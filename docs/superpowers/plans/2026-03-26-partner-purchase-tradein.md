# 파트너 전용 구매/매입 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 파트너 포털에서 상품권 구매(대량, CSV 수령)와 매입(PIN 제출, 관리자 검수)을 할 수 있는 전용 경로 구현

**Architecture:** 기존 `PartnerService`를 확장하여 구매/매입 메서드를 추가하고, 파트너 라우트 그룹에 새 엔드포인트를 등록한다. `PartnerPrices` 테이블로 파트너별 개별 단가를 관리하며, `Order`/`TradeIn` 모델에 `Source` 필드를 추가하여 파트너 거래를 구분한다. 프론트엔드는 파트너 포털에 Buy/Trade-in 탭 2개를 추가한다.

**Tech Stack:** Go (Gin + GORM + MSSQL), React 18 + TypeScript (Vite), Zustand, CSS Variables

**Spec:** `docs/superpowers/specs/2026-03-26-partner-purchase-tradein-design.md`

---

## 파일 구조

### 생성 파일

| 파일 | 역할 |
|------|------|
| `go-server/internal/domain/partner_price.go` | PartnerPrice 도메인 모델 |
| `go-server/internal/app/services/partner_price_svc.go` | 관리자 단가 CRUD 서비스 |
| `go-server/internal/app/services/partner_order_svc.go` | 파트너 구매 서비스 (주문 생성, CSV 등) |
| `go-server/internal/app/services/partner_tradein_svc.go` | 파트너 매입 서비스 |
| `go-server/internal/api/handlers/partner_order_handler.go` | 파트너 구매 핸들러 |
| `go-server/internal/api/handlers/partner_tradein_handler.go` | 파트너 매입 핸들러 |
| `go-server/internal/api/handlers/admin_partner_price_handler.go` | 관리자 단가 관리 핸들러 |
| `partner/src/pages/tabs/BuyTab.tsx` | 파트너 구매 탭 UI |
| `partner/src/pages/tabs/TradeInTab.tsx` | 파트너 매입 탭 UI |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `go-server/internal/domain/order.go` | `Source` 필드 추가 |
| `go-server/internal/domain/tradein.go` | `Source` 필드 추가 |
| `go-server/internal/routes/partner.go` | 구매/매입 라우트 등록 |
| `go-server/internal/routes/admin.go` | 단가 관리 라우트 등록 |
| `go-server/internal/routes/container.go` | 새 핸들러 DI 등록 |
| `go-server/main.go` | AutoMigrate에 PartnerPrice 추가 |
| `partner/src/constants.ts` | Buy, Trade-in 탭 추가 |
| `partner/src/pages/PartnerPage.tsx` | 새 탭 컴포넌트 lazy import |
| `partner/src/api/manual.ts` | 파트너 구매/매입 API 함수 추가 |

---

## Task 1: PartnerPrice 도메인 모델 + DB 마이그레이션

**Files:**
- Create: `go-server/internal/domain/partner_price.go`
- Modify: `go-server/main.go` (AutoMigrate 추가)

- [ ] **Step 1: PartnerPrice 도메인 모델 생성**

```go
// go-server/internal/domain/partner_price.go
package domain

import "time"

// PartnerPrice는 관리자가 파트너×상품 조합별로 설정한 개별 단가입니다.
type PartnerPrice struct {
	ID           int            `gorm:"primaryKey;column:Id" json:"id"`
	PartnerId    int            `gorm:"column:PartnerId;uniqueIndex:idx_partner_product;not null" json:"partnerId"`
	ProductId    int            `gorm:"column:ProductId;uniqueIndex:idx_partner_product;not null" json:"productId"`
	BuyPrice     NumericDecimal `gorm:"column:BuyPrice;type:decimal(12,0);not null" json:"buyPrice"`
	TradeInPrice NumericDecimal `gorm:"column:TradeInPrice;type:decimal(12,0);not null" json:"tradeInPrice"`
	CreatedAt    time.Time      `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time      `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`

	Partner *User    `gorm:"foreignKey:PartnerId" json:"partner,omitempty"`
	Product *Product `gorm:"foreignKey:ProductId" json:"product,omitempty"`
}

func (PartnerPrice) TableName() string { return "PartnerPrices" }
```

- [ ] **Step 2: Order/TradeIn 모델에 Source 필드 추가**

`go-server/internal/domain/order.go` — Order struct에 추가:
```go
Source string `gorm:"column:Source;default:'USER';size:10" json:"source"`
```

`go-server/internal/domain/tradein.go` — TradeIn struct에 추가:
```go
Source string `gorm:"column:Source;default:'USER';size:10" json:"source"`
```

- [ ] **Step 3: AutoMigrate에 PartnerPrice 등록**

`go-server/main.go`에서 기존 `AutoMigrate` 호출 부분을 찾아 `&domain.PartnerPrice{}`를 추가한다.

- [ ] **Step 4: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 빌드 성공, 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add go-server/internal/domain/partner_price.go go-server/internal/domain/order.go go-server/internal/domain/tradein.go go-server/main.go
git commit -m "feat: add PartnerPrice domain model and Source field to Order/TradeIn"
```

---

## Task 2: 관리자 단가 관리 서비스 + 핸들러

**Files:**
- Create: `go-server/internal/app/services/partner_price_svc.go`
- Create: `go-server/internal/api/handlers/admin_partner_price_handler.go`

- [ ] **Step 1: AdminPartnerPriceService 생성**

