package services

import (
	"fmt"
	"time"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/pagination"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// SettlementService는 파트너 정산 생성, 조회, 상태 변경을 처리합니다.
type SettlementService struct {
	db     *gorm.DB
	config ConfigProvider
}

// NewSettlementService는 새로운 SettlementService 인스턴스를 생성합니다.
func NewSettlementService(db *gorm.DB, config ConfigProvider) *SettlementService {
	return &SettlementService{db: db, config: config}
}

// GetCommissionRate는 파트너의 유효 수수료율을 결정합니다.
// 수수료율 결정 우선순위:
// 1. 파트너(User) 테이블에 개별적으로 설정된 수수료율 (가장 높음)
// 2. 사이트 설정(SiteConfig)의 'PARTNER_COMMISSION_RATE' 값
// 3. 위 설정이 모두 없을 경우 기본값 5.00% 적용
func (s *SettlementService) GetCommissionRate(partnerID int) (decimal.Decimal, error) {
	// 1. 파트너 개별 수수료율 확인 (DB 조회)
	var user domain.User
	if err := s.db.Select("CommissionRate").First(&user, partnerID).Error; err != nil {
		return decimal.Zero, apperror.NotFound("파트너를 찾을 수 없습니다")
	}
	// 개별 설정값이 존재하고 0이 아니면 해당 값 반환
	if user.CommissionRate != nil && !user.CommissionRate.Decimal.IsZero() {
		return user.CommissionRate.Decimal, nil
	}

	// 2. 사이트 공통 설정 확인 (캐시 또는 DB)
	cfgVal := s.config.GetConfigValue("PARTNER_COMMISSION_RATE", "")
	if cfgVal != "" {
		if rate, err := decimal.NewFromString(cfgVal); err == nil {
			return rate, nil
		}
	}

	// 3. 최종 기본값 반환
	return decimal.NewFromFloat(5.00), nil
}

// getPayoutFrequency는 파트너의 정산 주기 설정을 확인합니다.
// 기본값은 'MONTHLY'이며, 파트너별로 'DAILY', 'WEEKLY', 'INSTANT' 등으로 설정 가능합니다.
func (s *SettlementService) getPayoutFrequency(partnerID int) string {
	var user domain.User
	if err := s.db.Select("PayoutFrequency").First(&user, partnerID).Error; err == nil && user.PayoutFrequency != nil && *user.PayoutFrequency != "" {
		return *user.PayoutFrequency
	}

	// 사이트 공통 정산 주기 설정 확인
	return s.config.GetConfigValue("PARTNER_PAYOUT_FREQ", "MONTHLY")
}

// CreateInstantSettlement는 즉시 정산(INSTANT) 조건의 파트너를 위해 단일 주문에 대한 정산 레코드를 생성합니다.
// 이 메서드는 주문이 성공적으로 배송(DELIVERED)되었을 때 호출되어 실시간 정산 기반을 마련합니다.
func (s *SettlementService) CreateInstantSettlement(partnerID int, orderID int) error {
	frequency := s.getPayoutFrequency(partnerID)
	if frequency != "INSTANT" {
		return nil // 즉시 정산 대상이 아니면 아무 작업도 하지 않음
	}

	commissionRate, err := s.GetCommissionRate(partnerID)
	if err != nil {
		return err
	}

	// 해당 주문 내에서 이 파트너가 공급한 바우처들의 판매액 합계 계산
	var salesData struct {
		TotalSales float64
		Quantity   int
	}
	err = s.db.Raw(`
		SELECT COALESCE(SUM(p.Price), 0) as TotalSales, COUNT(*) as Quantity
		FROM VoucherCodes v
		JOIN Products p ON v.ProductId = p.Id
		WHERE v.SuppliedByPartnerID = ? AND v.OrderId = ? AND v.Status IN ('SOLD', 'USED')
	`, partnerID, orderID).Scan(&salesData).Error
	if err != nil {
		return apperror.Internal("판매 데이터 조회 실패", err)
	}

	if salesData.Quantity == 0 {
		return nil // 정산할 항목이 없음 (해당 주문에 이 파트너의 상품이 포함되지 않은 경우)
	}

	// 정산 금액 계산: 총 판매액 - (총 판매액 * 수수료율)
	totalSales := decimal.NewFromFloat(salesData.TotalSales)
	commissionAmount := totalSales.Mul(commissionRate).Div(decimal.NewFromInt(100)).Round(0)
	payoutAmount := totalSales.Sub(commissionAmount)

	settlement := domain.PartnerSettlement{
		PartnerID:        partnerID,
		Period:           fmt.Sprintf("INSTANT-%d", orderID),
		Frequency:        "INSTANT",
		TotalSales:       domain.NewNumericDecimal(totalSales),
		TotalQuantity:    salesData.Quantity,
		CommissionRate:   domain.NewNumericDecimal(commissionRate),
		CommissionAmount: domain.NewNumericDecimal(commissionAmount),
		PayoutAmount:     domain.NewNumericDecimal(payoutAmount),
		Status:           "PENDING", // 초기 상태는 지급 대기
	}

	return s.db.Create(&settlement).Error
}

// CreateBatchSettlement는 주간/월간 배치 정산 레코드를 생성합니다.
// 해당 주기에 해당하는 모든 파트너의 판매 데이터를 집계합니다.
func (s *SettlementService) CreateBatchSettlement(frequency string) error {
	kst, err := time.LoadLocation("Asia/Seoul")
	if err != nil {
		kst = time.FixedZone("KST", 9*60*60)
	}
	now := time.Now().In(kst)

	var periodStart, periodEnd time.Time
	var period string

	switch frequency {
	case "WEEKLY":
		// 전주 월요일~일요일
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		thisMonday := time.Date(now.Year(), now.Month(), now.Day()-weekday+1, 0, 0, 0, 0, kst)
		periodStart = thisMonday.AddDate(0, 0, -7)
		periodEnd = thisMonday
		year, week := periodStart.ISOWeek()
		period = fmt.Sprintf("%d-W%02d", year, week)
	case "MONTHLY":
		// 전월 1일~말일
		firstOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, kst)
		periodEnd = firstOfMonth
		periodStart = firstOfMonth.AddDate(0, -1, 0)
		period = periodStart.Format("2006-01")
	default:
		return apperror.Validationf("잘못된 정산 주기입니다: %s", frequency)
	}

	// 동일 기간/주기의 배치 정산이 이미 존재하면 중복 실행을 방지합니다.
	var existingCount int64
	s.db.Model(&domain.PartnerSettlement{}).
		Where("Period = ? AND Frequency = ?", period, frequency).
		Count(&existingCount)
	if existingCount > 0 {
		logger.Log.Info("Settlement already exists for this period, skipping",
			zap.String("period", period), zap.String("frequency", frequency))
		return nil
	}

	// 해당 주기의 파트너(PayoutFrequency가 일치하는)를 찾아 정산 레코드 생성
	var partners []domain.User
	err = s.db.Where("Role = 'PARTNER' AND DeletedAt IS NULL").Find(&partners).Error
	if err != nil {
		return apperror.Internal("파트너 목록 조회 실패", err)
	}

	createdCount := 0
	for _, partner := range partners {
		partnerFreq := s.getPayoutFrequency(partner.ID)
		if partnerFreq != frequency {
			continue
		}

		// 이미 같은 기간 정산이 존재하는지 확인
		var existingCount int64
		s.db.Model(&domain.PartnerSettlement{}).
			Where("PartnerId = ? AND Period = ? AND Frequency = ?", partner.ID, period, frequency).
			Count(&existingCount)
		if existingCount > 0 {
			continue
		}

		// 기간 내 파트너 바우처 판매 데이터 집계
		var salesData struct {
			TotalSales float64
			Quantity   int
		}
		err = s.db.Raw(`
			SELECT COALESCE(SUM(p.Price), 0) as TotalSales, COUNT(*) as Quantity
			FROM VoucherCodes v
			JOIN Products p ON v.ProductId = p.Id
			WHERE v.SuppliedByPartnerID = ? AND v.Status IN ('SOLD', 'USED')
			AND v.SoldAt >= ? AND v.SoldAt < ?
		`, partner.ID, periodStart, periodEnd).Scan(&salesData).Error
		if err != nil {
			logger.Log.Error("정산 데이터 집계 실패",
				zap.Int("partnerId", partner.ID),
				zap.String("period", period),
				zap.Error(err),
			)
			continue
		}

		if salesData.Quantity == 0 {
			continue
		}

		// 최소 정산 금액 확인
		minPayoutAmount := s.config.GetConfigInt("PARTNER_MIN_PAYOUT_AMT", 10000)
		totalSales := decimal.NewFromFloat(salesData.TotalSales)
		if totalSales.LessThan(decimal.NewFromInt(int64(minPayoutAmount))) {
			logger.Log.Info("최소 정산 금액 미달",
				zap.Int("partnerId", partner.ID),
				zap.String("totalSales", totalSales.String()),
				zap.Int("minAmount", minPayoutAmount),
			)
			continue
		}

		commissionRate, err := s.GetCommissionRate(partner.ID)
		if err != nil {
			logger.Log.Error("수수료율 조회 실패", zap.Int("partnerId", partner.ID), zap.Error(err))
			continue
		}

		commissionAmount := totalSales.Mul(commissionRate).Div(decimal.NewFromInt(100)).Round(0)
		payoutAmount := totalSales.Sub(commissionAmount)

		settlement := domain.PartnerSettlement{
			PartnerID:        partner.ID,
			Period:           period,
			Frequency:        frequency,
			TotalSales:       domain.NewNumericDecimal(totalSales),
			TotalQuantity:    salesData.Quantity,
			CommissionRate:   domain.NewNumericDecimal(commissionRate),
			CommissionAmount: domain.NewNumericDecimal(commissionAmount),
			PayoutAmount:     domain.NewNumericDecimal(payoutAmount),
			Status:           "PENDING",
		}

		if err := s.db.Create(&settlement).Error; err != nil {
			logger.Log.Error("정산 레코드 생성 실패",
				zap.Int("partnerId", partner.ID),
				zap.String("period", period),
				zap.Error(err),
			)
			continue
		}
		createdCount++
	}

	logger.Log.Info("배치 정산 완료",
		zap.String("frequency", frequency),
		zap.String("period", period),
		zap.Int("created", createdCount),
	)
	return nil
}

