package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/workqueue"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/crypto"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/telegram"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// FulfillmentService는 외부 API를 통한 상품권 자동 발급 파이프라인입니다.
type FulfillmentService struct {
	db         *gorm.DB
	issuers    map[string]interfaces.VoucherIssuer
	encKey     string
	paymentPP  interfaces.IPaymentProvider
	notifyPool *workqueue.WorkerPool // 텔레그램 알림 비동기 큐
	eventSvc   *OrderEventService    // 주문 이벤트 기록 (부분 Event Sourcing)
}

func NewFulfillmentService(
	db *gorm.DB,
	issuers map[string]interfaces.VoucherIssuer,
	encKey string,
	pp interfaces.IPaymentProvider,
) *FulfillmentService {
	return &FulfillmentService{
		db:        db,
		issuers:   issuers,
		encKey:    encKey,
		paymentPP: pp,
	}
}

// SetNotifyPool은 텔레그램 알림 워커 풀을 주입합니다 (setter injection).
func (s *FulfillmentService) SetNotifyPool(pool *workqueue.WorkerPool) {
	s.notifyPool = pool
}

// SetOrderEventService는 주문 이벤트 기록 서비스를 주입합니다 (setter injection).
func (s *FulfillmentService) SetOrderEventService(svc *OrderEventService) {
	s.eventSvc = svc
}

const maxRetries = 3

var retryDelays = []time.Duration{0, 2 * time.Second, 5 * time.Second}

// ProcessPendingOrders는 크론에서 호출되어 PAID 상태의 API 발급 주문을 처리합니다.
func (s *FulfillmentService) ProcessPendingOrders() {
	var orders []domain.Order
	err := s.db.
		Where("Status = ?", "PAID").
		Where("Id IN (SELECT DISTINCT OI.OrderId FROM OrderItems OI JOIN Products P ON P.Id = OI.ProductId WHERE P.FulfillmentType = ?)", "API").
		Where("NOT EXISTS (SELECT 1 FROM IssuanceLogs WHERE IssuanceLogs.OrderId = Orders.Id AND IssuanceLogs.Status = 'SUCCESS')").
		Find(&orders).Error
	if err != nil {
		logger.Log.Error("fulfillment: failed to query pending orders", zap.Error(err))
		return
	}

	// 배치 전체 타임아웃 (30분) — 크론 스케줄러 블로킹 방지
	batchCtx, batchCancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer batchCancel()

	for _, order := range orders {
		// 배치 타임아웃 초과 시 나머지 주문은 다음 크론에서 처리
		if batchCtx.Err() != nil {
			logger.Log.Warn("fulfillment: 배치 타임아웃 초과, 나머지 주문은 다음 크론에서 처리",
				zap.Int("remaining", len(orders)),
			)
			break
		}

		orderCtx, orderCancel := context.WithTimeout(batchCtx, 5*time.Minute)
		if err := s.FulfillOrder(orderCtx, order.ID); err != nil {
			logger.Log.Error("fulfillment: order failed",
				zap.Int("orderId", order.ID),
				zap.Error(err),
			)
		}
		orderCancel()
	}
}

