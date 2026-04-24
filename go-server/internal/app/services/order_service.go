// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// Order Service는 주문 생성, 결제 확인, 바우처 할당 등 주문의 전체 생명주기를 담당합니다.
package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/repository"
	"seedream-gift-server/internal/infra/workqueue"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/crypto"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/telegram"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// OrderService는 주문 생성, 결제 처리, 취소 등 주문 라이프사이클 전반의 비즈니스 로직을 조율합니다.
type OrderService struct {
	db              *gorm.DB
	orderRepo       *repository.BaseRepository[domain.Order]
	itemRepo        *repository.BaseRepository[domain.OrderItem]
	voucherRepo     *repository.BaseRepository[domain.VoucherCode]
	paymentProvider interfaces.IPaymentProvider
	cfg             *config.Config
	config          ConfigProvider
	fraudChecker    interfaces.FraudChecker
	notifyPool      *workqueue.WorkerPool // 텔레그램 알림 비동기 큐
	auditPool       *workqueue.WorkerPool // 감사 로그 비동기 큐
	eventSvc        *OrderEventService    // 주문 이벤트 기록 (부분 Event Sourcing)
}

// NewOrderService는 데이터베이스 연결 및 외부 결제 모듈을 주입받아 OrderService를 초기화합니다.
func NewOrderService(db *gorm.DB, pp interfaces.IPaymentProvider, cfg *config.Config, configProvider ConfigProvider) *OrderService {
	return &OrderService{
		db:              db,
		orderRepo:       repository.NewBaseRepository[domain.Order](db),
		itemRepo:        repository.NewBaseRepository[domain.OrderItem](db),
		voucherRepo:     repository.NewBaseRepository[domain.VoucherCode](db),
		paymentProvider: pp,
		cfg:             cfg,
		config:          configProvider,
	}
}

// SetFraudChecker는 사기 조회 서비스를 주입합니다 (setter injection).
func (s *OrderService) SetFraudChecker(fc interfaces.FraudChecker) {
	s.fraudChecker = fc
}

// SetWorkerPools는 비동기 작업 큐를 주입합니다 (setter injection).
// notifyPool: 텔레그램 알림 큐, auditPool: 감사 로그 큐
func (s *OrderService) SetWorkerPools(notifyPool, auditPool *workqueue.WorkerPool) {
	s.notifyPool = notifyPool
	s.auditPool = auditPool
}

// SetOrderEventService는 주문 이벤트 기록 서비스를 주입합니다 (setter injection).
func (s *OrderService) SetOrderEventService(svc *OrderEventService) {
	s.eventSvc = svc
}

// CreateOrderInput은 주문 생성 API 요청 시 전달받는 데이터 구조입니다.
type CreateOrderInput struct {
	Items []struct {
		ProductID int `json:"productId" binding:"required"`
		Quantity  int `json:"quantity" binding:"required,min=1"`
	} `json:"items" binding:"required,dive"`
	PaymentMethod  string `json:"paymentMethod"`
	IdempotencyKey string `json:"idempotencyKey"` // 중복 주문 방지용 키
	ShippingMethod string `json:"shippingMethod"`
	RecipientName  string `json:"recipientName"`
	RecipientPhone string `json:"recipientPhone"`
	RecipientAddr  string `json:"recipientAddr"`
	RecipientZip   string `json:"recipientZip"`
	// 선물하기 필드: 값이 있으면 '선물하기' 프로세스로 처리됨
	GiftReceiverEmail string `json:"giftReceiverEmail"`
	GiftMessage       string `json:"giftMessage"`
	// 현금영수증 발행 정보
	CashReceiptType   string `json:"cashReceiptType"`
	CashReceiptNumber string `json:"cashReceiptNumber"`
}

// generateOrderCode는 날짜와 랜덤 접미사를 조합하여 고유한 주문 번호를 생성합니다.
// 8바이트 랜덤(2^64) → 충돌 확률 사실상 0
func generateOrderCode() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("주문 코드 생성 중 오류 발생: %w", err)
	}
	suffix := strings.ToUpper(hex.EncodeToString(b))
	now := time.Now()
	return fmt.Sprintf("ORD-%d%02d%02d-%s", now.Year(), now.Month(), now.Day(), suffix), nil
}

