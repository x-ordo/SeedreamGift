package services

import (
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/repository"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// AdminBrandService는 관리자의 브랜드 관리 기능을 처리합니다.
type AdminBrandService struct {
	db        *gorm.DB
	brandRepo *repository.BaseRepository[domain.Brand]
}

func NewAdminBrandService(db *gorm.DB) *AdminBrandService {
	return &AdminBrandService{
		db:        db,
		brandRepo: repository.NewBaseRepository[domain.Brand](db),
	}
}

func (s *AdminBrandService) GetBrands(params pagination.QueryParams) (pagination.PaginatedResponse[domain.Brand], error) {
	return s.brandRepo.FindAll(params, nil)
}

// GetBrandByCode는 코드로 브랜드 단건을 조회합니다. 비활성 브랜드도 포함합니다.
func (s *AdminBrandService) GetBrandByCode(code string) (*domain.Brand, error) {
	return s.brandRepo.FindOne(map[string]any{"Code": code})
}

func (s *AdminBrandService) CreateBrand(brand *domain.Brand) error {
	if err := domain.ValidateBrandCreate(brand); err != nil {
		return err
	}
	// Fix 8: 코드 및 이름 중복 검사
	var existing domain.Brand
	if s.db.Where("Code = ?", brand.Code).First(&existing).Error == nil {
		return apperror.Conflict("이미 존재하는 브랜드 코드입니다")
	}
	if s.db.Where("Name = ?", brand.Name).First(&existing).Error == nil {
		return apperror.Conflict("이미 존재하는 브랜드 이름입니다")
	}
	return s.brandRepo.Create(brand)
}

func (s *AdminBrandService) UpdateBrand(code string, brand *domain.Brand) error {
	if err := s.db.Model(&domain.Brand{}).Where("Code = ?", code).Updates(map[string]any{
		"Name":        brand.Name,
		"Color":       brand.Color,
		"Order":       brand.Order,
		"Description": brand.Description,
		"ImageUrl":    brand.ImageUrl,
		"IsActive":    brand.IsActive,
		"PinConfig":   brand.PinConfig,
	}).Error; err != nil {
		return err
	}
	// Fix 1: 브랜드 비활성화 시 해당 브랜드의 모든 활성 상품을 함께 비활성화
	if !brand.IsActive {
		s.db.Model(&domain.Product{}).
			Where("BrandCode = ? AND IsActive = ?", code, true).
			Update("IsActive", false)
	}
	return nil
}

func (s *AdminBrandService) DeleteBrand(code string) error {
	var productCount int64
	s.db.Model(&domain.Product{}).Where("BrandCode = ?", code).Count(&productCount)
	if productCount > 0 {
		return apperror.Conflict("cannot delete brand: product(s) still reference it")
	}
	return s.db.Delete(&domain.Brand{}, "Code = ?", code).Error
}
