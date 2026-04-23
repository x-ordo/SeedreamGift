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
		// 이미 ISSUED 이상이면 no-op (멱등)
		if order.Status != domain.OrderStatusPending {
			s.logger.Info("vaccount.issued 재수신 — idempotent no-op",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status))
			return nil
		}

		if err := tx.Model(&order).Update("Status", domain.OrderStatusIssued).Error; err != nil {
			return err
		}

		phase := "awaiting_deposit"
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

		// TODO(Phase 3.1 / 4): Voucher RESERVED → SOLD, Ledger.RecordPayment, OrderEvent 기록.
		// Phase 3 MVP 는 Order/Payment 전이만 다루고, Voucher/Ledger 는 연계 작업 완결 후 추가.
		return nil
	})
}
