package services

import (
	"context"
	"testing"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// reconcileClientStub 는 ReconcileClient 의 테스트 대역입니다.
type reconcileClientStub struct {
	items []seedream.VAccountResult
}

func (s *reconcileClientStub) WalkVAccountsSince(
	ctx context.Context,
	q seedream.VAccountListQuery,
	visit func(context.Context, seedream.VAccountResult) error,
	traceID string,
) error {
	for _, it := range s.items {
		if err := visit(ctx, it); err != nil {
			return err
		}
	}
	return nil
}

func seedReconcileOrder(t *testing.T, db *gorm.DB, orderStatus, paymentStatus string, method string, orderCode string) (*domain.Order, *domain.Payment) {
	t.Helper()
	o := &domain.Order{
		UserID: 42, Status: orderStatus, Source: "USER",
		TotalAmount: domain.NewNumericDecimal(decimal.NewFromInt(50000)),
		OrderCode:   &orderCode,
	}
	require.NoError(t, db.Create(o).Error)

	phase := domain.SeedreamPhaseAwaitingDeposit
	idem := "gift:vaccount:" + orderCode
	p := &domain.Payment{
		OrderID: o.ID, Method: method,
		Amount: o.TotalAmount, Status: paymentStatus,
		SeedreamPhase:          &phase,
		SeedreamIdempotencyKey: &idem,
	}
	require.NoError(t, db.Create(p).Error)
	return o, p
}

func newReconcileSvc(db *gorm.DB, items []seedream.VAccountResult) *SeedreamReconcileService {
	stub := &reconcileClientStub{items: items}
	return NewSeedreamReconcileService(db, stub, zap.NewNop())
}

func TestReconcile_Classify_MissingDeposit(t *testing.T) {
	db := setupStateTestDB(t)
	seedReconcileOrder(t, db, "PENDING", "PENDING", "VIRTUAL_ACCOUNT_SEEDREAM", "ORD-RC-DEP")

	svc := newReconcileSvc(db, nil)
	kind := svc.classifyDrift(context.Background(), seedream.VAccountResult{
		OrderNo: "ORD-RC-DEP", Status: "SUCCESS", Phase: "completed", Amount: 50000,
	})
	assert.Equal(t, DriftMissingDepositWebhook, kind)
}

func TestReconcile_Classify_MissingCancel(t *testing.T) {
	db := setupStateTestDB(t)
	seedReconcileOrder(t, db, "ISSUED", "PENDING", "VIRTUAL_ACCOUNT_SEEDREAM", "ORD-RC-CAN")

	svc := newReconcileSvc(db, nil)
	kind := svc.classifyDrift(context.Background(), seedream.VAccountResult{
		OrderNo: "ORD-RC-CAN", Status: "CANCELLED", Phase: "cancelled",
	})
	assert.Equal(t, DriftMissingCancelWebhook, kind)
}

func TestReconcile_Classify_IssuedWebhookMissing(t *testing.T) {
	db := setupStateTestDB(t)
	seedReconcileOrder(t, db, "PENDING", "PENDING", "VIRTUAL_ACCOUNT_SEEDREAM", "ORD-RC-ISS")

	svc := newReconcileSvc(db, nil)
	kind := svc.classifyDrift(context.Background(), seedream.VAccountResult{
		OrderNo: "ORD-RC-ISS", Status: "PENDING", Phase: "awaiting_deposit",
	})
	assert.Equal(t, DriftIssuedWebhookMissing, kind)
}

func TestReconcile_Classify_AmountMismatch(t *testing.T) {
	db := setupStateTestDB(t)
	seedReconcileOrder(t, db, "ISSUED", "PENDING", "VIRTUAL_ACCOUNT_SEEDREAM", "ORD-RC-AMT")

	svc := newReconcileSvc(db, nil)
	kind := svc.classifyDrift(context.Background(), seedream.VAccountResult{
		OrderNo: "ORD-RC-AMT", Status: "AMOUNT_MISMATCH", Phase: "failed",
	})
	assert.Equal(t, DriftAmountMismatch, kind)
}

func TestReconcile_Classify_UnknownOrder(t *testing.T) {
	db := setupStateTestDB(t)
	// 시드 없음

	svc := newReconcileSvc(db, nil)
	kind := svc.classifyDrift(context.Background(), seedream.VAccountResult{
		OrderNo: "ORD-DOES-NOT-EXIST", Status: "SUCCESS",
	})
	assert.Equal(t, DriftUnknownOrder, kind)
}

func TestReconcile_Classify_InSync(t *testing.T) {
	db := setupStateTestDB(t)
	// 내부 Payment 이미 SUCCESS 로 업데이트된 상태면 Seedream SUCCESS 와 드리프트 없음.
	seedReconcileOrder(t, db, "PAID", "SUCCESS", "VIRTUAL_ACCOUNT_SEEDREAM", "ORD-RC-SYNC")

	svc := newReconcileSvc(db, nil)
	kind := svc.classifyDrift(context.Background(), seedream.VAccountResult{
		OrderNo: "ORD-RC-SYNC", Status: "SUCCESS", Phase: "completed",
	})
	assert.Equal(t, DriftNone, kind)
}

func TestReconcile_Classify_TerminalInternal_NoDrift(t *testing.T) {
	// 내부가 COMPLETED 면 Seedream 의 어떤 상태도 drift 로 취급하지 않음.
	db := setupStateTestDB(t)
	seedReconcileOrder(t, db, "COMPLETED", "SUCCESS", "VIRTUAL_ACCOUNT_SEEDREAM", "ORD-RC-TERM")

	svc := newReconcileSvc(db, nil)
	kind := svc.classifyDrift(context.Background(), seedream.VAccountResult{
		OrderNo: "ORD-RC-TERM", Status: "CANCELLED", // 이상한 후행 상태
	})
	assert.Equal(t, DriftNone, kind)
}

func TestReconcile_EndToEnd_WalksAndLogs(t *testing.T) {
	db := setupStateTestDB(t)
	seedReconcileOrder(t, db, "PENDING", "PENDING", "VIRTUAL_ACCOUNT_SEEDREAM", "ORD-RC-E2E-1")
	seedReconcileOrder(t, db, "ISSUED", "PENDING", "VIRTUAL_ACCOUNT_SEEDREAM", "ORD-RC-E2E-2")

	items := []seedream.VAccountResult{
		{OrderNo: "ORD-RC-E2E-1", Status: "SUCCESS", Phase: "completed", Amount: 50000}, // missing deposit
		{OrderNo: "ORD-RC-E2E-2", Status: "PENDING", Phase: "awaiting_deposit"},          // in-sync
		{OrderNo: "ORD-RC-UNK", Status: "SUCCESS"},                                       // unknown order
	}
	svc := newReconcileSvc(db, items)

	// Reconcile 자체가 에러 없이 끝나야 함 (drift 는 로그만).
	require.NoError(t, svc.Reconcile(context.Background()))
}

func TestReconcile_CustomWindowAndNow(t *testing.T) {
	db := setupStateTestDB(t)
	svc := NewSeedreamReconcileService(db, &reconcileClientStub{}, zap.NewNop())
	fixed := time.Date(2026, 4, 24, 12, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return fixed }
	svc.window = 30 * time.Minute
	// WalkVAccountsSince 의 From 인자가 fixed-window 로 전달되는지 확인할 필요는 stub 에서는 생략.
	require.NoError(t, svc.Reconcile(context.Background()))
}