```go
// go-server/internal/app/services/partner_price_svc.go
package services

import (
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/pagination"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type AdminPartnerPriceService struct {
	db *gorm.DB
}

func NewAdminPartnerPriceService(db *gorm.DB) *AdminPartnerPriceService {
	return &AdminPartnerPriceService{db: db}
}

// GetPrices는 파트너 단가 목록을 페이지네이션하여 반환합니다.
func (s *AdminPartnerPriceService) GetPrices(partnerId int, params pagination.Params) ([]domain.PartnerPrice, int64, error) {
	var items []domain.PartnerPrice
	var total int64
	query := s.db.Model(&domain.PartnerPrice{})
	if partnerId > 0 {
		query = query.Where("PartnerId = ?", partnerId)
	}
	query.Count(&total)
	err := query.Preload("Partner", func(db *gorm.DB) *gorm.DB {
		return db.Select("Id", "Email", "Name", "PartnerTier")
	}).Preload("Product", func(db *gorm.DB) *gorm.DB {
		return db.Select("Id", "Name", "BrandCode", "Price", "BuyPrice", "TradeInRate")
	}).Order("CreatedAt DESC").
		Offset(params.Offset()).Limit(params.Limit).
		Find(&items).Error
	return items, total, err
}

// GetPricesByPartner는 특정 파트너의 모든 단가를 반환합니다.
func (s *AdminPartnerPriceService) GetPricesByPartner(partnerId int) ([]domain.PartnerPrice, error) {
	var items []domain.PartnerPrice
	err := s.db.Where("PartnerId = ?", partnerId).
		Preload("Product", func(db *gorm.DB) *gorm.DB {
			return db.Select("Id", "Name", "BrandCode", "Price", "BuyPrice", "TradeInRate")
		}).Find(&items).Error
	return items, err
}

// UpsertPrice는 파트너×상품 단가를 생성하거나 갱신합니다.
func (s *AdminPartnerPriceService) UpsertPrice(partnerId, productId int, buyPrice, tradeInPrice float64) (*domain.PartnerPrice, error) {
	if buyPrice <= 0 || tradeInPrice <= 0 {
		return nil, apperror.Validation("구매 단가와 매입 단가는 0보다 커야 합니다")
	}
	// 파트너 존재 확인
	var user domain.User
	if err := s.db.Select("Id", "Role").First(&user, partnerId).Error; err != nil {
		return nil, apperror.NotFound("파트너를 찾을 수 없습니다")
	}
	if user.Role != "PARTNER" && user.Role != "ADMIN" {
		return nil, apperror.Validation("파트너 역할의 사용자만 단가를 설정할 수 있습니다")
	}
	// 상품 존재 확인
	var product domain.Product
	if err := s.db.Select("Id").First(&product, productId).Error; err != nil {
		return nil, apperror.NotFound("상품을 찾을 수 없습니다")
	}

	price := domain.PartnerPrice{
		PartnerId:    partnerId,
		ProductId:    productId,
		BuyPrice:     domain.NewNumericDecimalFromFloat(buyPrice),
		TradeInPrice: domain.NewNumericDecimalFromFloat(tradeInPrice),
	}
	err := s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "PartnerId"}, {Name: "ProductId"}},
		DoUpdates: clause.AssignmentColumns([]string{"BuyPrice", "TradeInPrice", "UpdatedAt"}),
	}).Create(&price).Error
	if err != nil {
		return nil, apperror.Internal("단가 저장 실패", err)
	}
	return &price, nil
}

// DeletePrice는 단가 설정을 삭제합니다 (기본값으로 복귀).
func (s *AdminPartnerPriceService) DeletePrice(id int) error {
	result := s.db.Delete(&domain.PartnerPrice{}, id)
	if result.RowsAffected == 0 {
		return apperror.NotFound("단가 설정을 찾을 수 없습니다")
	}
	return result.Error
}
```

- [ ] **Step 2: AdminPartnerPriceHandler 생성**

```go
// go-server/internal/api/handlers/admin_partner_price_handler.go
package handlers

import (
	"strconv"
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminPartnerPriceHandler struct {
	service *services.AdminPartnerPriceService
}

func NewAdminPartnerPriceHandler(service *services.AdminPartnerPriceService) *AdminPartnerPriceHandler {
	return &AdminPartnerPriceHandler{service: service}
}

func (h *AdminPartnerPriceHandler) GetPrices(c *gin.Context) {
	partnerId, _ := strconv.Atoi(c.Query("partnerId"))
	params := pagination.FromQuery(c)
	items, total, err := h.service.GetPrices(partnerId, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.SuccessWithMeta(c, items, pagination.Meta(params, total))
}

func (h *AdminPartnerPriceHandler) GetPricesByPartner(c *gin.Context) {
	partnerId, err := strconv.Atoi(c.Param("partnerId"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 파트너 ID입니다")
		return
	}
	items, err := h.service.GetPricesByPartner(partnerId)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, items)
}

func (h *AdminPartnerPriceHandler) UpsertPrice(c *gin.Context) {
	var req struct {
		PartnerId    int     `json:"partnerId" binding:"required"`
		ProductId    int     `json:"productId" binding:"required"`
		BuyPrice     float64 `json:"buyPrice" binding:"required,gt=0"`
		TradeInPrice float64 `json:"tradeInPrice" binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	price, err := h.service.UpsertPrice(req.PartnerId, req.ProductId, req.BuyPrice, req.TradeInPrice)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, price)
}

func (h *AdminPartnerPriceHandler) DeletePrice(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 ID입니다")
		return
	}
	if err := h.service.DeletePrice(id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "단가 설정이 삭제되었습니다"})
}
```

- [ ] **Step 3: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add go-server/internal/app/services/partner_price_svc.go go-server/internal/api/handlers/admin_partner_price_handler.go
git commit -m "feat: add AdminPartnerPriceService and handler for partner price management"
```

---

## Task 3: 파트너 구매 서비스

**Files:**
- Create: `go-server/internal/app/services/partner_order_svc.go`

- [ ] **Step 1: PartnerOrderService 생성**

