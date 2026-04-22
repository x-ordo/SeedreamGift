// Package services includes PaymentQueryService for read-only payment listing (결제현황).
package services

import (
	"time"
	"seedream-gift-server/internal/api/dto"
	"seedream-gift-server/internal/domain"

	"gorm.io/gorm"
)

// PaymentQueryScope는 조회 범위를 구분합니다.
type PaymentQueryScope string

const (
	// PaymentScopeAdmin은 어드민 전체 결제 조회 범위입니다.
	PaymentScopeAdmin PaymentQueryScope = "ADMIN"
	// PaymentScopePartner는 파트너 자기 상품 주문에 한정된 조회 범위입니다.
	PaymentScopePartner PaymentQueryScope = "PARTNER"
)

// PaymentQueryFilters는 /payments 엔드포인트의 쿼리 파라미터를 담습니다.
type PaymentQueryFilters struct {
	// Status는 결제 상태 필터입니다. 빈 문자열이면 전체.
	Status string
	// Method는 결제 수단 필터입니다. 빈 문자열이면 전체.
	Method string
	// From은 조회 시작 시각 (inclusive, Payment.CreatedAt 기준)입니다.
	From time.Time
	// To는 조회 종료 시각 (inclusive)입니다.
	To time.Time
	// Search는 주문코드(또는 Admin 스코프에서 고객명) LIKE 검색어입니다.
	Search string
	// Page는 1-based 페이지 번호입니다.
	Page int
	// PageSize는 페이지 당 항목 수입니다 (최대 100).
	PageSize int
	// PartnerUserID는 Partner 스코프 시 필터링 기준 파트너 user ID입니다.
	PartnerUserID int
}

// PaymentQueryService는 읽기 전용 결제 조회 서비스입니다.
type PaymentQueryService struct {
	db *gorm.DB
}

// NewPaymentQueryService는 PaymentQueryService를 생성합니다.
func NewPaymentQueryService(db *gorm.DB) *PaymentQueryService {
	return &PaymentQueryService{db: db}
}

