// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
package services

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// PaymentService는 외부 결제 게이트웨이(PG)와 연동하여 결제 요청, 검증 및 사후 처리를 조율합니다.
type PaymentService struct {
	db             *gorm.DB
	provider       interfaces.IPaymentProvider
	cashReceiptSvc *CashReceiptService
	ledgerSvc      *LedgerService
	eventSvc       *OrderEventService // 주문 이벤트 기록 (부분 Event Sourcing)
}

// SetLedgerService는 복식부기 원장 서비스를 주입합니다.
func (s *PaymentService) SetLedgerService(ls *LedgerService) {
	s.ledgerSvc = ls
}

// SetOrderEventService는 주문 이벤트 기록 서비스를 주입합니다 (setter injection).
func (s *PaymentService) SetOrderEventService(svc *OrderEventService) {
	s.eventSvc = svc
}

// NewPaymentService는 데이터베이스 연결 및 PG 프로바이더를 주입받아 서비스를 생성합니다.
// cashReceiptSvc는 선택적 의존성으로, 가변 인자로 받아 기존 호출부 변경 없이 주입할 수 있습니다.
func NewPaymentService(db *gorm.DB, provider interfaces.IPaymentProvider, cashReceiptSvc ...*CashReceiptService) *PaymentService {
	svc := &PaymentService{db: db, provider: provider}
	if len(cashReceiptSvc) > 0 {
		svc.cashReceiptSvc = cashReceiptSvc[0]
	}
	return svc
}

// PaymentInitiateRequest는 프론트엔드에서 결제창을 띄우기 전, 서버에 결제 의사를 알릴 때 보내는 데이터입니다.
type PaymentInitiateRequest struct {
	OrderID int     `json:"orderId" binding:"required"` // 결제를 진행할 주문 ID
	Amount  float64 `json:"amount" binding:"required,gt=0"` // 결제 예정 금액 (양수 필수, 주문 금액과 일치해야 함)
	Method  string  `json:"method" binding:"required"`  // 결제 수단 (CARD, VIRTUAL_ACCOUNT 등)
}

// PaymentInitiateResponse는 결제 요청에 대해 서버가 생성한 결제 키와 리다이렉트 정보를 담습니다.
type PaymentInitiateResponse struct {
	PaymentKey  string  `json:"paymentKey"`  // 서버 측에서 생성한 고유 결제 식별자
	OrderID     int     `json:"orderId"`     // 주문 ID
	Amount      float64 `json:"amount"`      // 검증된 결제 금액
	RedirectUrl string  `json:"redirectUrl"` // PG사 결제 페이지 URL (또는 모의 URL)
}

// InitiatePayment는 실제 PG 결제창을 호출하기 전 서버 측의 준비 단계입니다.
// 주문 금액과 요청 금액의 일치 여부를 검증하고, 결제 시도 기록(Payment)을 생성합니다.
func (s *PaymentService) InitiatePayment(userID int, req PaymentInitiateRequest) (*PaymentInitiateResponse, error) {
	var order domain.Order
	if err := s.db.First(&order, req.OrderID).Error; err != nil {
		return nil, apperror.NotFound("해당 주문을 찾을 수 없습니다")
	}
	if order.UserID != userID {
		return nil, apperror.Forbidden("주문에 대한 접근 권한이 없습니다")
	}

	// 결제 금액 위변조 방지를 위한 서버 측 재검증 (1원 오차 범위 내 허용)
	diff := order.TotalAmount.InexactFloat64() - req.Amount
	if diff > 1 || diff < -1 {
		return nil, apperror.Validation("결제 요청 금액이 주문의 총 결제 금액과 일치하지 않습니다")
	}

	// 보안을 위해 암호학적으로 안전한 랜덤 결제 키 생성
	keyBytes := make([]byte, 16)
	if _, err := rand.Read(keyBytes); err != nil {
		return nil, apperror.Internal("결제 키 생성 중 오류 발생", err)
	}
	paymentKey := fmt.Sprintf("PAY_%s", hex.EncodeToString(keyBytes))

	// 결제 시도 내역(PENDING) 저장 - 나중에 PG 결과와 대조하기 위함
	payment := &domain.Payment{
		OrderID: req.OrderID,
		Amount:  order.TotalAmount,
		Method:  req.Method,
		Status:  "PENDING",
	}
	if err := s.db.Create(payment).Error; err != nil {
		return nil, err
	}

	return &PaymentInitiateResponse{
		PaymentKey:  paymentKey,
		OrderID:     req.OrderID,
		Amount:      req.Amount,
		RedirectUrl: "https://mock-pg.example.com/pay/" + paymentKey,
	}, nil
}

