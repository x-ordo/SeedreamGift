package services

import (
	"fmt"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/repository"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// AdminProductService는 관리자의 상품 관리 기능을 처리합니다.
type AdminProductService struct {
	db          *gorm.DB
	productRepo *repository.BaseRepository[domain.Product]
}

func NewAdminProductService(db *gorm.DB) *AdminProductService {
	return &AdminProductService{
		db:          db,
		productRepo: repository.NewBaseRepository[domain.Product](db),
	}
}

func (s *AdminProductService) GetProducts(params pagination.QueryParams) (pagination.PaginatedResponse[domain.Product], error) {
	var items []domain.Product
	var total int64

	s.db.Model(&domain.Product{}).Count(&total)

	if params.Limit <= 0 {
		params.Limit = 20
	}
	if params.Limit > 100 {
		params.Limit = 100
	}
	if params.Page <= 0 {
		params.Page = 1
	}
	offset := (params.Page - 1) * params.Limit

	err := s.db.Preload("Brand").Order("Id desc").Offset(offset).Limit(params.Limit).Find(&items).Error
	if err != nil {
		return pagination.PaginatedResponse[domain.Product]{}, err
	}
	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), nil
}

func (s *AdminProductService) CreateProduct(product *domain.Product) error {
	if err := domain.ValidateProductCreate(product); err != nil {
		return err
	}
	domain.CalculateBuyPrice(product)
	return s.productRepo.Create(product)
}

func (s *AdminProductService) UpdateProduct(id int, product *domain.Product) error {
	existing, err := s.productRepo.FindByID(id)
	if err != nil {
		return apperror.NotFoundf("product %d not found", id)
	}
	if product.Price.Decimal.IsZero() {
		product.Price = existing.Price
	}
	if product.DiscountRate.Decimal.IsZero() && existing.DiscountRate.Decimal.IsPositive() {
		product.DiscountRate = existing.DiscountRate
	}
	if product.TradeInRate.Decimal.IsZero() && existing.TradeInRate.Decimal.IsPositive() {
		product.TradeInRate = existing.TradeInRate
	}
	domain.CalculateBuyPrice(product)
	return s.db.Model(&domain.Product{}).Where("Id = ?", id).Updates(map[string]any{
		"BrandCode":           product.BrandCode,
		"Name":                product.Name,
		"Description":         product.Description,
		"Price":               product.Price.Decimal,
		"DiscountRate":        product.DiscountRate.Decimal,
		"BuyPrice":            product.BuyPrice.Decimal,
		"TradeInRate":         product.TradeInRate.Decimal,
		"AllowTradeIn":        product.AllowTradeIn,
		"AllowPartnerStock":   product.AllowPartnerStock,
		"ImageUrl":            product.ImageUrl,
		"IsActive":            product.IsActive,
		"Type":                product.Type,
		"ShippingMethod":      product.ShippingMethod,
		"FulfillmentType":     product.FulfillmentType,
		"ProviderCode":        product.ProviderCode,
		"ProviderProductCode": product.ProviderProductCode,
	}).Error
}

func (s *AdminProductService) UpdateApprovalStatus(id int, status string, reason string) error {
	var product domain.Product
	if err := s.db.Select("Id", "ApprovalStatus").First(&product, id).Error; err != nil {
		return apperror.NotFoundf("product %d not found", id)
	}
	if err := domain.ValidateProductApproval(product.ApprovalStatus, status, reason); err != nil {
		return err
	}
	// Fix 3: 거절 사유 저장 및 승인 시 사유 초기화
	updates := map[string]any{
		"ApprovalStatus": status,
	}
	if status == "REJECTED" && reason != "" {
		updates["RejectionReason"] = reason
	}
	if status == "APPROVED" {
		updates["RejectionReason"] = nil
	}
	return s.db.Model(&domain.Product{}).Where("Id = ?", id).Updates(updates).Error
}

func (s *AdminProductService) DeleteProduct(id int) error {
	// Fix 2: 활성 바우처 존재 시 삭제 방지
	var activeVouchers int64
	s.db.Model(&domain.VoucherCode{}).
		Where("ProductId = ? AND Status IN ('AVAILABLE','RESERVED','SOLD')", id).
		Count(&activeVouchers)
	if activeVouchers > 0 {
		return apperror.Conflict(fmt.Sprintf("활성 바우처 %d건이 있어 삭제할 수 없습니다. 먼저 바우처를 처리해주세요.", activeVouchers))
	}

	// Fix 2: 진행 중인 주문에 포함된 상품 삭제 방지
	var orderItemCount int64
	s.db.Model(&domain.OrderItem{}).
		Where("ProductId = ? AND EXISTS (SELECT 1 FROM Orders WHERE Id = OrderItems.OrderId AND Status IN ('PENDING','PAID'))", id).
		Count(&orderItemCount)
	if orderItemCount > 0 {
		return apperror.Conflict("진행 중인 주문에 포함된 상품은 삭제할 수 없습니다")
	}

	return s.productRepo.Delete(id)
}
