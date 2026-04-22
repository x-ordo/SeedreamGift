package services

import (
	"time"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/repository"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// AdminSessionService는 관리자의 세션/감사로그 관리 기능을 처리합니다.
type AdminSessionService struct {
	db        *gorm.DB
	auditRepo *repository.BaseRepository[domain.AuditLog]
}

func NewAdminSessionService(db *gorm.DB) *AdminSessionService {
	return &AdminSessionService{
		db:        db,
		auditRepo: repository.NewBaseRepository[domain.AuditLog](db),
	}
}

func (s *AdminSessionService) GetAuditLogs(params pagination.QueryParams) (pagination.PaginatedResponse[domain.AuditLog], error) {
	return s.auditRepo.FindAll(params, nil)
}

func (s *AdminSessionService) GetAuditLogDetail(id int) (*domain.AuditLog, error) {
	var log domain.AuditLog
	err := s.db.Preload("User").First(&log, id).Error
	return &log, err
}

func (s *AdminSessionService) GetSessions(params pagination.QueryParams) (pagination.PaginatedResponse[domain.RefreshToken], error) {
	var items []domain.RefreshToken
	var total int64
	now := time.Now()
	db := s.db.Model(&domain.RefreshToken{}).Where("ExpiresAt > ?", now)
	db.Count(&total)
	if params.Limit <= 0 {
		params.Limit = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}
	offset := (params.Page - 1) * params.Limit
	err := s.db.Where("ExpiresAt > ?", now).Preload("User").Order("CreatedAt DESC").Offset(offset).Limit(params.Limit).Find(&items).Error
	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), err
}

func (s *AdminSessionService) DeleteSession(id int, currentAdminID int) error {
	var token domain.RefreshToken
	if err := s.db.First(&token, id).Error; err != nil {
		return apperror.NotFoundf("session %d not found", id)
	}
	if token.UserID == currentAdminID {
		return apperror.Validation("cannot delete your own active session")
	}
	return s.db.Delete(&domain.RefreshToken{}, id).Error
}

func (s *AdminSessionService) DeleteUserSessions(userId int) error {
	return s.db.Where("UserId = ?", userId).Delete(&domain.RefreshToken{}).Error
}
