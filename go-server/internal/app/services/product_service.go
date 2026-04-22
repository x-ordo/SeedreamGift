// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// Product Service는 상품 카탈로그 및 관련 정보를 관리합니다.
package services

import (
	"w-gift-server/internal/domain"
	"w-gift-server/internal/infra/repository"
	"w-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// ProductService는 상품 관련 비즈니스 로직을 처리하는 서비스입니다.
type ProductService struct {
	repo *repository.BaseRepository[domain.Product]
}

// NewProductService는 새로운 ProductService 인스턴스를 생성합니다.
func NewProductService(db *gorm.DB) *ProductService {
	return &ProductService{
		repo: repository.NewBaseRepository[domain.Product](db),
	}
}

// GetProducts는 필터 조건에 맞는 상품 목록을 페이지네이션하여 조회합니다.
// 1. 활성화 여부(activeOnly) 및 특정 브랜드(brandCode) 필터를 동적으로 적용합니다.
// 2. 전체 데이터 개수를 카운트하여 페이지네이션 정보(Total)를 산출합니다.
// 3. 성능 최적화를 위해 관계된 브랜드(Brand) 정보를 한 번의 쿼리로 미리 로드(Preload)합니다.
func (s *ProductService) GetProducts(params pagination.QueryParams, activeOnly bool, brandCode string) (pagination.PaginatedResponse[domain.Product], error) {
	var items []domain.Product
	var total int64

	// 기본 쿼리 빌더 생성
	db := s.repo.GetDB().Model(&domain.Product{})

	// 조건부 필터링 적용
	if activeOnly {
		db = db.Where("IsActive = ?", true)
		// 파트너 상품은 어드민 승인 완료 건만 노출
		db = db.Where("(ApprovalStatus = 'APPROVED' OR PartnerID IS NULL)")
	}
	if brandCode != "" {
		db = db.Where("BrandCode = ?", brandCode)
	}

	// 페이지네이션용 전체 카운트 조회
	db.Count(&total)

	// 페이지네이션 파라미터 보정
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

	// 실제 데이터 조회: Preload를 통해 N+1 문제를 방지하고 최신순으로 정렬합니다.
	err := db.
		Select("Id", "BrandCode", "Name", "Description", "Price", "DiscountRate", "BuyPrice", "TradeInRate", "AllowTradeIn", "ImageUrl", "IsActive", "Type", "ShippingMethod", "CreatedAt").
		Preload("Brand").Order("CreatedAt desc").Offset(offset).Limit(params.Limit).Find(&items).Error
	if err != nil {
		return pagination.PaginatedResponse[domain.Product]{}, err
	}

	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), nil
}

// GetProductByID는 ID를 사용하여 단일 상품 정보를 조회합니다.
func (s *ProductService) GetProductByID(id int) (*domain.Product, error) {
	var product domain.Product
	err := s.repo.GetDB().Preload("Brand").First(&product, id).Error
	if err != nil {
		return nil, err
	}
	return &product, nil
}

// GetProductRates는 활성화된 모든 상품의 요율 정보를 조회합니다.
func (s *ProductService) GetProductRates() ([]domain.Product, error) {
	var products []domain.Product
	err := s.repo.GetDB().Where("IsActive = ? AND (ApprovalStatus = 'APPROVED' OR PartnerID IS NULL)", true).
		Select("Id", "BrandCode", "Name", "Price", "DiscountRate", "BuyPrice", "TradeInRate", "AllowTradeIn").
		Order("BrandCode ASC, Price ASC").
		Find(&products).Error
	return products, err
}

// GetProductsByBrand는 특정 브랜드의 모든 활성 상품을 조회합니다.
func (s *ProductService) GetProductsByBrand(brandCode string) ([]domain.Product, error) {
	var products []domain.Product
	err := s.repo.GetDB().Preload("Brand").Where("BrandCode = ? AND IsActive = ? AND (ApprovalStatus = 'APPROVED' OR PartnerID IS NULL)", brandCode, true).
		Order("Price ASC").
		Find(&products).Error
	return products, err
}
