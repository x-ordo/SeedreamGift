package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// VAccountStateService 는 Seedream 웹훅 이벤트에 따라 Order/Payment 상태를 전이시킵니다.
// 설계 §6.2 의 전이 표를 참조하여 각 Apply* 함수로 분리.
type VAccountStateService struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewVAccountStateService(db *gorm.DB, logger *zap.Logger) *VAccountStateService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &VAccountStateService{db: db, logger: logger}
}

// ApplyIssued 는 vaccount.issued 이벤트를 처리합니다.
//
//   Order.Status: PENDING → ISSUED
//   Payment.SeedreamPhase: awaiting_bank_selection → awaiting_deposit
//   Payment.BankCode/AccountNumber/DepositorName/ExpiresAt UPDATE
//
// 이미 ISSUED 또는 그 이후 상태인 경우 no-op (idempotent).
func (s *VAccountStateService) ApplyIssued(ctx context.Context, orderCode *string, payload seedream.VAccountIssuedPayload) error {
	if orderCode == nil || *orderCode == "" {
		return errors.New("orderCode 누락")
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order domain.Order
		if err := tx.Where("OrderCode = ?", *orderCode).First(&order).Error; err != nil {
			return fmt.Errorf("order not found (orderCode=%s): %w", *orderCode, err)
		}
		// 상태별 분기 (I-3 fix):
		//   - PENDING: 정상 전이
		//   - ISSUED/PAID/DELIVERED/COMPLETED: idempotent no-op (웹훅 재전송 등)
		//   - CANCELLED/EXPIRED/AMOUNT_MISMATCH/REFUNDED/REFUND_PAID: terminal state 에 도달 — race condition 의심 → Warn
		switch order.Status {
		case domain.OrderStatusPending:
			// fall through to transition
		case domain.OrderStatusIssued, domain.OrderStatusPaid,
			domain.OrderStatusDelivered, domain.OrderStatusCompleted:
			s.logger.Info("vaccount.issued 재수신 — idempotent no-op",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status))
			return nil
		default: // CANCELLED, EXPIRED, AMOUNT_MISMATCH, REFUNDED, REFUND_PAID
			s.logger.Warn("vaccount.issued arrived after terminal state — possible cancel race",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status))
			return nil
		}

		if err := tx.Model(&order).Update("Status", domain.OrderStatusIssued).Error; err != nil {
			return err
		}

		phase := domain.SeedreamPhaseAwaitingDeposit
		bankCode := payload.BankCode
		accountNo := payload.AccountNo
		depositorName := payload.ReceiverName
		expiresAt := payload.DepositEndDateAt
		if err := tx.Model(&domain.Payment{}).
			Where("OrderId = ? AND Status = 'PENDING'", order.ID).
			Updates(map[string]any{
				"SeedreamPhase": &phase,
				"BankCode":      &bankCode,
				"AccountNumber": &accountNo,
				"DepositorName": &depositorName,
				"ExpiresAt":     &expiresAt,
			}).Error; err != nil {
			return err
		}
		return nil
	})
}

