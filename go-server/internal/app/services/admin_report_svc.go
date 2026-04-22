package services

import (
	"time"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"

	"gorm.io/gorm"
)

// validateReportDate는 날짜 문자열이 YYYY-MM-DD 형식인지 검증합니다.
func validateReportDate(label, date string) error {
	if date == "" {
		return nil
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		return apperror.Validation(label + " 형식이 올바르지 않습니다 (YYYY-MM-DD)")
	}
	return nil
}

// AdminReportService는 관리자 리포트 관련 기능을 처리합니다.
type AdminReportService struct {
	db *gorm.DB
}

func NewAdminReportService(db *gorm.DB) *AdminReportService {
	return &AdminReportService{db: db}
}

// ReportDateRange는 리포트 조회 기간을 나타냅니다.
type ReportDateRange struct {
	StartDate string `form:"startDate"`
	EndDate   string `form:"endDate"`
}

func (s *AdminReportService) GetBankTransactionReport(startDate, endDate string) ([]map[string]any, error) {
	// 날짜 파라미터 형식을 먼저 검증합니다.
	if err := validateReportDate("시작일", startDate); err != nil {
		return nil, err
	}
	if err := validateReportDate("종료일", endDate); err != nil {
		return nil, err
	}
	var results []map[string]any
	query := s.db.Model(&domain.Payment{}).
		Select("Method, Status, COUNT(*) as count, SUM(Amount) as total_amount").
		Group("Method, Status")
	if startDate != "" {
		query = query.Where("CreatedAt >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("CreatedAt <= ?", endDate+" 23:59:59")
	}
	err := query.Find(&results).Error
	return results, err
}

func (s *AdminReportService) GetTradeInPayoutReport(startDate, endDate string) ([]map[string]any, error) {
	// 날짜 파라미터 형식을 먼저 검증합니다.
	if err := validateReportDate("시작일", startDate); err != nil {
		return nil, err
	}
	if err := validateReportDate("종료일", endDate); err != nil {
		return nil, err
	}
	var results []map[string]any
	query := s.db.Model(&domain.TradeIn{}).
		Select("Status, COUNT(*) as count, SUM(PayoutAmount) as total_payout").
		Group("Status")
	if startDate != "" {
		query = query.Where("CreatedAt >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("CreatedAt <= ?", endDate+" 23:59:59")
	}
	err := query.Find(&results).Error
	return results, err
}

// GetDailySalesReport는 기간별 일별 매출 집계를 반환합니다.
func (s *AdminReportService) GetDailySalesReport(from, to string) ([]map[string]any, error) {
	if err := validateReportDate("시작일", from); err != nil {
		return nil, err
	}
	if err := validateReportDate("종료일", to); err != nil {
		return nil, err
	}

	var results []map[string]any
	query := s.db.Raw(`
		SELECT CAST(CreatedAt AS DATE) as date, COUNT(*) as count, SUM(TotalAmount) as amount
		FROM Orders
		WHERE Status IN ('PAID','DELIVERED','COMPLETED')
		AND CreatedAt >= ? AND CreatedAt <= ?
		GROUP BY CAST(CreatedAt AS DATE)
		ORDER BY date
	`, from, to+" 23:59:59")
	err := query.Scan(&results).Error
	return results, err
}

// GetBrandPerformance는 브랜드별 판매 성과를 반환합니다.
func (s *AdminReportService) GetBrandPerformance(from, to string) ([]map[string]any, error) {
	if err := validateReportDate("시작일", from); err != nil {
		return nil, err
	}
	if err := validateReportDate("종료일", to); err != nil {
		return nil, err
	}

	var results []map[string]any
	query := s.db.Raw(`
		SELECT p.BrandCode as brandCode, b.Name as brandName,
			COUNT(oi.Id) as soldCount, SUM(oi.Price * oi.Quantity) as revenue
		FROM OrderItems oi
		JOIN Products p ON oi.ProductId = p.Id
		JOIN Brands b ON p.BrandCode = b.Code
		JOIN Orders o ON oi.OrderId = o.Id
		WHERE o.Status IN ('PAID','DELIVERED','COMPLETED')
		AND o.CreatedAt >= ? AND o.CreatedAt <= ?
		GROUP BY p.BrandCode, b.Name
		ORDER BY revenue DESC
	`, from, to+" 23:59:59")
	err := query.Scan(&results).Error
	return results, err
}

// GetProfitReport는 기간별 수익 보고서 (매출 - 매입 지급액)를 반환합니다.
func (s *AdminReportService) GetProfitReport(from, to string) (map[string]any, error) {
	if err := validateReportDate("시작일", from); err != nil {
		return nil, err
	}
	if err := validateReportDate("종료일", to); err != nil {
		return nil, err
	}

	endDate := to + " 23:59:59"

	// 매출 합계
	var salesResult struct{ Total *float64 }
	s.db.Raw(`
		SELECT SUM(TotalAmount) as Total FROM Orders
		WHERE Status IN ('PAID','DELIVERED','COMPLETED')
		AND CreatedAt >= ? AND CreatedAt <= ?
	`, from, endDate).Scan(&salesResult)

	// 매입 지급 합계
	var payoutResult struct{ Total *float64 }
	s.db.Raw(`
		SELECT SUM(PayoutAmount) as Total FROM TradeIns
		WHERE Status = 'PAID'
		AND UpdatedAt >= ? AND UpdatedAt <= ?
	`, from, endDate).Scan(&payoutResult)

	salesRevenue := float64(0)
	if salesResult.Total != nil {
		salesRevenue = *salesResult.Total
	}
	tradeInPayouts := float64(0)
	if payoutResult.Total != nil {
		tradeInPayouts = *payoutResult.Total
	}

	return map[string]any{
		"from":           from,
		"to":             to,
		"salesRevenue":   salesRevenue,
		"tradeInPayouts": tradeInPayouts,
		"profit":         salesRevenue - tradeInPayouts,
	}, nil
}

// GetTopCustomers는 총 구매 금액 기준 상위 고객 목록을 반환합니다.
func (s *AdminReportService) GetTopCustomers(limit int) ([]map[string]any, error) {
	if limit <= 0 {
		limit = 10
	}
	var results []map[string]any
	err := s.db.Raw(`
		SELECT TOP(?) u.Id as userId, u.Name as name, u.Email as email,
			COUNT(o.Id) as orderCount, SUM(o.TotalAmount) as totalAmount
		FROM Users u
		JOIN Orders o ON u.Id = o.UserId
		WHERE o.Status IN ('PAID','DELIVERED','COMPLETED') AND u.DeletedAt IS NULL
		GROUP BY u.Id, u.Name, u.Email
		ORDER BY totalAmount DESC
	`, limit).Scan(&results).Error
	return results, err
}

func (s *AdminReportService) GetUserTransactionExport(userID int) (map[string]any, error) {
	// 안전 상한선: 단일 사용자의 내역이 지나치게 많을 경우 메모리 과부하 방지
	const exportLimit = 1000

	var orders []domain.Order
	if err := s.db.Where("UserId = ?", userID).Preload("OrderItems.Product").Order("CreatedAt DESC").Limit(exportLimit).Find(&orders).Error; err != nil {
		return nil, err
	}

	var tradeIns []domain.TradeIn
	if err := s.db.Where("UserId = ?", userID).Order("CreatedAt DESC").Limit(exportLimit).Find(&tradeIns).Error; err != nil {
		return nil, err
	}

	return map[string]any{
		"userId":   userID,
		"orders":   orders,
		"tradeIns": tradeIns,
	}, nil
}
