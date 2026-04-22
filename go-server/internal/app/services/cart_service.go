// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// Cart Service는 사용자의 장바구니 상태를 관리합니다.
package services

import (
	"time"
	"w-gift-server/internal/domain"
	"w-gift-server/internal/infra/repository"
	"w-gift-server/pkg/apperror"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// CartService는 장바구니 관련 비즈니스 로직을 처리하는 서비스입니다.
type CartService struct {
	db     *gorm.DB
	repo   *repository.BaseRepository[domain.CartItem]
	config ConfigProvider
}

// NewCartService는 새로운 CartService 인스턴스를 생성합니다.
func NewCartService(db *gorm.DB, configProvider ConfigProvider) *CartService {
	return &CartService{
		db:     db,
		repo:   repository.NewBaseRepository[domain.CartItem](db),
		config: configProvider,
	}
}

// CartItemWithStock은 재고 정보가 포함된 장바구니 항목입니다.
type CartItemWithStock struct {
	domain.CartItem
	AvailableStock int `json:"availableStock"`
}

// CartResponse는 요약 정보가 포함된 장바구니 응답 구조체입니다.
type CartResponse struct {
	Items       []CartItemWithStock   `json:"items"`
	ItemCount   int                   `json:"itemCount"`
	TotalAmount domain.NumericDecimal `json:"totalAmount"`
}

// GetCart는 특정 사용자의 장바구니 항목과 요약 정보를 조회합니다.
func (s *CartService) GetCart(userID int) (*CartResponse, error) {
	var items []domain.CartItem
	err := s.db.Preload("Product.Brand").Where("UserId = ?", userID).Find(&items).Error
	if err != nil {
		return nil, err
	}

	// 각 상품의 가용 재고 수량 조회
	productIDs := make([]int, len(items))
	for i, item := range items {
		productIDs[i] = item.ProductID
	}
	stockMap := make(map[int]int)
	if len(productIDs) > 0 {
		type stockRow struct {
			ProductID int
			Count     int
		}
		var rows []stockRow
		// AVAILABLE 상태의 바우처만 재고로 산정하는 것이 의도된 설계입니다.
		// RESERVED 상태의 바우처는 현재 다른 사용자의 결제 진행 중인 항목이므로
		// 실제 구매 가능 재고에서 제외하는 것이 정확한 재고 표시입니다.
		if err := s.db.Model(&domain.VoucherCode{}).
			Select("ProductId as product_id, COUNT(*) as count").
			Where("ProductId IN ? AND Status = 'AVAILABLE'", productIDs).
			Group("ProductId").Scan(&rows).Error; err != nil {
			return nil, apperror.Internal("재고 조회 실패", err)
		}
		for _, r := range rows {
			stockMap[r.ProductID] = r.Count
		}
	}

	totalAmount := decimal.Zero
	var itemCount int
	result := make([]CartItemWithStock, len(items))
	for i, item := range items {
		totalAmount = totalAmount.Add(item.Product.BuyPrice.Decimal.Mul(decimal.NewFromInt(int64(item.Quantity))))
		itemCount += item.Quantity
		result[i] = CartItemWithStock{
			CartItem:       item,
			AvailableStock: stockMap[item.ProductID],
		}
	}

	return &CartResponse{
		Items:       result,
		ItemCount:   itemCount,
		TotalAmount: domain.NewNumericDecimal(totalAmount),
	}, nil
}

// LimitResponse는 장바구니 결제 가능 여부와 한도 정보를 담는 구조체입니다.
type LimitResponse struct {
	CurrentCartTotal float64 `json:"currentCartTotal"`
	Limits           struct {
		PerOrder struct {
			Max       float64 `json:"max"`
			Remaining float64 `json:"remaining"`
		} `json:"perOrder"`
		Daily struct {
			Max       float64 `json:"max"`
			Used      float64 `json:"used"`
			Remaining float64 `json:"remaining"`
		} `json:"daily"`
	} `json:"limits"`
	CanProceed bool `json:"canProceed"`
}

// kstLoc is defined in admin_order_svc.go (package-level singleton for Asia/Seoul timezone).

// CheckLimit는 사용자의 주문 한도를 체크하여 장바구니 결제 가능 여부를 반환합니다.
func (s *CartService) CheckLimit(userID int) (*LimitResponse, error) {
	var user domain.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, err
	}

	cartResp, err := s.GetCart(userID)
	if err != nil {
		return nil, apperror.Internal("장바구니 조회 실패", err)
	}
	var total float64
	if cartResp != nil {
		total = cartResp.TotalAmount.InexactFloat64()
	}

	// 1회 주문 한도: ConfigProvider 캐시 → 사용자 커스텀 한도 → 기본값 500,000원
	perOrderMax := s.config.GetConfigFloat("LIMIT_PER_ORDER", 500000.0)
	if user.CustomLimitPerTx != nil {
		perOrderMax = user.CustomLimitPerTx.InexactFloat64()
	}

	// 일일 주문 한도: ConfigProvider 캐시 → 사용자 커스텀 한도 → 기본값 1,000,000원
	dailyMax := s.config.GetConfigFloat("LIMIT_PER_DAY", 1000000.0)
	if user.CustomLimitPerDay != nil {
		dailyMax = user.CustomLimitPerDay.InexactFloat64()
	}

	// 일일 사용액: KST 자정 기준
	nowKST := time.Now().In(kstLoc)
	todayKST := time.Date(nowKST.Year(), nowKST.Month(), nowKST.Day(), 0, 0, 0, 0, kstLoc)
	// CreateOrder의 한도 검증과 동일한 기준: 실제 결제 완료 상태만 합산
	var dailyUsed float64
	s.db.Model(&domain.Order{}).
		Where("UserId = ? AND Status IN ('PAID','DELIVERED','COMPLETED') AND CreatedAt >= ?", userID, todayKST).
		Select("COALESCE(SUM(TotalAmount), 0)").Scan(&dailyUsed)

	res := &LimitResponse{}
	res.CurrentCartTotal = total
	res.Limits.PerOrder.Max = perOrderMax
	res.Limits.PerOrder.Remaining = perOrderMax - total
	res.Limits.Daily.Max = dailyMax
	res.Limits.Daily.Used = dailyUsed
	res.Limits.Daily.Remaining = dailyMax - dailyUsed - total
	res.CanProceed = res.Limits.PerOrder.Remaining >= 0 && res.Limits.Daily.Remaining >= 0

	return res, nil
}

