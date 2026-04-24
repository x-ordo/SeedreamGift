package services

import (
	"context"
	"errors"
	"testing"
	"time"
	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/payment"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/pagination"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// ─── Mock FraudChecker (order) ───

type orderMockFraudChecker struct {
	result *interfaces.FraudCheckResult
	err    error
}

func (m *orderMockFraudChecker) Check(userID int, source string) (*interfaces.FraudCheckResult, error) {
	return m.result, m.err
}

func (m *orderMockFraudChecker) CheckRealtime(userID int) (*interfaces.FraudCheckResult, error) {
	return m.result, m.err
}

// ─── Test helpers ───

// setupOrderTestDB sets up an in-memory SQLite database with all models needed for order tests.
func setupOrderTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := setupTestDB() // from auth_test.go — creates :memory: SQLite with User, RefreshToken
	err := db.AutoMigrate(
		&domain.Order{},
		&domain.OrderItem{},
		&domain.Product{},
		&domain.Brand{},
		&domain.VoucherCode{},
		&domain.Gift{},
		&domain.CartItem{},
		&domain.Payment{},
	)
	require.NoError(t, err, "AutoMigrate should succeed")
	return db
}

func defaultTestConfig() *config.Config {
	return &config.Config{
		JWTSecret:         "test-secret",
		JWTAccessExpiry:   time.Hour,
		EncryptionKey:     "6464646464646464646464646464646464646464646464646464646464646464",
		OrderCancelWindow: 30 * time.Minute,
	}
}

// createOrderTestUser creates a user in the DB and returns its ID.
func createOrderTestUser(t *testing.T, db *gorm.DB, email string) int {
	t.Helper()
	user := domain.User{Email: email, Password: "hashed"}
	require.NoError(t, db.Create(&user).Error)
	return user.ID
}

// createOrderTestBrand creates a brand in the DB.
func createOrderTestBrand(t *testing.T, db *gorm.DB, code, name string) {
	t.Helper()
	brand := domain.Brand{Code: code, Name: name, IsActive: true}
	require.NoError(t, db.Create(&brand).Error)
}

// createOrderTestProduct creates a product in the DB and returns its ID.
func createOrderTestProduct(t *testing.T, db *gorm.DB, brandCode string, price int64, isActive bool) int {
	t.Helper()
	// Calculate buyPrice with a 5% discount
	priceDec := decimal.NewFromInt(price)
	discountRate := decimal.NewFromFloat(5.0)
	buyPrice := priceDec.Mul(decimal.NewFromInt(1).Sub(discountRate.Div(decimal.NewFromInt(100))))

	product := domain.Product{
		BrandCode:    brandCode,
		Name:         "Test Gift Card",
		Price:        domain.NewNumericDecimal(priceDec),
		DiscountRate: domain.NewNumericDecimal(discountRate),
		BuyPrice:     domain.NewNumericDecimal(buyPrice),
		TradeInRate:  domain.NewNumericDecimal(decimal.NewFromFloat(3.0)),
		IsActive:     true, // GORM은 bool default:true 태그가 있으면 false 값을 무시하므로 항상 true로 생성
		Type:         "PHYSICAL",
	}
	require.NoError(t, db.Create(&product).Error)
	// GORM zero-value issue: bool 필드의 default:true 태그로 인해 false가 무시됨.
	// 비활성 상품이 필요한 경우 생성 후 별도 UPDATE로 처리합니다.
	if !isActive {
		require.NoError(t, db.Model(&domain.Product{}).Where("Id = ?", product.ID).Update("IsActive", false).Error)
	}
	return product.ID
}

func newOrderService(db *gorm.DB, cfg *config.Config, configProvider ConfigProvider) *OrderService {
	pp := payment.NewMockPaymentProvider()
	return NewOrderService(db, pp, cfg, configProvider)
}

// ─── Tests ───

