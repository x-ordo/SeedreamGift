package services

import (
	"testing"
	"time"

	"seedream-gift-server/internal/domain"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// seedExpiryTestOrder 는 Seedream VA 만료 테스트용 기본 시드입니다.
// expiresAt 이 nil 이면 Payment.ExpiresAt 을 설정하지 않음.
func seedExpiryTestOrder(t *testing.T, db *gorm.DB, orderStatus string, expiresAt *time.Time, method string) (*domain.Order, *domain.Payment) {
	t.Helper()
	code := "ORD-EXP-" + orderStatus
	o := &domain.Order{
		UserID: 42, Status: orderStatus, Source: "USER",
		TotalAmount: domain.NewNumericDecimal(decimal.NewFromInt(50000)),
		OrderCode:   &code,
	}
	require.NoError(t, db.Create(o).Error)

	phase := domain.SeedreamPhaseAwaitingDeposit
	idem := "gift:vaccount:" + code
	p := &domain.Payment{
		OrderID:                o.ID,
		Method:                 method,
		Amount:                 o.TotalAmount,
		Status:                 "PENDING",
		SeedreamPhase:          &phase,
		SeedreamIdempotencyKey: &idem,
		ExpiresAt:              expiresAt,
	}
	require.NoError(t, db.Create(p).Error)
	return o, p
}

// frozenNow 는 고정된 "now" 를 가진 service 를 반환합니다.
func newExpirySvcWithNow(db *gorm.DB, now time.Time) *SeedreamExpiryService {
	svc := NewSeedreamExpiryService(db, zap.NewNop())
	svc.now = func() time.Time { return now }
	return svc
}

func TestSeedreamExpiry_HappyPath_Pending(t *testing.T) {
	db := setupStateTestDB(t)
	now := time.Now().UTC()
	expiredAt := now.Add(-1 * time.Minute) // 1분 전 만료
	order, payment := seedExpiryTestOrder(t, db, "PENDING", &expiredAt, "VIRTUAL_ACCOUNT_SEEDREAM")

	svc := newExpirySvcWithNow(db, now)
	svc.ExpireSeedreamOrders()

	var gotOrder domain.Order
	require.NoError(t, db.First(&gotOrder, order.ID).Error)
	assert.Equal(t, domain.OrderStatusExpired, gotOrder.Status)

	var gotPayment domain.Payment
	require.NoError(t, db.First(&gotPayment, payment.ID).Error)
	assert.Equal(t, "CANCELLED", gotPayment.Status)
	require.NotNil(t, gotPayment.SeedreamPhase)
	assert.Equal(t, domain.SeedreamPhaseFailed, *gotPayment.SeedreamPhase)
	require.NotNil(t, gotPayment.CancelledAt)
	require.NotNil(t, gotPayment.FailReason)
}

func TestSeedreamExpiry_HappyPath_Issued(t *testing.T) {
	// 은행선택 후(ISSUED) 입금 없이 만료
	db := setupStateTestDB(t)
	now := time.Now().UTC()
	expiredAt := now.Add(-30 * time.Second)
	order, _ := seedExpiryTestOrder(t, db, "ISSUED", &expiredAt, "VIRTUAL_ACCOUNT_SEEDREAM")

	newExpirySvcWithNow(db, now).ExpireSeedreamOrders()

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, domain.OrderStatusExpired, got.Status)
}

func TestSeedreamExpiry_NotYetExpired_Skip(t *testing.T) {
	db := setupStateTestDB(t)
	now := time.Now().UTC()
	future := now.Add(10 * time.Minute) // 아직 만료 안 됨
	order, _ := seedExpiryTestOrder(t, db, "PENDING", &future, "VIRTUAL_ACCOUNT_SEEDREAM")

	newExpirySvcWithNow(db, now).ExpireSeedreamOrders()

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "PENDING", got.Status, "만료 전이면 상태 유지")
}

func TestSeedreamExpiry_AlreadyPaid_Idempotent(t *testing.T) {
	// race: Payment.ExpiresAt < now 이지만 Order 는 이미 PAID 일 때 건드리지 말아야 함.
	// seedExpiryTestOrder 는 Payment.Status='PENDING' 으로 생성하므로 조건부 업데이트가
	// Order.Status='PENDING'|'ISSUED' 가드에 의해 no-op 되는지 검증.
	db := setupStateTestDB(t)
	now := time.Now().UTC()
	expiredAt := now.Add(-1 * time.Minute)
	order, payment := seedExpiryTestOrder(t, db, "PAID", &expiredAt, "VIRTUAL_ACCOUNT_SEEDREAM")

	// 실제 race 를 흉내 — scan 에서는 잡혀도 UPDATE 의 WHERE 가 방어해야 함.
	// seed 가 PAID 로 만든 경우 SQL scan 자체에서 Order.Status IN ('PENDING','ISSUED') 필터가
	// 걸러내므로 선택되지 않음. 그래도 호출해 no-op 를 확인.
	newExpirySvcWithNow(db, now).ExpireSeedreamOrders()

	var gotOrder domain.Order
	require.NoError(t, db.First(&gotOrder, order.ID).Error)
	assert.Equal(t, "PAID", gotOrder.Status)

	var gotPayment domain.Payment
	require.NoError(t, db.First(&gotPayment, payment.ID).Error)
	assert.Equal(t, "PENDING", gotPayment.Status, "Payment 도 건드리지 말아야 함")
}

func TestSeedreamExpiry_NonSeedreamVA_Ignored(t *testing.T) {
	// 다른 결제 수단(CASH, VIRTUAL_ACCOUNT 등)은 OrderService.CancelExpiredOrders 담당.
	// 우리 서비스는 건드리지 말아야 함.
	db := setupStateTestDB(t)
	now := time.Now().UTC()
	expiredAt := now.Add(-1 * time.Minute)
	order, _ := seedExpiryTestOrder(t, db, "PENDING", &expiredAt, "CASH")

	newExpirySvcWithNow(db, now).ExpireSeedreamOrders()

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "PENDING", got.Status, "비-Seedream 주문은 무시")
}

func TestSeedreamExpiry_ReleasesReservedVouchers(t *testing.T) {
	db := setupStateTestDB(t)
	now := time.Now().UTC()
	expiredAt := now.Add(-1 * time.Minute)
	order, _ := seedExpiryTestOrder(t, db, "PENDING", &expiredAt, "VIRTUAL_ACCOUNT_SEEDREAM")

	soldAt := now
	vc := &domain.VoucherCode{
		ProductID: 1, PinCode: "encrypted-xxxx", PinHash: "hhh", Status: "RESERVED",
		OrderID:   &order.ID,
		SoldAt:    &soldAt,
	}
	require.NoError(t, db.Create(vc).Error)

	newExpirySvcWithNow(db, now).ExpireSeedreamOrders()

	var gotVC domain.VoucherCode
	require.NoError(t, db.First(&gotVC, vc.ID).Error)
	assert.Equal(t, "AVAILABLE", gotVC.Status)
	assert.Nil(t, gotVC.OrderID)
	assert.Nil(t, gotVC.SoldAt)
}

func TestSeedreamExpiry_NoCandidates_NoLogNoop(t *testing.T) {
	db := setupStateTestDB(t)
	// 시드 없음. 그냥 호출해도 에러 없이 no-op.
	newExpirySvcWithNow(db, time.Now()).ExpireSeedreamOrders()
}