// AddItem validates product, then adds to cart or increments quantity.
// unique 제약(UserId+ProductId)을 활용하여 동시 요청 시 중복 삽입 방지
func (s *CartService) AddItem(userID int, productID int, quantity int) error {
	var product domain.Product
	if err := s.db.Where("Id = ? AND IsActive = ?", productID, true).First(&product).Error; err != nil {
		return apperror.NotFound("상품을 찾을 수 없거나 판매 중지된 상품입니다")
	}

	// DB 방언 감지: MSSQL은 MERGE, 그 외(SQLite 등)는 SELECT→INSERT/UPDATE
	dialector := s.db.Dialector.Name()
	if dialector == "sqlserver" {
		result := s.db.Exec(
			`MERGE CartItems WITH (HOLDLOCK) AS target
			 USING (SELECT ? AS UserId, ? AS ProductId) AS source
			 ON target.UserId = source.UserId AND target.ProductId = source.ProductId
			 WHEN MATCHED THEN UPDATE SET Quantity = target.Quantity + ?
			 WHEN NOT MATCHED THEN INSERT (UserId, ProductId, Quantity) VALUES (?, ?, ?);`,
			userID, productID, quantity, userID, productID, quantity,
		)
		return result.Error
	}

	// 폴백: SELECT → INSERT or UPDATE (SQLite/테스트 환경)
	var item domain.CartItem
	err := s.db.Where("UserId = ? AND ProductId = ?", userID, productID).First(&item).Error
	if err != nil {
		return s.db.Create(&domain.CartItem{
			UserID:    userID,
			ProductID: productID,
			Quantity:  quantity,
		}).Error
	}
	return s.db.Model(&item).Update("Quantity", item.Quantity+quantity).Error
}

// UpdateQuantity는 장바구니 항목의 수량을 업데이트합니다.
// productID(상품 ID)로 항목을 조회합니다. 수량은 1 이상이어야 하며, 상품의 최대 구매 수량을 초과할 수 없습니다.
func (s *CartService) UpdateQuantity(userID int, productID int, quantity int) error {
	// 수량 기본 유효성 검사
	if quantity < 1 {
		return apperror.Validation("수량은 1 이상이어야 합니다")
	}

	// 상품 ID와 사용자 ID로 장바구니 항목 및 상품 정보를 함께 조회하여 최대 구매 수량 검증
	var item domain.CartItem
	if err := s.db.Preload("Product").
		Where("ProductId = ? AND UserId = ?", productID, userID).
		First(&item).Error; err != nil {
		return apperror.NotFound("장바구니 항목을 찾을 수 없습니다")
	}

	// 상품별 최대 구매 수량 제한 검증 (MaxPurchaseQty가 0이면 제한 없음)
	if item.Product.MaxPurchaseQty > 0 && quantity > item.Product.MaxPurchaseQty {
		return apperror.Validationf("최대 %d개까지 구매 가능합니다", item.Product.MaxPurchaseQty)
	}

	return s.db.Model(&item).Update("Quantity", quantity).Error
}

// RemoveItem은 장바구니에서 특정 상품을 제거합니다.
func (s *CartService) RemoveItem(userID int, productID int) error {
	return s.db.Where("ProductId = ? AND UserId = ?", productID, userID).Delete(&domain.CartItem{}).Error
}

// RemoveItemsBatch는 장바구니에서 여러 상품을 한꺼번에 제거합니다.
func (s *CartService) RemoveItemsBatch(userID int, productIDs []int) (int64, error) {
	res := s.db.Where("UserId = ? AND ProductId IN ?", userID, productIDs).Delete(&domain.CartItem{})
	return res.RowsAffected, res.Error
}

// ClearCart는 사용자의 장바구니를 비웁니다.
func (s *CartService) ClearCart(userID int) error {
	return s.db.Where("UserId = ?", userID).Delete(&domain.CartItem{}).Error
}
