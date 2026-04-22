package services

import (
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// AdminCartService는 관리자의 장바구니 관리 기능을 처리합니다.
type AdminCartService struct {
	db *gorm.DB
}

func NewAdminCartService(db *gorm.DB) *AdminCartService {
	return &AdminCartService{db: db}
}

func (s *AdminCartService) GetAllCarts(params pagination.QueryParams) (pagination.PaginatedResponse[domain.CartItem], error) {
	var items []domain.CartItem
	var total int64
	s.db.Model(&domain.CartItem{}).Count(&total)
	offset := (params.Page - 1) * params.Limit
	err := s.db.Preload("User").Preload("Product").Order("CreatedAt DESC").Offset(offset).Limit(params.Limit).Find(&items).Error
	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), err
}

func (s *AdminCartService) GetUserCarts(userId int) ([]domain.CartItem, error) {
	var items []domain.CartItem
	err := s.db.Preload("Product").Where("UserId = ?", userId).Find(&items).Error
	return items, err
}

func (s *AdminCartService) DeleteCartItem(id int) error {
	return s.db.Delete(&domain.CartItem{}, id).Error
}

func (s *AdminCartService) ClearUserCart(userId int) error {
	return s.db.Where("UserId = ?", userId).Delete(&domain.CartItem{}).Error
}
