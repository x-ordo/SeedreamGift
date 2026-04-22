package services

import (
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// AdminGiftService는 관리자의 선물 관리 기능을 처리합니다.
type AdminGiftService struct {
	db *gorm.DB
}

func NewAdminGiftService(db *gorm.DB) *AdminGiftService {
	return &AdminGiftService{db: db}
}

func (s *AdminGiftService) GetAllGifts(params pagination.QueryParams) (pagination.PaginatedResponse[domain.Gift], error) {
	var items []domain.Gift
	var total int64
	s.db.Model(&domain.Gift{}).Count(&total)
	if params.Limit <= 0 {
		params.Limit = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}
	offset := (params.Page - 1) * params.Limit
	err := s.db.Preload("Sender").Preload("Receiver").Preload("Order").
		Order("CreatedAt DESC").Offset(offset).Limit(params.Limit).Find(&items).Error
	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), err
}

func (s *AdminGiftService) GetGiftDetail(id int) (*domain.Gift, error) {
	var gift domain.Gift
	err := s.db.Preload("Sender").Preload("Receiver").Preload("Order.OrderItems.Product").First(&gift, id).Error
	return &gift, err
}

func (s *AdminGiftService) GetGiftStats() (map[string]any, error) {
	var total, sent, claimed, expired int64
	s.db.Model(&domain.Gift{}).Count(&total)
	s.db.Model(&domain.Gift{}).Where("Status = 'SENT'").Count(&sent)
	s.db.Model(&domain.Gift{}).Where("Status = 'CLAIMED'").Count(&claimed)
	s.db.Model(&domain.Gift{}).Where("Status = 'EXPIRED'").Count(&expired)
	return map[string]any{
		"total":   total,
		"sent":    sent,
		"claimed": claimed,
		"expired": expired,
	}, nil
}