func TestCreateOrder_Success(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	// Setup data
	createOrderTestBrand(t, db, "SHINSEGAE", "신세계")
	userID := createOrderTestUser(t, db, "buyer@test.com")
	productID := createOrderTestProduct(t, db, "SHINSEGAE", 100000, true)

	input := CreateOrderInput{
		Items: []struct {
			ProductID int `json:"productId" binding:"required"`
			Quantity  int `json:"quantity" binding:"required,min=1"`
		}{
			{ProductID: productID, Quantity: 2},
		},
		PaymentMethod:  "VIRTUAL_ACCOUNT",
		ShippingMethod: "DELIVERY",
		RecipientName:  "홍길동",
	}

	order, err := svc.CreateOrder(context.Background(), userID, input)
	require.NoError(t, err)
	require.NotNil(t, order)

	assert.Equal(t, "PENDING", order.Status)
	assert.Equal(t, userID, order.UserID)

	// BuyPrice = 100000 * 0.95 = 95000, Quantity = 2, Total = 190000
	expectedTotal := decimal.NewFromInt(95000).Mul(decimal.NewFromInt(2))
	assert.True(t, order.TotalAmount.Equal(expectedTotal),
		"expected totalAmount=%s, got=%s", expectedTotal, order.TotalAmount.String())
	assert.NotNil(t, order.OrderCode)
	assert.NotNil(t, order.PaymentDeadlineAt)
	assert.NotNil(t, order.WithdrawalDeadlineAt)

	// Verify OrderItems were created
	assert.Len(t, order.OrderItems, 1)
	assert.Equal(t, 2, order.OrderItems[0].Quantity)
}

func TestCreateOrder_InactiveProduct(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	createOrderTestBrand(t, db, "LOTTE", "롯데")
	userID := createOrderTestUser(t, db, "buyer2@test.com")
	productID := createOrderTestProduct(t, db, "LOTTE", 50000, false) // inactive

	input := CreateOrderInput{
		Items: []struct {
			ProductID int `json:"productId" binding:"required"`
			Quantity  int `json:"quantity" binding:"required,min=1"`
		}{
			{ProductID: productID, Quantity: 1},
		},
	}

	order, err := svc.CreateOrder(context.Background(), userID, input)
	assert.Nil(t, order)
	assert.Error(t, err)

	var appErr *apperror.AppError
	require.True(t, errors.As(err, &appErr))
	assert.Equal(t, apperror.CodeValidation, appErr.Code)
	assert.Contains(t, appErr.Message, "비활성 상품")
}

func TestCreateOrder_Idempotency(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	createOrderTestBrand(t, db, "HYUNDAI", "현대")
	userID := createOrderTestUser(t, db, "buyer3@test.com")
	productID := createOrderTestProduct(t, db, "HYUNDAI", 100000, true)

	input := CreateOrderInput{
		Items: []struct {
			ProductID int `json:"productId" binding:"required"`
			Quantity  int `json:"quantity" binding:"required,min=1"`
		}{
			{ProductID: productID, Quantity: 1},
		},
		IdempotencyKey: "unique-key-12345",
	}

	// First call creates the order
	order1, err := svc.CreateOrder(context.Background(), userID, input)
	require.NoError(t, err)
	require.NotNil(t, order1)

	// Second call with same idempotency key returns existing order
	order2, err := svc.CreateOrder(context.Background(), userID, input)
	require.NoError(t, err)
	require.NotNil(t, order2)

	assert.Equal(t, order1.ID, order2.ID, "idempotent request should return same order")

	// Verify only one order exists in DB
	var count int64
	db.Model(&domain.Order{}).Where("UserId = ?", userID).Count(&count)
	assert.Equal(t, int64(1), count, "should have exactly 1 order in DB")
}

