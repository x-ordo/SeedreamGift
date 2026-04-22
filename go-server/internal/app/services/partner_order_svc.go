package services

import (
	"bytes"
	"fmt"
	"strings"
	"time"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/crypto"
	"seedream-gift-server/pkg/pagination"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// PartnerOrderService는 파트너의 상품권 구매(대량 발주) 기능을 처리합니다.
// 파트너별 단가 적용, 1일 구매 한도 검증, 멱등성 보장, CSV PIN 내보내기 등을 담당합니다.
type PartnerOrderService struct {
	db            *gorm.DB
	encryptionKey string
	config        ConfigProvider
}

// NewPartnerOrderService는 새로운 PartnerOrderService 인스턴스를 생성합니다.
func NewPartnerOrderService(db *gorm.DB, encryptionKey string, config ConfigProvider) *PartnerOrderService {
	return &PartnerOrderService{
		db:            db,
		encryptionKey: encryptionKey,
		config:        config,
	}
}

// PurchasableProduct는 파트너가 구매할 수 있는 상품에 파트너 단가 정보를 추가한 구조체입니다.
type PurchasableProduct struct {
	domain.Product
	PartnerBuyPrice     *decimal.Decimal `json:"partnerBuyPrice"`
	PartnerTradeInPrice *decimal.Decimal `json:"partnerTradeInPrice"`
}

// CreatePartnerOrderInput은 파트너 구매 주문 생성 시 전달받는 데이터 구조입니다.
type CreatePartnerOrderInput struct {
	Items []struct {
		ProductID int `json:"productId" binding:"required"`
		Quantity  int `json:"quantity" binding:"required,min=1,max=50"`
	} `json:"items" binding:"required,min=1"`
	IdempotencyKey string `json:"idempotencyKey"`
}

// resolvePartnerPrice는 파트너의 상품별 구매가/매입가를 조회합니다.
// PartnerPrices 테이블에 설정이 있으면 해당 값을, 없으면 Product 기본값을 반환합니다.
func (s *PartnerOrderService) resolvePartnerPrice(partnerID, productID int) (buyPrice, tradeInPrice decimal.Decimal, err error) {
	var pp domain.PartnerPrice
	if dbErr := s.db.
		Where("PartnerId = ? AND ProductId = ?", partnerID, productID).
		First(&pp).Error; dbErr == nil {
		return pp.BuyPrice.Decimal, pp.TradeInPrice.Decimal, nil
	}

	// 파트너 단가 미설정 → 상품 기본 단가 사용
	var product domain.Product
	if dbErr := s.db.Select("BuyPrice", "TradeInRate", "Price").First(&product, productID).Error; dbErr != nil {
		return decimal.Zero, decimal.Zero, apperror.NotFound("상품을 찾을 수 없습니다")
	}

	// TradeIn 기본가: Price * TradeInRate / 100
	hundred := decimal.NewFromInt(100)
	tradeInAmt := product.Price.Decimal.Mul(product.TradeInRate.Decimal).Div(hundred).Round(0)
	return product.BuyPrice.Decimal, tradeInAmt, nil
}

// GetPurchasableProducts는 파트너가 구매 가능한 활성 상품 목록과 파트너 단가를 반환합니다.
func (s *PartnerOrderService) GetPurchasableProducts(partnerID int, params pagination.QueryParams) ([]PurchasableProduct, int64, error) {
	var products []domain.Product
	var total int64

	db := s.db.Model(&domain.Product{}).
		Where("IsActive = ? AND DeletedAt IS NULL", true)

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, apperror.Internal("상품 수 조회 실패", err)
	}

	offset := (params.Page - 1) * params.Limit
	if err := db.
		Preload("Brand").
		Order("Id DESC").
		Offset(offset).
		Limit(params.Limit).
		Find(&products).Error; err != nil {
		return nil, 0, apperror.Internal("상품 목록 조회 실패", err)
	}

	// 파트너 단가 일괄 조회
	productIDs := make([]int, len(products))
	for i, p := range products {
		productIDs[i] = p.ID
	}

	var partnerPrices []domain.PartnerPrice
	s.db.Where("PartnerId = ? AND ProductId IN ?", partnerID, productIDs).Find(&partnerPrices)
	priceMap := make(map[int]domain.PartnerPrice, len(partnerPrices))
	for _, pp := range partnerPrices {
		priceMap[pp.ProductId] = pp
	}

	result := make([]PurchasableProduct, len(products))
	for i, p := range products {
		pp := PurchasableProduct{Product: p}
		if price, ok := priceMap[p.ID]; ok {
			buyP := price.BuyPrice.Decimal
			tradeP := price.TradeInPrice.Decimal
			pp.PartnerBuyPrice = &buyP
			pp.PartnerTradeInPrice = &tradeP
		}
		result[i] = pp
	}

	return result, total, nil
}

