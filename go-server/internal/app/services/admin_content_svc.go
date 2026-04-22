package services

import (
	"time"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/repository"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// AdminContentService는 관리자의 콘텐츠(공지/FAQ/이벤트/문의) 관리 기능을 처리합니다.
type AdminContentService struct {
	db         *gorm.DB
	noticeRepo *repository.BaseRepository[domain.Notice]
	faqRepo    *repository.BaseRepository[domain.Faq]
	eventRepo  *repository.BaseRepository[domain.Event]
	policyRepo *repository.BaseRepository[domain.Policy]
}

func NewAdminContentService(db *gorm.DB) *AdminContentService {
	return &AdminContentService{
		db:         db,
		noticeRepo: repository.NewBaseRepository[domain.Notice](db),
		faqRepo:    repository.NewBaseRepository[domain.Faq](db),
		eventRepo:  repository.NewBaseRepository[domain.Event](db),
		policyRepo: repository.NewBaseRepository[domain.Policy](db),
	}
}

// ── Notices ──

func (s *AdminContentService) GetAllNotices(params pagination.QueryParams) (pagination.PaginatedResponse[domain.Notice], error) {
	return s.noticeRepo.FindAll(params, nil)
}

func (s *AdminContentService) GetNotice(id int) (*domain.Notice, error) {
	return s.noticeRepo.FindByID(id)
}

func (s *AdminContentService) CreateNotice(n *domain.Notice) error {
	if err := domain.ValidateNotice(n); err != nil {
		return err
	}
	return s.noticeRepo.Create(n)
}

func (s *AdminContentService) UpdateNotice(id int, n *domain.Notice) error {
	return s.noticeRepo.Update(id, n)
}

func (s *AdminContentService) DeleteNotice(id int) error { return s.noticeRepo.Delete(id) }

// ── FAQs ──

func (s *AdminContentService) GetAllFaqs(params pagination.QueryParams) (pagination.PaginatedResponse[domain.Faq], error) {
	return s.faqRepo.FindAll(params, nil)
}

func (s *AdminContentService) GetFaq(id int) (*domain.Faq, error) { return s.faqRepo.FindByID(id) }

func (s *AdminContentService) CreateFaq(f *domain.Faq) error {
	if err := domain.ValidateFaq(f); err != nil {
		return err
	}
	return s.faqRepo.Create(f)
}

func (s *AdminContentService) UpdateFaq(id int, f *domain.Faq) error { return s.faqRepo.Update(id, f) }

func (s *AdminContentService) DeleteFaq(id int) error { return s.faqRepo.Delete(id) }

// ── Events ──

func (s *AdminContentService) GetAllEvents(params pagination.QueryParams) (pagination.PaginatedResponse[domain.Event], error) {
	return s.eventRepo.FindAll(params, nil)
}

func (s *AdminContentService) GetEvent(id int) (*domain.Event, error) {
	return s.eventRepo.FindByID(id)
}

func (s *AdminContentService) CreateEvent(e *domain.Event) error {
	if err := domain.ValidateEvent(e); err != nil {
		return err
	}
	return s.eventRepo.Create(e)
}

func (s *AdminContentService) UpdateEvent(id int, e *domain.Event) error {
	// 날짜가 모두 제공된 경우 종료일이 시작일보다 이후인지 검증합니다.
	if !e.StartDate.IsZero() && !e.EndDate.IsZero() {
		if !e.EndDate.After(e.StartDate) {
			return apperror.Validation("종료일은 시작일보다 이후여야 합니다")
		}
	}
	return s.eventRepo.Update(id, e)
}

func (s *AdminContentService) DeleteEvent(id int) error { return s.eventRepo.Delete(id) }

// ── Inquiries ──

func (s *AdminContentService) GetAllInquiries(params pagination.QueryParams) (pagination.PaginatedResponse[domain.Inquiry], error) {
	var items []domain.Inquiry
	var total int64
	s.db.Model(&domain.Inquiry{}).Count(&total)
	offset := (params.Page - 1) * params.Limit
	err := s.db.Preload("User").Order("CreatedAt DESC").Offset(offset).Limit(params.Limit).Find(&items).Error
	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), err
}

func (s *AdminContentService) GetInquiry(id int) (*domain.Inquiry, error) {
	var inquiry domain.Inquiry
	err := s.db.Preload("User").First(&inquiry, id).Error
	return &inquiry, err
}