// FulfillOrder는 단일 주문의 발급 파이프라인을 실행합니다.
func (s *FulfillmentService) FulfillOrder(ctx context.Context, orderID int) error {
	var order domain.Order
	if err := s.db.Preload("OrderItems.Product").First(&order, orderID).Error; err != nil {
		return apperror.NotFound("주문 조회 실패")
	}

	if order.Status != "PAID" {
		return nil
	}

	// 발급 시작 이벤트 기록
	if s.eventSvc != nil {
		s.eventSvc.Record(nil, order.ID, domain.EventFulfillmentStarted, nil, "SYSTEM", nil)
	}

	// 멱등성: 루프 전 단일 쿼리로 이미 성공한 아이템 ID를 일괄 조회 (N+1 방지)
	var successItemIDs []int
	s.db.Model(&domain.IssuanceLog{}).
		Where("\"OrderId\" = ? AND \"Status\" = 'SUCCESS'", orderID).
		Pluck("\"OrderItemId\"", &successItemIDs)
	successSet := make(map[int]bool, len(successItemIDs))
	for _, id := range successItemIDs {
		successSet[id] = true
	}

	for _, item := range order.OrderItems {
		product := item.Product
		if product.FulfillmentType != "API" {
			continue
		}

		// 멱등성: 이미 성공한 아이템은 건너뜀
		if successSet[item.ID] {
			continue
		}

		if err := s.fulfillItem(ctx, &order, &item, &product); err != nil {
			return err
		}
	}

	// 모든 아이템 발급 완료 → DELIVERED
	now := time.Now()
	if err := s.db.Model(&domain.Order{}).Where("Id = ? AND Status = 'PAID'", orderID).
		Updates(map[string]any{
			"Status":            "DELIVERED",
			"DigitalDeliveryAt": now,
		}).Error; err != nil {
		return err
	}

	// 발급 완료 이벤트 기록
	if s.eventSvc != nil {
		var voucherCount int64
		s.db.Model(&domain.VoucherCode{}).Where("OrderId = ?", orderID).Count(&voucherCount)
		s.eventSvc.Record(nil, orderID, domain.EventFulfillmentCompleted, nil, "SYSTEM", map[string]interface{}{
			"voucherCount": voucherCount,
		})
	}

	return nil
}

func (s *FulfillmentService) fulfillItem(
	ctx context.Context,
	order *domain.Order,
	item *domain.OrderItem,
	product *domain.Product,
) error {
	if product.ProviderCode == nil || *product.ProviderCode == "" {
		return apperror.Validationf("상품 %d: ProviderCode 미설정", product.ID)
	}

	issuer, ok := s.issuers[*product.ProviderCode]
	if !ok {
		return apperror.Validationf("상품 %d: 알 수 없는 Provider '%s'", product.ID, *product.ProviderCode)
	}

	productCode := ""
	if product.ProviderProductCode != nil {
		productCode = *product.ProviderProductCode
	}

	orderCode := ""
	if order.OrderCode != nil {
		orderCode = *order.OrderCode
	}
	req := interfaces.IssueRequest{
		ProductCode: productCode,
		Quantity:    item.Quantity,
		OrderCode:   orderCode,
	}

	// IssuanceLog 생성
	reqStr := ""
	if reqJSON, err := json.Marshal(req); err != nil {
		logger.Log.Warn("fulfillment: failed to marshal request payload", zap.Error(err))
	} else {
		reqStr = string(reqJSON)
	}
	logEntry := domain.IssuanceLog{
		OrderID:        order.ID,
		OrderItemID:    item.ID,
		ProductID:      product.ID,
		ProviderCode:   *product.ProviderCode,
		Status:         "PENDING",
		RequestPayload: &reqStr,
	}
	if err := s.db.Create(&logEntry).Error; err != nil {
		logger.Log.Error("fulfillment: failed to create issuance log",
			zap.Int("orderId", order.ID),
			zap.Error(err),
		)
	}

	// 재시도 루프
	var vouchers []interfaces.IssuedVoucher
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 && attempt < len(retryDelays) {
			delay := retryDelays[attempt]
			select {
			case <-ctx.Done():
				return apperror.Internal("fulfillment cancelled", ctx.Err())
			case <-time.After(delay):
			}
		}

		logEntry.AttemptCount = attempt + 1
		vouchers, lastErr = issuer.Issue(ctx, req)
		if lastErr == nil {
			break
		}

		logger.Log.Warn("fulfillment: issue attempt failed",
			zap.Int("orderId", order.ID),
			zap.Int("attempt", attempt+1),
			zap.Error(lastErr),
		)
	}

	if lastErr != nil {
		return s.handleFailure(order, &logEntry, lastErr)
	}

	// 성공: VoucherCode 생성
	for _, v := range vouchers {
		encrypted, err := crypto.Encrypt(v.PinCode, s.encKey)
		if err != nil {
			return apperror.Internal("PIN 암호화 실패", err)
		}

		pinHash := crypto.SHA256Hash(v.PinCode)
		txRef := v.TransactionRef

		vc := domain.VoucherCode{
			ProductID:              product.ID,
			PinCode:                encrypted,
			PinHash:                pinHash,
			Status:                 "SOLD",
			OrderID:                &order.ID,
			SoldAt:                 timePtr(time.Now()),
			ExpiredAt:              v.ExpiresAt,
			Source:                 "API",
			ExternalTransactionRef: strPtr(txRef),
		}
		if v.SecurityCode != "" {
			encSec, encErr := crypto.Encrypt(v.SecurityCode, s.encKey)
			if encErr != nil {
				logger.Log.Error("SecurityCode 암호화 실패",
					zap.Int("orderId", order.ID),
					zap.Error(encErr),
				)
				return fmt.Errorf("SecurityCode 암호화 실패: %w", encErr)
			}
			vc.SecurityCode = &encSec
		}
		if v.GiftNumber != "" {
			vc.GiftNumber = &v.GiftNumber
		}
		if err := s.db.Create(&vc).Error; err != nil {
			return apperror.Internal("VoucherCode 저장 실패", err)
		}
	}

	// 로그 성공 처리
	now := time.Now()
	maskedResp := maskPINsInResponse(vouchers)
	logEntry.Status = "SUCCESS"
	logEntry.CompletedAt = &now
	logEntry.ResponsePayload = &maskedResp
	if len(vouchers) > 0 {
		logEntry.TransactionRef = &vouchers[0].TransactionRef
	}
	if logEntry.ID > 0 {
		if err := s.db.Model(&logEntry).Updates(map[string]any{
			"Status":          logEntry.Status,
			"CompletedAt":     logEntry.CompletedAt,
			"ResponsePayload": logEntry.ResponsePayload,
			"TransactionRef":  logEntry.TransactionRef,
			"AttemptCount":    logEntry.AttemptCount,
		}).Error; err != nil {
			logger.Log.Error("fulfillment: failed to update success log",
				zap.Int("orderId", order.ID),
				zap.Error(err),
			)
		}
	}

	logger.Log.Info("fulfillment: order item issued",
		zap.Int("orderId", order.ID),
		zap.Int("orderItemId", item.ID),
		zap.Int("count", len(vouchers)),
	)

	return nil
}