```go
// go-server/internal/app/services/partner_order_svc.go
package services

import (
	"encoding/csv"
	"fmt"
	"strings"
	"time"

	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/crypto"
	"w-gift-server/pkg/pagination"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type PartnerOrderService struct {
	db            *gorm.DB
	encryptionKey string
	config        ConfigProvider
}

func NewPartnerOrderService(db *gorm.DB, encryptionKey string, config ConfigProvider) *PartnerOrderService {
	return &PartnerOrderService{db: db, encryptionKey: encryptionKey, config: config}
}

// resolvePartnerPrice는 파트너별 개별 단가를 조회하고, 없으면 상품 기본값을 반환합니다.
func (s *PartnerOrderService) resolvePartnerPrice(partnerId, productId int) (buyPrice, tradeInPrice decimal.Decimal, err error) {
	var pp domain.PartnerPrice
	if err := s.db.Where("PartnerId = ? AND ProductId = ?", partnerId, productId).First(&pp).Error; err == nil {
		return pp.BuyPrice.Decimal, pp.TradeInPrice.Decimal, nil
	}
	var product domain.Product
	if err := s.db.Select("Id", "Price", "BuyPrice", "TradeInRate").First(&product, productId).Error; err != nil {
		return decimal.Zero, decimal.Zero, apperror.NotFound("상품을 찾을 수 없습니다")
	}
	tradeIn := product.Price.Decimal.Mul(product.TradeInRate.Decimal).Div(decimal.NewFromInt(100)).Round(0)
	return product.BuyPrice.Decimal, tradeIn, nil
}

// PurchasableProduct는 파트너 단가가 포함된 구매 가능 상품 정보입니다.
type PurchasableProduct struct {
	domain.Product
	PartnerBuyPrice     *decimal.Decimal `json:"partnerBuyPrice"`
	PartnerTradeInPrice *decimal.Decimal `json:"partnerTradeInPrice"`
}

// GetPurchasableProducts는 활성 상품 목록에 파트너 단가를 포함하여 반환합니다.
func (s *PartnerOrderService) GetPurchasableProducts(partnerId int, params pagination.Params) ([]PurchasableProduct, int64, error) {
	var products []domain.Product
	var total int64
	query := s.db.Model(&domain.Product{}).Where("IsActive = ? AND DeletedAt IS NULL", true)
	query.Count(&total)
	if err := query.Order("BrandCode, Price").Offset(params.Offset()).Limit(params.Limit).Find(&products).Error; err != nil {
		return nil, 0, err
	}

	// 해당 파트너의 모든 단가를 한 번에 조회
	var prices []domain.PartnerPrice
	s.db.Where("PartnerId = ?", partnerId).Find(&prices)
	priceMap := make(map[int]domain.PartnerPrice, len(prices))
	for _, p := range prices {
		priceMap[p.ProductId] = p
	}

	result := make([]PurchasableProduct, len(products))
	for i, prod := range products {
		result[i] = PurchasableProduct{Product: prod}
		if pp, ok := priceMap[prod.ID]; ok {
			bp := pp.BuyPrice.Decimal
			tp := pp.TradeInPrice.Decimal
			result[i].PartnerBuyPrice = &bp
			result[i].PartnerTradeInPrice = &tp
		}
	}
	return result, total, nil
}

// CreatePartnerOrderInput은 파트너 주문 생성 요청입니다.
type CreatePartnerOrderInput struct {
	Items []struct {
		ProductID int `json:"productId" binding:"required"`
		Quantity  int `json:"quantity" binding:"required,min=1,max=50"`
	} `json:"items" binding:"required,min=1"`
	IdempotencyKey string `json:"idempotencyKey"`
}

// CreatePartnerOrder는 파트너 단가 기반으로 주문을 생성합니다.
func (s *PartnerOrderService) CreatePartnerOrder(partnerId int, input CreatePartnerOrderInput) (*domain.Order, error) {
	var order *domain.Order

	err := s.db.Transaction(func(tx *gorm.DB) error {
		// 멱등성 체크
		if input.IdempotencyKey != "" {
			var existing domain.Order
			if err := tx.Where("IdempotencyKey = ? AND UserId = ?", input.IdempotencyKey, partnerId).First(&existing).Error; err == nil {
				tx.Preload("OrderItems.Product").First(&existing, existing.ID)
				order = &existing
				return nil
			}
		}

		// 1일 구매 한도 검증
		dailyLimit := s.resolveDailyBuyLimit(partnerId)
		var todayCount int64
		today := time.Now().Format("2006-01-02")
		tx.Model(&domain.Order{}).
			Where("UserId = ? AND Source = 'PARTNER' AND CAST(CreatedAt AS DATE) = ?", partnerId, today).
			Count(&todayCount)

		totalQty := 0
		for _, item := range input.Items {
			totalQty += item.Quantity
		}
		if int(todayCount)+totalQty > dailyLimit {
			return apperror.Validationf("1일 구매 한도(%d건)를 초과합니다. 오늘 %d건 주문 완료", dailyLimit, todayCount)
		}

		// 상품 조회 + 총액 계산
		totalAmount := decimal.Zero
		orderItems := make([]domain.OrderItem, 0, len(input.Items))
		for _, item := range input.Items {
			buyPrice, _, err := s.resolvePartnerPrice(partnerId, item.ProductID)
			if err != nil {
				return err
			}
			itemTotal := buyPrice.Mul(decimal.NewFromInt(int64(item.Quantity)))
			totalAmount = totalAmount.Add(itemTotal)
			orderItems = append(orderItems, domain.OrderItem{
				ProductID: item.ProductID,
				Quantity:  item.Quantity,
				Price:     domain.NewNumericDecimal(buyPrice),
			})
		}

		// 재고 확인
		for _, item := range input.Items {
			var available int64
			tx.Model(&domain.VoucherCode{}).
				Where("ProductId = ? AND Status = 'AVAILABLE'", item.ProductID).
				Count(&available)
			if int(available) < item.Quantity {
				return apperror.Validationf("상품 ID %d의 재고가 부족합니다 (요청: %d, 재고: %d)", item.ProductID, item.Quantity, available)
			}
		}

		newOrder := &domain.Order{
			UserID:         partnerId,
			TotalAmount:    domain.NewNumericDecimal(totalAmount),
			Status:         "PENDING",
			Source:         "PARTNER",
			ShippingMethod: stringPtr("DIGITAL"),
			IdempotencyKey: nilIfEmpty(input.IdempotencyKey),
			OrderItems:     orderItems,
		}
		if err := tx.Create(newOrder).Error; err != nil {
			return apperror.Internal("주문 생성 실패", err)
		}
		order = newOrder
		return nil
	})
	if err != nil {
		return nil, err
	}
	return order, nil
}

// GetMyPurchases는 파트너의 구매(Source=PARTNER) 주문 목록을 반환합니다.
func (s *PartnerOrderService) GetMyPurchases(partnerId int, status string, params pagination.Params) ([]domain.Order, int64, error) {
	var items []domain.Order
	var total int64
	query := s.db.Model(&domain.Order{}).Where("UserId = ? AND Source = 'PARTNER'", partnerId)
	if status != "" {
		query = query.Where("Status = ?", status)
	}
	query.Count(&total)
	err := query.Preload("OrderItems.Product").
		Order("CreatedAt DESC").
		Offset(params.Offset()).Limit(params.Limit).
		Find(&items).Error
	return items, total, err
}

// CancelPartnerOrder는 PENDING 상태의 파트너 주문을 취소합니다.
func (s *PartnerOrderService) CancelPartnerOrder(partnerId, orderId int) error {
	result := s.db.Model(&domain.Order{}).
		Where("Id = ? AND UserId = ? AND Source = 'PARTNER' AND Status = 'PENDING'", orderId, partnerId).
		Update("Status", "CANCELLED")
	if result.RowsAffected == 0 {
		return apperror.NotFound("취소 가능한 주문을 찾을 수 없습니다")
	}
	return result.Error
}

// ExportOrderPins는 주문에 할당된 바우처 PIN을 복호화하여 CSV 문자열로 반환합니다.
func (s *PartnerOrderService) ExportOrderPins(partnerId, orderId int) (string, error) {
	var order domain.Order
	if err := s.db.Where("Id = ? AND UserId = ? AND Source = 'PARTNER'", orderId, partnerId).
		Preload("OrderItems.Product").Preload("VoucherCodes").
		First(&order).Error; err != nil {
		return "", apperror.NotFound("주문을 찾을 수 없습니다")
	}
	if order.Status != "PAID" && order.Status != "DELIVERED" && order.Status != "COMPLETED" {
		return "", apperror.Validation("결제 완료된 주문만 다운로드 가능합니다")
	}

	var sb strings.Builder
	w := csv.NewWriter(&sb)
	w.Write([]string{"상품명", "PIN코드", "보안코드", "발행번호", "상태"})

	for _, vc := range order.VoucherCodes {
		pin := vc.PinCode
		if decrypted, err := crypto.DecryptAuto(pin, s.encryptionKey); err == nil {
			pin = decrypted
		}
		secCode := ""
		if vc.SecurityCode != nil {
			if dec, err := crypto.DecryptAuto(*vc.SecurityCode, s.encryptionKey); err == nil {
				secCode = dec
			}
		}
		giftNum := ""
		if vc.GiftNumber != nil {
			if dec, err := crypto.DecryptAuto(*vc.GiftNumber, s.encryptionKey); err == nil {
				giftNum = dec
			}
		}
		productName := ""
		if vc.Product.Name != "" {
			productName = vc.Product.Name
		}
		w.Write([]string{productName, pin, secCode, giftNum, vc.Status})
	}
	w.Flush()
	return sb.String(), nil
}

func (s *PartnerOrderService) resolveDailyBuyLimit(partnerId int) int {
	var user domain.User
	if err := s.db.Select("Id", "DailyPinLimit").First(&user, partnerId).Error; err == nil && user.DailyPinLimit != nil {
		return *user.DailyPinLimit
	}
	return s.config.GetConfigInt("PARTNER_DAILY_BUY_LIMIT", 100)
}

func stringPtr(s string) *string { return &s }

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add go-server/internal/app/services/partner_order_svc.go
git commit -m "feat: add PartnerOrderService for partner purchasing with daily limits and CSV export"
```