// CreateOrder는 주문의 전 과정을 하나의 트랜잭션으로 처리합니다.
// 1. 멱등성 확인 2. 상품 유효성 검증 3. 구매 한도 체크 4. 주문서 생성 5. 바우처 가점유 6. 선물하기 연동
func (s *OrderService) CreateOrder(ctx context.Context, userID int, input CreateOrderInput) (*domain.Order, error) {
	// KYC 검증 필수: 미인증 사용자는 주문 불가
	var orderUser domain.User
	if err := s.db.Select("Id", "KycStatus").First(&orderUser, userID).Error; err != nil {
		return nil, apperror.NotFound("사용자를 찾을 수 없습니다")
	}
	if orderUser.KycStatus != "VERIFIED" {
		return nil, apperror.Validation("본인 인증(KYC)을 완료해야 주문할 수 있습니다. 마이페이지에서 인증을 진행해주세요.")
	}

	// 사기 조회 (트랜잭션 밖 — 외부 API 호출을 트랜잭션 안에 넣지 않음)
	var fraudResult *interfaces.FraudCheckResult
	if s.fraudChecker != nil {
		var fcErr error
		fraudResult, fcErr = s.fraudChecker.Check(userID, "ORDER")
		if fcErr != nil {
			logger.Log.Error("사기 조회 실패 (fail-closed) → FRAUD_HOLD 적용",
				zap.Error(fcErr), zap.Int("userId", userID))
			fraudResult = &interfaces.FraudCheckResult{IsFlagged: true}
		}
	}

	var order *domain.Order

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. 멱등성 체크: 동일한 IdempotencyKey로 요청이 온 경우 기존 주문을 반환하여 중복 결제 방지
		if input.IdempotencyKey != "" {
			var existing domain.Order
			if err := tx.Set("gorm:query_option", "WITH (UPDLOCK)").
				Where("IdempotencyKey = ? AND UserId = ?", input.IdempotencyKey, userID).
				First(&existing).Error; err == nil {
				tx.Preload("OrderItems.Product").Preload("VoucherCodes").First(&existing, existing.ID)
				order = &existing
				return nil
			}
		}

		// 2. 상품 조회 및 유효성 검증
		productIDs := make([]int, len(input.Items))
		for i, item := range input.Items {
			productIDs[i] = item.ProductID
		}

		var products []domain.Product
		// 활성화된(IsActive=true) 상품만 주문 가능
		if err := tx.Where("Id IN ? AND IsActive = ?", productIDs, true).Find(&products).Error; err != nil {
			return apperror.Internal("상품 정보를 가져오지 못했습니다", err)
		}

		if len(products) != len(productIDs) {
			return apperror.Validation("비활성 상품이 포함되어 있거나 존재하지 않는 상품이 있습니다")
		}

		productMap := make(map[int]domain.Product, len(products))
		for _, p := range products {
			productMap[p.ID] = p
		}

		// 2-1. 혼합 주문 차단: STOCK과 API 발급 방식을 한 주문에 혼합할 수 없음
		hasStock, hasAPI := false, false
		for _, p := range products {
			if p.FulfillmentType == "API" {
				hasAPI = true
			} else {
				hasStock = true
			}
		}
		if hasStock && hasAPI {
			return apperror.Validation("일부 상품은 별도 주문이 필요합니다. 상품을 나누어 주문해주세요.")
		}

		// 3. 주문 총액 계산 및 미결제 주문 수 제한 확인
		totalAmount := decimal.Zero
		for _, item := range input.Items {
			product := productMap[item.ProductID]
			itemPrice := product.BuyPrice.Decimal.Mul(decimal.NewFromInt(int64(item.Quantity)))
			totalAmount = totalAmount.Add(itemPrice)
		}

		// 동일 사용자의 동시 주문을 직렬화하여 한도 초과를 방지합니다.
		var lockUser domain.User
		if err := tx.Set("gorm:query_option", "WITH (UPDLOCK)").
			Select("Id").Where("Id = ?", userID).First(&lockUser).Error; err != nil {
			return apperror.Internal("사용자 정보를 확인할 수 없습니다", err)
		}

		// 동시 진행 가능한 결제 대기(PENDING) 주문 수를 SiteConfig로 제한하여 악의적 재고 점유 방지
		var pendingCount int64
		tx.Model(&domain.Order{}).Where("UserId = ? AND Status = 'PENDING'", userID).Count(&pendingCount)
		maxPending := s.config.GetConfigInt("MAX_PENDING_ORDERS", 3)
		if pendingCount >= int64(maxPending) {
			return apperror.Validationf("미결제 주문이 %d건 있습니다. 결제를 완료하거나 취소 후 새 주문을 해주세요", pendingCount)
		}

		// 4. 구매 한도 검증 (회원별 커스텀 한도 또는 시스템 기본 설정값 적용, ConfigProvider 캐시 활용)
		var user domain.User
		if err := tx.Select("Id", "CustomLimitPerTx", "CustomLimitPerDay", "CustomLimitPerMonth", "CustomLimitPerYear").First(&user, userID).Error; err != nil {
			return apperror.Internal("사용자 정보를 확인할 수 없습니다", err)
		}

		perOrderLimit := s.config.GetConfigFloat("LIMIT_PER_ORDER", 500000)
		dailyLimitCfg := s.config.GetConfigFloat("LIMIT_PER_DAY", 1000000)
		monthlyLimitCfg := s.config.GetConfigFloat("LIMIT_PER_MONTH", 50000000)

		// 1회 주문 한도 체크
		if user.CustomLimitPerTx != nil {
			perOrderLimit = user.CustomLimitPerTx.InexactFloat64()
		}
		if totalAmount.GreaterThan(decimal.NewFromFloat(perOrderLimit)) {
			return apperror.Validationf("1회 주문 한도(%.0f원)를 초과했습니다", perOrderLimit)
		}

		// 일일/월간 한도 체크 (실제 결제 완료된 건들만 합산하여 비교)
		dailyLimit := dailyLimitCfg
		if user.CustomLimitPerDay != nil {
			dailyLimit = user.CustomLimitPerDay.InexactFloat64()
		}
		nowKST := time.Now().In(kstLoc)
		todayKST := time.Date(nowKST.Year(), nowKST.Month(), nowKST.Day(), 0, 0, 0, 0, kstLoc)
		monthStart := time.Date(nowKST.Year(), nowKST.Month(), 1, 0, 0, 0, 0, kstLoc)

		// 단일 쿼리로 일일/월간 사용액 동시 조회 (UTC 변환 — DB는 UTC, 비교는 KST 기준)
		var usageSummary struct {
			DailyUsed   string
			MonthlyUsed string
		}
		todayUTC := todayKST.UTC()
		monthUTC := monthStart.UTC()
		tx.Model(&domain.Order{}).
			Where("UserId = ? AND Status IN ('PAID','DELIVERED','COMPLETED') AND CreatedAt >= ?", userID, monthUTC).
			Select(`
				CAST(COALESCE(SUM(CASE WHEN CreatedAt >= ? THEN TotalAmount ELSE 0 END), 0) AS VARCHAR(30)) as DailyUsed,
				CAST(COALESCE(SUM(TotalAmount), 0) AS VARCHAR(30)) as MonthlyUsed
			`, todayUTC).
			Scan(&usageSummary)

		dailyUsed, _ := decimal.NewFromString(usageSummary.DailyUsed)
		if dailyUsed.Add(totalAmount).GreaterThan(decimal.NewFromFloat(dailyLimit)) {
			return apperror.Validationf("일일 구매 한도(%s원)를 초과했습니다. 내일 다시 시도해주세요.", formatAmount(dailyLimit))
		}

		// 월간 한도 체크
		monthlyLimit := monthlyLimitCfg
		if user.CustomLimitPerMonth != nil {
			monthlyLimit = user.CustomLimitPerMonth.InexactFloat64()
		}
		monthlyUsed, _ := decimal.NewFromString(usageSummary.MonthlyUsed)
		if monthlyUsed.Add(totalAmount).GreaterThan(decimal.NewFromFloat(monthlyLimit)) {
			return apperror.Validationf("월간 구매 한도(%s원)를 초과했습니다. 다음 달에 다시 시도해주세요.", formatAmount(monthlyLimit))
		}

		// 5. 주문 레코드 생성 및 초기 상태 설정
		orderCode, err := generateOrderCode()
		if err != nil {
			return apperror.Internal("주문 코드 생성 실패", err)
		}
		var idempotencyKey *string
		if input.IdempotencyKey != "" {
			idempotencyKey = &input.IdempotencyKey
		}
		var cashReceiptType *string
		if input.CashReceiptType != "" {
			cashReceiptType = &input.CashReceiptType
		}
		var cashReceiptNumber *string
		if input.CashReceiptNumber != "" {
			cashReceiptNumber = &input.CashReceiptNumber
		}
		orderStatus := "PENDING"
		var adminNote *string
		if fraudResult != nil && fraudResult.IsFlagged {
			orderStatus = "FRAUD_HOLD"
			note := fmt.Sprintf("FRAUD_HOLD: %s [sources: %s]",
				fraudResult.Reason, strings.Join(fraudResult.FlagSources, ", "))
			adminNote = &note
		}

		order = &domain.Order{
			UserID:            userID,
			TotalAmount:       domain.NewNumericDecimal(totalAmount),
			Status:            orderStatus,
			PaymentMethod:     &input.PaymentMethod,
			IdempotencyKey:    idempotencyKey,
			ShippingMethod:    &input.ShippingMethod,
			RecipientName:     &input.RecipientName,
			RecipientPhone:    &input.RecipientPhone,
			RecipientAddr:     &input.RecipientAddr,
			RecipientZip:      &input.RecipientZip,
			OrderCode:         &orderCode,
			CashReceiptType:   cashReceiptType,
			CashReceiptNumber: cashReceiptNumber,
			AdminNote:         adminNote,
		}

		if err := tx.Create(order).Error; err != nil {
			return err
		}

		// 입금 및 취소 기한 설정 (SiteConfig 기반)
		now := time.Now()
		paymentMinutes := s.config.GetConfigInt("PAYMENT_DEADLINE_MINUTES", 30)
		paymentDeadline := now.Add(time.Duration(paymentMinutes) * time.Minute)
		withdrawalDays := s.config.GetConfigInt("WITHDRAWAL_DEADLINE_DAYS", 7)
		withdrawalDeadline := now.AddDate(0, 0, withdrawalDays)
		order.PaymentDeadlineAt = &paymentDeadline
		order.WithdrawalDeadlineAt = &withdrawalDeadline
		if err := tx.Model(order).Updates(map[string]any{
			"PaymentDeadlineAt":    order.PaymentDeadlineAt,
			"WithdrawalDeadlineAt": order.WithdrawalDeadlineAt,
		}).Error; err != nil {
			return err
		}

		// 주문 생성 이벤트 기록
		if s.eventSvc != nil {
			s.eventSvc.Record(tx, order.ID, domain.EventOrderCreated, &userID, "USER", map[string]interface{}{
				"totalAmount": order.TotalAmount,
				"itemCount":   len(input.Items),
			})
		}

		// FRAUD_HOLD 이벤트 기록
		if s.eventSvc != nil && orderStatus == "FRAUD_HOLD" {
			s.eventSvc.Record(tx, order.ID, domain.EventOrderFraudHeld, nil, "SYSTEM", map[string]interface{}{
				"reason": "fraud check flagged",
			})
		}

		// 6. 상세 주문 항목 생성 및 디지털 바우처 선점(RESERVE)
		for _, item := range input.Items {
			product := productMap[item.ProductID]

			orderItem := domain.OrderItem{
				OrderID:   order.ID,
				ProductID: item.ProductID,
				Quantity:  item.Quantity,
				Price:     product.BuyPrice,
			}
			if err := tx.Create(&orderItem).Error; err != nil {
				return err
			}

			// 디지털 상품인 경우, AVAILABLE 상태인 바우처를 즉시 점유하여 다른 사용자와의 경합 방지
			// API 발급 상품은 결제 후 외부 API에서 발급하므로 예약 단계 건너뜀
			// FRAUD_HOLD 상태에서는 바우처 예약을 건너뛰어 재고 점유를 방지
			if orderStatus != "FRAUD_HOLD" && product.Type == "DIGITAL" && product.FulfillmentType != "API" {
				var voucherIDs []int
				// UPDLOCK: 선택한 행을 잠가 다른 트랜잭션이 대기하도록 함
				// READPAST 제거: 잠긴 행을 건너뛰면 동시 트랜잭션이 같은 바우처를 이중 할당할 위험
				if err := tx.Raw(
					`SELECT TOP(?) Id FROM VoucherCodes WITH (UPDLOCK)
					 WHERE ProductId = ? AND Status = 'AVAILABLE'
					 ORDER BY CASE WHEN Source = 'ADMIN' OR Source IS NULL THEN 0 ELSE 1 END, CreatedAt ASC`,
					item.Quantity, item.ProductID,
				).Scan(&voucherIDs).Error; err != nil {
					return err
				}
				if len(voucherIDs) < item.Quantity {
					return apperror.Validationf("상품 %s의 재고가 부족합니다", product.Name)
				}

				if err := tx.Model(&domain.VoucherCode{}).Where("Id IN ?", voucherIDs).Updates(map[string]any{
					"OrderId": order.ID,
					"Status":  "RESERVED",
				}).Error; err != nil {
					return err
				}
			}
		}

		// 7. 선물하기 연동: 이메일을 통해 수신 사용자를 찾아 선물 기록 생성
		if input.GiftReceiverEmail != "" {
			// FRAUD_HOLD 주문은 선물 불가
			if orderStatus == "FRAUD_HOLD" {
				return apperror.Validation("현재 이 주문으로 선물을 보낼 수 없습니다. 고객센터에 문의해주세요.")
			}

			var receiver domain.User
			if err := tx.Where("Email = ?", input.GiftReceiverEmail).First(&receiver).Error; err != nil {
				return apperror.NotFoundf("선물 수신자를 찾을 수 없습니다: %s", input.GiftReceiverEmail)
			}
			// 자기 자신에게 선물 방지
			if receiver.ID == userID {
				return apperror.Validation("자기 자신에게는 선물할 수 없습니다")
			}

			// 선물 만료일 설정 (30일)
			giftExpiryDays := s.config.GetConfigInt("GIFT_EXPIRY_DAYS", 30)
			expiresAt := time.Now().AddDate(0, 0, giftExpiryDays)
			gift := &domain.Gift{
				SenderID:   userID,
				ReceiverID: receiver.ID,
				OrderID:    order.ID,
				Status:     "SENT",
				ExpiresAt:  &expiresAt,
			}
			if input.GiftMessage != "" {
				gift.Message = &input.GiftMessage
			}
			if err := tx.Create(gift).Error; err != nil {
				return apperror.Internal("선물 레코드 생성 실패", err)
			}
		}

		return tx.Preload("OrderItems.Product").Preload("VoucherCodes").First(order, order.ID).Error
	})

	// FRAUD_HOLD 시 텔레그램 알림 (트랜잭션 밖 — 워커 풀로 비동기 발송)
	if err == nil && order != nil && order.Status == "FRAUD_HOLD" && fraudResult != nil {
		msg := fmt.Sprintf(
			"🚨 <b>FRAUD_HOLD 주문 발생</b>\n"+
				"<b>주문:</b> <code>%s</code>\n"+
				"<b>금액:</b> %s원\n"+
				"<b>사유:</b> %s\n"+
				"<b>출처:</b> %s",
			stringVal(order.OrderCode),
			order.TotalAmount.String(),
			fraudResult.Reason,
			strings.Join(fraudResult.FlagSources, ", "),
		)
		if s.notifyPool != nil {
			if submitErr := s.notifyPool.Submit(workqueue.TelegramAlertJob{
				Token:   telegram.GetGlobalToken(),
				ChatID:  telegram.GetGlobalChatID(),
				Message: msg,
			}); submitErr != nil {
				logger.Log.Warn("FRAUD_HOLD 알림 큐 제출 실패", zap.Error(submitErr))
			}
		} else {
			go telegram.SendAlert(telegram.GetGlobalToken(), telegram.GetGlobalChatID(), msg)
		}
	}

	return order, err
}