// ApplyDeposited 는 vaccount.deposited 이벤트를 처리합니다.
//
//   Amount 검증: payload.amount == Order.TotalAmount (불일치 시 에러 — Seedream 회귀 의심)
//   Order.Status: (PENDING|ISSUED) → PAID
//   Payment.Status: PENDING → CONFIRMED + ConfirmedAt
//   Voucher RESERVED → SOLD (Phase 3 범위 외, TODO 플래그)
//   Ledger 기록 (Phase 3 범위 외, TODO)
//
// 이미 PAID 이상이면 no-op.
func (s *VAccountStateService) ApplyDeposited(ctx context.Context, orderCode *string, payload seedream.VAccountDepositedPayload) error {
	if orderCode == nil || *orderCode == "" {
		return errors.New("orderCode 누락")
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order domain.Order
		if err := tx.Where("OrderCode = ?", *orderCode).First(&order).Error; err != nil {
			return fmt.Errorf("order not found (orderCode=%s): %w", *orderCode, err)
		}
		// 이미 PAID 이상이면 no-op
		if order.Status == domain.OrderStatusPaid ||
			order.Status == domain.OrderStatusDelivered ||
			order.Status == domain.OrderStatusCompleted {
			s.logger.Info("vaccount.deposited 재수신 — idempotent no-op",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status))
			return nil
		}

		// Amount 검증: Seedream 은 mismatch 시 webhook 을 발사하지 않는 설계 원칙.
		// 만약 도달하면 Seedream 회귀 버그 — 상태 전이 거부 + Ops 에스컬레이션.
		if payload.Amount != order.TotalAmount.Decimal.IntPart() {
			s.logger.Error("vaccount.deposited amount mismatch — Seedream 회귀 의심",
				zap.String("orderCode", *orderCode),
				zap.Int64("expected", order.TotalAmount.Decimal.IntPart()),
				zap.Int64("got", payload.Amount))
			return fmt.Errorf("amount mismatch: expected=%d got=%d", order.TotalAmount.Decimal.IntPart(), payload.Amount)
		}

		if err := tx.Model(&order).Update("Status", domain.OrderStatusPaid).Error; err != nil {
			return err
		}

		now := time.Now().UTC()
		if err := tx.Model(&domain.Payment{}).
			Where("OrderId = ? AND Status = 'PENDING'", order.ID).
			Updates(map[string]any{
				"Status":      "CONFIRMED",
				"ConfirmedAt": &now,
			}).Error; err != nil {
			return err
		}

		// RESERVED 바우처 → SOLD 전이. CreateOrder 시점에 OrderID 로 바인딩 + Status='RESERVED'
		// 로 예약된 PIN 을 실제 판매 완료로 확정. SoldAt 은 입금 시각 기준.
		// (이후 Fulfillment 단계가 DELIVERED 로 전이하며 유저에게 PIN 전달.)
		vcResult := tx.Model(&domain.VoucherCode{}).
			Where("OrderId = ? AND Status = 'RESERVED'", order.ID).
			Updates(map[string]any{
				"Status": "SOLD",
				"SoldAt": &now,
			})
		if vcResult.Error != nil {
			return fmt.Errorf("voucher RESERVED→SOLD 전이 실패: %w", vcResult.Error)
		}
		s.logger.Info("vaccount.deposited 처리 완료",
			zap.String("orderCode", *orderCode),
			zap.Int("orderId", order.ID),
			zap.Int64("vouchersSold", vcResult.RowsAffected))

		// TODO(Phase 4+): Ledger.RecordPayment, OrderEvent 기록.
		return nil
	})
}

// ApplyPaymentCanceled 는 payment.canceled 이벤트를 처리합니다 (미국식 L 하나).
//
// 가맹점 요청으로 입금 전 취소 성공 시 Seedream 이 발사하는 웹훅.
//
//	Order.Status: (PENDING|ISSUED) → CANCELLED
//	Payment.SeedreamPhase: → cancelled
//
// 이미 CANCELLED 면 idempotent no-op.
// PAID/DELIVERED/COMPLETED/REFUNDED/REFUND_PAID 에 도달하면 race 의심 → Warn no-op.
func (s *VAccountStateService) ApplyPaymentCanceled(ctx context.Context, orderCode *string, payload seedream.PaymentCanceledPayload) error {
	if orderCode == nil || *orderCode == "" {
		return errors.New("orderCode 누락")
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order domain.Order
		if err := tx.Where("OrderCode = ?", *orderCode).First(&order).Error; err != nil {
			return fmt.Errorf("order not found (orderCode=%s): %w", *orderCode, err)
		}

		switch order.Status {
		case domain.OrderStatusPending, domain.OrderStatusIssued:
			// fall through to transition
		case domain.OrderStatusCancelled:
			s.logger.Info("payment.canceled 재수신 — idempotent no-op",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status))
			return nil
		default: // PAID, DELIVERED, COMPLETED, REFUNDED, REFUND_PAID, EXPIRED, AMOUNT_MISMATCH
			s.logger.Warn("payment.canceled arrived after non-cancellable state — possible race",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status),
				zap.String("reason", payload.Reason))
			return nil
		}

		if err := tx.Model(&order).Update("Status", domain.OrderStatusCancelled).Error; err != nil {
			return err
		}

		phase := domain.SeedreamPhaseCancelled
		if err := tx.Model(&domain.Payment{}).
			Where("OrderId = ?", order.ID).
			Updates(map[string]any{
				"SeedreamPhase": &phase,
			}).Error; err != nil {
			return err
		}
		return nil
	})
}