func (s *AdminContentService) AnswerInquiry(id int, adminID int, answer string) error {
	if answer == "" {
		return apperror.Validation("답변 내용을 입력해주세요")
	}
	if len(answer) > 5000 {
		return apperror.Validation("답변은 5000자 이내로 입력해주세요")
	}

	// 현재 상태를 조회하여 CLOSED 문의에는 답변할 수 없도록 차단합니다.
	var inquiry domain.Inquiry
	if err := s.db.Select("Id", "Status").First(&inquiry, id).Error; err != nil {
		return apperror.NotFound("문의를 찾을 수 없습니다")
	}
	if inquiry.Status == "CLOSED" {
		return apperror.Validation("종료된 문의에는 답변할 수 없습니다")
	}

	now := time.Now()
	return s.db.Model(&domain.Inquiry{}).Where("Id = ?", id).Updates(map[string]any{
		"Answer":     answer,
		"Status":     "ANSWERED",
		"AnsweredAt": now,
		"AnsweredBy": adminID,
	}).Error
}

func (s *AdminContentService) CloseInquiry(id int) error {
	var inquiry domain.Inquiry
	if err := s.db.Select("Id", "Status").First(&inquiry, id).Error; err != nil {
		return apperror.NotFound("문의를 찾을 수 없습니다")
	}
	if inquiry.Status == "CLOSED" {
		return apperror.Validation("이미 종료된 문의입니다")
	}
	return s.db.Model(&domain.Inquiry{}).Where("Id = ?", id).Updates(map[string]any{
		"Status": "CLOSED",
	}).Error
}

func (s *AdminContentService) DeleteInquiryAdmin(id int) error {
	return s.db.Delete(&domain.Inquiry{}, id).Error
}

// ── Policies ──

func (s *AdminContentService) GetAllPolicies(params pagination.QueryParams) (pagination.PaginatedResponse[domain.Policy], error) {
	return s.policyRepo.FindAll(params, nil)
}

func (s *AdminContentService) GetPolicy(id int) (*domain.Policy, error) {
	return s.policyRepo.FindByID(id)
}

func (s *AdminContentService) CreatePolicy(p *domain.Policy) error {
	if p.Title == "" || p.Content == "" || p.Type == "" || p.Version == "" {
		return apperror.Validation("title, content, type, version are required")
	}
	validPolicyTypes := map[string]bool{"TERMS": true, "PRIVACY": true, "MARKETING": true}
	if !validPolicyTypes[p.Type] {
		return apperror.Validation("유효하지 않은 정책 유형입니다 (TERMS, PRIVACY, MARKETING)")
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		// IsCurrent=true인 경우, 같은 Type의 다른 정책들의 IsCurrent를 false로 원자적으로 변경
		if p.IsCurrent {
			if err := tx.Model(&domain.Policy{}).Where("Type = ? AND IsCurrent = ?", p.Type, true).Update("IsCurrent", false).Error; err != nil {
				return err
			}
		}
		return tx.Create(p).Error
	})
}

func (s *AdminContentService) UpdatePolicy(id int, p *domain.Policy) error {
	if p.IsCurrent {
		// 기존 current 해제
		var existing domain.Policy
		if err := s.db.First(&existing, id).Error; err == nil {
			s.db.Model(&domain.Policy{}).Where("Type = ? AND IsCurrent = ? AND Id != ?", existing.Type, true, id).Update("IsCurrent", false)
		}
	}
	return s.policyRepo.Update(id, p)
}

func (s *AdminContentService) SetCurrentPolicy(id int) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var policy domain.Policy
		if err := tx.First(&policy, id).Error; err != nil {
			return apperror.NotFound("정책을 찾을 수 없습니다")
		}
		// 같은 Type의 현재 정책을 원자적으로 해제한 뒤 이 정책을 current로 설정
		if err := tx.Model(&domain.Policy{}).Where("Type = ? AND IsCurrent = ?", policy.Type, true).Update("IsCurrent", false).Error; err != nil {
			return err
		}
		return tx.Model(&policy).Update("IsCurrent", true).Error
	})
}

func (s *AdminContentService) DeletePolicy(id int) error {
	return s.policyRepo.Delete(id)
}

// GetCurrentPolicy는 공개 API용 — 특정 유형의 현재 버전 정책을 반환합니다.
func (s *AdminContentService) GetCurrentPolicy(policyType string) (*domain.Policy, error) {
	var policy domain.Policy
	err := s.db.Where("Type = ? AND IsCurrent = ? AND IsActive = ?", policyType, true, true).First(&policy).Error
	if err != nil {
		return nil, err
	}
	return &policy, nil
}