// VerifyPayment는 사용자가 결제창에서 인증을 마친 후, PG사에 최종 승인 요청을 보내는 단계입니다.
// 승인이 완료되면 주문(PAID), 결제(CONFIRMED), 바우처(SOLD) 상태를 한꺼번에 업데이트합니다.
func (s *PaymentService) VerifyPayment(userID int, paymentKey string, orderID int) (*interfaces.PaymentVerifyResult, error) {
	// 기본 소유권 확인
	var order domain.Order
	if err := s.db.First(&order, orderID).Error; err != nil {
		return nil, apperror.NotFound("주문을 찾을 수 없습니다")
	}
	if order.UserID != userID {
		return nil, apperror.Forbidden("해당 주문의 소유자가 아닙니다")
	}

	// 주입된 PG 프로바이더(예: 토스페이먼츠)를 통해 실제 결제 완료 여부를 최종 확인(승인)
	result, err := s.provider.VerifyPayment(paymentKey, orderID, order.TotalAmount.InexactFloat64())
	if err != nil {
		return nil, err
	}

	if result.Success {
		// 데이터 무결성을 보장하기 위해 전체 상태 변경을 트랜잭션으로 묶음
		err := s.db.Transaction(func(tx *gorm.DB) error {
			// 동시 결제 처리나 중복 요청을 막기 위해 행 잠금(UPDLOCK) 수행
			var lockedOrder domain.Order
			if err := tx.Set("gorm:query_option", "WITH (UPDLOCK, ROWLOCK)").
				First(&lockedOrder, orderID).Error; err != nil {
				return apperror.NotFound("주문을 찾을 수 없습니다")
			}
			if lockedOrder.Status != "PENDING" {
				return apperror.Validation("이미 결제 처리가 완료된 주문입니다")
			}

			// 1. 주문 엔티티의 상태를 '결제완료'로 변경
			if err := tx.Model(&lockedOrder).Updates(map[string]any{
				"Status":        "PAID",
				"PaymentKey":    paymentKey,
				"PaymentMethod": result.Method,
			}).Error; err != nil {
				return err
			}

			// 결제 완료 이벤트 기록
			if s.eventSvc != nil {
				s.eventSvc.Record(tx, lockedOrder.ID, domain.EventOrderPaid, &lockedOrder.UserID, "SYSTEM", map[string]interface{}{
					"paymentKey": paymentKey,
					"amount":     lockedOrder.TotalAmount,
				})
			}

			// 2. 개별 결제 시도 기록을 '확정' 상태로 변경 및 승인 시각 기록
			if err := tx.Model(&domain.Payment{}).Where("OrderId = ?", orderID).Updates(map[string]any{
				"Status":      "CONFIRMED",
				"BankTxId":    paymentKey,
				"ConfirmedAt": time.Now(),
			}).Error; err != nil {
				return err
			}

			// 3. 복식부기 원장 기록: DEBIT(REVENUE) + CREDIT(CUSTOMER)
			// PG 승인은 이미 완료되어 되돌릴 수 없으므로, 원장 실패 시에도 주문을 PAID로 진행.
			// 실패 시 에러 로그로 남기고 관리자가 수동 보정하도록 함.
			if s.ledgerSvc != nil {
				if ledgerErr := s.ledgerSvc.RecordPayment(tx, orderID, lockedOrder.TotalAmount.Decimal); ledgerErr != nil {
					logger.Log.Error("원장 기록 실패 (결제) — 주문 처리는 계속 진행, 수동 보정 필요",
						zap.Error(ledgerErr), zap.Int("orderID", orderID),
						zap.String("paymentKey", paymentKey))
				}
			}

			// 4. 점유 중이던 바우처들을 최종 '판매됨' 상태로 전환하여 재고 소진 확정
			if err := tx.Model(&domain.VoucherCode{}).
				Where("OrderId = ? AND Status = 'RESERVED'", orderID).
				Updates(map[string]any{
					"Status": "SOLD",
					"SoldAt": time.Now(),
				}).Error; err != nil {
				return apperror.Internal("바우처 판매 확정 처리 실패", err)
			}

			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	return result, nil
}

// HandleWebhook은 가상계좌 입금 등 외부 PG사에서 보내오는 비동기 이벤트를 수신합니다.
// 브라우저 이탈 등으로 인해 VerifyPayment가 호출되지 않은 경우에도 주문 상태를 동기화하는 역할을 합니다.
// VerifyWebhookSignature는 PG사 웹훅의 HMAC-SHA256 서명을 검증합니다.
// signatureHeader: PG에서 전송한 서명 헤더 값
// rawBody: 원본 HTTP 요청 바디 (byte 그대로)
// secretKey: PG사에서 발급한 웹훅 시크릿 키
func VerifyWebhookSignature(signatureHeader string, rawBody []byte, secretKey string) bool {
	if secretKey == "" {
		if gin.Mode() == gin.ReleaseMode {
			logger.Log.Error("웹훅 서명 검증 실패: 프로덕션 환경에서 PG 웹훅 시크릿이 미설정됨 — 보안 위협 방지를 위해 거부")
			return false
		}
		logger.Log.Warn("웹훅 서명 검증 스킵: PG 웹훅 시크릿 미설정 (개발 모드)")
		return true
	}
	mac := hmac.New(sha256.New, []byte(secretKey))
	mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signatureHeader))
}

func (s *PaymentService) HandleWebhook(payload map[string]any, signatureHeader string, rawBody []byte, webhookSecret string) error {
	// 웹훅 서명 검증 — PG사의 HMAC-SHA256 서명과 대조
	if !VerifyWebhookSignature(signatureHeader, rawBody, webhookSecret) {
		logger.Log.Warn("웹훅 서명 검증 실패", zap.String("signature", signatureHeader))
		return apperror.Unauthorized("웹훅 서명이 유효하지 않습니다")
	}

	// 웹훅 데이터에서 필수 식별 정보(상태, 주문번호) 추출
	statusRaw, hasStatus := payload["status"]
	orderIDRaw, hasOrderID := payload["orderId"]
	if !hasStatus || !hasOrderID {
		return apperror.Validation("웹훅 데이터 필수 필드(status, orderId) 누락")
	}

	status, ok := statusRaw.(string)
	if !ok || status == "" {
		return apperror.Validation("웹훅 상태(status) 필드 값이 유효하지 않습니다")
	}

	// JSON 숫자는 기본적으로 float64로 처리되므로 안전하게 변환
	orderIDFloat, ok := orderIDRaw.(float64)
	if !ok || orderIDFloat <= 0 {
		return apperror.Validation("웹훅 주문번호(orderId) 필드 값이 유효하지 않습니다")
	}

	orderID := int(orderIDFloat)

	// 웹훅 페이로드에서 결제 키/방법 추출 (PG사에 따라 필드명이 다를 수 있음)
	paymentKeyFromWebhook, _ := payload["paymentKey"].(string)
	paymentMethodFromWebhook, _ := payload["method"].(string)

	if status == "DONE" || status == "PAID" {
		err := s.db.Transaction(func(tx *gorm.DB) error {
			var order domain.Order
			if err := tx.Set("gorm:query_option", "WITH (UPDLOCK, ROWLOCK)").
				First(&order, orderID).Error; err != nil {
				return apperror.NotFound("주문을 찾을 수 없습니다")
			}
			if order.Status != "PENDING" {
				return nil // 이미 처리됨 (멱등)
			}

			// 1. 주문 상태 및 결제 정보 업데이트 (VerifyPayment와 동일)
			orderUpdates := map[string]any{"Status": "PAID"}
			if paymentKeyFromWebhook != "" {
				orderUpdates["PaymentKey"] = paymentKeyFromWebhook
			}
			if paymentMethodFromWebhook != "" {
				orderUpdates["PaymentMethod"] = paymentMethodFromWebhook
			}
			if err := tx.Model(&order).Updates(orderUpdates).Error; err != nil {
				return err
			}

			// 2. 결제 완료 이벤트 기록
			if s.eventSvc != nil {
				s.eventSvc.Record(tx, order.ID, domain.EventOrderPaid, nil, "WEBHOOK", map[string]interface{}{
					"paymentKey": paymentKeyFromWebhook,
					"amount":     order.TotalAmount,
				})
			}

			// 3. Payment 레코드 CONFIRMED + BankTxId 기록
			paymentUpdates := map[string]any{
				"Status":      "CONFIRMED",
				"ConfirmedAt": time.Now(),
			}
			if paymentKeyFromWebhook != "" {
				paymentUpdates["BankTxId"] = paymentKeyFromWebhook
			}
			if err := tx.Model(&domain.Payment{}).Where("OrderId = ?", orderID).Updates(paymentUpdates).Error; err != nil {
				return err
			}

			// 4. RESERVED 바우처를 SOLD로 전환
			if err := tx.Model(&domain.VoucherCode{}).
				Where("OrderId = ? AND Status = 'RESERVED'", orderID).
				Updates(map[string]any{
					"Status": "SOLD",
					"SoldAt": time.Now(),
				}).Error; err != nil {
				return err
			}

			// 5. 복식부기 원장 기록 (웹훅 경유 결제)
			if s.ledgerSvc != nil {
				if ledgerErr := s.ledgerSvc.RecordPayment(tx, orderID, order.TotalAmount.Decimal); ledgerErr != nil {
					logger.Log.Error("원장 기록 실패 (웹훅 결제) — 주문 처리는 계속 진행",
						zap.Error(ledgerErr), zap.Int("orderID", orderID))
				}
			}

			return nil
		})
		if err != nil {
			return err
		}

		// [비활성화] 유가증권은 현금영수증 발급 대상 아님 (부가가치세법 시행령 제73조)
		// if s.cashReceiptSvc != nil {
		// 	go func() {
		// 		defer func() {
		// 			if r := recover(); r != nil {
		// 				logger.Log.Error("AutoIssue 패닉",
		// 					zap.Any("recover", r),
		// 					zap.Int("orderID", orderID),
		// 				)
		// 			}
		// 		}()
		// 		s.cashReceiptSvc.AutoIssue(orderID)
		// 	}()
		// }

		return nil
	}

	return nil
}