func TestCreateOrder_FraudHold(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	// Set up fraud checker that flags the user
	svc.SetFraudChecker(&orderMockFraudChecker{
		result: &interfaces.FraudCheckResult{
			IsFlagged:      true,
			PhoneCaution:   "Y",
			AccountCaution: "N",
		},
	})

	createOrderTestBrand(t, db, "DAISO", "다이소")
	userID := createOrderTestUser(t, db, "fraud@test.com")
	productID := createOrderTestProduct(t, db, "DAISO", 50000, true)

	input := CreateOrderInput{
		Items: []struct {
			ProductID int `json:"productId" binding:"required"`
			Quantity  int `json:"quantity" binding:"required,min=1"`
		}{
			{ProductID: productID, Quantity: 1},
		},
	}

	order, err := svc.CreateOrder(context.Background(), userID, input)
	require.NoError(t, err)
	require.NotNil(t, order)

	assert.Equal(t, "FRAUD_HOLD", order.Status, "fraud-flagged order should be in FRAUD_HOLD status")
}

func TestCreateOrder_PurchaseLimit(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	// Set per-order limit to 100000
	cp := &mockConfigProvider{
		values: map[string]string{
			"LIMIT_PER_ORDER": "100000",
			"LIMIT_PER_DAY":   "10000000",
			"LIMIT_PER_MONTH": "50000000",
		},
	}
	svc := newOrderService(db, cfg, cp)

	createOrderTestBrand(t, db, "OLIVE", "올리브영")
	userID := createOrderTestUser(t, db, "buyer5@test.com")
	// Product with buyPrice = 200000 * 0.95 = 190000
	productID := createOrderTestProduct(t, db, "OLIVE", 200000, true)

	input := CreateOrderInput{
		Items: []struct {
			ProductID int `json:"productId" binding:"required"`
			Quantity  int `json:"quantity" binding:"required,min=1"`
		}{
			{ProductID: productID, Quantity: 1},
		},
	}

	// 190000 > 100000 limit → should fail
	order, err := svc.CreateOrder(context.Background(), userID, input)
	assert.Nil(t, order)
	assert.Error(t, err)

	var appErr *apperror.AppError
	require.True(t, errors.As(err, &appErr))
	assert.Equal(t, apperror.CodeValidation, appErr.Code)
	assert.Contains(t, appErr.Message, "1회 주문 한도")
}

func TestCancelOrder_Success(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	createOrderTestBrand(t, db, "SS", "신세계C")
	userID := createOrderTestUser(t, db, "cancel@test.com")
	productID := createOrderTestProduct(t, db, "SS", 100000, true)

	// Create order first
	input := CreateOrderInput{
		Items: []struct {
			ProductID int `json:"productId" binding:"required"`
			Quantity  int `json:"quantity" binding:"required,min=1"`
		}{
			{ProductID: productID, Quantity: 1},
		},
	}
	order, err := svc.CreateOrder(context.Background(), userID, input)
	require.NoError(t, err)

	// Cancel it
	err = svc.CancelOrder(order.ID, userID)
	require.NoError(t, err)

	// Verify the order status is CANCELLED
	var updated domain.Order
	require.NoError(t, db.First(&updated, order.ID).Error)
	assert.Equal(t, "CANCELLED", updated.Status)
}

func TestCancelOrder_NotOwner(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	createOrderTestBrand(t, db, "LT", "롯데C")
	ownerID := createOrderTestUser(t, db, "owner@test.com")
	otherID := createOrderTestUser(t, db, "other@test.com")
	productID := createOrderTestProduct(t, db, "LT", 100000, true)

	input := CreateOrderInput{
		Items: []struct {
			ProductID int `json:"productId" binding:"required"`
			Quantity  int `json:"quantity" binding:"required,min=1"`
		}{
			{ProductID: productID, Quantity: 1},
		},
	}
	order, err := svc.CreateOrder(context.Background(), ownerID, input)
	require.NoError(t, err)

	// Try to cancel as another user
	err = svc.CancelOrder(order.ID, otherID)
	assert.Error(t, err)

	var appErr *apperror.AppError
	require.True(t, errors.As(err, &appErr))
	assert.Equal(t, apperror.CodeForbidden, appErr.Code)
}