// GetSettlements는 관리자용 정산 목록을 조회합니다 (파트너/상태 필터 지원).
func (s *SettlementService) GetSettlements(params pagination.QueryParams, partnerID int, status string) (pagination.PaginatedResponse[domain.PartnerSettlement], error) {
	if params.Limit <= 0 {
		params.Limit = 20
	}
	if params.Limit > 100 {
		params.Limit = 100
	}
	if params.Page <= 0 {
		params.Page = 1
	}
	offset := (params.Page - 1) * params.Limit

	db := s.db.Model(&domain.PartnerSettlement{})
	if partnerID > 0 {
		db = db.Where("PartnerId = ?", partnerID)
	}
	if status != "" {
		db = db.Where("Status = ?", status)
	}

	var total int64
	db.Count(&total)

	var items []domain.PartnerSettlement
	err := db.Order("Id DESC").Offset(offset).Limit(params.Limit).Find(&items).Error
	if err != nil {
		return pagination.PaginatedResponse[domain.PartnerSettlement]{}, err
	}
	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), nil
}

// GetSettlementByID는 정산 상세 정보를 조회합니다.
func (s *SettlementService) GetSettlementByID(id int) (*domain.PartnerSettlement, error) {
	var settlement domain.PartnerSettlement
	if err := s.db.First(&settlement, id).Error; err != nil {
		return nil, apperror.NotFound("정산 레코드를 찾을 수 없습니다")
	}
	return &settlement, nil
}