// ApplyVAccountDepositCanceled 는 vaccount.deposit_canceled 이벤트를 처리합니다 (미국식 L 하나).
//
// 가맹점 요청으로 입금 후 환불 성공 시 Seedream 이 발사하는 웹훅.
// 실제 입금 확인은 별도 deposit_cancel.deposited 웹훅에서 처리 (ApplyDepositCancelDeposited).
//
//	Order.Status: (PAID|DELIVERED) → REFUNDED
//	Payment.SeedreamPhase: → refunded
//	Payment.Status: → REFUNDED
//
// 이미 REFUNDED/REFUND_PAID 면 idempotent no-op.
// CANCELLED/EXPIRED/AMOUNT_MISMATCH 에 도달하면 race 의심 → Warn no-op.
func (s *VAccountStateService) ApplyVAccountDepositCanceled(ctx context.Context, orderCode *string, payload seedream.VAccountDepositCanceledPayload) error {
	if orderCode == nil || *orderCode == "" {
		return errors.New("orderCode 누락")
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order domain.Order
		if err := tx.Where("OrderCode = ?", *orderCode).First(&order).Error; err != nil {
			return fmt.Errorf("order not found (orderCode=%s): %w", *orderCode, err)
		}

		switch order.Status {
		case domain.OrderStatusPaid, domain.OrderStatusDelivered:
			// fall through to transition
		case domain.OrderStatusRefunded, domain.OrderStatusRefundPaid:
			s.logger.Info("vaccount.deposit_canceled 재수신 — idempotent no-op",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status))
			return nil
		default: // PENDING, ISSUED, CANCELLED, COMPLETED, EXPIRED, AMOUNT_MISMATCH
			s.logger.Warn("vaccount.deposit_canceled arrived from unexpected state — possible race",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status),
				zap.String("reason", payload.Reason))
			return nil
		}

		if err := tx.Model(&order).Update("Status", domain.OrderStatusRefunded).Error; err != nil {
			return err
		}

		phase := domain.SeedreamPhaseRefunded
		if err := tx.Model(&domain.Payment{}).
			Where("OrderId = ?", order.ID).
			Updates(map[string]any{
				"Status":        "REFUNDED",
				"SeedreamPhase": &phase,
			}).Error; err != nil {
			return err
		}
		return nil
	})
}