func stringVal(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// formatAmount는 숫자를 천 단위 쉼표 포함 문자열로 변환합니다. (예: 1000000 → "1,000,000")
func formatAmount(amount float64) string {
	s := fmt.Sprintf("%.0f", amount)
	n := len(s)
	if n <= 3 {
		return s
	}
	var result []byte
	for i, c := range s {
		if i > 0 && (n-i)%3 == 0 {
			result = append(result, ',')
		}
		result = append(result, byte(c))
	}
	return string(result)
}

// ClearCartItems는 주문 완료 후 해당 상품의 장바구니 항목을 삭제합니다.
func (s *OrderService) ClearCartItems(userID int, productIDs []int) {
	if len(productIDs) == 0 {
		return
	}
	s.db.Where("UserId = ? AND ProductId IN ?", userID, productIDs).Delete(&domain.CartItem{})
}

// ProcessPayment는 결제 게이트웨이(PG)로부터 받은 결제 키를 검증하고 주문을 확정합니다.
// 결제 완료 시 바우처 상태를 'SOLD'로 변경하여 최종적으로 판매 완료 처리합니다.
func (s *OrderService) ProcessPayment(orderID int, userID int, paymentKey string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var order domain.Order
		if err := tx.Set("gorm:query_option", "WITH (UPDLOCK, ROWLOCK)").
			First(&order, orderID).Error; err != nil {
			return err
		}

		if order.UserID != userID {
			return apperror.Forbidden("해당 주문의 소유자가 아닙니다")
		}

		if order.Status != "PENDING" {
			return apperror.Validation("결제 대기 중인 주문만 처리할 수 있습니다")
		}

		// 결제 기한이 만료된 경우 처리 차단
		if order.PaymentDeadlineAt != nil && time.Now().After(*order.PaymentDeadlineAt) {
			return apperror.Validation("결제 기한이 만료되었습니다")
		}

		// 예약된 바우처 존재 여부 확인 (STOCK 상품의 경우)
		var reservedCount int64
		tx.Model(&domain.VoucherCode{}).Where("OrderId = ? AND Status = 'RESERVED'", orderID).Count(&reservedCount)
		var requiredQty int64
		tx.Model(&domain.OrderItem{}).Where("OrderId = ?", orderID).Select("COALESCE(SUM(Quantity), 0)").Scan(&requiredQty)
		// API 상품은 결제 후 발급하므로 reservedCount=0이 정상
		if requiredQty > 0 && reservedCount > 0 && reservedCount != requiredQty {
			logger.Log.Error("결제 시 바우처 수 불일치",
				zap.Int("orderId", orderID),
				zap.Int64("reserved", reservedCount),
				zap.Int64("required", requiredQty),
			)
			return apperror.Validation("주문 상품의 재고가 변경되었습니다. 다시 주문해주세요.")
		}

		// PG사 연동을 통한 실제 결제 여부 최종 검증
		res, err := s.paymentProvider.VerifyPayment(paymentKey, orderID, order.TotalAmount.InexactFloat64())
		if err != nil || !res.Success {
			return apperror.Internal("결제 검증 실패", err)
		}

		// 주문 상태를 '결제완료(PAID)'로 업데이트
		if err := tx.Model(&order).Updates(map[string]any{
			"Status":     "PAID",
			"PaymentKey": paymentKey,
		}).Error; err != nil {
			return apperror.Internal("주문 상태 업데이트 실패", err)
		}

		// 점유(RESERVED)되어 있던 바우처들을 판매완료(SOLD) 상태로 전환
		if err := tx.Model(&domain.VoucherCode{}).Where("OrderId = ?", orderID).Updates(map[string]any{
			"Status": "SOLD",
			"SoldAt": time.Now(),
		}).Error; err != nil {
			return apperror.Internal("바우처 판매 확정 처리 실패", err)
		}

		return nil
	})
}