func TestGetMyOrders_Pagination(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	createOrderTestBrand(t, db, "HD", "현대P")
	userID := createOrderTestUser(t, db, "paged@test.com")
	productID := createOrderTestProduct(t, db, "HD", 100000, true)

	// Create 3 orders
	for i := 0; i < 3; i++ {
		input := CreateOrderInput{
			Items: []struct {
				ProductID int `json:"productId" binding:"required"`
				Quantity  int `json:"quantity" binding:"required,min=1"`
			}{
				{ProductID: productID, Quantity: 1},
			},
		}
		_, err := svc.CreateOrder(context.Background(), userID, input)
		require.NoError(t, err)
	}

	// Fetch page 1 with limit 2
	params := pagination.QueryParams{Page: 1, Limit: 2}
	result, err := svc.GetMyOrders(userID, params)
	require.NoError(t, err)

	assert.Len(t, result.Items, 2, "page 1 should return 2 items")
	assert.Equal(t, int64(3), result.Meta.Total, "total should be 3")
	assert.Equal(t, 2, result.Meta.TotalPages, "should have 2 pages")
	assert.True(t, result.Meta.HasNextPage)
	assert.False(t, result.Meta.HasPrevPage)

	// Fetch page 2
	params2 := pagination.QueryParams{Page: 2, Limit: 2}
	result2, err := svc.GetMyOrders(userID, params2)
	require.NoError(t, err)

	assert.Len(t, result2.Items, 1, "page 2 should return 1 item")
	assert.True(t, result2.Meta.HasPrevPage)
	assert.False(t, result2.Meta.HasNextPage)
}

func TestGetOrderDetail_Success(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	createOrderTestBrand(t, db, "SG", "신세계D")
	userID := createOrderTestUser(t, db, "detail@test.com")
	productID := createOrderTestProduct(t, db, "SG", 100000, true)

	input := CreateOrderInput{
		Items: []struct {
			ProductID int `json:"productId" binding:"required"`
			Quantity  int `json:"quantity" binding:"required,min=1"`
		}{
			{ProductID: productID, Quantity: 2},
		},
	}
	order, err := svc.CreateOrder(context.Background(), userID, input)
	require.NoError(t, err)

	// Get order detail as owner (USER role)
	detail, err := svc.GetOrderDetail(order.ID, userID, "USER")
	require.NoError(t, err)
	require.NotNil(t, detail)

	assert.Equal(t, order.ID, detail.ID)
	assert.Equal(t, userID, detail.UserID)
	assert.Len(t, detail.OrderItems, 1, "should have 1 order item")
	assert.Equal(t, 2, detail.OrderItems[0].Quantity)
}

func TestGetOrderDetail_NotOwner(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	createOrderTestBrand(t, db, "LT2", "롯데D")
	ownerID := createOrderTestUser(t, db, "detailowner@test.com")
	otherID := createOrderTestUser(t, db, "detailother@test.com")
	productID := createOrderTestProduct(t, db, "LT2", 100000, true)

	input := CreateOrderInput{
		Items: []struct {
			ProductID int `json:"productId" binding:"required"`
			Quantity  int `json:"quantity" binding:"required,min=1"`
		}{
			{ProductID: productID, Quantity: 1},
		},
	}
	order, err := svc.CreateOrder(context.Background(), ownerID, input)
	require.NoError(t, err)

	// Other user with USER role should not see the order
	detail, err := svc.GetOrderDetail(order.ID, otherID, "USER")
	assert.Error(t, err, "non-owner USER should get error")
	assert.Nil(t, detail)
}

