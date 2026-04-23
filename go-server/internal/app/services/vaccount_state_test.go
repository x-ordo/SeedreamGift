package services

import (
	"context"
	"testing"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func setupStateTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	// NOTE: domain.OrderEvent uses `type:nvarchar(max)` which SQLite (used for in-memory tests)
	// cannot parse. Since this service's MVP implementation does not yet write to OrderEvent
	// (see TODO in ApplyDeposited), we omit it from AutoMigrate to keep the test runnable.
	// When OrderEvent writes are added in Phase 3.1/4, switch tests to a dialect-tolerant
	// schema or MSSQL-specific integration tests.
	require.NoError(t, db.AutoMigrate(
		&domain.Order{}, &domain.Payment{}, &domain.User{}, &domain.OrderItem{},
		&domain.VoucherCode{},
	))
	return db
}

func seedPendingOrderWithPayment(t *testing.T, db *gorm.DB) (*domain.Order, *domain.Payment) {
	t.Helper()
	code := "ORD-S-1"
	o := &domain.Order{
		UserID: 42, Status: "PENDING", Source: "USER",
		TotalAmount: domain.NewNumericDecimal(decimal.NewFromInt(50000)),
		OrderCode:   &code,
	}
	require.NoError(t, db.Create(o).Error)

	phase := "awaiting_bank_selection"
	idem := "gift:vaccount:ORD-S-1"
	vaID := int64(102847)
	p := &domain.Payment{
		OrderID: o.ID, Method: "VIRTUAL_ACCOUNT_SEEDREAM",
		Amount: o.TotalAmount, Status: "PENDING",
		SeedreamVAccountID: &vaID, SeedreamPhase: &phase, SeedreamIdempotencyKey: &idem,
	}
	require.NoError(t, db.Create(p).Error)
	return o, p
}

func TestApplyVAccountIssued(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyIssued(context.Background(), order.OrderCode, seedream.VAccountIssuedPayload{
		OrderNo:          *order.OrderCode,
		BankCode:         "088",
		AccountNo:        "110-123-456789",
		ReceiverName:     "씨드림기프트",
		DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
		IssuedAt:         time.Now().UTC(),
	})
	require.NoError(t, err)

	// Order.Status: PENDING → ISSUED
	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "ISSUED", got.Status)

	// Payment 필드 업데이트
	var p domain.Payment
	require.NoError(t, db.Where("OrderId = ?", order.ID).First(&p).Error)
	require.NotNil(t, p.SeedreamPhase)
	assert.Equal(t, "awaiting_deposit", *p.SeedreamPhase)
	require.NotNil(t, p.BankCode)
	assert.Equal(t, "088", *p.BankCode)
	require.NotNil(t, p.AccountNumber)
	assert.Equal(t, "110-123-456789", *p.AccountNumber)
}

func TestApplyVAccountDeposited_AmountMatches(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	// 먼저 ISSUED 상태로
	db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "ISSUED")

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyDeposited(context.Background(), order.OrderCode, seedream.VAccountDepositedPayload{
		OrderNo: *order.OrderCode, Amount: 50000, DepositedAt: time.Now().UTC(),
	})
	require.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "PAID", got.Status)

	var p domain.Payment
	require.NoError(t, db.Where("OrderId = ?", order.ID).First(&p).Error)
	assert.Equal(t, "CONFIRMED", p.Status)
	require.NotNil(t, p.ConfirmedAt)
}

func TestApplyVAccountDeposited_AmountMismatch_Rejected(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "ISSUED")

	svc := NewVAccountStateService(db, zap.NewNop())
	// Seedream 이 애초에 mismatch 에 대해 webhook 을 발사하지 않는 것이 설계 원칙 — 만약 도달하면 Seedream 회귀.
	// Phase 3 구현은 방어적으로 Order.Status 를 변경하지 않고 에러 반환.
	err := svc.ApplyDeposited(context.Background(), order.OrderCode, seedream.VAccountDepositedPayload{
		OrderNo: *order.OrderCode, Amount: 30000, DepositedAt: time.Now().UTC(),
	})
	assert.Error(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "ISSUED", got.Status) // 변하지 않음
}