// GetPartnerSettlements는 특정 파트너의 정산 목록을 조회합니다.
func (s *SettlementService) GetPartnerSettlements(partnerID int, params pagination.QueryParams) (pagination.PaginatedResponse[domain.PartnerSettlement], error) {
	if params.Limit <= 0 {
		params.Limit = 20
	}
	if params.Limit > 100 {
		params.Limit = 100
	}
	if params.Page <= 0 {
		params.Page = 1
	}
	offset := (params.Page - 1) * params.Limit

	var total int64
	s.db.Model(&domain.PartnerSettlement{}).Where("PartnerId = ?", partnerID).Count(&total)

	var items []domain.PartnerSettlement
	err := s.db.Where("PartnerId = ?", partnerID).
		Order("Id DESC").
		Offset(offset).Limit(params.Limit).
		Find(&items).Error
	if err != nil {
		return pagination.PaginatedResponse[domain.PartnerSettlement]{}, err
	}
	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), nil
}

// UpdateSettlementStatus는 정산 상태를 변경합니다 (PENDING -> CONFIRMED -> PAID/FAILED).
func (s *SettlementService) UpdateSettlementStatus(id int, status string, transferRef string, failureReason string, adminNote string) error {
	var settlement domain.PartnerSettlement
	if err := s.db.First(&settlement, id).Error; err != nil {
		return apperror.NotFound("정산 레코드를 찾을 수 없습니다")
	}

	// 상태 전이 유효성 검증
	validTransitions := map[string][]string{
		"PENDING":   {"CONFIRMED"},
		"CONFIRMED": {"PAID", "FAILED"},
		"FAILED":    {"CONFIRMED"}, // 재시도 허용
	}
	allowed, ok := validTransitions[settlement.Status]
	if !ok {
		return apperror.Validationf("현재 상태(%s)에서는 변경할 수 없습니다", settlement.Status)
	}
	isValid := false
	for _, a := range allowed {
		if a == status {
			isValid = true
			break
		}
	}
	if !isValid {
		return apperror.Validationf("'%s' → '%s' 상태 전이가 허용되지 않습니다", settlement.Status, status)
	}

	updates := map[string]any{
		"Status": status,
	}

	if transferRef != "" {
		updates["TransferRef"] = transferRef
	}
	if failureReason != "" {
		updates["FailureReason"] = failureReason
	}
	if adminNote != "" {
		updates["AdminNote"] = adminNote
	}

	if status == "PAID" {
		now := time.Now()
		updates["PaidAt"] = &now
	}

	return s.db.Model(&domain.PartnerSettlement{}).Where("Id = ?", id).Updates(updates).Error
}