---

## Task 4: 파트너 매입 서비스

**Files:**
- Create: `go-server/internal/app/services/partner_tradein_svc.go`

- [ ] **Step 1: PartnerTradeInService 생성**

```go
// go-server/internal/app/services/partner_tradein_svc.go
package services

import (
	"time"

	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/crypto"
	"w-gift-server/pkg/pagination"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type PartnerTradeInService struct {
	db            *gorm.DB
	encryptionKey string
	config        ConfigProvider
}

func NewPartnerTradeInService(db *gorm.DB, encryptionKey string, config ConfigProvider) *PartnerTradeInService {
	return &PartnerTradeInService{db: db, encryptionKey: encryptionKey, config: config}
}

// CreatePartnerTradeInInput은 파트너 매입 신청 요청입니다.
type CreatePartnerTradeInInput struct {
	ProductID    int      `json:"productId" binding:"required"`
	PinCodes     []string `json:"pinCodes" binding:"required,min=1,max=20"`
	SecurityCode string   `json:"securityCode"`
	GiftNumber   string   `json:"giftNumber"`
}

// CreatePartnerTradeIn은 파트너 매입 단가로 매입 신청을 생성합니다.
func (s *PartnerTradeInService) CreatePartnerTradeIn(partnerId int, input CreatePartnerTradeInInput) ([]domain.TradeIn, error) {
	// 1일 매입 한도 검증
	dailyLimit := s.config.GetConfigInt("PARTNER_DAILY_TRADEIN_LIMIT", 50)
	var todayCount int64
	today := time.Now().Format("2006-01-02")
	s.db.Model(&domain.TradeIn{}).
		Where("UserId = ? AND Source = 'PARTNER' AND CAST(CreatedAt AS DATE) = ?", partnerId, today).
		Count(&todayCount)
	if int(todayCount)+len(input.PinCodes) > dailyLimit {
		return nil, apperror.Validationf("1일 매입 한도(%d건)를 초과합니다. 오늘 %d건 신청 완료", dailyLimit, todayCount)
	}

	// 상품 확인
	var product domain.Product
	if err := s.db.First(&product, input.ProductID).Error; err != nil {
		return nil, apperror.NotFound("상품을 찾을 수 없습니다")
	}
	if !product.AllowTradeIn {
		return nil, apperror.Validation("이 상품은 현재 매입을 진행하지 않습니다")
	}

	// 파트너 매입 단가 조회
	_, tradeInPrice, err := s.resolvePartnerPrice(partnerId, input.ProductID)
	if err != nil {
		return nil, err
	}

	// 파트너 계좌 정보 조회
	var partner domain.User
	if err := s.db.Select("Id", "BankName", "AccountNumber", "AccountHolder").First(&partner, partnerId).Error; err != nil {
		return nil, apperror.NotFound("파트너 정보를 찾을 수 없습니다")
	}

	var tradeIns []domain.TradeIn
	err = s.db.Transaction(func(tx *gorm.DB) error {
		for _, pinCode := range input.PinCodes {
			pinCode = trimSpace(pinCode)
			if pinCode == "" {
				continue
			}

			// PIN 중복 검사
			pinHash := crypto.SHA256Hash(pinCode)
			var duplicateCount int64
			tx.Model(&domain.TradeIn{}).Where("PinHash = ?", pinHash).Count(&duplicateCount)
			if duplicateCount > 0 {
				return apperror.Conflict("이미 접수된 PIN 코드입니다: " + pinCode[:4] + "****")
			}

			// PIN 암호화
			encryptedPin, err := crypto.Encrypt(pinCode, s.encryptionKey)
			if err != nil {
				return apperror.Internal("PIN 코드 암호화 실패", err)
			}

			payout := domain.NewNumericDecimal(tradeInPrice.Round(0))

			ti := domain.TradeIn{
				UserID:       partnerId,
				ProductID:    input.ProductID,
				ProductName:  &product.Name,
				ProductBrand: &product.BrandCode,
				ProductPrice: &product.Price,
				Quantity:     1,
				PinCode:      &encryptedPin,
				PinHash:      &pinHash,
				PayoutAmount: payout,
				Status:       "REQUESTED",
				Source:       "PARTNER",
				AppliedRate:  &domain.NumericDecimal{Decimal: tradeInPrice.Div(product.Price.Decimal).Mul(decimal.NewFromInt(100)).Round(2)},
				BankName:     partner.BankName,
				AccountNum:   partner.AccountNumber,
				AccountHolder: partner.AccountHolder,
			}

			// 보안코드/발행번호 암호화
			if input.SecurityCode != "" {
				enc, err := crypto.Encrypt(input.SecurityCode, s.encryptionKey)
				if err != nil {
					return apperror.Internal("보안 코드 암호화 실패", err)
				}
				ti.SecurityCode = &enc
			}
			if input.GiftNumber != "" {
				enc, err := crypto.Encrypt(input.GiftNumber, s.encryptionKey)
				if err != nil {
					return apperror.Internal("발행 번호 암호화 실패", err)
				}
				ti.GiftNumber = &enc
			}

			if err := tx.Create(&ti).Error; err != nil {
				return apperror.Internal("매입 신청 생성 실패", err)
			}
			tradeIns = append(tradeIns, ti)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return tradeIns, nil
}

// GetMyTradeIns는 파트너의 매입(Source=PARTNER) 목록을 반환합니다.
func (s *PartnerTradeInService) GetMyTradeIns(partnerId int, status string, params pagination.Params) ([]domain.TradeIn, int64, error) {
	var items []domain.TradeIn
	var total int64
	query := s.db.Model(&domain.TradeIn{}).Where("UserId = ? AND Source = 'PARTNER'", partnerId)
	if status != "" {
		query = query.Where("Status = ?", status)
	}
	query.Count(&total)
	err := query.Preload("Product", func(db *gorm.DB) *gorm.DB {
		return db.Select("Id", "Name", "BrandCode", "Price")
	}).Order("CreatedAt DESC").
		Offset(params.Offset()).Limit(params.Limit).
		Find(&items).Error
	return items, total, err
}

// GetTradeInDetail은 파트너의 특정 매입 상세를 반환합니다.
func (s *PartnerTradeInService) GetTradeInDetail(partnerId, tradeInId int) (*domain.TradeIn, error) {
	var ti domain.TradeIn
	if err := s.db.Where("Id = ? AND UserId = ? AND Source = 'PARTNER'", tradeInId, partnerId).
		Preload("Product").First(&ti).Error; err != nil {
		return nil, apperror.NotFound("매입 내역을 찾을 수 없습니다")
	}
	return &ti, nil
}

func (s *PartnerTradeInService) resolvePartnerPrice(partnerId, productId int) (buyPrice, tradeInPrice decimal.Decimal, err error) {
	var pp domain.PartnerPrice
	if err := s.db.Where("PartnerId = ? AND ProductId = ?", partnerId, productId).First(&pp).Error; err == nil {
		return pp.BuyPrice.Decimal, pp.TradeInPrice.Decimal, nil
	}
	var product domain.Product
	if err := s.db.Select("Id", "Price", "BuyPrice", "TradeInRate").First(&product, productId).Error; err != nil {
		return decimal.Zero, decimal.Zero, apperror.NotFound("상품을 찾을 수 없습니다")
	}
	tradeIn := product.Price.Decimal.Mul(product.TradeInRate.Decimal).Div(decimal.NewFromInt(100)).Round(0)
	return product.BuyPrice.Decimal, tradeIn, nil
}

func trimSpace(s string) string {
	return strings.TrimSpace(s)
}
```