// classifyPaymentUIStatus 순수 함수 단위 테스트 — Order/Payment 조합 → UIStatus.
func TestClassifyPaymentUIStatus(t *testing.T) {
	awaitingBS := "awaiting_bank_selection"
	awaitingDep := "awaiting_deposit"

	tests := []struct {
		name    string
		order   *domain.Order
		payment *domain.Payment
		want    string
	}{
		{"nil order", nil, nil, PaymentUIStatusUnknown},
		{"CANCELLED order", &domain.Order{Status: "CANCELLED"}, nil, PaymentUIStatusCancelled},
		{"EXPIRED order", &domain.Order{Status: "EXPIRED"}, nil, PaymentUIStatusExpired},
		{"PAID order", &domain.Order{Status: "PAID"}, nil, PaymentUIStatusPaid},
		{"DELIVERED order", &domain.Order{Status: "DELIVERED"}, nil, PaymentUIStatusPaid},
		{"COMPLETED order", &domain.Order{Status: "COMPLETED"}, nil, PaymentUIStatusPaid},
		{"AMOUNT_MISMATCH distinct", &domain.Order{Status: "AMOUNT_MISMATCH"}, nil, PaymentUIStatusAmountMismatch},
		{"FRAUD_HOLD → FAILED", &domain.Order{Status: "FRAUD_HOLD"}, nil, PaymentUIStatusFailed},
		{"ISSUED → AwaitingDeposit", &domain.Order{Status: "ISSUED"}, nil, PaymentUIStatusAwaitingDeposit},
		{
			"PENDING + awaiting_bank_selection",
			&domain.Order{Status: "PENDING"},
			&domain.Payment{SeedreamPhase: &awaitingBS},
			PaymentUIStatusAwaitingBankSelection,
		},
		{
			"PENDING + awaiting_deposit race",
			&domain.Order{Status: "PENDING"},
			&domain.Payment{SeedreamPhase: &awaitingDep},
			PaymentUIStatusAwaitingDeposit,
		},
		{"PENDING + CASH (payment nil)", &domain.Order{Status: "PENDING"}, nil, PaymentUIStatusAwaitingDeposit},
		{"unknown status fallback", &domain.Order{Status: "SOMETHING_WEIRD"}, nil, PaymentUIStatusUnknown},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := classifyPaymentUIStatus(tt.order, tt.payment)
			assert.Equal(t, tt.want, got)
		})
	}
}

// canResumePayment 단위 테스트.
func TestCanResumePayment(t *testing.T) {
	past := time.Now().Add(-1 * time.Minute)
	future := time.Now().Add(10 * time.Minute)

	tests := []struct {
		name    string
		order   *domain.Order
		payment *domain.Payment
		want    bool
	}{
		{"nil order", nil, nil, false},
		{"CANCELLED", &domain.Order{Status: "CANCELLED"}, nil, false},
		{"EXPIRED", &domain.Order{Status: "EXPIRED"}, nil, false},
		{"PAID", &domain.Order{Status: "PAID"}, nil, false},
		{"PENDING + no payment → resume OK", &domain.Order{Status: "PENDING"}, nil, true},
		{"PENDING + payment 기한 지남 → no", &domain.Order{Status: "PENDING"}, &domain.Payment{ExpiresAt: &past}, false},
		{"PENDING + 기한 남음 → OK", &domain.Order{Status: "PENDING"}, &domain.Payment{ExpiresAt: &future}, true},
		{"ISSUED + 기한 남음 → OK", &domain.Order{Status: "ISSUED"}, &domain.Payment{ExpiresAt: &future}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, canResumePayment(tt.order, tt.payment))
		})
	}
}

// seedOrderForStatus 는 GetPaymentStatus 통합 테스트용 Order 를 직접 insert 합니다.
// CreateOrder 의 KYC 검증 파이프라인을 우회 (기존 테스트 fixture 와 동일 접근).
func seedOrderForStatus(t *testing.T, db *gorm.DB, userID int, status string, code string) *domain.Order {
	t.Helper()
	o := &domain.Order{
		UserID: userID, Status: status, Source: "USER",
		TotalAmount: domain.NewNumericDecimal(decimal.NewFromInt(100000)),
		OrderCode:   &code,
	}
	require.NoError(t, db.Create(o).Error)
	return o
}