// ListPayments는 스코프·필터에 맞는 결제 리스트와 요약을 반환합니다.
// Partner 스코프면 Product.PartnerID 조인으로 자동 제한하고, 응답 단계에서 민감 필드를 마스킹합니다.
func (s *PaymentQueryService) ListPayments(scope PaymentQueryScope, f PaymentQueryFilters) (*dto.PaymentListResponse, error) {
	base := s.buildBaseQuery(scope, f)

	// Summary는 status 필터 미적용 기준 (상태별 토글 UX 용도)
	summary, err := s.computeSummary(s.buildBaseQuery(scope, f))
	if err != nil {
		return nil, err
	}

	// status 필터 적용된 실제 리스트
	listQ := s.applyStatusFilter(base, f.Status)

	// Count를 위한 별도 체인 (SELECT 절이 적용되기 전)
	countQ := s.applyStatusFilter(s.buildBaseQuery(scope, f), f.Status)
	var total int64
	if err := countQ.Count(&total).Error; err != nil {
		return nil, err
	}

	page := f.Page
	if page < 1 {
		page = 1
	}
	pageSize := f.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var rows []paymentJoinRow
	if err := listQ.
		Select(paymentSelectColumns).
		Order("p.CreatedAt DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	items := make([]dto.PaymentListItem, 0, len(rows))
	for _, r := range rows {
		item := r.toDTO()
		if scope == PaymentScopePartner {
			item = dto.MaskPaymentListItemForPartner(item)
		}
		items = append(items, item)
	}

	return &dto.PaymentListResponse{
		Items:    items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		Summary:  summary,
	}, nil
}

// paymentJoinRow는 raw SELECT 결과를 받는 중간 구조체입니다.
type paymentJoinRow struct {
	PaymentID     int        `gorm:"column:PaymentId"`
	OrderID       int        `gorm:"column:OrderId"`
	OrderCode     *string    `gorm:"column:OrderCode"`
	CustomerName  *string    `gorm:"column:CustomerName"`
	CustomerEmail *string    `gorm:"column:CustomerEmail"`
	Method        string     `gorm:"column:Method"`
	Status        string     `gorm:"column:Status"`
	Amount        int64      `gorm:"column:Amount"`
	FailReason    *string    `gorm:"column:FailReason"`
	ConfirmedAt   *time.Time `gorm:"column:ConfirmedAt"`
	CreatedAt     time.Time  `gorm:"column:CreatedAt"`
}

func (r paymentJoinRow) toDTO() dto.PaymentListItem {
	return dto.PaymentListItem{
		PaymentID:     r.PaymentID,
		OrderID:       r.OrderID,
		OrderCode:     r.OrderCode,
		CustomerName:  r.CustomerName,
		CustomerEmail: r.CustomerEmail,
		Method:        r.Method,
		Status:        r.Status,
		Amount:        r.Amount,
		FailReason:    r.FailReason,
		ConfirmedAt:   r.ConfirmedAt,
		CreatedAt:     r.CreatedAt,
	}
}

// paymentSelectColumns는 Payment + Order + User를 조인한 리스트 조회 SELECT 절입니다.
// MSSQL decimal(12,0)의 Amount를 BIGINT로 캐스트해 Go int64로 안전하게 수신합니다.
const paymentSelectColumns = `
	p.Id            AS PaymentId,
	p.OrderId       AS OrderId,
	o.OrderCode     AS OrderCode,
	u.Name          AS CustomerName,
	u.Email         AS CustomerEmail,
	p.Method        AS Method,
	p.Status        AS Status,
	CAST(p.Amount AS BIGINT) AS Amount,
	p.FailReason   AS FailReason,
	p.ConfirmedAt  AS ConfirmedAt,
	p.CreatedAt    AS CreatedAt
`

// buildBaseQuery는 스코프·기간·수단·검색을 적용한 기본 쿼리 체인을 만듭니다.
// status는 포함하지 않음 (summary 계산 시 제외되어야 함).
func (s *PaymentQueryService) buildBaseQuery(scope PaymentQueryScope, f PaymentQueryFilters) *gorm.DB {
	q := s.db.Table("Payments AS p").
		Joins("JOIN Orders o ON p.OrderId = o.Id").
		Joins("LEFT JOIN Users u ON o.UserId = u.Id")

	if scope == PaymentScopePartner {
		q = q.
			Joins("JOIN OrderItems oi ON oi.OrderId = o.Id").
			Joins("JOIN Products pr ON pr.Id = oi.ProductId").
			Where("pr.PartnerID = ?", f.PartnerUserID).
			Distinct("p.Id")
	}

	if !f.From.IsZero() {
		q = q.Where("p.CreatedAt >= ?", f.From)
	}
	if !f.To.IsZero() {
		q = q.Where("p.CreatedAt <= ?", f.To)
	}
	if f.Method != "" {
		q = q.Where("p.Method = ?", f.Method)
	}
	if f.Search != "" {
		pattern := "%" + f.Search + "%"
		if scope == PaymentScopeAdmin {
			q = q.Where("o.OrderCode LIKE ? OR u.Name LIKE ?", pattern, pattern)
		} else {
			q = q.Where("o.OrderCode LIKE ?", pattern)
		}
	}
	return q
}

// applyStatusFilter는 status가 지정된 경우에만 필터를 덧붙입니다.
func (s *PaymentQueryService) applyStatusFilter(q *gorm.DB, status string) *gorm.DB {
	if status != "" {
		return q.Where("p.Status = ?", status)
	}
	return q
}

// computeSummary는 status 필터 미적용 집계를 반환합니다.
// SUM(CASE...)로 단일 쿼리에서 상태별 카운트를 계산합니다.
func (s *PaymentQueryService) computeSummary(base *gorm.DB) (dto.PaymentSummary, error) {
	var row struct {
		Total     int64
		Success   int64
		Failed    int64
		Pending   int64
		Cancelled int64
	}
	if err := base.
		Select(`
			COUNT(*) AS Total,
			SUM(CASE WHEN p.Status = 'SUCCESS'   THEN 1 ELSE 0 END) AS Success,
			SUM(CASE WHEN p.Status = 'FAILED'    THEN 1 ELSE 0 END) AS Failed,
			SUM(CASE WHEN p.Status = 'PENDING'   THEN 1 ELSE 0 END) AS Pending,
			SUM(CASE WHEN p.Status = 'CANCELLED' THEN 1 ELSE 0 END) AS Cancelled
		`).
		Scan(&row).Error; err != nil {
		return dto.PaymentSummary{}, err
	}
	return dto.PaymentSummary{
		TotalCount:     row.Total,
		SuccessCount:   row.Success,
		FailedCount:    row.Failed,
		PendingCount:   row.Pending,
		CancelledCount: row.Cancelled,
	}, nil
}

// _ keep domain imported for future DTO mapping that may reference domain types.
var _ = domain.Payment{}