func (s *FulfillmentService) handleFailure(order *domain.Order, logEntry *domain.IssuanceLog, issueErr error) error {
	now := time.Now()
	errMsg := issueErr.Error()
	logEntry.Status = "FAILED"
	logEntry.ErrorMessage = &errMsg
	logEntry.CompletedAt = &now

	// 주문 취소
	adminNote := fmt.Sprintf("API_ISSUANCE_FAILURE: %s", errMsg)
	if err := s.db.Model(&domain.Order{}).Where("Id = ?", order.ID).Updates(map[string]any{
		"Status":    "CANCELLED",
		"AdminNote": adminNote,
	}).Error; err != nil {
		logger.Log.Error("fulfillment: failed to cancel order",
			zap.Int("orderId", order.ID),
			zap.Error(err),
		)
	}

	// 환불 시도
	if order.PaymentKey != nil && *order.PaymentKey != "" {
		_, refundErr := s.paymentPP.RefundPayment(*order.PaymentKey, "상품권 발급 실패로 인한 자동 환불")
		if refundErr != nil {
			logEntry.Status = "FAILED_REFUND_PENDING"
			refundErrMsg := fmt.Sprintf("%s | 환불 실패: %s", errMsg, refundErr.Error())
			logEntry.ErrorMessage = &refundErrMsg
			// 환불 실패도 텔레그램 알림 (워커 풀로 비동기 발송)
			ocStr := ""
			if order.OrderCode != nil {
				ocStr = *order.OrderCode
			}
			refundAlertMsg := fmt.Sprintf(
				"🚨 <b>발급 실패 + 환불 실패</b>\n"+
					"<b>주문:</b> <code>%s</code>\n"+
					"<b>발급 에러:</b> %s\n"+
					"<b>환불 에러:</b> %s\n"+
					"<b>수동 환불 필요</b>",
				ocStr, errMsg, refundErr.Error(),
			)
			if s.notifyPool != nil {
				if submitErr := s.notifyPool.Submit(workqueue.TelegramAlertJob{
					Token:   telegram.GetGlobalToken(),
					ChatID:  telegram.GetGlobalChatID(),
					Message: refundAlertMsg,
				}); submitErr != nil {
					logger.Log.Warn("환불 실패 알림 큐 제출 실패", zap.Error(submitErr))
				}
			} else {
				go telegram.SendAlert(telegram.GetGlobalToken(), telegram.GetGlobalChatID(), refundAlertMsg)
			}
		} else {
			logEntry.Status = "REFUNDED"
		}
	}

	if logEntry.ID > 0 {
		if err := s.db.Model(logEntry).Updates(map[string]any{
			"Status":         logEntry.Status,
			"ErrorMessage":   logEntry.ErrorMessage,
			"CompletedAt":    logEntry.CompletedAt,
			"AttemptCount":   logEntry.AttemptCount,
			"TransactionRef": logEntry.TransactionRef,
		}).Error; err != nil {
			logger.Log.Error("fulfillment: failed to update failure log",
				zap.Int("orderId", order.ID),
				zap.Error(err),
			)
		}
	}

	// 텔레그램 알림 (워커 풀로 비동기 발송)
	oc := ""
	if order.OrderCode != nil {
		oc = *order.OrderCode
	}
	issuanceFailureMsg := fmt.Sprintf(
		"🚨 <b>상품권 발급 실패</b>\n"+
			"<b>주문:</b> <code>%s</code>\n"+
			"<b>사유:</b> %s\n"+
			"<b>시도:</b> %d/%d\n"+
			"<b>처리:</b> %s\n"+
			"<b>Time:</b> %s",
		oc, errMsg, logEntry.AttemptCount, maxRetries, logEntry.Status, time.Now().Format("2006-01-02 15:04:05"),
	)
	if s.notifyPool != nil {
		if submitErr := s.notifyPool.Submit(workqueue.TelegramAlertJob{
			Token:   telegram.GetGlobalToken(),
			ChatID:  telegram.GetGlobalChatID(),
			Message: issuanceFailureMsg,
		}); submitErr != nil {
			logger.Log.Warn("발급 실패 알림 큐 제출 실패", zap.Error(submitErr))
		}
	} else {
		go telegram.SendAlert(telegram.GetGlobalToken(), telegram.GetGlobalChatID(), issuanceFailureMsg)
	}

	logger.Log.Error("fulfillment: final failure",
		zap.Int("orderId", order.ID),
		zap.String("status", logEntry.Status),
		zap.Error(issueErr),
	)

	// 발급 최종 실패 이벤트 기록
	if s.eventSvc != nil {
		s.eventSvc.Record(nil, order.ID, domain.EventFulfillmentFailed, nil, "SYSTEM", map[string]interface{}{
			"error": issueErr.Error(),
		})
	}

	return issueErr
}