func TestApplyVAccountIssued_OrderNotFound(t *testing.T) {
	db := setupStateTestDB(t)
	svc := NewVAccountStateService(db, zap.NewNop())
	unknown := "ORD-NOT-EXIST"
	err := svc.ApplyIssued(context.Background(), &unknown, seedream.VAccountIssuedPayload{OrderNo: unknown})
	assert.Error(t, err)
}

func TestApplyVAccountIssued_Idempotent(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	svc := NewVAccountStateService(db, zap.NewNop())

	payload := seedream.VAccountIssuedPayload{
		OrderNo: *order.OrderCode, BankCode: "088", AccountNo: "110-1",
		DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
	}
	// 1차 호출: 전이 성공
	require.NoError(t, svc.ApplyIssued(context.Background(), order.OrderCode, payload))
	// 2차 호출: Order 이미 ISSUED — no-op 또는 에러 없이 반환
	err := svc.ApplyIssued(context.Background(), order.OrderCode, payload)
	assert.NoError(t, err, "재수신은 idempotent no-op 이어야 함")
}

// ── I-3 fix: terminal state 에서 vaccount.issued 수신 시 Warn no-op ──

func TestApplyVAccountIssued_TerminalState_Warns(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	// Order 를 CANCELLED 상태로 강제 변경 (terminal state)
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "CANCELLED").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	payload := seedream.VAccountIssuedPayload{
		OrderNo: *order.OrderCode, BankCode: "088", AccountNo: "110-1",
		DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
	}
	err := svc.ApplyIssued(context.Background(), order.OrderCode, payload)
	assert.NoError(t, err, "terminal state 에서 vaccount.issued 수신은 Warn no-op")

	// Order.Status 변경 없음
	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "CANCELLED", got.Status)
}

// ── ApplyPaymentCanceled (payment.canceled) ──

func TestApplyPaymentCanceled_HappyPath(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	// ISSUED 상태에서 시작
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "ISSUED").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyPaymentCanceled(context.Background(), order.OrderCode, seedream.PaymentCanceledPayload{
		OrderNo: *order.OrderCode, Reason: "가맹점 요청", CanceledAt: time.Now().UTC(),
	})
	require.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "CANCELLED", got.Status)

	var p domain.Payment
	require.NoError(t, db.Where("OrderId = ?", order.ID).First(&p).Error)
	require.NotNil(t, p.SeedreamPhase)
	assert.Equal(t, "cancelled", *p.SeedreamPhase)
}

func TestApplyPaymentCanceled_Idempotent(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "CANCELLED").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyPaymentCanceled(context.Background(), order.OrderCode, seedream.PaymentCanceledPayload{
		OrderNo: *order.OrderCode, Reason: "재수신", CanceledAt: time.Now().UTC(),
	})
	assert.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "CANCELLED", got.Status)
}

func TestApplyPaymentCanceled_WarnNoOp(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	// 이미 PAID — cancel 불가 상태
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "PAID").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyPaymentCanceled(context.Background(), order.OrderCode, seedream.PaymentCanceledPayload{
		OrderNo: *order.OrderCode, Reason: "race", CanceledAt: time.Now().UTC(),
	})
	assert.NoError(t, err, "Warn no-op: 에러 없이 반환")

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "PAID", got.Status, "Status 변경 없음")
}

// ── ApplyVAccountDepositCanceled (vaccount.deposit_canceled) ──

func TestApplyVAccountDepositCanceled_HappyPath(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "PAID").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyVAccountDepositCanceled(context.Background(), order.OrderCode, seedream.VAccountDepositCanceledPayload{
		OrderNo: *order.OrderCode, Reason: "가맹점 환불", CanceledAt: time.Now().UTC(),
	})
	require.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "REFUNDED", got.Status)

	var p domain.Payment
	require.NoError(t, db.Where("OrderId = ?", order.ID).First(&p).Error)
	assert.Equal(t, "REFUNDED", p.Status)
	require.NotNil(t, p.SeedreamPhase)
	assert.Equal(t, "refunded", *p.SeedreamPhase)
}