// GetMyOrders는 로그인한 사용자의 최근 주문 내역을 조회합니다.
func (s *OrderService) GetMyOrders(userID int, params pagination.QueryParams) (pagination.PaginatedResponse[domain.Order], error) {
	var items []domain.Order
	var total int64

	db := s.db.Model(&domain.Order{}).Where("UserId = ?", userID)
	if err := db.Count(&total).Error; err != nil {
		return pagination.PaginatedResponse[domain.Order]{}, apperror.Internal("주문 수 조회 실패", err)
	}

	offset := (params.Page - 1) * params.Limit
	// 목록 조회 시에는 보안을 위해 바우처 코드(PIN) 등은 로드하지 않습니다.
	err := db.
		Select("Id", "OrderCode", "UserId", "TotalAmount", "Status", "PaymentMethod", "CreatedAt", "UpdatedAt").
		Preload("OrderItems", func(db *gorm.DB) *gorm.DB {
			return db.Select("Id", "OrderId", "ProductId", "Quantity", "Price")
		}).
		Preload("OrderItems.Product", func(db *gorm.DB) *gorm.DB {
			return db.Select("Id", "Name", "BrandCode", "Price", "ImageUrl")
		}).
		Order("Id DESC").Offset(offset).Limit(params.Limit).Find(&items).Error

	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), err
}