주의: `strings` import가 필요하므로 파일 상단 import에 `"strings"` 추가.

- [ ] **Step 2: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add go-server/internal/app/services/partner_tradein_svc.go
git commit -m "feat: add PartnerTradeInService for partner trade-in with PIN validation and daily limits"
```

---

## Task 5: 파트너 구매/매입 핸들러

**Files:**
- Create: `go-server/internal/api/handlers/partner_order_handler.go`
- Create: `go-server/internal/api/handlers/partner_tradein_handler.go`

- [ ] **Step 1: PartnerOrderHandler 생성**

```go
// go-server/internal/api/handlers/partner_order_handler.go
package handlers

import (
	"net/http"
	"strconv"
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

type PartnerOrderHandler struct {
	service *services.PartnerOrderService
}

func NewPartnerOrderHandler(service *services.PartnerOrderService) *PartnerOrderHandler {
	return &PartnerOrderHandler{service: service}
}

func (h *PartnerOrderHandler) GetPurchasableProducts(c *gin.Context) {
	partnerID := c.GetInt("userId")
	params := pagination.FromQuery(c)
	items, total, err := h.service.GetPurchasableProducts(partnerID, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.SuccessWithMeta(c, items, pagination.Meta(params, total))
}

func (h *PartnerOrderHandler) CreateOrder(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var input services.CreatePartnerOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	order, err := h.service.CreatePartnerOrder(partnerID, input)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, order)
}

func (h *PartnerOrderHandler) GetMyPurchases(c *gin.Context) {
	partnerID := c.GetInt("userId")
	status := c.Query("status")
	params := pagination.FromQuery(c)
	items, total, err := h.service.GetMyPurchases(partnerID, status, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.SuccessWithMeta(c, items, pagination.Meta(params, total))
}

func (h *PartnerOrderHandler) CancelOrder(c *gin.Context) {
	partnerID := c.GetInt("userId")
	orderID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 주문 ID입니다")
		return
	}
	if err := h.service.CancelPartnerOrder(partnerID, orderID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "주문이 취소되었습니다"})
}

func (h *PartnerOrderHandler) ExportPins(c *gin.Context) {
	partnerID := c.GetInt("userId")
	orderID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 주문 ID입니다")
		return
	}
	csvData, err := h.service.ExportOrderPins(partnerID, orderID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	// BOM 추가하여 Excel에서 한글 깨짐 방지
	bom := "\xEF\xBB\xBF"
	c.Header("Content-Disposition", "attachment; filename=order-pins.csv")
	c.Data(http.StatusOK, "text/csv; charset=utf-8", []byte(bom+csvData))
}
```

- [ ] **Step 2: PartnerTradeInHandler 생성**

```go
// go-server/internal/api/handlers/partner_tradein_handler.go
package handlers

import (
	"strconv"
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

type PartnerTradeInHandler struct {
	service *services.PartnerTradeInService
}

func NewPartnerTradeInHandler(service *services.PartnerTradeInService) *PartnerTradeInHandler {
	return &PartnerTradeInHandler{service: service}
}

func (h *PartnerTradeInHandler) Create(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var input services.CreatePartnerTradeInInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	tradeIns, err := h.service.CreatePartnerTradeIn(partnerID, input)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, tradeIns)
}

func (h *PartnerTradeInHandler) GetMyTradeIns(c *gin.Context) {
	partnerID := c.GetInt("userId")
	status := c.Query("status")
	params := pagination.FromQuery(c)
	items, total, err := h.service.GetMyTradeIns(partnerID, status, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.SuccessWithMeta(c, items, pagination.Meta(params, total))
}

func (h *PartnerTradeInHandler) GetDetail(c *gin.Context) {
	partnerID := c.GetInt("userId")
	tradeInID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 매입 ID입니다")
		return
	}
	ti, err := h.service.GetTradeInDetail(partnerID, tradeInID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, ti)
}
```

- [ ] **Step 3: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add go-server/internal/api/handlers/partner_order_handler.go go-server/internal/api/handlers/partner_tradein_handler.go
git commit -m "feat: add PartnerOrderHandler and PartnerTradeInHandler"
```

---

## Task 6: DI 등록 + 라우트 연결

**Files:**
- Modify: `go-server/internal/routes/container.go` (Handlers struct + NewHandlers)
- Modify: `go-server/internal/routes/partner.go` (새 라우트 등록)
- Modify: `go-server/internal/routes/admin.go` (단가 관리 라우트 등록)

- [ ] **Step 1: Handlers struct에 새 핸들러 필드 추가**

`container.go`의 `Handlers` struct에 추가:
```go
PartnerOrder    *handlers.PartnerOrderHandler
PartnerTradeIn  *handlers.PartnerTradeInHandler
AdminPartnerPrice *handlers.AdminPartnerPriceHandler
```