// GetSettlementSummary는 파트너의 정산 요약 통계를 반환합니다.
func (s *SettlementService) GetSettlementSummary(partnerID int, from, to string) (map[string]any, error) {
	baseWhere := "PartnerId = ?"
	args := []any{partnerID}

	if from != "" {
		baseWhere += " AND CreatedAt >= ?"
		args = append(args, from)
	}
	if to != "" {
		baseWhere += " AND CreatedAt <= ?"
		args = append(args, to)
	}

	// 전체 정산 통계
	var totalStats struct {
		TotalSales    float64
		TotalPayout   float64
		TotalComm     float64
		Count         int64
		TotalQuantity int64
	}
	s.db.Model(&domain.PartnerSettlement{}).
		Select("COALESCE(SUM(TotalSales), 0) as TotalSales, COALESCE(SUM(PayoutAmount), 0) as TotalPayout, COALESCE(SUM(CommissionAmount), 0) as TotalComm, COUNT(*) as Count, COALESCE(SUM(TotalQuantity), 0) as TotalQuantity").
		Where(baseWhere, args...).
		Scan(&totalStats)

	// 상태별 건수
	var statusCounts []struct {
		Status string
		Count  int64
		Amount float64
	}
	s.db.Model(&domain.PartnerSettlement{}).
		Select("Status, COUNT(*) as Count, COALESCE(SUM(PayoutAmount), 0) as Amount").
		Where(baseWhere, args...).
		Group("Status").
		Find(&statusCounts)

	statusMap := make(map[string]any)
	for _, sc := range statusCounts {
		statusMap[sc.Status] = map[string]any{
			"count":  sc.Count,
			"amount": sc.Amount,
		}
	}

	// 현재 수수료율
	commissionRate, _ := s.GetCommissionRate(partnerID)

	return map[string]any{
		"totalSales":        totalStats.TotalSales,
		"totalPayout":       totalStats.TotalPayout,
		"totalCommission":   totalStats.TotalComm,
		"totalQuantity":     totalStats.TotalQuantity,
		"settlementCount":   totalStats.Count,
		"byStatus":          statusMap,
		"currentCommission": commissionRate.InexactFloat64(),
	}, nil
}