// CreatePartnerOrder는 파트너 구매 주문을 생성합니다.
// 멱등성 체크, 1일 구매 한도 검증, 파트너 단가 적용, 재고 확인을 포함합니다.
func (s *PartnerOrderService) CreatePartnerOrder(partnerID int, input CreatePartnerOrderInput) (*domain.Order, error) {
	var order *domain.Order

	err := s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 멱등성 체크
		if input.IdempotencyKey != "" {
			var existing domain.Order
			if err := tx.Set("gorm:query_option", "WITH (UPDLOCK)").
				Where("IdempotencyKey = ? AND UserId = ? AND Source = 'PARTNER'", input.IdempotencyKey, partnerID).
				First(&existing).Error; err == nil {
				tx.Preload("OrderItems.Product").First(&existing, existing.ID)
				order = &existing
				return nil
			}
		}

		// 2. 상품 조회 및 유효성 검증
		productIDs := make([]int, len(input.Items))
		for i, item := range input.Items {
			productIDs[i] = item.ProductID
		}

		var products []domain.Product
		if err := tx.Where("Id IN ? AND IsActive = ? AND DeletedAt IS NULL", productIDs, true).
			Find(&products).Error; err != nil {
			return apperror.Internal("상품 정보 조회 실패", err)
		}
		if len(products) != len(productIDs) {
			return apperror.Validation("비활성 상품이 포함되어 있거나 존재하지 않는 상품이 있습니다")
		}

		productMap := make(map[int]domain.Product, len(products))
		for _, p := range products {
			productMap[p.ID] = p
		}

		// 3. 파트너 단가 적용 및 총액 산출
		totalAmount := decimal.Zero
		itemPrices := make(map[int]decimal.Decimal, len(input.Items))
		for _, item := range input.Items {
			buyPrice, _, err := s.resolvePartnerPrice(partnerID, item.ProductID)
			if err != nil {
				return err
			}
			itemTotal := buyPrice.Mul(decimal.NewFromInt(int64(item.Quantity)))
			totalAmount = totalAmount.Add(itemTotal)
			itemPrices[item.ProductID] = buyPrice
		}

		// 4. 1일 구매 한도 검증 (수량 기준)
		dailyLimit := s.resolveDailyBuyLimit(partnerID)
		nowKST := time.Now().In(kstLoc)
		todayStart := time.Date(nowKST.Year(), nowKST.Month(), nowKST.Day(), 0, 0, 0, 0, kstLoc)

		// 오늘 이미 구매한 수량 합산
		type qtySum struct{ TotalQty int }
		var todayQty qtySum
		tx.Raw(`
			SELECT COALESCE(SUM(oi.Quantity), 0) AS TotalQty
			FROM Orders o
			JOIN OrderItems oi ON oi.OrderId = o.Id
			WHERE o.UserId = ? AND o.Source = 'PARTNER'
			  AND o.Status NOT IN ('CANCELLED')
			  AND o.CreatedAt >= ?
		`, partnerID, todayStart).Scan(&todayQty)

		newItemCount := 0
		for _, item := range input.Items {
			newItemCount += item.Quantity
		}
		if todayQty.TotalQty+newItemCount > dailyLimit {
			return apperror.Validationf("1일 구매 한도(%d개)를 초과합니다. 현재 오늘 구매: %d개", dailyLimit, todayQty.TotalQty)
		}

		// 5. 주문 레코드 생성 (파트너 주문은 PG 결제 대기 상태로 시작)
		orderCode, err := generateOrderCode()
		if err != nil {
			return apperror.Internal("주문 코드 생성 실패", err)
		}

		var idempotencyKey *string
		if input.IdempotencyKey != "" {
			idempotencyKey = &input.IdempotencyKey
		}

		source := "PARTNER"
		order = &domain.Order{
			UserID:         partnerID,
			TotalAmount:    domain.NewNumericDecimal(totalAmount),
			Status:         domain.OrderStatusPending,
			Source:         source,
			IdempotencyKey: idempotencyKey,
			OrderCode:      &orderCode,
		}

		if err := tx.Create(order).Error; err != nil {
			return apperror.Internal("주문 생성 실패", err)
		}

		// 6. 주문 항목 생성 및 바우처 배정
		for _, item := range input.Items {
			product := productMap[item.ProductID]
			buyPrice := itemPrices[item.ProductID]

			orderItem := domain.OrderItem{
				OrderID:   order.ID,
				ProductID: item.ProductID,
				Quantity:  item.Quantity,
				Price:     domain.NewNumericDecimal(buyPrice),
			}
			if err := tx.Create(&orderItem).Error; err != nil {
				return apperror.Internal("주문 항목 생성 실패", err)
			}

			// 재고 확인 및 바우처 배정 (STOCK 타입만)
			if product.FulfillmentType != "API" {
				var voucherIDs []int
				if err := tx.Raw(
					`SELECT TOP(?) Id FROM VoucherCodes WITH (UPDLOCK)
					 WHERE ProductId = ? AND Status = 'AVAILABLE'
					 ORDER BY CreatedAt ASC`,
					item.Quantity, item.ProductID,
				).Scan(&voucherIDs).Error; err != nil {
					return apperror.Internal("바우처 조회 실패", err)
				}
				if len(voucherIDs) < item.Quantity {
					return apperror.Validationf("상품 %s의 재고가 부족합니다", product.Name)
				}

				now := time.Now()
				if err := tx.Model(&domain.VoucherCode{}).
					Where("Id IN ?", voucherIDs).
					Updates(map[string]any{
						"OrderId": order.ID,
						"Status":  domain.VoucherStatusSold,
						"SoldAt":  now,
					}).Error; err != nil {
					return apperror.Internal("바우처 배정 실패", err)
				}
			}
		}

		return tx.Preload("OrderItems.Product").First(order, order.ID).Error
	})

	return order, err
}