- [ ] **Step 2: NewHandlers에서 서비스/핸들러 초기화**

`container.go`의 `NewHandlers` 함수 내에 추가 (기존 `partnerService` 초기화 근처):
```go
partnerOrderSvc := services.NewPartnerOrderService(db, cfg.EncryptionKey, configProvider)
partnerTradeInSvc := services.NewPartnerTradeInService(db, cfg.EncryptionKey, configProvider)
partnerPriceSvc := services.NewAdminPartnerPriceService(db)
```

Handlers 리턴 시 필드 추가:
```go
PartnerOrder:      handlers.NewPartnerOrderHandler(partnerOrderSvc),
PartnerTradeIn:    handlers.NewPartnerTradeInHandler(partnerTradeInSvc),
AdminPartnerPrice: handlers.NewAdminPartnerPriceHandler(partnerPriceSvc),
```

- [ ] **Step 3: partner.go에 구매/매입 라우트 추가**

`RegisterPartnerRoutes` 함수 내 기존 라우트 블록에 추가:
```go
// Partner Purchasing (구매)
partner.GET("/products/purchasable", h.PartnerOrder.GetPurchasableProducts)
partner.POST("/orders", h.PartnerOrder.CreateOrder)
partner.GET("/orders/purchases", h.PartnerOrder.GetMyPurchases)
partner.POST("/orders/:id/cancel", h.PartnerOrder.CancelOrder)
partner.GET("/orders/:id/export", h.PartnerOrder.ExportPins)

// Partner Trade-in (매입)
partner.POST("/trade-ins", h.PartnerTradeIn.Create)
partner.GET("/trade-ins", h.PartnerTradeIn.GetMyTradeIns)
partner.GET("/trade-ins/:id", h.PartnerTradeIn.GetDetail)
```

- [ ] **Step 4: admin.go에 단가 관리 라우트 추가**

`RegisterAdminRoutes` 함수 내 기존 admin 블록에 추가:
```go
// Partner Price Management (파트너 단가)
admin.GET("/partner-prices", h.AdminPartnerPrice.GetPrices)
admin.GET("/partner-prices/:partnerId", h.AdminPartnerPrice.GetPricesByPartner)
admin.POST("/partner-prices", h.AdminPartnerPrice.UpsertPrice)
admin.DELETE("/partner-prices/:id", h.AdminPartnerPrice.DeletePrice)
```

- [ ] **Step 5: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 빌드 성공

- [ ] **Step 6: 커밋**

```bash
git add go-server/internal/routes/container.go go-server/internal/routes/partner.go go-server/internal/routes/admin.go
git commit -m "feat: wire partner purchase/trade-in handlers and admin price management routes"
```

---

## Task 7: 파트너 포털 API 레이어

**Files:**
- Modify: `partner/src/api/manual.ts`

- [ ] **Step 1: 파트너 구매/매입 API 함수 추가**

`partner/src/api/manual.ts`에 추가:

```typescript
// ── Partner Purchase (구매) ──────────────────────
export const partnerOrderApi = {
  getPurchasableProducts: (params?: { page?: number; limit?: number }) =>
    axiosInstance.get('/partner/products/purchasable', { params }),

  createOrder: (data: { items: { productId: number; quantity: number }[]; idempotencyKey?: string }) =>
    axiosInstance.post('/partner/orders', data),

  getMyPurchases: (params?: { status?: string; page?: number; limit?: number }) =>
    axiosInstance.get('/partner/orders/purchases', { params }),

  cancelOrder: (orderId: number) =>
    axiosInstance.post(`/partner/orders/${orderId}/cancel`),

  exportPins: (orderId: number) =>
    axiosInstance.get(`/partner/orders/${orderId}/export`, { responseType: 'blob' }),

  confirmPayment: (data: { orderId: number; paymentKey: string }) =>
    axiosInstance.post('/partner/orders/payment/confirm', data),
};

// ── Partner Trade-in (매입) ──────────────────────
export const partnerTradeInApi = {
  create: (data: { productId: number; pinCodes: string[]; securityCode?: string; giftNumber?: string }) =>
    axiosInstance.post('/partner/trade-ins', data),

  getMyTradeIns: (params?: { status?: string; page?: number; limit?: number }) =>
    axiosInstance.get('/partner/trade-ins', { params }),

  getDetail: (id: number) =>
    axiosInstance.get(`/partner/trade-ins/${id}`),
};
```

- [ ] **Step 2: 커밋**

```bash
git add partner/src/api/manual.ts
git commit -m "feat: add partner purchase and trade-in API functions"
```

---

## Task 8: 파트너 포털 탭 구성 + Buy 탭 UI

**Files:**
- Modify: `partner/src/constants.ts`
- Modify: `partner/src/pages/PartnerPage.tsx`
- Create: `partner/src/pages/tabs/BuyTab.tsx`

- [ ] **Step 1: constants.ts에 Buy/Trade-in 탭 추가**

`PARTNER_TABS` 배열에 `products` 뒤에 추가:
```typescript
import { Gauge, Tag, ShoppingCart, Coins, Receipt, Ticket, Banknote, UserCircle } from 'lucide-react';

// 타입에 추가
type PartnerTab = 'dashboard' | 'products' | 'buy' | 'tradein' | 'orders' | 'vouchers' | 'payouts' | 'profile';

// PARTNER_TABS 배열에서 products 뒤에 삽입
{ id: 'buy', label: '상품 구매', icon: ShoppingCart, title: '상품 구매', description: '파트너 전용 단가로 상품권을 구매합니다.' },
{ id: 'tradein', label: '매입 신청', icon: Coins, title: '매입 신청', description: '보유 상품권의 매입을 신청합니다.' },
```

- [ ] **Step 2: PartnerPage.tsx에 lazy import 추가**

`TAB_COMPONENTS` 맵에 추가:
```typescript
'buy': lazy(() => import('./tabs/BuyTab')),
'tradein': lazy(() => import('./tabs/TradeInTab')),
```

- [ ] **Step 3: BuyTab.tsx 생성**

