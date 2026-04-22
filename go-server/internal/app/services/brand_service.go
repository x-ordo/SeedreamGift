/*
Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
Brand Service는 브랜드 카탈로그를 관리합니다.

주요 역할:
- 브랜드 정보를 조회하고 브랜드 메타데이터를 관리합니다.
- 상품 카탈로그를 위한 브랜드 기반 필터링을 지원합니다.
- 고성능 Windows 백엔드를 위해 효율적인 브랜드 데이터 전달을 보장합니다.
*/
package services

import (
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/repository"
	"seedream-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// BrandService는 브랜드 관련 비즈니스 로직을 처리하는 서비스입니다.
type BrandService struct {
	repo *repository.BaseRepository[domain.Brand]
}

// NewBrandService는 새로운 BrandService 인스턴스를 생성합니다.
func NewBrandService(db *gorm.DB) *BrandService {
	return &BrandService{
		repo: repository.NewBaseRepository[domain.Brand](db),
	}
}

// GetAllBrands는 페이지네이션이 적용된 활성 브랜드 목록을 반환합니다.
func (s *BrandService) GetAllBrands(params pagination.QueryParams) (pagination.PaginatedResponse[domain.Brand], error) {
	return s.repo.FindAll(params, map[string]any{"IsActive": true})
}

// GetBrandByCode는 고유 코드를 사용하여 특정 브랜드의 상세 정보를 조회합니다.
func (s *BrandService) GetBrandByCode(code string) (*domain.Brand, error) {
	return s.repo.FindOne(map[string]any{"Code": code, "IsActive": true})
}