// GetMyPurchases는 파트너의 구매 주문 목록을 페이지네이션하여 반환합니다.
func (s *PartnerOrderService) GetMyPurchases(partnerID int, status string, params pagination.QueryParams) ([]domain.Order, int64, error) {
	var items []domain.Order
	var total int64

	db := s.db.Model(&domain.Order{}).
		Where("UserId = ? AND Source = 'PARTNER'", partnerID)

	if status != "" {
		db = db.Where("Status = ?", status)
	}

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, apperror.Internal("주문 수 조회 실패", err)
	}

	offset := (params.Page - 1) * params.Limit
	err := db.
		Preload("OrderItems.Product", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("Id", "Name", "BrandCode", "Price", "ImageUrl")
		}).
		Order("Id DESC").
		Offset(offset).
		Limit(params.Limit).
		Find(&items).Error

	return items, total, err
}

// CancelPartnerOrder는 PENDING 상태의 파트너 주문을 취소하고 바우처를 재고로 환원합니다.
func (s *PartnerOrderService) CancelPartnerOrder(partnerID, orderID int) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var order domain.Order
		if err := tx.Set("gorm:query_option", "WITH (UPDLOCK)").
			Where("Id = ? AND UserId = ? AND Source = 'PARTNER'", orderID, partnerID).
			First(&order).Error; err != nil {
			return apperror.NotFound("주문을 찾을 수 없습니다")
		}

		if order.Status != domain.OrderStatusPending {
			return apperror.Validation("결제 대기 중인 주문만 취소할 수 있습니다")
		}

		if err := tx.Model(&order).Update("Status", domain.OrderStatusCancelled).Error; err != nil {
			return apperror.Internal("주문 취소 실패", err)
		}

		return tx.Model(&domain.VoucherCode{}).
			Where("OrderId = ?", orderID).
			Updates(map[string]any{
				"OrderId": nil,
				"Status":  domain.VoucherStatusAvailable,
				"SoldAt":  nil,
			}).Error
	})
}