func TestGetPaymentStatus_OwnerPendingVA(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	userID := createOrderTestUser(t, db, "pstatus@test.com")
	order := seedOrderForStatus(t, db, userID, "PENDING", "ORD-PS-1")

	phase := "awaiting_bank_selection"
	bankCode := "088"
	accountNo := "110-123-456789"
	depositor := "씨드림기프트"
	expires := time.Now().Add(30 * time.Minute)
	require.NoError(t, db.Create(&domain.Payment{
		OrderID: order.ID, Method: "VIRTUAL_ACCOUNT_SEEDREAM",
		Amount: order.TotalAmount, Status: "PENDING",
		SeedreamPhase: &phase, BankCode: &bankCode,
		AccountNumber: &accountNo, DepositorName: &depositor,
		ExpiresAt: &expires,
	}).Error)

	resp, err := svc.GetPaymentStatus(order.ID, userID, "USER")
	require.NoError(t, err)
	assert.Equal(t, "VIRTUAL_ACCOUNT_SEEDREAM", resp.Method)
	assert.Equal(t, PaymentUIStatusAwaitingBankSelection, resp.UIStatus)
	assert.True(t, resp.CanResume)
	require.NotNil(t, resp.AccountNumber)
	assert.Equal(t, accountNo, *resp.AccountNumber)
	assert.Equal(t, int64(100000), resp.TotalAmount)
}

func TestGetPaymentStatus_NotOwner_NotFound(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	owner := createOrderTestUser(t, db, "owner-ps@test.com")
	other := createOrderTestUser(t, db, "other-ps@test.com")
	order := seedOrderForStatus(t, db, owner, "PENDING", "ORD-PS-2")

	resp, err := svc.GetPaymentStatus(order.ID, other, "USER")
	assert.Error(t, err)
	assert.Nil(t, resp)
}

func TestGetPaymentStatus_AdminCanSeeOthers(t *testing.T) {
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	owner := createOrderTestUser(t, db, "owner-admin@test.com")
	admin := createOrderTestUser(t, db, "admin-viewer@test.com")
	order := seedOrderForStatus(t, db, owner, "PAID", "ORD-PS-3")

	resp, err := svc.GetPaymentStatus(order.ID, admin, "ADMIN")
	require.NoError(t, err)
	assert.Equal(t, PaymentUIStatusPaid, resp.UIStatus)
	assert.False(t, resp.CanResume)
}

