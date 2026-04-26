package services

import (
	"time"
	"seedream-gift-server/internal/domain"

	"gorm.io/gorm"
)

// AdminStatsService는 관리자 대시보드 통계를 처리합니다.
// CQRS 읽기 모델: readCache(DashboardReadService)가 주입되면 캐시 우선 조회합니다.
type AdminStatsService struct {
	db        *gorm.DB
	readCache *DashboardReadService // CQRS 읽기 캐시 (선택적 — nil이면 항상 DB 직접 조회)
}

// NewAdminStatsService는 새로운 AdminStatsService 인스턴스를 생성합니다.
func NewAdminStatsService(db *gorm.DB) *AdminStatsService {
	return &AdminStatsService{db: db}
}

// SetReadCache는 CQRS 읽기 모델 캐시를 주입합니다 (setter injection).
// container.go에서 DashboardReadService 생성 후 호출합니다.
func (s *AdminStatsService) SetReadCache(cache *DashboardReadService) {
	s.readCache = cache
}

const cacheKeyDashboardStats = "dashboard_stats"

// GetStats는 관리자 대시보드용 주요 통계 지표를 조회합니다.
// DashboardReadService가 주입되어 있으면 캐시 우선 조회합니다 (CQRS 읽기 모델).
func (s *AdminStatsService) GetStats() (map[string]any, error) {
	// CQRS 읽기 캐시 확인
	if s.readCache != nil {
		if cached, ok := s.readCache.Get(cacheKeyDashboardStats); ok {
			return cached.(map[string]any), nil
		}
	}

	var userCount, productCount, orderCount, tradeInCount, pendingKycCount, pendingTradeInCount, voucherCount, pendingOrderCount int64
	var vaIssuedCount, vaExpiringSoonCount, refundInProgressCount int64
	s.db.Model(&domain.User{}).Where("DeletedAt IS NULL").Count(&userCount)
	s.db.Model(&domain.Product{}).Count(&productCount)
	s.db.Model(&domain.Order{}).Count(&orderCount)
	s.db.Model(&domain.Order{}).Where("Status = 'PENDING'").Count(&pendingOrderCount)
	s.db.Model(&domain.TradeIn{}).Count(&tradeInCount)
	s.db.Model(&domain.User{}).Where("KycStatus = 'PENDING' AND DeletedAt IS NULL").Count(&pendingKycCount)
	s.db.Model(&domain.TradeIn{}).Where("Status = 'REQUESTED'").Count(&pendingTradeInCount)
	s.db.Model(&domain.VoucherCode{}).Where("Status = 'AVAILABLE'").Count(&voucherCount)

	// VA 결제 모니터링 — 입금 대기 / 만료 임박(30분 이내) / 환불 진행 중
	now := time.Now()
	expiringSoonAt := now.Add(30 * time.Minute)
	s.db.Model(&domain.Order{}).Where("Status = 'ISSUED'").Count(&vaIssuedCount)
	s.db.Model(&domain.Order{}).
		Where("Status = 'ISSUED' AND PaymentDeadlineAt IS NOT NULL AND PaymentDeadlineAt > ? AND PaymentDeadlineAt < ?", now, expiringSoonAt).
		Count(&vaExpiringSoonCount)
	s.db.Model(&domain.Order{}).Where("Status = 'REFUNDED'").Count(&refundInProgressCount)

	stats := map[string]any{
		"userCount":             userCount,
		"productCount":          productCount,
		"orderCount":            orderCount,
		"pendingOrderCount":     pendingOrderCount,
		"tradeInCount":          tradeInCount,
		"pendingKycCount":       pendingKycCount,
		"pendingTradeInCount":   pendingTradeInCount,
		"availableVouchers":     voucherCount,
		"vaIssuedCount":         vaIssuedCount,         // 입금 대기 (ISSUED)
		"vaExpiringSoonCount":   vaExpiringSoonCount,   // 30분 내 만료 임박
		"refundInProgressCount": refundInProgressCount, // 환불 진행 중 (REFUNDED, REFUND_PAID 전)
	}

	// CQRS 읽기 캐시에 저장
	if s.readCache != nil {
		s.readCache.Set(cacheKeyDashboardStats, stats)
	}

	return stats, nil
}