```tsx
// partner/src/pages/tabs/BuyTab.tsx
import { useState, useCallback } from 'react';
import { partnerOrderApi } from '../../api/manual';
import { usePartnerList } from '../../hooks/usePartnerList';
import { ORDER_STATUS_MAP } from '../../constants';

interface PurchasableProduct {
  id: number;
  name: string;
  brandCode: string;
  price: string;
  buyPrice: string;
  partnerBuyPrice?: string;
  partnerTradeInPrice?: string;
}

interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

const BuyTab: React.FC = () => {
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [purchaseStatus, setPurchaseStatus] = useState<string>('');
  const { data: productsData, isLoading } = usePartnerList<PurchasableProduct>(
    'purchasable-products',
    '/partner/products/purchasable'
  );
  const products = productsData?.items || productsData || [];

  const addToCart = useCallback((product: PurchasableProduct, quantity: number) => {
    const unitPrice = product.partnerBuyPrice ? Number(product.partnerBuyPrice) : Number(product.buyPrice);
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { productId: product.id, productName: product.name, quantity, unitPrice }];
    });
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  }, []);

  const totalAmount = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const handleOrder = async () => {
    if (cart.length === 0) return;
    setPurchaseStatus('processing');
    try {
      const items = cart.map(item => ({ productId: item.productId, quantity: item.quantity }));
      const { data } = await partnerOrderApi.createOrder({ items });
      setPurchaseStatus('success');
      setCart([]);
    } catch (error) {
      setPurchaseStatus('error');
    }
  };

  const handleExport = async (orderId: number) => {
    try {
      const response = await partnerOrderApi.exportPins(orderId);
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-${orderId}-pins.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('CSV 다운로드 실패:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* 상품 목록 */}
      <section>
        <h3 className="text-lg font-bold mb-3">구매 가능 상품</h3>
        {isLoading ? (
          <p className="text-base-content/50">로딩 중...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(products as PurchasableProduct[]).map(product => (
              <div key={product.id} className="border rounded-xl p-4 space-y-2">
                <div className="font-semibold">{product.name}</div>
                <div className="text-sm text-base-content/50">
                  정가: <span className="line-through">{Number(product.price).toLocaleString()}원</span>
                </div>
                <div className="text-primary font-bold">
                  파트너가: {(product.partnerBuyPrice ? Number(product.partnerBuyPrice) : Number(product.buyPrice)).toLocaleString()}원
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={1}
                    className="w-20 border rounded px-2 py-1 text-sm"
                    id={`qty-${product.id}`}
                  />
                  <button
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium"
                    onClick={() => {
                      const qty = parseInt((document.getElementById(`qty-${product.id}`) as HTMLInputElement).value) || 1;
                      addToCart(product, qty);
                    }}
                  >
                    담기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 장바구니 */}
      {cart.length > 0 && (
        <section className="border-t pt-4">
          <h3 className="text-lg font-bold mb-3">주문 내역</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">상품명</th>
                <th className="py-2 text-right">단가</th>
                <th className="py-2 text-right">수량</th>
                <th className="py-2 text-right">소계</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {cart.map(item => (
                <tr key={item.productId} className="border-b">
                  <td className="py-2">{item.productName}</td>
                  <td className="py-2 text-right">{item.unitPrice.toLocaleString()}원</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right font-medium">{(item.unitPrice * item.quantity).toLocaleString()}원</td>
                  <td className="py-2 text-right">
                    <button className="text-red-500 text-xs" onClick={() => removeFromCart(item.productId)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center mt-4">
            <span className="text-lg font-bold">합계: {totalAmount.toLocaleString()}원</span>
            <button
              className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold"
              onClick={handleOrder}
              disabled={purchaseStatus === 'processing'}
            >
              {purchaseStatus === 'processing' ? '처리 중...' : '결제하기'}
            </button>
          </div>
        </section>
      )}

      {/* 구매 내역 */}
      <section className="border-t pt-4">
        <h3 className="text-lg font-bold mb-3">구매 내역</h3>
        <PurchaseHistory onExport={handleExport} />
      </section>
    </div>
  );
};

const PurchaseHistory: React.FC<{ onExport: (id: number) => void }> = ({ onExport }) => {
  const { data, isLoading } = usePartnerList('partner-purchases', '/partner/orders/purchases');
  const orders = (data as any)?.items || data || [];

  if (isLoading) return <p className="text-base-content/50">로딩 중...</p>;
  if (!orders.length) return <p className="text-base-content/50">구매 내역이 없습니다.</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="py-2">주문번호</th>
          <th className="py-2">금액</th>
          <th className="py-2">상태</th>
          <th className="py-2">일시</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {(orders as any[]).map((order: any) => {
          const status = ORDER_STATUS_MAP[order.status] || { label: order.status, color: 'gray' };
          return (
            <tr key={order.id} className="border-b">
              <td className="py-2">{order.orderCode || `#${order.id}`}</td>
              <td className="py-2">{Number(order.totalAmount).toLocaleString()}원</td>
              <td className="py-2">
                <span className={`px-2 py-0.5 rounded text-xs bg-${status.color}-100 text-${status.color}-700`}>
                  {status.label}
                </span>
              </td>
              <td className="py-2">{new Date(order.createdAt).toLocaleDateString('ko-KR')}</td>
              <td className="py-2">
                {['PAID', 'DELIVERED', 'COMPLETED'].includes(order.status) && (
                  <button
                    className="text-primary text-xs font-medium"
                    onClick={() => onExport(order.id)}
                  >
                    CSV 다운로드
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default BuyTab;
```

- [ ] **Step 4: 커밋**

```bash
git add partner/src/constants.ts partner/src/pages/PartnerPage.tsx partner/src/pages/tabs/BuyTab.tsx
git commit -m "feat: add Buy tab to partner portal with product listing, cart, and CSV export"
```

---

## Task 9: Trade-in 탭 UI

**Files:**
- Create: `partner/src/pages/tabs/TradeInTab.tsx`

- [ ] **Step 1: TradeInTab.tsx 생성**

```tsx
// partner/src/pages/tabs/TradeInTab.tsx
import { useState, useMemo } from 'react';
import { partnerTradeInApi, partnerOrderApi } from '../../api/manual';
import { usePartnerList } from '../../hooks/usePartnerList';

interface Product {
  id: number;
  name: string;
  brandCode: string;
  price: string;
  partnerTradeInPrice?: string;
  tradeInRate: string;
  allowTradeIn: boolean;
}

const TRADEIN_STATUS_MAP: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: '신청완료', color: 'yellow' },
  RECEIVED: { label: '접수', color: 'blue' },
  VERIFIED: { label: '검수완료', color: 'indigo' },
  PAID: { label: '정산완료', color: 'green' },
  REJECTED: { label: '반려', color: 'red' },
};

