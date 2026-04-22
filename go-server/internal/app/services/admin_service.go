// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// AdminConfigService는 사이트 설정(SiteConfig) CRUD를 처리합니다.
// 통계는 AdminStatsService, 보안 패턴은 PatternRuleService로 분리되었습니다.
package services

import (
	"seedream-gift-server/internal/domain"

	"gorm.io/gorm"
)

// AdminConfigService는 사이트 설정 관리를 전담합니다.
type AdminConfigService struct {
	db     *gorm.DB
	config ConfigProvider
}

// NewAdminConfigService는 새로운 AdminConfigService 인스턴스를 생성합니다.
func NewAdminConfigService(db *gorm.DB, config ConfigProvider) *AdminConfigService {
	return &AdminConfigService{db: db, config: config}
}

// GetSiteConfigs는 전체 사이트 설정 목록을 조회합니다.
func (s *AdminConfigService) GetSiteConfigs() ([]domain.SiteConfig, error) {
	var configs []domain.SiteConfig
	err := s.db.Find(&configs).Error
	return configs, err
}

// UpdateSiteConfig는 키를 기반으로 특정 사이트 설정 값을 업데이트합니다.
func (s *AdminConfigService) UpdateSiteConfig(key string, value string) error {
	if err := s.db.Model(&domain.SiteConfig{}).Where("[Key] = ?", key).Update("Value", value).Error; err != nil {
		return err
	}
	if s.config != nil {
		s.config.Invalidate(key)
	}
	return nil
}

// GetSiteConfigByKey는 키를 사용하여 특정 사이트 설정을 조회합니다.
func (s *AdminConfigService) GetSiteConfigByKey(key string) (*domain.SiteConfig, error) {
	var cfg domain.SiteConfig
	err := s.db.Where("[Key] = ?", key).First(&cfg).Error
	return &cfg, err
}

// GetSiteConfigByID는 ID를 사용하여 특정 사이트 설정을 조회합니다.
func (s *AdminConfigService) GetSiteConfigByID(id int) (*domain.SiteConfig, error) {
	var cfg domain.SiteConfig
	err := s.db.First(&cfg, id).Error
	return &cfg, err
}

// CreateSiteConfig는 새로운 사이트 설정을 생성합니다.
func (s *AdminConfigService) CreateSiteConfig(cfg *domain.SiteConfig) error {
	return s.db.Create(cfg).Error
}

// DeleteSiteConfig는 ID를 사용하여 사이트 설정을 삭제합니다.
func (s *AdminConfigService) DeleteSiteConfig(id int) error {
	return s.db.Delete(&domain.SiteConfig{}, id).Error
}