// CancelOrder는 결제 대기 중인 주문을 명시적으로 취소합니다.
// 취소 시 점유(RESERVED)되어 있던 바우처들은 다시 판매 가능(AVAILABLE) 상태로 해제됩니다.
func (s *OrderService) CancelOrder(orderID, userID int) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var order domain.Order
		if err := tx.Set("gorm:query_option", "WITH (UPDLOCK)").
			First(&order, orderID).Error; err != nil {
			return apperror.NotFound("주문을 찾을 수 없습니다")
		}
		if order.UserID != userID {
			return apperror.Forbidden("해당 주문의 취소 권한이 없습니다")
		}
		if order.Status != "PENDING" {
			return apperror.Validation("결제 대기 중인 주문만 취소할 수 있습니다")
		}
		// 주문 생성 후 일정 시간이 지난 경우 자동 취소 로직과의 충돌 방지를 위해 확인
		if time.Since(order.CreatedAt) > s.cfg.OrderCancelWindow {
			return apperror.Validation("취소 가능 시간이 경과했습니다. 고객센터에 문의해주세요.")
		}
		if err := tx.Model(&order).Update("Status", "CANCELLED").Error; err != nil {
			return err
		}
		// 주문 취소 이벤트 기록
		if s.eventSvc != nil {
			actorID := userID
			s.eventSvc.Record(tx, orderID, domain.EventOrderCancelled, &actorID, "USER", map[string]interface{}{
				"reason": "user requested cancellation",
			})
		}
		// 할당된 바우처들의 연결을 끊고 재고로 환원
		return tx.Model(&domain.VoucherCode{}).
			Where("OrderId = ?", orderID).
			Updates(map[string]any{"OrderId": nil, "Status": "AVAILABLE", "SoldAt": nil}).Error
	})
}

// GetOrderDetail은 특정 주문의 모든 정보를 상세히 조회합니다.
// 관리자라면 타인의 주문도 조회할 수 있으며, 일반 사용자는 본인의 주문만 조회 가능합니다.
func (s *OrderService) GetOrderDetail(orderID int, userID int, role string) (*domain.Order, error) {
	var order domain.Order
	query := s.db.Preload("OrderItems.Product").Preload("VoucherCodes")

	if role == "ADMIN" {
		query = query.Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("Id", "Email", "Name", "Phone", "Role", "KycStatus")
		})
	} else {
		query = query.Where("UserId = ?", userID)
	}

	if err := query.First(&order, orderID).Error; err != nil {
		return nil, err
	}

	// 보안: 결제 완료 전(PENDING, FRAUD_HOLD, CANCELLED) 주문은 PIN 노출 금지
	if role != "ADMIN" && !isOrderPINVisible(order.Status) {
		order.VoucherCodes = nil
	} else {
		s.maskVoucherPINs(order.VoucherCodes)
	}

	// PIN이 포함된 응답이면 DB 감사 로그 기록 (워커 풀로 비동기 처리)
	if len(order.VoucherCodes) > 0 {
		orderIDStr := fmt.Sprintf("%d", orderID)
		detail := fmt.Sprintf("주문상세조회: orderId=%d, role=%s, pinCount=%d",
			orderID, role, len(order.VoucherCodes))
		auditEntry := &domain.AuditLog{
			UserID:     &userID,
			Action:     "PIN_VIEW",
			Resource:   "Order",
			ResourceID: &orderIDStr,
			NewValue:   &detail,
		}
		if s.auditPool != nil {
			if submitErr := s.auditPool.Submit(workqueue.AuditLogJob{
				DB:    s.db,
				Model: auditEntry,
			}); submitErr != nil {
				logger.Log.Warn("감사 로그 큐 제출 실패", zap.Error(submitErr))
			}
		} else {
			go func() { s.db.Create(auditEntry) }()
		}
	}

	return &order, nil
}

