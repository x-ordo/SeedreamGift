package services

import (
	"testing"
	"seedream-gift-server/internal/domain"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupCartTestDB는 CartService 테스트에 필요한 모든 도메인 모델을 마이그레이션한 테스트 DB를 준비합니다.
func setupCartTestDB() *CartService {
	db := setupTestDB()
	db.AutoMigrate(&domain.CartItem{}, &domain.Product{}, &domain.Brand{}, &domain.VoucherCode{})

	cfg := newMockConfigProvider()
	return NewCartService(db, cfg)
}

// seedBrandAndProduct는 테스트용 브랜드와 상품을 생성합니다.
func seedBrandAndProduct(svc *CartService, brandCode string, productID int, buyPrice int64) {
	svc.db.Create(&domain.Brand{Code: brandCode, Name: brandCode + "_name", IsActive: true})
	svc.db.Create(&domain.Product{
		ID:             productID,
		BrandCode:      brandCode,
		Name:           "Test Product",
		Price:          domain.NewNumericDecimalFromInt(100000),
		DiscountRate:   domain.NewNumericDecimalFromInt(5),
		BuyPrice:       domain.NewNumericDecimalFromInt(buyPrice),
		TradeInRate:    domain.NewNumericDecimalFromInt(0),
		IsActive:       true,
		MaxPurchaseQty: 10,
	})
}

// seedUser는 테스트용 사용자를 생성합니다.
func seedUser(svc *CartService, userID int) {
	svc.db.Create(&domain.User{ID: userID, Email: "cart-test@example.com", Password: "hashed"})
}

// ── AddItem ──

func TestCart_AddItem_Success(t *testing.T) {
	svc := setupCartTestDB()
	seedBrandAndProduct(svc, "SHINSE", 1, 95000)
	seedUser(svc, 1)

	err := svc.AddItem(1, 1, 2)
	require.NoError(t, err)

	// DB에서 직접 확인
	var items []domain.CartItem
	svc.db.Where("UserId = ?", 1).Find(&items)
	assert.Len(t, items, 1, "장바구니에 1개 항목이 있어야 합니다")
	assert.Equal(t, 2, items[0].Quantity)
}

func TestCart_AddItem_Duplicate(t *testing.T) {
	svc := setupCartTestDB()
	seedBrandAndProduct(svc, "SHINSE", 1, 95000)
	seedUser(svc, 1)

	// 최초 추가
	err := svc.AddItem(1, 1, 2)
	require.NoError(t, err)

	// 동일 상품 재추가 → 수량 누적
	err = svc.AddItem(1, 1, 3)
	require.NoError(t, err)

	var item domain.CartItem
	svc.db.Where("UserId = ? AND ProductId = ?", 1, 1).First(&item)
	assert.Equal(t, 5, item.Quantity, "수량이 2+3=5로 누적되어야 합니다")
}

func TestCart_AddItem_InactiveProduct(t *testing.T) {
	svc := setupCartTestDB()
	svc.db.Create(&domain.Brand{Code: "INACTIVE", Name: "Inactive Brand", IsActive: true})
	svc.db.Create(&domain.Product{
		ID:        99,
		BrandCode: "INACTIVE",
		Name:      "Inactive Product",
		Price:     domain.NewNumericDecimalFromInt(10000),
		BuyPrice:  domain.NewNumericDecimalFromInt(9500),
		IsActive:  true,
	})
	// GORM은 bool 기본값(default:true)이 있을 때 false 값을 무시하므로, 생성 후 별도 업데이트합니다.
	svc.db.Model(&domain.Product{}).Where("Id = ?", 99).Update("IsActive", false)
	seedUser(svc, 1)

	err := svc.AddItem(1, 99, 1)
	assert.Error(t, err, "비활성 상품은 장바구니에 추가할 수 없어야 합니다")
}

// ── GetCart ──

func TestCart_GetCart(t *testing.T) {
	svc := setupCartTestDB()
	seedUser(svc, 1)

	// 브랜드 2개, 상품 2개
	svc.db.Create(&domain.Brand{Code: "BR1", Name: "Brand1", IsActive: true})
	svc.db.Create(&domain.Brand{Code: "BR2", Name: "Brand2", IsActive: true})
	svc.db.Create(&domain.Product{
		ID: 10, BrandCode: "BR1", Name: "Product A", IsActive: true,
		Price: domain.NewNumericDecimalFromInt(100000), BuyPrice: domain.NewNumericDecimalFromInt(95000),
	})
	svc.db.Create(&domain.Product{
		ID: 20, BrandCode: "BR2", Name: "Product B", IsActive: true,
		Price: domain.NewNumericDecimalFromInt(50000), BuyPrice: domain.NewNumericDecimalFromInt(47000),
	})

	// 장바구니에 추가
	require.NoError(t, svc.AddItem(1, 10, 2))
	require.NoError(t, svc.AddItem(1, 20, 1))

	cart, err := svc.GetCart(1)
	require.NoError(t, err)
	assert.NotNil(t, cart)
	assert.Len(t, cart.Items, 2, "장바구니에 2개 항목이 있어야 합니다")
	assert.Equal(t, 3, cart.ItemCount, "총 수량은 2+1=3이어야 합니다")

	// totalAmount = 95000*2 + 47000*1 = 237000
	expectedTotal := decimal.NewFromInt(237000)
	assert.True(t, cart.TotalAmount.Equal(expectedTotal),
		"총액은 237000이어야 합니다, 실제: %s", cart.TotalAmount.String())
}

func TestCart_GetCart_Empty(t *testing.T) {
	svc := setupCartTestDB()
	seedUser(svc, 1)

	cart, err := svc.GetCart(1)
	require.NoError(t, err)
	assert.NotNil(t, cart)
	assert.Len(t, cart.Items, 0)
	assert.Equal(t, 0, cart.ItemCount)
	assert.True(t, cart.TotalAmount.Equal(decimal.Zero))
}

// ── UpdateQuantity ──

func TestCart_UpdateQuantity(t *testing.T) {
	svc := setupCartTestDB()
	seedBrandAndProduct(svc, "SHINSE", 1, 95000)
	seedUser(svc, 1)

	require.NoError(t, svc.AddItem(1, 1, 2))

	// 수량 변경
	err := svc.UpdateQuantity(1, 1, 5)
	require.NoError(t, err)

	var item domain.CartItem
	svc.db.Where("UserId = ? AND ProductId = ?", 1, 1).First(&item)
	assert.Equal(t, 5, item.Quantity, "수량이 5로 업데이트되어야 합니다")
}

func TestCart_UpdateQuantity_InvalidQuantity(t *testing.T) {
	svc := setupCartTestDB()
	seedBrandAndProduct(svc, "SHINSE", 1, 95000)
	seedUser(svc, 1)

	require.NoError(t, svc.AddItem(1, 1, 2))

	err := svc.UpdateQuantity(1, 1, 0)
	assert.Error(t, err, "수량 0은 허용되지 않아야 합니다")
}

func TestCart_UpdateQuantity_ExceedsMax(t *testing.T) {
	svc := setupCartTestDB()
	seedBrandAndProduct(svc, "SHINSE", 1, 95000) // MaxPurchaseQty=10
	seedUser(svc, 1)

	require.NoError(t, svc.AddItem(1, 1, 1))

	err := svc.UpdateQuantity(1, 1, 11)
	assert.Error(t, err, "최대 구매 수량 초과 시 에러가 발생해야 합니다")
}

// ── RemoveItem ──

func TestCart_RemoveItem(t *testing.T) {
	svc := setupCartTestDB()
	seedBrandAndProduct(svc, "SHINSE", 1, 95000)
	seedUser(svc, 1)

	require.NoError(t, svc.AddItem(1, 1, 3))

	err := svc.RemoveItem(1, 1)
	require.NoError(t, err)

	var count int64
	svc.db.Model(&domain.CartItem{}).Where("UserId = ?", 1).Count(&count)
	assert.Equal(t, int64(0), count, "삭제 후 장바구니가 비어 있어야 합니다")
}

// ── ClearCart ──

func TestCart_ClearCart(t *testing.T) {
	svc := setupCartTestDB()
	seedUser(svc, 1)

	svc.db.Create(&domain.Brand{Code: "B1", Name: "B1Name", IsActive: true})
	svc.db.Create(&domain.Brand{Code: "B2", Name: "B2Name", IsActive: true})
	svc.db.Create(&domain.Product{
		ID: 30, BrandCode: "B1", Name: "P1", IsActive: true,
		Price: domain.NewNumericDecimalFromInt(10000), BuyPrice: domain.NewNumericDecimalFromInt(9500),
	})
	svc.db.Create(&domain.Product{
		ID: 31, BrandCode: "B2", Name: "P2", IsActive: true,
		Price: domain.NewNumericDecimalFromInt(20000), BuyPrice: domain.NewNumericDecimalFromInt(19000),
	})

	require.NoError(t, svc.AddItem(1, 30, 1))
	require.NoError(t, svc.AddItem(1, 31, 2))

	err := svc.ClearCart(1)
	require.NoError(t, err)

	var count int64
	svc.db.Model(&domain.CartItem{}).Where("UserId = ?", 1).Count(&count)
	assert.Equal(t, int64(0), count, "전체 삭제 후 장바구니가 비어 있어야 합니다")
}