// ── Saga 예시 (향후 확장용) ──────────────────────────────────────────────────
//
// fulfillWithSaga는 Saga 패턴으로 발급을 실행합니다 (향후 확장용).
// 현재는 기존 fulfillItem + handleFailure 흐름과 동일한 결과를 냅니다.
// 이 메서드는 아직 호출되지 않으며, FulfillOrder/fulfillItem을 대체하지 않습니다.
//
// 사용 시나리오: 외부 MSA 분리, 결제 서비스 분리 등 분산 트랜잭션이 필요할 때.
func (s *FulfillmentService) fulfillWithSaga(ctx context.Context, order *domain.Order, items []domain.OrderItem) error {
	var issuedVouchers []interfaces.IssuedVoucher

	saga := NewSaga("order-fulfillment").
		AddStep(SagaStep{
			Name: "issue_vouchers",
			Execute: func(ctx context.Context) error {
				var allVouchers []interfaces.IssuedVoucher
				for i := range items {
					item := &items[i]
					product := item.Product
					if product.FulfillmentType != "API" || product.ProviderCode == nil || *product.ProviderCode == "" {
						continue
					}
					issuer, ok := s.issuers[*product.ProviderCode]
					if !ok {
						continue
					}
					productCode := ""
					if product.ProviderProductCode != nil {
						productCode = *product.ProviderProductCode
					}
					orderCode := ""
					if order.OrderCode != nil {
						orderCode = *order.OrderCode
					}
					vouchers, err := issuer.Issue(ctx, interfaces.IssueRequest{
						ProductCode: productCode,
						Quantity:    item.Quantity,
						OrderCode:   orderCode,
					})
					if err != nil {
						return err
					}
					allVouchers = append(allVouchers, vouchers...)
				}
				issuedVouchers = allVouchers
				return nil
			},
			Compensate: nil, // 외부 API 발급 취소는 불가 — 수동 처리 필요
		}).
		AddStep(SagaStep{
			Name: "save_voucher_codes",
			Execute: func(ctx context.Context) error {
				for _, v := range issuedVouchers {
					encrypted, err := crypto.Encrypt(v.PinCode, s.encKey)
					if err != nil {
						return err
					}
					vc := domain.VoucherCode{
						PinCode:                encrypted,
						PinHash:                crypto.SHA256Hash(v.PinCode),
						Status:                 "SOLD",
						OrderID:                &order.ID,
						SoldAt:                 timePtr(time.Now()),
						ExpiredAt:              v.ExpiresAt,
						Source:                 "API",
						ExternalTransactionRef: strPtr(v.TransactionRef),
					}
					if err := s.db.Create(&vc).Error; err != nil {
						return err
					}
				}
				return nil
			},
			Compensate: func(ctx context.Context) error {
				// 이미 저장된 VoucherCode를 삭제하여 DB 일관성 복구
				return s.db.Where("\"OrderId\" = ? AND \"Source\" = 'API'", order.ID).
					Delete(&domain.VoucherCode{}).Error
			},
		}).
		AddStep(SagaStep{
			Name: "mark_delivered",
			Execute: func(ctx context.Context) error {
				now := time.Now()
				return s.db.Model(&domain.Order{}).Where("\"Id\" = ? AND \"Status\" = 'PAID'", order.ID).
					Updates(map[string]any{
						"Status":            "DELIVERED",
						"DigitalDeliveryAt": now,
					}).Error
			},
			Compensate: func(ctx context.Context) error {
				// 배송 완료 마킹 실패 시 주문을 취소하고 환불 처리
				if order.PaymentKey != nil && *order.PaymentKey != "" {
					_, _ = s.paymentPP.RefundPayment(*order.PaymentKey, "발급 Saga 실패로 인한 자동 환불")
				}
				return s.db.Model(&domain.Order{}).Where("\"Id\" = ?", order.ID).
					Update("\"Status\"", "CANCELLED").Error
			},
		})

	return saga.Execute(ctx)
}

func maskPINsInResponse(vouchers []interfaces.IssuedVoucher) string {
	type masked struct {
		PinCode        string `json:"pinCode"`
		TransactionRef string `json:"transactionRef"`
	}
	var list []masked
	for _, v := range vouchers {
		pin := "****"
		if len(v.PinCode) > 4 {
			pin = strings.Repeat("*", len(v.PinCode)-4) + v.PinCode[len(v.PinCode)-4:]
		}
		list = append(list, masked{PinCode: pin, TransactionRef: v.TransactionRef})
	}
	b, _ := json.Marshal(list)
	return string(b)
}

func timePtr(t time.Time) *time.Time { return &t }
func strPtr(s string) *string        { return &s }