// CancelExpiredOrders는 결제 기한이 만료된 PENDING/FRAUD_HOLD 주문을 자동 취소하고 바우처를 해제합니다.
// 크론에서 5분 간격으로 호출됩니다.
//
// 주의: Seedream VA 주문(Payment.Method='VIRTUAL_ACCOUNT_SEEDREAM')은 여기서 제외합니다 —
// 내부만 CANCELLED 시키면 Seedream 쪽은 여전히 대기 중이라 사용자가 이후 입금 시 유령 입금이
// 발생합니다. Seedream VA 전용 만료는 SeedreamExpiryService.ExpireSeedreamOrders 가 담당
// (Order→EXPIRED, Payment→CANCELLED 로 전이하며 Seedream 은 자체 타임아웃으로 자동 만료).
func (s *OrderService) CancelExpiredOrders() {
	now := time.Now()

	// PENDING: 결제 기한 만료 (Seedream VA 는 별도 SeedreamExpiryService 가 처리)
	var pendingOrders []domain.Order
	s.db.
		Where("Orders.Status = ? AND Orders.PaymentDeadlineAt IS NOT NULL AND Orders.PaymentDeadlineAt < ?", "PENDING", now).
		Where("NOT EXISTS (SELECT 1 FROM Payments p WHERE p.OrderId = Orders.Id AND p.Method = ?)", "VIRTUAL_ACCOUNT_SEEDREAM").
		Select("Id", "OrderCode").
		Find(&pendingOrders)

	// FRAUD_HOLD: 24시간 초과
	var holdOrders []domain.Order
	fraudHoldHours := 24
	if s.config != nil {
		fraudHoldHours = s.config.GetConfigInt("FRAUD_HOLD_TIMEOUT_HOURS", 24)
	}
	s.db.Where("Status = ? AND CreatedAt < ?", "FRAUD_HOLD", now.Add(-time.Duration(fraudHoldHours)*time.Hour)).
		Select("Id", "OrderCode").
		Find(&holdOrders)

	allOrders := make([]domain.Order, 0, len(pendingOrders)+len(holdOrders))
	allOrders = append(allOrders, pendingOrders...)
	allOrders = append(allOrders, holdOrders...)
	if len(allOrders) == 0 {
		return
	}

	cancelled := 0
	for _, order := range allOrders {
		err := s.db.Transaction(func(tx *gorm.DB) error {
			// 주문 취소
			if err := tx.Model(&domain.Order{}).Where("Id = ? AND Status IN ?", order.ID, []string{"PENDING", "FRAUD_HOLD"}).
				Updates(map[string]any{
					"Status":    "CANCELLED",
					"AdminNote": "시스템 자동 취소: 결제/검토 기한 만료",
				}).Error; err != nil {
				return err
			}
			// 바우처 해제
			return tx.Model(&domain.VoucherCode{}).
				Where("OrderId = ? AND Status = 'RESERVED'", order.ID).
				Updates(map[string]any{"OrderId": nil, "Status": "AVAILABLE", "SoldAt": nil}).Error
		})
		if err != nil {
			logger.Log.Error("만료 주문 자동 취소 실패",
				zap.Int("orderId", order.ID),
				zap.Error(err),
			)
			continue
		}
		cancelled++
	}

	if cancelled > 0 {
		logger.Log.Info("만료 주문 자동 취소 완료",
			zap.Int("cancelled", cancelled),
			zap.Int("pending", len(pendingOrders)),
			zap.Int("fraudHold", len(holdOrders)),
		)
	}
}

// maskVoucherPINs는 데이터베이스에 암호화되어 저장된 PIN을 복호화한 뒤, 사용자에게는 마스킹된 형태로만 제공합니다.
// 예: "12345678" -> "****5678" (마지막 4자리만 노출)
// isOrderPINVisible는 주문 상태가 PIN 노출이 안전한 상태인지 판단합니다.
func isOrderPINVisible(status string) bool {
	switch status {
	case "PAID", "DELIVERED", "COMPLETED":
		return true
	default:
		return false
	}
}

// PaymentStatusResponse 는 GET /orders/:id/payment-status 전용 응답 DTO.
//
// 유저 본인의 주문에서 "결제 진행 중" 또는 "입금 대기" 화면을 구성하기 위해
// 필요한 최소 정보를 제공합니다. Order 도메인의 Payment 구조체를 직접 노출하지
// 않고 전용 DTO 를 통하는 이유:
//  1. Payment.AccountNumber 는 `json:"-"` 로 전역 차단돼 있어 일반 직렬화 경로로
//     내보낼 수 없음 — 이 DTO 는 유저 본인 & 활성 결제 건에 한해 노출 허용.
//  2. UI 에 필요한 파생 상태(uiStatus, canResume 등) 를 서버에서 권위 있게 결정.
//  3. 향후 Payment 도메인 변경에 UI 가 덜 결합되도록 shape 을 별도 관리.
type PaymentStatusResponse struct {
	OrderID       int        `json:"orderId"`
	OrderCode     string     `json:"orderCode"`
	OrderStatus   string     `json:"orderStatus"`   // Order.Status 원본
	TotalAmount   int64      `json:"totalAmount"`
	Method        string     `json:"method"`        // Payment.Method (VIRTUAL_ACCOUNT_SEEDREAM | CASH | ...)
	PaymentStatus string     `json:"paymentStatus"` // Payment.Status 원본
	SeedreamPhase *string    `json:"seedreamPhase,omitempty"`
	BankCode      *string    `json:"bankCode,omitempty"`
	BankName      *string    `json:"bankName,omitempty"`
	AccountNumber *string    `json:"accountNumber,omitempty"`
	DepositorName *string    `json:"depositorName,omitempty"`
	ExpiresAt     *time.Time `json:"expiresAt,omitempty"`
	// UIStatus 는 프론트가 스위치할 파생 상태 (아래 classifyPaymentUIStatus 참조).
	UIStatus string `json:"uiStatus"`
	// CanResume 은 "결제창 다시 열기" 버튼 노출 여부 — VA 재발급 가능한 상태일 때만 true.
	CanResume bool `json:"canResume"`
}

// Payment UIStatus 상수 — 프론트가 switch 에 쓸 정형화된 값.
//
// 이 enum 은 Order.Status 와 Payment.SeedreamPhase 를 "유저 관점" 에서 재편성한
// 표현입니다. 예를 들어 Seedream VA 의 Order.Status=PENDING 이라도 은행선택 전
// (awaiting_bank_selection) 과 은행선택 후 입금 대기 (awaiting_deposit) 는
// UI 가 전혀 다른 화면을 보여줘야 하므로 두 상태로 분리.
const (
	PaymentUIStatusAwaitingBankSelection = "AWAITING_BANK_SELECTION" // VA 발급 직후 — 유저가 키움페이로 이동해야 함
	PaymentUIStatusAwaitingDeposit       = "AWAITING_DEPOSIT"        // 은행선택 완료 — 유저가 입금해야 함
	PaymentUIStatusPaid                  = "PAID"                    // 입금/결제 완료
	PaymentUIStatusExpired               = "EXPIRED"                 // 기한 초과
	PaymentUIStatusCancelled             = "CANCELLED"
	PaymentUIStatusFailed                = "FAILED"
	PaymentUIStatusAmountMismatch        = "AMOUNT_MISMATCH" // 입금액 ≠ 주문액 — Ops 수동 처리 대기
	PaymentUIStatusUnknown               = "UNKNOWN"
)