func TestGetPaymentStatus_NoPaymentRecord_CashPending(t *testing.T) {
	// Payment 레코드가 아직 없는 PENDING 주문(CASH) — AwaitingDeposit 로 분류되고
	// 결제 정보 필드는 nil.
	db := setupOrderTestDB(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	userID := createOrderTestUser(t, db, "cash-ps@test.com")
	order := seedOrderForStatus(t, db, userID, "PENDING", "ORD-PS-4")

	resp, err := svc.GetPaymentStatus(order.ID, userID, "USER")
	require.NoError(t, err)
	assert.Equal(t, PaymentUIStatusAwaitingDeposit, resp.UIStatus)
	assert.Nil(t, resp.AccountNumber)
	assert.Empty(t, resp.Method)
	assert.True(t, resp.CanResume)
}

// setupOrderTestDBWithEvents 는 OrderEvents 테이블까지 생성한 in-memory DB 를 반환합니다.
// OrderEvent.Payload nvarchar(max) 이 SQLite 에서 AutoMigrate 실패하므로 수동 CREATE.
func setupOrderTestDBWithEvents(t *testing.T) *gorm.DB {
	db := setupOrderTestDB(t)
	require.NoError(t, db.Exec(`
		CREATE TABLE IF NOT EXISTS "OrderEvents" (
			"Id"        INTEGER PRIMARY KEY AUTOINCREMENT,
			"OrderId"   INTEGER NOT NULL,
			"EventType" TEXT NOT NULL,
			"Payload"   TEXT,
			"ActorId"   INTEGER,
			"ActorType" TEXT,
			"CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`).Error)
	return db
}

func TestGetOrderTimeline_OwnerSeesEvents(t *testing.T) {
	db := setupOrderTestDBWithEvents(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	userID := createOrderTestUser(t, db, "tl-owner@test.com")
	order := seedOrderForStatus(t, db, userID, "PAID", "ORD-TL-1")

	// 두 개 이벤트 삽입 — 시간 간격으로
	evtSvc := NewOrderEventService(db)
	evtSvc.Record(nil, order.ID, "VACCOUNT_ISSUED", nil, "SYSTEM", map[string]any{
		"orderCode": "ORD-TL-1", "bankCode": "088",
	})
	evtSvc.Record(nil, order.ID, "PAYMENT_CONFIRMED", nil, "SYSTEM", map[string]any{
		"amount": 50000, "vouchersSold": 1,
	})

	events, err := svc.GetOrderTimeline(order.ID, userID, "USER")
	require.NoError(t, err)
	require.Len(t, events, 2)
	assert.Equal(t, "VACCOUNT_ISSUED", events[0].EventType)
	assert.Equal(t, "PAYMENT_CONFIRMED", events[1].EventType)
	// Payload 필터링 확인 — 허용된 키만 존재
	require.NotNil(t, events[0].Payload)
	assert.Equal(t, "088", events[0].Payload["bankCode"])
}

func TestGetOrderTimeline_NotOwner_NotFound(t *testing.T) {
	db := setupOrderTestDBWithEvents(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	owner := createOrderTestUser(t, db, "tl-own@test.com")
	other := createOrderTestUser(t, db, "tl-other@test.com")
	order := seedOrderForStatus(t, db, owner, "PAID", "ORD-TL-2")

	evtSvc := NewOrderEventService(db)
	evtSvc.Record(nil, order.ID, "PAYMENT_CONFIRMED", nil, "SYSTEM", map[string]any{"amount": 1000})

	events, err := svc.GetOrderTimeline(order.ID, other, "USER")
	assert.Error(t, err)
	assert.Nil(t, events)
}

func TestGetOrderTimeline_SanitizesDisallowedKeys(t *testing.T) {
	// Payload 에 민감 키(accountNumber, pinCode 등) 가 섞여 들어와도 allow-list 필터로
	// 제거되어 응답에 포함되지 않아야 함.
	db := setupOrderTestDBWithEvents(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	userID := createOrderTestUser(t, db, "tl-san@test.com")
	order := seedOrderForStatus(t, db, userID, "PAID", "ORD-TL-3")

	NewOrderEventService(db).Record(nil, order.ID, "PAYMENT_CONFIRMED", nil, "SYSTEM", map[string]any{
		"amount":        50000,
		"accountNumber": "110-SECRET-999", // 민감 — 제거돼야 함
		"pinCode":       "9999",           // 민감 — 제거돼야 함
	})

	events, err := svc.GetOrderTimeline(order.ID, userID, "USER")
	require.NoError(t, err)
	require.Len(t, events, 1)
	require.NotNil(t, events[0].Payload)
	assert.Contains(t, events[0].Payload, "amount")
	assert.NotContains(t, events[0].Payload, "accountNumber", "민감 키는 응답에서 제거돼야 함")
	assert.NotContains(t, events[0].Payload, "pinCode")
}

func TestGetOrderTimeline_NoEvents_EmptySlice(t *testing.T) {
	db := setupOrderTestDBWithEvents(t)
	cfg := defaultTestConfig()
	cp := newMockConfigProvider()
	svc := newOrderService(db, cfg, cp)

	userID := createOrderTestUser(t, db, "tl-empty@test.com")
	order := seedOrderForStatus(t, db, userID, "PENDING", "ORD-TL-4")

	events, err := svc.GetOrderTimeline(order.ID, userID, "USER")
	require.NoError(t, err)
	assert.Empty(t, events)
}