// GetStatsWithPeriod는 기간별 필터링된 대시보드 통계를 반환합니다.
func (s *AdminStatsService) GetStatsWithPeriod(period string) (map[string]any, error) {
	baseStats, err := s.GetStats()
	if err != nil {
		return nil, err
	}

	kst, err := time.LoadLocation("Asia/Seoul")
	if err != nil {
		kst = time.FixedZone("KST", 9*60*60)
	}
	now := time.Now().In(kst)

	var from time.Time
	switch period {
	case "today":
		from = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, kst)
	case "week":
		from = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, kst).AddDate(0, 0, -7)
	case "month":
		from = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, kst).AddDate(0, -1, 0)
	default:
		from = time.Time{}
	}

	paidStatuses := []string{"PAID", "DELIVERED", "COMPLETED"}

	var salesAmount struct{ Total *float64 }
	salesQuery := s.db.Model(&domain.Order{}).Select("SUM(TotalAmount) as Total").Where("Status IN ?", paidStatuses)
	if !from.IsZero() {
		salesQuery = salesQuery.Where("CreatedAt >= ?", from)
	}
	salesQuery.Scan(&salesAmount)

	var tradeInPayout struct{ Total *float64 }
	tradeInQuery := s.db.Model(&domain.TradeIn{}).Select("SUM(PayoutAmount) as Total").Where("Status = 'PAID'")
	if !from.IsZero() {
		tradeInQuery = tradeInQuery.Where("UpdatedAt >= ?", from)
	}
	tradeInQuery.Scan(&tradeInPayout)

	periodSales := float64(0)
	if salesAmount.Total != nil {
		periodSales = *salesAmount.Total
	}
	periodPayout := float64(0)
	if tradeInPayout.Total != nil {
		periodPayout = *tradeInPayout.Total
	}

	var lowStockProducts []map[string]any
	s.db.Raw(`
		SELECT p.Id as productId, p.Name as productName, p.BrandCode as brandCode,
			p.MinStockAlert as threshold,
			COUNT(CASE WHEN v.Status = 'AVAILABLE' THEN 1 END) as available
		FROM Products p
		LEFT JOIN VoucherCodes v ON v.ProductId = p.Id
		WHERE p.MinStockAlert > 0 AND p.DeletedAt IS NULL
		GROUP BY p.Id, p.Name, p.BrandCode, p.MinStockAlert
		HAVING COUNT(CASE WHEN v.Status = 'AVAILABLE' THEN 1 END) < p.MinStockAlert
		ORDER BY available ASC
	`).Scan(&lowStockProducts)

	nowUTC := time.Now()
	h24 := nowUTC.Add(-24 * time.Hour)
	h48 := nowUTC.Add(-48 * time.Hour)
	h72 := nowUTC.Add(-72 * time.Hour)

	var aging24, aging48, aging72 int64
	s.db.Model(&domain.TradeIn{}).Where("Status = 'REQUESTED' AND CreatedAt < ? AND CreatedAt >= ?", h24, h48).Count(&aging24)
	s.db.Model(&domain.TradeIn{}).Where("Status = 'REQUESTED' AND CreatedAt < ? AND CreatedAt >= ?", h48, h72).Count(&aging48)
	s.db.Model(&domain.TradeIn{}).Where("Status = 'REQUESTED' AND CreatedAt < ?", h72).Count(&aging72)

	result := baseStats
	result["salesAmount"] = periodSales
	result["tradeInPayouts"] = periodPayout
	result["profit"] = periodSales - periodPayout
	result["period"] = period
	result["lowStockProducts"] = lowStockProducts
	result["agingTradeIns"] = map[string]any{
		"over24h": aging24,
		"over48h": aging48,
		"over72h": aging72,
	}

	return result, nil
}