// classifyPaymentUIStatus 는 Order + Payment 를 UI 관점 단일 enum 으로 축약합니다.
//
// 이 함수의 출력은 프론트엔드가 어떤 화면을 그릴지 결정하는 단일 스위치 포인트이므로,
// 유스케이스를 모두 아우르면서도 "유저가 다음에 해야 할 행동" 을 한 값으로 표현해야 합니다.
//
// 결정 트리 — **이 부분은 아래 TODO 로 표시된 블록에서 사용자가 구현**:
//
//   입력 조합:
//     - order.Status: "PENDING" | "ISSUED" | "PAID" | "DELIVERED" | "COMPLETED"
//                   | "CANCELLED" | "EXPIRED" | "AMOUNT_MISMATCH" | "FRAUD_HOLD"
//     - payment.Status: "PENDING" | "CONFIRMED" | "CANCELLED" | "FAILED" (nil 가능)
//     - payment.SeedreamPhase: "awaiting_bank_selection" | "awaiting_deposit"
//                              | "completed" | "cancelled" | "failed" | nil
//
//   고민할 케이스들:
//     1. Payment 레코드가 아직 없음 (nil) — VA 발급 전 상태. UI 는 뭘 보여줘야?
//     2. Order=PENDING + Payment=PENDING + Phase=awaiting_bank_selection
//     3. Order=ISSUED + Payment=PENDING + Phase=awaiting_deposit
//     4. Order=PAID + Payment=CONFIRMED — PAID
//     5. Order=EXPIRED — EXPIRED (VA 기한 만료)
//     6. Order=CANCELLED — CANCELLED
//     7. Order=AMOUNT_MISMATCH — FAILED? 별도? (Ops 수동 처리 대기)
//     8. Order=FRAUD_HOLD — ? (특수 케이스, UI 표현 필요?)
//     9. CASH 결제 (SeedreamPhase=nil) — Order.Status 만으로 판정
//
// TODO(user): classifyPaymentUIStatus 를 이 파일 아래에서 구현하세요.
// 이 결정은 유저가 화면에서 보는 상태 분류 = UX 행동 유도 → **도메인 판단 필요**.

// GetPaymentStatus 는 유저 본인의 주문에 대한 결제 상태 정보를 반환합니다.
// ADMIN 은 타인 주문도 조회 가능 (관리 편의).
//
// 권한 경계:
//   - role != "ADMIN" 이면 WHERE UserId = ? 로 본인 주문만 허용.
//   - 404 vs 403: 존재 여부 자체를 노출하지 않기 위해 권한 없는 주문은 404 동일하게 처리.
//
// Payment 선택:
//   - 가장 최근 활성 Payment 하나만 반환 (한 주문에 여러 결제 시도가 있을 수 있음).
//   - 활성 = Status IN ('PENDING','CONFIRMED') — 취소/실패된 과거 시도는 제외.
//   - 없으면 payment 필드는 nil 로 반환 (UIStatus 는 Order 기반으로만 판정).
func (s *OrderService) GetPaymentStatus(orderID int, userID int, role string) (*PaymentStatusResponse, error) {
	var order domain.Order
	q := s.db.Select("Id", "OrderCode", "Status", "TotalAmount", "UserId")
	if role != "ADMIN" {
		q = q.Where("UserId = ?", userID)
	}
	if err := q.First(&order, orderID).Error; err != nil {
		return nil, apperror.NotFound("주문을 찾을 수 없습니다")
	}

	var payment *domain.Payment
	var p domain.Payment
	err := s.db.
		Where("OrderId = ? AND Status IN ?", orderID, []string{"PENDING", "CONFIRMED"}).
		Order("CreatedAt DESC").
		First(&p).Error
	if err == nil {
		payment = &p
	}

	resp := &PaymentStatusResponse{
		OrderID:     order.ID,
		OrderStatus: order.Status,
		TotalAmount: order.TotalAmount.Decimal.IntPart(),
	}
	if order.OrderCode != nil {
		resp.OrderCode = *order.OrderCode
	}
	if payment != nil {
		resp.Method = payment.Method
		resp.PaymentStatus = payment.Status
		resp.SeedreamPhase = payment.SeedreamPhase
		resp.BankCode = payment.BankCode
		resp.BankName = payment.BankName
		resp.AccountNumber = payment.AccountNumber
		resp.DepositorName = payment.DepositorName
		resp.ExpiresAt = payment.ExpiresAt
	}

	resp.UIStatus = classifyPaymentUIStatus(&order, payment)
	resp.CanResume = canResumePayment(&order, payment)
	return resp, nil
}

// classifyPaymentUIStatus 는 Order + Payment 조합을 UI 관점 단일 enum 으로 축약합니다.
//
// 결정:
//   - CASH (payment=nil, Order=PENDING) → AwaitingDeposit (무통장 입금 대기 — yk24 패턴).
//     프론트는 동일 AwaitingDeposit 에서 VA 는 payment.accountNumber, CASH 는 SiteConfig
//     계좌를 참조.
//   - AMOUNT_MISMATCH 는 별도 상수 — "입금액 ≠ 주문액 / 고객센터 문의" 특수 안내가
//     FAILED 일반 실패와 구분되어야 함.
//   - FRAUD_HOLD 는 유저가 직접 조치 불가 + "심사 중" 안내가 필요 → Failed 로 묶음
//     (향후 별도 상수로 분리 가능).
func classifyPaymentUIStatus(order *domain.Order, payment *domain.Payment) string {
	if order == nil {
		return PaymentUIStatusUnknown
	}

	switch order.Status {
	case domain.OrderStatusCancelled:
		return PaymentUIStatusCancelled
	case domain.OrderStatusExpired:
		return PaymentUIStatusExpired
	case domain.OrderStatusPaid, domain.OrderStatusDelivered, domain.OrderStatusCompleted:
		return PaymentUIStatusPaid
	case "AMOUNT_MISMATCH":
		return PaymentUIStatusAmountMismatch
	case "FRAUD_HOLD":
		return PaymentUIStatusFailed
	case "ISSUED":
		// 은행 선택 완료, 입금 대기 — VA 특유의 중간 상태.
		return PaymentUIStatusAwaitingDeposit
	case domain.OrderStatusPending:
		if payment != nil && payment.SeedreamPhase != nil &&
			*payment.SeedreamPhase == "awaiting_bank_selection" {
			return PaymentUIStatusAwaitingBankSelection
		}
		// VA 은행선택 후 phase=awaiting_deposit 로 넘어갔지만 Order.Status 전이가 아직 안 된
		// 희박한 race 케이스도 동일하게 AwaitingDeposit.
		if payment != nil && payment.SeedreamPhase != nil &&
			*payment.SeedreamPhase == "awaiting_deposit" {
			return PaymentUIStatusAwaitingDeposit
		}
		// CASH 또는 아직 Payment 레코드가 없는 경우 — 무통장 입금 대기.
		return PaymentUIStatusAwaitingDeposit
	}
	return PaymentUIStatusUnknown
}

