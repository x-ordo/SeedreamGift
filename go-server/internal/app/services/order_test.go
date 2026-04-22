package services

import (
	"context"
	"errors"
	"testing"
	"time"
	"w-gift-server/internal/app/interfaces"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/internal/infra/payment"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/pagination"

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
