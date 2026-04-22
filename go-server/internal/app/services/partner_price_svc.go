package services

import (
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/pagination"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// AdminPartnerPriceService는 관리자가 파트너별 상품 단가를 관리하는 서비스입니다.
// 파트너×상품 조합에 대해 구매가(BuyPrice)와 매입가(TradeInPrice)를 독립적으로 설정할 수 있습니다.
type AdminPartnerPriceService struct {
	db *gorm.DB
}

// NewAdminPartnerPriceService는 새로운 AdminPartnerPriceService 인스턴스를 생성합니다.
func NewAdminPartnerPriceService(db *gorm.DB) *AdminPartnerPriceService {
	return &AdminPartnerPriceService{db: db}
}

// GetPrices는 파트너 단가 목록을 페이지네이션하여 반환합니다.
// partnerId가 0보다 크면 해당 파트너의 단가만 필터링합니다.
// Partner(Id,Email,Name,PartnerTier)와 Product(Id,Name,BrandCode,Price,BuyPrice,TradeInRate)를 Preload합니다.
func (s *AdminPartnerPriceService) GetPrices(partnerID int, params pagination.QueryParams) ([]domain.PartnerPrice, int64, error) {
	var items []domain.PartnerPrice
	var total int64

	db := s.db.Model(&domain.PartnerPrice{})
	if partnerID > 0 {
		db = db.Where("PartnerId = ?", partnerID)
	}

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, apperror.Internal("파트너 단가 수 조회 실패", err)
	}

	offset := (params.Page - 1) * params.Limit
	err := db.
		Preload("Partner", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("Id", "Email", "Name", "PartnerTier")
		}).
		Preload("Product", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("Id", "Name", "BrandCode", "Price", "BuyPrice", "TradeInRate")
		}).
		Order("Id DESC").
		Offset(offset).
		Limit(params.Limit).
		Find(&items).Error

	return items, total, err
}

// GetPricesByPartner는 특정 파트너에 대해 설정된 모든 단가를 반환합니다.
func (s *AdminPartnerPriceService) GetPricesByPartner(partnerID int) ([]domain.PartnerPrice, error) {
	var items []domain.PartnerPrice
	err := s.db.
		Preload("Product", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("Id", "Name", "BrandCode", "Price", "BuyPrice", "TradeInRate")
		}).
		Where("PartnerId = ?", partnerID).
		Find(&items).Error
	if err != nil {
		return nil, apperror.Internal("파트너 단가 목록 조회 실패", err)
	}
	return items, nil
}

// UpsertPrice는 파트너×상품 조합의 단가를 생성하거나 업데이트합니다.
// 동일한 (PartnerId, ProductId) 조합이 존재하면 가격 필드만 갱신됩니다.
func (s *AdminPartnerPriceService) UpsertPrice(partnerID, productID int, buyPrice, tradeInPrice float64) (*domain.PartnerPrice, error) {
	// 1. 입력 검증
	if buyPrice <= 0 {
		return nil, apperror.Validation("구매가는 0보다 커야 합니다")
	}
	if tradeInPrice <= 0 {
		return nil, apperror.Validation("매입가는 0보다 커야 합니다")
	}

	// 2. 파트너 존재 및 역할 확인
	var partner domain.User
	if err := s.db.Select("Id", "Role").First(&partner, partnerID).Error; err != nil {
		return nil, apperror.NotFound("파트너를 찾을 수 없습니다")
	}
	if partner.Role != "PARTNER" && partner.Role != "ADMIN" {
		return nil, apperror.Validation("해당 사용자는 파트너 역할이 아닙니다")
	}

	// 3. 상품 존재 확인
	var product domain.Product
	if err := s.db.Select("Id").First(&product, productID).Error; err != nil {
		return nil, apperror.NotFound("상품을 찾을 수 없습니다")
	}

	// 4. Upsert 수행
	pp := domain.PartnerPrice{
		PartnerId:    partnerID,
		ProductId:    productID,
		BuyPrice:     domain.NewNumericDecimal(decimal.NewFromFloat(buyPrice).Round(0)),
		TradeInPrice: domain.NewNumericDecimal(decimal.NewFromFloat(tradeInPrice).Round(0)),
	}

	result := s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "PartnerId"}, {Name: "ProductId"}},
		DoUpdates: clause.AssignmentColumns([]string{"BuyPrice", "TradeInPrice", "UpdatedAt"}),
	}).Create(&pp)

	if result.Error != nil {
		return nil, apperror.Internal("파트너 단가 저장 실패", result.Error)
	}

	// 5. 저장된 레코드를 Preload하여 반환
	var saved domain.PartnerPrice
	s.db.
		Preload("Partner", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("Id", "Email", "Name", "PartnerTier")
		}).
		Preload("Product", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("Id", "Name", "BrandCode", "Price", "BuyPrice", "TradeInRate")
		}).
		Where("PartnerId = ? AND ProductId = ?", partnerID, productID).
		First(&saved)

	return &saved, nil
}

// DeletePrice는 지정된 ID의 파트너 단가 레코드를 삭제합니다.
func (s *AdminPartnerPriceService) DeletePrice(id int) error {
	result := s.db.Delete(&domain.PartnerPrice{}, id)
	if result.Error != nil {
		return apperror.Internal("파트너 단가 삭제 실패", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperror.NotFound("파트너 단가를 찾을 수 없습니다")
	}
	return nil
}