// CheckPartnerPostManagement는 파트너 사후 관리를 수행합니다.
// 클레임 임계값 초과, PIN 불량률 초과 등을 감지합니다.
func (s *SettlementService) CheckPartnerPostManagement() {
	claimThreshold := s.config.GetConfigInt("PARTNER_CLAIM_THRESHOLD", 3)
	defectRateThreshold := s.config.GetConfigInt("PARTNER_PIN_DEFECT_RATE", 5)

	// 이번 달 기준
	kst, _ := time.LoadLocation("Asia/Seoul")
	if kst == nil {
		kst = time.FixedZone("KST", 9*60*60)
	}
	now := time.Now().In(kst)
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, kst)

	// 파트너별 분쟁(클레임) 건수 확인
	type partnerClaim struct {
		PartnerID int
		Claims    int64
	}
	var claims []partnerClaim
	s.db.Raw(`
		SELECT v.SuppliedByPartnerID as PartnerID, COUNT(*) as Claims
		FROM VoucherCodes v
		WHERE v.SuppliedByPartnerID IS NOT NULL
		AND v.DisputedAt IS NOT NULL AND v.DisputedAt >= ?
		GROUP BY v.SuppliedByPartnerID
		HAVING COUNT(*) >= ?
	`, monthStart, claimThreshold).Scan(&claims)

	for _, c := range claims {
		logger.Log.Warn("파트너 클레임 임계값 초과",
			zap.Int("partnerId", c.PartnerID),
			zap.Int64("claims", c.Claims),
			zap.Int("threshold", claimThreshold),
		)
	}

	// 파트너별 PIN 불량률 확인 (분쟁 / 전체 판매)
	type partnerDefect struct {
		PartnerID  int
		TotalSold  int64
		Disputed   int64
		DefectRate float64
	}
	var defects []partnerDefect
	s.db.Raw(`
		SELECT v.SuppliedByPartnerID as PartnerID,
			COUNT(CASE WHEN v.Status IN ('SOLD', 'USED') THEN 1 END) as TotalSold,
			COUNT(CASE WHEN v.DisputedAt IS NOT NULL THEN 1 END) as Disputed,
			CASE
				WHEN COUNT(CASE WHEN v.Status IN ('SOLD', 'USED') THEN 1 END) > 0
				THEN CAST(COUNT(CASE WHEN v.DisputedAt IS NOT NULL THEN 1 END) AS FLOAT) * 100.0 /
					 COUNT(CASE WHEN v.Status IN ('SOLD', 'USED') THEN 1 END)
				ELSE 0
			END as DefectRate
		FROM VoucherCodes v
		WHERE v.SuppliedByPartnerID IS NOT NULL AND v.SoldAt >= ?
		GROUP BY v.SuppliedByPartnerID
		HAVING COUNT(CASE WHEN v.Status IN ('SOLD', 'USED') THEN 1 END) > 0
			AND CAST(COUNT(CASE WHEN v.DisputedAt IS NOT NULL THEN 1 END) AS FLOAT) * 100.0 /
				COUNT(CASE WHEN v.Status IN ('SOLD', 'USED') THEN 1 END) >= ?
	`, monthStart, defectRateThreshold).Scan(&defects)

	for _, d := range defects {
		logger.Log.Warn("파트너 PIN 불량률 초과",
			zap.Int("partnerId", d.PartnerID),
			zap.Int64("totalSold", d.TotalSold),
			zap.Int64("disputed", d.Disputed),
			zap.Float64("defectRate", d.DefectRate),
			zap.Int("threshold", defectRateThreshold),
		)
	}
}
