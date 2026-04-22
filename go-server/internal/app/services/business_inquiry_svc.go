// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// BusinessInquiry Service는 파트너 제휴/입점 등 비즈니스 문의 접수 및 관리 기능을 담당합니다.
package services

import (
	"regexp"
	"strings"
	"time"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/repository"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/email"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/pagination"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// businessRegNoPattern은 사업자등록번호 형식(숫자 10자리, 하이픈 없음)을 검증합니다.
var businessRegNoPattern = regexp.MustCompile(`^\d{10}$`)

// businessOpenDatePattern은 개업일자 형식(YYYYMMDD, 하이픈 없음)을 검증합니다.
var businessOpenDatePattern = regexp.MustCompile(`^\d{8}$`)

// validInquiryCategories는 허용된 문의 카테고리 집합입니다.
var validInquiryCategories = map[string]bool{
	"제휴문의": true,
	"입점문의": true,
	"대량구매": true,
	"기타":   true,
}

// validInquiryStatuses는 허용된 문의 상태 집합입니다.
var validInquiryStatuses = map[string]bool{
	"NEW":     true,
	"READ":    true,
	"REPLIED": true,
}

// BusinessInquiryService는 비즈니스 문의 접수, 조회, 상태 관리 비즈니스 로직을 처리합니다.
type BusinessInquiryService struct {
	db         *gorm.DB
	repo       *repository.BaseRepository[domain.BusinessInquiry]
	emailSvc   *email.Service
	adminEmail string
}

// NewBusinessInquiryService는 데이터베이스, 이메일 서비스, 관리자 이메일 주소를 주입받아
// BusinessInquiryService를 초기화합니다.
func NewBusinessInquiryService(db *gorm.DB, emailSvc *email.Service, adminEmail string) *BusinessInquiryService {
	return &BusinessInquiryService{
		db:         db,
		repo:       repository.NewBaseRepository[domain.BusinessInquiry](db),
		emailSvc:   emailSvc,
		adminEmail: adminEmail,
	}
}

// Submit은 비즈니스 문의를 유효성 검사 후 DB에 저장하고, 관리자에게 이메일 알림을 발송합니다.
// 이메일 발송은 비동기(goroutine)로 처리되며 실패하더라도 문의 접수는 완료됩니다.
func (s *BusinessInquiryService) Submit(inquiry *domain.BusinessInquiry) error {
	if err := s.validate(inquiry); err != nil {
		return err
	}

	inquiry.Status = "NEW"
	if err := s.repo.Create(inquiry); err != nil {
		return apperror.Internal("문의 접수 중 오류가 발생했습니다", err)
	}

	// 이메일 알림은 비동기로 처리 — 실패해도 접수는 완료된 것으로 간주
	go func() {
		if s.emailSvc == nil || s.adminEmail == "" {
			return
		}
		err := s.emailSvc.SendBusinessInquiryNotification(
			s.adminEmail,
			inquiry.CompanyName,
			inquiry.BusinessRegNo,
			inquiry.BusinessOpenDate,
			inquiry.RepName,
			inquiry.ContactName,
			inquiry.Email,
			inquiry.Phone,
			inquiry.Category,
			inquiry.Message,
		)
		if err != nil {
			logger.Log.Error("비즈니스 문의 이메일 알림 발송 실패",
				zap.Int("inquiryId", inquiry.ID),
				zap.Error(err),
			)
		}
	}()

	return nil
}

// GetAll은 관리자용 페이지네이션 문의 목록을 조회합니다.
func (s *BusinessInquiryService) GetAll(params pagination.QueryParams) (pagination.PaginatedResponse[domain.BusinessInquiry], error) {
	return s.repo.FindAll(params, nil)
}

// GetByID는 단일 비즈니스 문의를 ID로 조회합니다.
func (s *BusinessInquiryService) GetByID(id int) (*domain.BusinessInquiry, error) {
	inquiry, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperror.NotFound("문의를 찾을 수 없습니다")
	}
	return inquiry, nil
}