// ExportOrderPins는 파트너 주문의 PIN 코드를 복호화하여 UTF-8 BOM CSV 문자열로 반환합니다.
func (s *PartnerOrderService) ExportOrderPins(partnerID, orderID int) (string, error) {
	var order domain.Order
	if err := s.db.
		Where("Id = ? AND UserId = ? AND Source = 'PARTNER'", orderID, partnerID).
		First(&order).Error; err != nil {
		return "", apperror.NotFound("주문을 찾을 수 없습니다")
	}

	if order.Status != domain.OrderStatusPaid &&
		order.Status != domain.OrderStatusDelivered &&
		order.Status != domain.OrderStatusCompleted {
		return "", apperror.Validation("결제 완료된 주문의 PIN만 내보낼 수 있습니다")
	}

	var vouchers []domain.VoucherCode
	if err := s.db.
		Preload("Product", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("Id", "Name", "BrandCode")
		}).
		Where("OrderId = ?", orderID).
		Find(&vouchers).Error; err != nil {
		return "", apperror.Internal("바우처 조회 실패", err)
	}

	var buf bytes.Buffer
	// UTF-8 BOM (Excel 한글 호환)
	buf.Write([]byte{0xEF, 0xBB, 0xBF})
	buf.WriteString("상품명,브랜드,PIN코드,보안코드,상태\n")

	for _, v := range vouchers {
		pinCode := v.PinCode
		if pinCode != "" {
			if decrypted, err := crypto.DecryptAuto(pinCode, s.encryptionKey); err == nil {
				pinCode = decrypted
			}
		}

		securityCode := ""
		if v.SecurityCode != nil && *v.SecurityCode != "" {
			if decrypted, err := crypto.DecryptAuto(*v.SecurityCode, s.encryptionKey); err == nil {
				securityCode = decrypted
			}
		}

		productName := ""
		brandCode := ""
		if v.Product.ID > 0 {
			productName = v.Product.Name
			brandCode = v.Product.BrandCode
		}

		buf.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s\n",
			csvEscape(productName),
			csvEscape(brandCode),
			csvEscape(pinCode),
			csvEscape(securityCode),
			csvEscape(v.Status),
		))
	}

	return buf.String(), nil
}

// resolveDailyBuyLimit는 파트너의 1일 구매 한도(수량)를 결정합니다.
// 우선순위: User.DailyPinLimit → SiteConfig.PARTNER_DAILY_BUY_LIMIT → 100
func (s *PartnerOrderService) resolveDailyBuyLimit(partnerID int) int {
	var user domain.User
	if err := s.db.Select("DailyPinLimit").First(&user, partnerID).Error; err == nil {
		if user.DailyPinLimit != nil && *user.DailyPinLimit > 0 {
			return *user.DailyPinLimit
		}
	}
	return s.config.GetConfigInt("PARTNER_DAILY_BUY_LIMIT", 100)
}

// csvEscape는 CSV 출력 시 쉼표, 큰따옴표, 개행이 포함된 필드를 안전하게 이스케이프합니다.
func csvEscape(s string) string {
	if strings.ContainsAny(s, ",\"\n\r") {
		return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
	}
	return s
}