// OrderTimelineEvent 는 GET /orders/:id/timeline 응답의 개별 엔트리입니다.
// OrderEvent domain 의 raw 필드 중 유저에게 안전/유의미한 것만 노출.
type OrderTimelineEvent struct {
	ID        int            `json:"id"`
	EventType string         `json:"eventType"`
	Payload   map[string]any `json:"payload,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
}

// timelinePayloadAllowList 는 Timeline payload 에서 유저 노출이 허용된 키 집합입니다.
// 누락된 키는 응답에서 제거됩니다 (민감/내부 필드 방어).
var timelinePayloadAllowList = map[string]struct{}{
	"orderCode":        {},
	"bankCode":         {},
	"depositEndDateAt": {},
	"amount":           {},
	"depositedAt":      {},
	"vouchersSold":     {},
	"reason":           {},
	"canceledAt":       {},
	"cancelledAt":      {},
	"source":           {},
	"cancelDate":       {},
	// DaouTrx 는 유저가 고객센터 문의 시 참조용 — 해시 없이 노출해도 안전 (식별자 성격).
	"daouTrx":       {},
	"refundDaouTrx": {},
	// Seedreampay (자사 바우처) 경로
	"serialNo":      {}, // 바우처 일련번호 — 구매자에게 노출 가능 (secret 은 별도)
	"amountApplied": {}, // Redeem 시 적용 금액
	"usedAt":        {},
	"refundedAt":    {},
	"actorType":     {}, // USER / ADMIN — 환불 주체 감사
}

// sanitizeTimelinePayload 는 OrderEvent.Payload raw JSON 에서 allow-list 키만 남깁니다.
func sanitizeTimelinePayload(raw string) map[string]any {
	if raw == "" {
		return nil
	}
	var decoded map[string]any
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		return nil
	}
	if len(decoded) == 0 {
		return nil
	}
	filtered := make(map[string]any, len(decoded))
	for k, v := range decoded {
		if _, ok := timelinePayloadAllowList[k]; ok {
			filtered[k] = v
		}
	}
	if len(filtered) == 0 {
		return nil
	}
	return filtered
}

// GetOrderTimeline 은 유저 본인의 주문에 대한 이벤트 타임라인을 시간순(과거→현재)으로
// 반환합니다. 권한 없는 주문은 404 로 은폐. eventType 한국어 라벨 매핑은 프론트엔드 책임.
func (s *OrderService) GetOrderTimeline(orderID, userID int, role string) ([]OrderTimelineEvent, error) {
	q := s.db.Select("Id", "UserId")
	if role != "ADMIN" {
		q = q.Where("UserId = ?", userID)
	}
	var ownerCheck domain.Order
	if err := q.First(&ownerCheck, orderID).Error; err != nil {
		return nil, apperror.NotFound("주문을 찾을 수 없습니다")
	}

	var events []domain.OrderEvent
	if err := s.db.Where(`"OrderId" = ?`, orderID).Order(`"CreatedAt" ASC`).Find(&events).Error; err != nil {
		return nil, apperror.Internal("이벤트를 조회할 수 없습니다", err)
	}

	result := make([]OrderTimelineEvent, 0, len(events))
	for _, e := range events {
		result = append(result, OrderTimelineEvent{
			ID:        e.ID,
			EventType: e.EventType,
			Payload:   sanitizeTimelinePayload(e.Payload),
			CreatedAt: e.CreatedAt,
		})
	}
	return result, nil
}

// canResumePayment 는 "결제창 다시 열기" 버튼을 유저에게 보여줄지 판정합니다.
// VA 발급은 TOKEN 이 1회용이라 재시도는 기존 PENDING Payment 를 취소하고 새로
// 발급하는 형태 — Order 가 아직 살아있고 (PENDING/ISSUED) 기한이 남았을 때만 허용.
func canResumePayment(order *domain.Order, payment *domain.Payment) bool {
	if order == nil {
		return false
	}
	// 종료 상태에서는 재시도 불가
	switch order.Status {
	case domain.OrderStatusCancelled, domain.OrderStatusCompleted,
		domain.OrderStatusExpired, domain.OrderStatusRefundPaid,
		domain.OrderStatusPaid, domain.OrderStatusDelivered:
		return false
	}
	// Order.PaymentDeadlineAt 기반 기한 확인은 Order 엔티티에 해당 필드가 있을 때만
	// 의미 있음. 여기선 Payment.ExpiresAt 을 대체 지표로 사용 (Seedream VA 의 경우 동일).
	if payment != nil && payment.ExpiresAt != nil && payment.ExpiresAt.Before(time.Now()) {
		return false
	}
	return true
}

func (s *OrderService) maskVoucherPINs(vouchers []domain.VoucherCode) {
	for j := range vouchers {
		vc := &vouchers[j]
		if vc.PinCode != "" {
			// 복호화 시도 (암호화 알고리즘 자동 감지)
			if decrypted, err := crypto.DecryptAuto(vc.PinCode, s.cfg.EncryptionKey); err == nil {
				vc.PinCode = decrypted
			}
			// API 발급(Gift MOA 등): 고객이 인증코드 전체를 봐야 하므로 마스킹 생략
			// STOCK 발급(수동 업로드): 기존대로 마스킹
			if vc.Source != "API" {
				if len(vc.PinCode) > 4 {
					vc.PinCode = strings.Repeat("*", len(vc.PinCode)-4) + vc.PinCode[len(vc.PinCode)-4:]
				}
			}
		}
		// 보안 코드는 노출되지 않도록 초기화
		vc.SecurityCode = nil
	}
}