// UpdateStatus는 문의의 처리 상태를 변경합니다. 유효한 상태값은 NEW/READ/REPLIED 입니다.
func (s *BusinessInquiryService) UpdateStatus(id int, status string) error {
	if !validInquiryStatuses[status] {
		return apperror.Validation("유효하지 않은 상태값입니다. NEW, READ, REPLIED 중 하나여야 합니다")
	}
	result := s.db.Model(&domain.BusinessInquiry{}).Where("Id = ?", id).Update("Status", status)
	if result.Error != nil {
		return apperror.Internal("상태 변경 중 오류가 발생했습니다", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperror.NotFound("문의를 찾을 수 없습니다")
	}
	return nil
}

// Delete는 비즈니스 문의를 삭제합니다.
func (s *BusinessInquiryService) Delete(id int) error {
	result := s.db.Where("Id = ?", id).Delete(&domain.BusinessInquiry{})
	if result.Error != nil {
		return apperror.Internal("문의 삭제 중 오류가 발생했습니다", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperror.NotFound("문의를 찾을 수 없습니다")
	}
	return nil
}

// validate는 BusinessInquiry 필드의 유효성을 엄격하게 검사합니다.
func (s *BusinessInquiryService) validate(inquiry *domain.BusinessInquiry) error {
	// 필수 필드 + 길이 제한 검증
	inquiry.CompanyName = strings.TrimSpace(inquiry.CompanyName)
	if inquiry.CompanyName == "" {
		return apperror.Validation("회사명을 입력해주세요")
	}
	if len(inquiry.CompanyName) > 100 {
		return apperror.Validation("회사명은 100자 이내로 입력해주세요")
	}

	// 사업자등록번호: 숫자 10자리 (하이픈 제거 후 전달)
	inquiry.BusinessRegNo = strings.ReplaceAll(strings.TrimSpace(inquiry.BusinessRegNo), "-", "")
	if !businessRegNoPattern.MatchString(inquiry.BusinessRegNo) {
		return apperror.Validation("사업자등록번호는 숫자 10자리여야 합니다")
	}

	// 개업일자: YYYYMMDD (하이픈 제거 후 전달)
	inquiry.BusinessOpenDate = strings.ReplaceAll(strings.TrimSpace(inquiry.BusinessOpenDate), "-", "")
	if !businessOpenDatePattern.MatchString(inquiry.BusinessOpenDate) {
		return apperror.Validation("개업일자는 YYYYMMDD 형식의 8자리 숫자여야 합니다")
	}
	if _, err := time.Parse("20060102", inquiry.BusinessOpenDate); err != nil {
		return apperror.Validation("유효하지 않은 날짜입니다")
	}

	// 대표자성명 (외국인은 영문명)
	inquiry.RepName = strings.TrimSpace(inquiry.RepName)
	if inquiry.RepName == "" {
		return apperror.Validation("대표자성명을 입력해주세요")
	}
	if len(inquiry.RepName) > 50 {
		return apperror.Validation("대표자성명은 50자 이내로 입력해주세요")
	}

	inquiry.ContactName = strings.TrimSpace(inquiry.ContactName)
	if inquiry.ContactName == "" {
		return apperror.Validation("담당자명을 입력해주세요")
	}
	if len(inquiry.ContactName) > 50 {
		return apperror.Validation("담당자명은 50자 이내로 입력해주세요")
	}

	inquiry.Email = strings.TrimSpace(inquiry.Email)
	if inquiry.Email == "" {
		return apperror.Validation("이메일을 입력해주세요")
	}
	if err := domain.ValidateEmail(inquiry.Email); err != nil {
		return apperror.Validation(err.Error())
	}

	inquiry.Phone = strings.TrimSpace(inquiry.Phone)
	if inquiry.Phone == "" {
		return apperror.Validation("연락처를 입력해주세요")
	}

	if !validInquiryCategories[inquiry.Category] {
		return apperror.Validation("유효하지 않은 문의 유형입니다")
	}

	inquiry.Message = strings.TrimSpace(inquiry.Message)
	if inquiry.Message == "" {
		return apperror.Validation("문의 내용을 입력해주세요")
	}
	msgLen := len([]rune(inquiry.Message))
	if msgLen < 10 {
		return apperror.Validation("문의 내용은 최소 10자 이상 입력해주세요")
	}
	if msgLen > 200 {
		return apperror.Validation("문의 내용은 200자 이내로 입력해주세요")
	}

	return nil
}