const TradeInTab: React.FC = () => {
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [pinInput, setPinInput] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [giftNumber, setGiftNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: productsData } = usePartnerList<Product>(
    'purchasable-products-tradein',
    '/partner/products/purchasable'
  );
  const products = ((productsData as any)?.items || productsData || []) as Product[];
  const tradeInProducts = useMemo(() => products.filter(p => p.allowTradeIn), [products]);

  const selectedProduct = tradeInProducts.find(p => p.id === selectedProductId);
  const pinCodes = pinInput.split('\n').map(s => s.trim()).filter(Boolean);
  const tradeInPrice = selectedProduct
    ? (selectedProduct.partnerTradeInPrice
      ? Number(selectedProduct.partnerTradeInPrice)
      : Number(selectedProduct.price) * Number(selectedProduct.tradeInRate) / 100)
    : 0;
  const estimatedPayout = tradeInPrice * pinCodes.length;

  const handleSubmit = async () => {
    if (!selectedProductId || pinCodes.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await partnerTradeInApi.create({
        productId: selectedProductId,
        pinCodes,
        securityCode: securityCode || undefined,
        giftNumber: giftNumber || undefined,
      });
      setMessage({ type: 'success', text: `${pinCodes.length}건 매입 신청이 완료되었습니다.` });
      setPinInput('');
      setSecurityCode('');
      setGiftNumber('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '매입 신청 중 오류가 발생했습니다.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 매입 신청 폼 */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold">매입 신청</h3>

        <div>
          <label className="block text-sm font-medium mb-1">상품 선택</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={selectedProductId}
            onChange={e => setSelectedProductId(Number(e.target.value))}
          >
            <option value={0}>상품을 선택하세요</option>
            {tradeInProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} — 매입가 {(p.partnerTradeInPrice
                  ? Number(p.partnerTradeInPrice)
                  : Number(p.price) * Number(p.tradeInRate) / 100
                ).toLocaleString()}원
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            PIN 코드 (줄바꿈으로 구분, 최대 20개)
          </label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 h-32 font-mono text-sm"
            placeholder={"1234-5678-9012\n2345-6789-0123\n..."}
            value={pinInput}
            onChange={e => setPinInput(e.target.value)}
          />
          <p className="text-xs text-base-content/50 mt-1">입력된 PIN: {pinCodes.length}개</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">보안코드 (선택)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={securityCode}
              onChange={e => setSecurityCode(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">발행번호 (선택)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={giftNumber}
              onChange={e => setGiftNumber(e.target.value)}
            />
          </div>
        </div>

        {selectedProduct && pinCodes.length > 0 && (
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-sm">매입 단가: <strong>{tradeInPrice.toLocaleString()}원</strong> × {pinCodes.length}개</div>
            <div className="text-lg font-bold text-primary mt-1">예상 정산: {estimatedPayout.toLocaleString()}원</div>
          </div>
        )}

        {message && (
          <div className={`rounded-xl p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <button
          className="w-full py-2.5 bg-primary text-white rounded-xl font-bold disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting || !selectedProductId || pinCodes.length === 0}
        >
          {submitting ? '처리 중...' : '매입 신청'}
        </button>
      </section>

      {/* 매입 내역 */}
      <section className="border-t pt-4">
        <h3 className="text-lg font-bold mb-3">매입 내역</h3>
        <TradeInHistory />
      </section>
    </div>
  );
};

const TradeInHistory: React.FC = () => {
  const { data, isLoading } = usePartnerList('partner-tradeins', '/partner/trade-ins');
  const items = (data as any)?.items || data || [];

  if (isLoading) return <p className="text-base-content/50">로딩 중...</p>;
  if (!items.length) return <p className="text-base-content/50">매입 내역이 없습니다.</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="py-2">상품</th>
          <th className="py-2 text-right">정산금액</th>
          <th className="py-2">상태</th>
          <th className="py-2">신청일</th>
        </tr>
      </thead>
      <tbody>
        {(items as any[]).map((ti: any) => {
          const status = TRADEIN_STATUS_MAP[ti.status] || { label: ti.status, color: 'gray' };
          return (
            <tr key={ti.id} className="border-b">
              <td className="py-2">{ti.productName || ti.product?.name || '-'}</td>
              <td className="py-2 text-right">{Number(ti.payoutAmount).toLocaleString()}원</td>
              <td className="py-2">
                <span className={`px-2 py-0.5 rounded text-xs bg-${status.color}-100 text-${status.color}-700`}>
                  {status.label}
                </span>
              </td>
              <td className="py-2">{new Date(ti.createdAt).toLocaleDateString('ko-KR')}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default TradeInTab;
```

- [ ] **Step 2: 커밋**

```bash
git add partner/src/pages/tabs/TradeInTab.tsx
git commit -m "feat: add Trade-in tab to partner portal with PIN submission and history"
```

---

## Task 10: Dashboard 위젯 통합 + 최종 빌드 확인

**Files:**
- Modify: `partner/src/pages/tabs/DashboardTab.tsx` (구매/매입 통계 위젯 추가)

- [ ] **Step 1: DashboardTab에 구매/매입 통계 위젯 추가**

기존 DashboardTab의 통계 그리드에 2개 카드 추가. 파트너 대시보드 API 응답에 `purchaseCount`, `purchaseAmount`, `tradeInCount`, `tradeInAmount` 필드를 추가해야 한다. 이를 위해 `PartnerService.GetDashboard`에 쿼리 추가:

`go-server/internal/app/services/partner_svc.go`의 `GetDashboard` 메서드에 추가:
```go
// 이번 달 구매 통계
var purchaseStats struct {
	Count  int64
	Amount float64
}
s.db.Model(&domain.Order{}).
	Where("UserId = ? AND Source = 'PARTNER' AND CAST(CreatedAt AS DATE) >= ?", partnerID, firstOfMonth).
	Select("COUNT(*) as Count, COALESCE(SUM(CAST(TotalAmount AS FLOAT)), 0) as Amount").
	Scan(&purchaseStats)

// 이번 달 매입 통계
var tradeInStats struct {
	Count  int64
	Amount float64
}
s.db.Model(&domain.TradeIn{}).
	Where("UserId = ? AND Source = 'PARTNER' AND CAST(CreatedAt AS DATE) >= ?", partnerID, firstOfMonth).
	Select("COUNT(*) as Count, COALESCE(SUM(CAST(PayoutAmount AS FLOAT)), 0) as Amount").
	Scan(&tradeInStats)
```

대시보드 응답 구조체에 필드 추가:
```go
MonthlyPurchaseCount  int64   `json:"monthlyPurchaseCount"`
MonthlyPurchaseAmount float64 `json:"monthlyPurchaseAmount"`
MonthlyTradeInCount   int64   `json:"monthlyTradeInCount"`
MonthlyTradeInAmount  float64 `json:"monthlyTradeInAmount"`
```

프론트엔드 DashboardTab에 위젯 2개 추가:
```tsx
<StatCard label="이번 달 구매" value={`${stats.monthlyPurchaseCount}건`} sub={`${Number(stats.monthlyPurchaseAmount).toLocaleString()}원`} />
<StatCard label="이번 달 매입" value={`${stats.monthlyTradeInCount}건`} sub={`${Number(stats.monthlyTradeInAmount).toLocaleString()}원`} />
```

- [ ] **Step 2: Go 서버 전체 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 빌드 성공

- [ ] **Step 3: 파트너 포털 빌드 확인**

Run: `cd partner && pnpm build`
Expected: 빌드 성공

- [ ] **Step 4: 최종 커밋**

```bash
git add -A
git commit -m "feat: integrate partner purchase/trade-in stats into dashboard"
```
