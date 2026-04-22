/*
Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
Content Service는 정보성 및 마케팅 콘텐츠의 제공을 관리합니다.

주요 역할:
- 프론트엔드 표시를 위한 배너, 공지사항, FAQ를 조회하고 분류합니다.
- 사용자 문의(Inquiry)를 처리하고 지원 티켓 생명주기를 관리합니다.
- 효율적인 데이터베이스 쿼리와 Windows 기반 프리로딩을 통해 콘텐츠 조회 성능을 최적화합니다.
*/
package services

import (
	"time"
	"w-gift-server/internal/domain"
	"w-gift-server/internal/infra/repository"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// ContentService는 공지사항, FAQ, 이벤트, 1:1 문의 등 콘텐츠 관련 비즈니스 로직을 처리하는 서비스입니다.
type ContentService struct {
	noticeRepo  *repository.BaseRepository[domain.Notice]
	faqRepo     *repository.BaseRepository[domain.Faq]
	eventRepo   *repository.BaseRepository[domain.Event]
	inquiryRepo *repository.BaseRepository[domain.Inquiry]
	db          *gorm.DB
}

// NewContentService는 새로운 ContentService 인스턴스를 생성합니다.
func NewContentService(db *gorm.DB) *ContentService {
	return &ContentService{
		db:          db,
		noticeRepo:  repository.NewBaseRepository[domain.Notice](db),
		faqRepo:     repository.NewBaseRepository[domain.Faq](db),
		eventRepo:   repository.NewBaseRepository[domain.Event](db),
		inquiryRepo: repository.NewBaseRepository[domain.Inquiry](db),
	}
}

// ========================================
// Events (이벤트)
// ========================================

// GetEvents는 페이지네이션이 적용된 이벤트 목록을 조회합니다.
func (s *ContentService) GetEvents(params pagination.QueryParams) (pagination.PaginatedResponse[domain.Event], error) {
	return s.eventRepo.FindAll(params, map[string]any{"IsActive": true})
}

// GetEventByID는 ID를 기준으로 활성 이벤트를 조회합니다.
func (s *ContentService) GetEventByID(id int) (*domain.Event, error) {
	return s.eventRepo.FindOne(map[string]any{"Id": id, "IsActive": true})
}

// IncrementEventView는 활성 이벤트의 조회수를 1 증가시킵니다.
// 비활성 이벤트에 대한 조회수는 증가되지 않으며 NotFound 오류를 반환합니다.
func (s *ContentService) IncrementEventView(id int) error {
	result := s.db.Model(&domain.Event{}).Where("Id = ? AND IsActive = ?", id, true).
		UpdateColumn("ViewCount", gorm.Expr("ViewCount + ?", 1))
	if result.RowsAffected == 0 {
		return apperror.NotFound("이벤트를 찾을 수 없습니다")
	}
	return result.Error
}

// GetActiveEvents는 현재 상태(진행 중, 예정, 종료)에 따른 활성 이벤트 목록을 조회합니다.
func (s *ContentService) GetActiveEvents(status string) ([]domain.Event, error) {
	var events []domain.Event
	now := time.Now()
	query := s.db.Where("IsActive = ?", true)

	switch status {
	case "ongoing":
		query = query.Where("StartDate <= ? AND EndDate >= ?", now, now)
	case "upcoming":
		query = query.Where("StartDate > ?", now)
	case "ended":
		query = query.Where("EndDate < ?", now)
	}

	err := query.Order("CreatedAt DESC").Find(&events).Error
	return events, err
}

// GetFeaturedEvents는 현재 진행 중인 추천(Featured) 활성 이벤트 목록을 조회합니다.
// 시작일이 현재 이전이고 종료일이 현재 이후인 이벤트만 반환합니다.
func (s *ContentService) GetFeaturedEvents() ([]domain.Event, error) {
	var events []domain.Event
	now := time.Now()
	err := s.db.Where("IsActive = ? AND IsFeatured = ? AND StartDate <= ? AND EndDate >= ?", true, true, now, now).
		Order("CreatedAt DESC").Find(&events).Error
	return events, err
}

// ========================================
// Notices (공지사항)
// ========================================

// GetNotices는 페이지네이션이 적용된 활성 공지사항 목록을 조회합니다.
func (s *ContentService) GetNotices(params pagination.QueryParams) (pagination.PaginatedResponse[domain.Notice], error) {
	return s.noticeRepo.FindAll(params, map[string]any{"IsActive": true})
}

// GetNoticeByID는 ID를 기준으로 활성 공지사항을 조회합니다.
func (s *ContentService) GetNoticeByID(id int) (*domain.Notice, error) {
	return s.noticeRepo.FindOne(map[string]any{"Id": id, "IsActive": true})
}

// IncrementNoticeView는 활성 공지사항의 조회수를 1 증가시킵니다.
// 비활성 공지사항에 대한 조회수는 증가되지 않으며 NotFound 오류를 반환합니다.
func (s *ContentService) IncrementNoticeView(id int) error {
	result := s.db.Model(&domain.Notice{}).Where("Id = ? AND IsActive = ?", id, true).
		UpdateColumn("ViewCount", gorm.Expr("ViewCount + ?", 1))
	if result.RowsAffected == 0 {
		return apperror.NotFound("공지사항을 찾을 수 없습니다")
	}
	return result.Error
}

// GetActiveNotices는 최근 작성된 활성 공지사항 목록을 지정된 개수만큼 조회합니다.
func (s *ContentService) GetActiveNotices(limit int) ([]domain.Notice, error) {
	var notices []domain.Notice
	err := s.db.Where("IsActive = ?", true).
		Order("CreatedAt DESC").Limit(limit).Find(&notices).Error
	return notices, err
}

// ========================================
// FAQs (자주 묻는 질문)
// ========================================

// GetFaqs는 카테고리별로 페이지네이션이 적용된 FAQ 목록을 조회합니다.
func (s *ContentService) GetFaqs(params pagination.QueryParams, category string) (pagination.PaginatedResponse[domain.Faq], error) {
	where := map[string]any{"IsActive": true}
	if category != "" {
		where["Category"] = category
	}
	return s.faqRepo.FindAll(params, where)
}

// GetFaqByID는 ID를 기준으로 활성 FAQ를 조회합니다.
func (s *ContentService) GetFaqByID(id int) (*domain.Faq, error) {
	return s.faqRepo.FindOne(map[string]any{"Id": id, "IsActive": true})
}

// GetActiveFaqs는 특정 카테고리의 모든 활성 FAQ 목록을 순서대로 조회합니다.
func (s *ContentService) GetActiveFaqs(category string) ([]domain.Faq, error) {
	var faqs []domain.Faq
	query := s.db.Where("IsActive = ?", true)
	if category != "" && category != "ALL" {
		query = query.Where("Category = ?", category)
	}
	err := query.Order("[Order] ASC").Find(&faqs).Error
	return faqs, err
}

// GetFaqCategories는 FAQ에 등록된 모든 고유 카테고리 목록을 조회합니다.
func (s *ContentService) GetFaqCategories() ([]string, error) {
	var categories []string
	err := s.db.Model(&domain.Faq{}).Distinct().Pluck("Category", &categories).Error
	return categories, err
}

// IncrementFaqHelpful는 FAQ의 '도움됨' 카운트를 1 증가시킵니다.
func (s *ContentService) IncrementFaqHelpful(id int) error {
	return s.db.Model(&domain.Faq{}).Where("Id = ?", id).UpdateColumn("HelpfulCount", gorm.Expr("HelpfulCount + ?", 1)).Error
}

// ========================================
// Inquiries (1:1 문의)
// ========================================

// CreateInquiry는 새로운 사용자 문의를 유효성 검사 후 생성합니다.
func (s *ContentService) CreateInquiry(userID int, category, subject, content string) error {
	if err := domain.ValidateInquiry(category, subject, content); err != nil {
		return err
	}
	inquiry := &domain.Inquiry{
		UserID:   userID,
		Category: category,
		Subject:  subject,
		Content:  content,
		Status:   "PENDING",
	}
	return s.inquiryRepo.Create(inquiry)
}

// GetMyInquiries는 특정 사용자가 작성한 문의 목록을 페이지네이션과 함께 조회합니다.
func (s *ContentService) GetMyInquiries(userID int, params pagination.QueryParams) (pagination.PaginatedResponse[domain.Inquiry], error) {
	return s.inquiryRepo.FindAll(params, map[string]any{"UserId": userID})
}

// UpdateInquiry는 답변 대기 중(PENDING)인 문의에 한해 수정을 허용합니다.
func (s *ContentService) UpdateInquiry(userID int, id int, updates map[string]any) error {
	result := s.db.Model(&domain.Inquiry{}).Where("Id = ? AND UserId = ? AND Status = ?", id, userID, "PENDING").Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperror.Validation("문의를 수정할 수 없습니다. 답변이 등록된 문의는 수정할 수 없습니다.")
	}
	return nil
}

// DeleteInquiry는 답변 대기 중(PENDING)인 문의에 한해 삭제를 허용합니다.
func (s *ContentService) DeleteInquiry(userID int, id int) error {
	result := s.db.Where("Id = ? AND UserId = ? AND Status = ?", id, userID, "PENDING").Delete(&domain.Inquiry{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperror.Validation("문의를 삭제할 수 없습니다. 답변이 등록된 문의는 삭제할 수 없습니다.")
	}
	return nil
}