func TestApplyVAccountDepositCanceled_Idempotent(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "REFUNDED").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyVAccountDepositCanceled(context.Background(), order.OrderCode, seedream.VAccountDepositCanceledPayload{
		OrderNo: *order.OrderCode, Reason: "재수신", CanceledAt: time.Now().UTC(),
	})
	assert.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "REFUNDED", got.Status)
}

func TestApplyVAccountDepositCanceled_WarnNoOp(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	// 환불 불가 상태 — CANCELLED
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "CANCELLED").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyVAccountDepositCanceled(context.Background(), order.OrderCode, seedream.VAccountDepositCanceledPayload{
		OrderNo: *order.OrderCode, Reason: "race", CanceledAt: time.Now().UTC(),
	})
	assert.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "CANCELLED", got.Status)
}

// ── ApplyVAccountCancelled (vaccount.cancelled — 외부 자동 취소) ──

func TestApplyVAccountCancelled_HappyPath(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "ISSUED").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyVAccountCancelled(context.Background(), order.OrderCode, seedream.VAccountCancelledPayload{
		OrderNo: *order.OrderCode, DaouTrx: "DAOU-XYZ-123", Reason: "키움 자동 취소", CancelledAt: time.Now().UTC(),
	})
	require.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "CANCELLED", got.Status)

	var p domain.Payment
	require.NoError(t, db.Where("OrderId = ?", order.ID).First(&p).Error)
	require.NotNil(t, p.SeedreamPhase)
	assert.Equal(t, "cancelled", *p.SeedreamPhase)
}

func TestApplyVAccountCancelled_Idempotent(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "CANCELLED").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyVAccountCancelled(context.Background(), order.OrderCode, seedream.VAccountCancelledPayload{
		OrderNo: *order.OrderCode, DaouTrx: "DAOU-XYZ-123", CancelledAt: time.Now().UTC(),
	})
	assert.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "CANCELLED", got.Status)
}

func TestApplyVAccountCancelled_WarnNoOp(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	// 이미 PAID → 외부 자동 취소가 도달하면 안 됨
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "PAID").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyVAccountCancelled(context.Background(), order.OrderCode, seedream.VAccountCancelledPayload{
		OrderNo: *order.OrderCode, DaouTrx: "DAOU-XYZ-123", CancelledAt: time.Now().UTC(),
	})
	assert.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "PAID", got.Status)
}

// ── ApplyDepositCancelDeposited (deposit_cancel.deposited — 환불 VA 실제 입금) ──

func TestApplyDepositCancelDeposited_HappyPath(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "REFUNDED").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyDepositCancelDeposited(context.Background(), order.OrderCode, seedream.DepositCancelDepositedPayload{
		OrderNo: *order.OrderCode, RefundDaouTrx: "REFUND-DAOU-456", Amount: 50000, CancelDate: "20260423120000",
	})
	require.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "REFUND_PAID", got.Status)

	var p domain.Payment
	require.NoError(t, db.Where("OrderId = ?", order.ID).First(&p).Error)
	require.NotNil(t, p.SeedreamPhase)
	assert.Equal(t, "refund_paid", *p.SeedreamPhase)
}

func TestApplyDepositCancelDeposited_Idempotent(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "REFUND_PAID").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyDepositCancelDeposited(context.Background(), order.OrderCode, seedream.DepositCancelDepositedPayload{
		OrderNo: *order.OrderCode, RefundDaouTrx: "REFUND-DAOU-456", Amount: 50000,
	})
	assert.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "REFUND_PAID", got.Status)
}

func TestApplyDepositCancelDeposited_WarnNoOp(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	// PAID — deposit_canceled 아직 미수신. out-of-order 가능성.
	require.NoError(t, db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "PAID").Error)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyDepositCancelDeposited(context.Background(), order.OrderCode, seedream.DepositCancelDepositedPayload{
		OrderNo: *order.OrderCode, RefundDaouTrx: "REFUND-DAOU-456", Amount: 50000,
	})
	assert.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "PAID", got.Status, "Status 변경 없음")
}