// ApplyVAccountCancelled 는 vaccount.cancelled 이벤트를 처리합니다 (영국식 L 두 개).
//
// 외부(키움/은행) 자동 취소로 발생한 이벤트. DaouTrx 로 감사 추적 필요.
//
//	Order.Status: (PENDING|ISSUED) → CANCELLED
//	Payment.SeedreamPhase: → cancelled
//
// 이미 CANCELLED 면 idempotent no-op.
// PAID/DELIVERED/COMPLETED/REFUNDED/REFUND_PAID 에 도달하면 race 의심 → Warn no-op.
func (s *VAccountStateService) ApplyVAccountCancelled(ctx context.Context, orderCode *string, payload seedream.VAccountCancelledPayload) error {
	if orderCode == nil || *orderCode == "" {
		return errors.New("orderCode 누락")
	}
	// 외부 취소는 감사 추적을 위해 daouTrx 를 항상 Info 레벨로 로깅.
	s.logger.Info("vaccount.cancelled received — external auto-cancel",
		zap.String("orderCode", *orderCode),
		zap.String("daouTrx", payload.DaouTrx),
		zap.String("reason", payload.Reason))

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order domain.Order
		if err := tx.Where("OrderCode = ?", *orderCode).First(&order).Error; err != nil {
			return fmt.Errorf("order not found (orderCode=%s): %w", *orderCode, err)
		}

		switch order.Status {
		case domain.OrderStatusPending, domain.OrderStatusIssued:
			// fall through to transition
		case domain.OrderStatusCancelled:
			s.logger.Info("vaccount.cancelled 재수신 — idempotent no-op",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status))
			return nil
		default: // PAID, DELIVERED, COMPLETED, REFUNDED, REFUND_PAID, EXPIRED, AMOUNT_MISMATCH
			s.logger.Warn("vaccount.cancelled arrived after non-cancellable state — possible race",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status),
				zap.String("daouTrx", payload.DaouTrx))
			return nil
		}

		if err := tx.Model(&order).Update("Status", domain.OrderStatusCancelled).Error; err != nil {
			return err
		}

		phase := domain.SeedreamPhaseCancelled
		if err := tx.Model(&domain.Payment{}).
			Where("OrderId = ?", order.ID).
			Updates(map[string]any{
				"SeedreamPhase": &phase,
			}).Error; err != nil {
			return err
		}
		return nil
	})
}

// ApplyDepositCancelDeposited 는 deposit_cancel.deposited 이벤트를 처리합니다.
//
// 환불 VA 에 실제 입금이 확인된 시점의 웹훅. ApplyVAccountDepositCanceled 후속.
//
//	Order.Status: REFUNDED → REFUND_PAID
//	Payment.SeedreamPhase: → refund_paid
//
// 이미 REFUND_PAID 면 idempotent no-op.
// PAID (deposit_canceled 를 아직 못 받은 경우) 포함 다른 상태 → Warn no-op (out-of-order 가능).
func (s *VAccountStateService) ApplyDepositCancelDeposited(ctx context.Context, orderCode *string, payload seedream.DepositCancelDepositedPayload) error {
	if orderCode == nil || *orderCode == "" {
		return errors.New("orderCode 누락")
	}
	// 환불 입금 확인은 금액 감사 기록 필수.
	s.logger.Info("deposit_cancel.deposited received — refund VA deposit confirmed",
		zap.String("orderCode", *orderCode),
		zap.String("refundDaouTrx", payload.RefundDaouTrx),
		zap.Int64("amount", payload.Amount))

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order domain.Order
		if err := tx.Where("OrderCode = ?", *orderCode).First(&order).Error; err != nil {
			return fmt.Errorf("order not found (orderCode=%s): %w", *orderCode, err)
		}

		switch order.Status {
		case domain.OrderStatusRefunded:
			// fall through to transition
		case domain.OrderStatusRefundPaid:
			s.logger.Info("deposit_cancel.deposited 재수신 — idempotent no-op",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status))
			return nil
		default: // PAID (deposit_canceled 아직 미수신), CANCELLED, EXPIRED 등 — race 의심
			s.logger.Warn("deposit_cancel.deposited arrived from unexpected state — out-of-order delivery suspected",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status),
				zap.Int64("amount", payload.Amount))
			return nil
		}

		if err := tx.Model(&order).Update("Status", domain.OrderStatusRefundPaid).Error; err != nil {
			return err
		}

		phase := domain.SeedreamPhaseRefundPaid
		if err := tx.Model(&domain.Payment{}).
			Where("OrderId = ?", order.ID).
			Updates(map[string]any{
				"SeedreamPhase": &phase,
			}).Error; err != nil {
			return err
		}
		return nil
	})
}
