package services

import (
	"fmt"
	"time"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/crypto"
	"seedream-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// PartnerService는 파트너의 대시보드, 상품, 주문, 바우처, 정산 기능을 처리합니다.
type PartnerService struct {
	db            *gorm.DB
	encryptionKey string
	config        ConfigProvider
}

// NewPartnerService는 새로운 PartnerService 인스턴스를 생성합니다.
func NewPartnerService(db *gorm.DB, encryptionKey string, config ConfigProvider) *PartnerService {
	return &PartnerService{
		db:            db,
		encryptionKey: encryptionKey,
		config:        config,
	}
}

// ── Dashboard ──

// GetDashboard는 파트너의 대시보드 통계를 조회합니다.
func (s *PartnerService) GetDashboard(partnerID int) (map[string]any, error) {
	// 파트너 재고 등록 가능 상품 수
	var availableProductCount int64
	s.db.Model(&domain.Product{}).Where("AllowPartnerStock = ? AND IsActive = ? AND DeletedAt IS NULL", true, true).Count(&availableProductCount)

	// 파트너가 공급한 바우처가 포함된 주문 수
	var totalOrders int64
	s.db.Raw(`
		SELECT COUNT(DISTINCT v.OrderId)
		FROM VoucherCodes v
		WHERE v.SuppliedByPartnerID = ? AND v.OrderId IS NOT NULL
	`, partnerID).Scan(&totalOrders)

	// 파트너 바우처 총 판매 금액 (판매된 바우처 기준)
	var totalSalesAmount float64
	s.db.Raw(`
		SELECT COALESCE(SUM(p.Price), 0)
		FROM VoucherCodes v
		JOIN Products p ON v.ProductId = p.Id
		WHERE v.SuppliedByPartnerID = ? AND v.Status IN ('SOLD', 'USED')
	`, partnerID).Scan(&totalSalesAmount)

	// 이번 달 판매 금액
	kst, err := time.LoadLocation("Asia/Seoul")
	if err != nil {
		kst = time.FixedZone("KST", 9*60*60)
	}
	now := time.Now().In(kst)
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, kst)

	var monthSalesAmount float64
	s.db.Raw(`
		SELECT COALESCE(SUM(p.Price), 0)
		FROM VoucherCodes v
		JOIN Products p ON v.ProductId = p.Id
		WHERE v.SuppliedByPartnerID = ? AND v.Status IN ('SOLD', 'USED')
		AND v.SoldAt >= ?
	`, partnerID, monthStart).Scan(&monthSalesAmount)

	// 사용 가능한 바우처 수
	var availableVouchers int64
	s.db.Model(&domain.VoucherCode{}).
		Where("SuppliedByPartnerID = ? AND Status = 'AVAILABLE'", partnerID).
		Count(&availableVouchers)

	// 정산 대기 금액 (PENDING 상태 정산)
	var pendingPayouts float64
	s.db.Model(&domain.PartnerSettlement{}).
		Select("COALESCE(SUM(PayoutAmount), 0)").
		Where("PartnerId = ? AND Status = 'PENDING'", partnerID).
		Scan(&pendingPayouts)

	return map[string]any{
		"availableProductCount": availableProductCount,
		"totalOrders":           totalOrders,
		"totalSalesAmount":      totalSalesAmount,
		"monthSalesAmount":      monthSalesAmount,
		"availableVouchers":     availableVouchers,
		"pendingPayouts":        pendingPayouts,
	}, nil
}

// ── Products ──

// GetAvailableProducts는 파트너 PIN 등록이 허용된 상품 목록을 조회합니다.
// 파트너는 상품을 직접 생성할 수 없으며, AllowPartnerStock=true인 어드민 상품에만 PIN을 등록할 수 있습니다.
func (s *PartnerService) GetAvailableProducts(partnerID int, params pagination.QueryParams) (pagination.PaginatedResponse[domain.Product], error) {
	var items []domain.Product
	var total int64

	s.db.Model(&domain.Product{}).
		Where("AllowPartnerStock = ? AND IsActive = ? AND DeletedAt IS NULL", true, true).
		Count(&total)

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

	err := s.db.Preload("Brand").
		Where("AllowPartnerStock = ? AND IsActive = ? AND DeletedAt IS NULL", true, true).
		Order("Id desc").
		Offset(offset).Limit(params.Limit).
		Find(&items).Error
	if err != nil {
		return pagination.PaginatedResponse[domain.Product]{}, err
	}
	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), nil
}

// GetMyVoucherStats는 파트너가 업로드한 바우처의 상품별 통계를 조회합니다.
func (s *PartnerService) GetMyVoucherStats(partnerID int) ([]map[string]any, error) {
	var results []map[string]any
	err := s.db.Raw(`
		SELECT p.Id as productId, p.Name as productName, p.BrandCode as brandCode,
			COUNT(*) as total,
			SUM(CASE WHEN v.Status = 'AVAILABLE' THEN 1 ELSE 0 END) as available,
			SUM(CASE WHEN v.Status = 'SOLD' THEN 1 ELSE 0 END) as sold,
			SUM(CASE WHEN v.Status = 'USED' THEN 1 ELSE 0 END) as used,
			SUM(CASE WHEN v.Status = 'EXPIRED' THEN 1 ELSE 0 END) as expired
		FROM VoucherCodes v
		JOIN Products p ON v.ProductId = p.Id
		WHERE v.SuppliedByPartnerID = ?
		GROUP BY p.Id, p.Name, p.BrandCode
		ORDER BY p.BrandCode, p.Name
	`, partnerID).Scan(&results).Error
	return results, err
}

// ── Orders ──

// GetMyOrders는 파트너 상품이 포함된 주문 목록을 조회합니다.
func (s *PartnerService) GetMyOrders(partnerID int, params pagination.QueryParams, status string) (pagination.PaginatedResponse[domain.Order], error) {
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

	// 파트너 상품이 포함된 주문 ID 서브쿼리
	subQuery := `
		SELECT DISTINCT o.Id
		FROM Orders o
		JOIN OrderItems oi ON o.Id = oi.OrderId
		JOIN Products p ON oi.ProductId = p.Id
		WHERE p.PartnerID = ?
	`
	args := []any{partnerID}

	if status != "" {
		subQuery += " AND o.Status = ?"
		args = append(args, status)
	}

	var total int64
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM (%s) AS sub", subQuery)
	s.db.Raw(countSQL, args...).Scan(&total)

	var orders []domain.Order
	dataSQL := fmt.Sprintf(`
		SELECT o.* FROM Orders o
		WHERE o.Id IN (%s)
		ORDER BY o.CreatedAt DESC
		OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
	`, subQuery)
	dataArgs := append(args, offset, params.Limit)
	err := s.db.Raw(dataSQL, dataArgs...).Scan(&orders).Error
	if err != nil {
		return pagination.PaginatedResponse[domain.Order]{}, err
	}

	// 단일 쿼리로 모든 주문의 OrderItems를 일괄 로딩 (N+1 방지)
	if len(orders) > 0 {
		orderIDs := make([]int, len(orders))
		for i, o := range orders {
			orderIDs[i] = o.ID
		}
		var allItems []domain.OrderItem
		s.db.Preload("Product").Where("OrderId IN ?", orderIDs).Find(&allItems)
		// 주문별로 매핑
		itemMap := make(map[int][]domain.OrderItem)
		for _, item := range allItems {
			itemMap[item.OrderID] = append(itemMap[item.OrderID], item)
		}
		for i := range orders {
			orders[i].OrderItems = itemMap[orders[i].ID]
		}
	}

	return pagination.CreatePaginatedResponse(orders, total, params.Page, params.Limit), nil
}

// GetMyOrderDetail는 파트너 상품이 포함된 특정 주문 상세를 조회합니다.
func (s *PartnerService) GetMyOrderDetail(partnerID int, orderID int) (*domain.Order, error) {
	// 해당 주문에 파트너 상품이 포함되어 있는지 확인
	var count int64
	s.db.Raw(`
		SELECT COUNT(*)
		FROM OrderItems oi
		JOIN Products p ON oi.ProductId = p.Id
		WHERE oi.OrderId = ? AND p.PartnerID = ?
	`, orderID, partnerID).Scan(&count)

	if count == 0 {
		return nil, apperror.Forbidden("해당 주문에 대한 권한이 없습니다")
	}

	var order domain.Order
	err := s.db.Preload("OrderItems.Product").
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("Id", "Email", "Name", "Phone")
		}).
		First(&order, orderID).Error
	if err != nil {
		return nil, apperror.NotFound("주문을 찾을 수 없습니다")
	}
	return &order, nil
}

// ── Vouchers ──

// GetMyVouchers는 파트너 상품에 연결된 바우처 목록을 조회합니다.
func (s *PartnerService) GetMyVouchers(partnerID int, params pagination.QueryParams, status string) (pagination.PaginatedResponse[domain.VoucherCode], error) {
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

	baseWhere := "v.SuppliedByPartnerID = ?"
	args := []any{partnerID}
	if status != "" {
		baseWhere += " AND v.Status = ?"
		args = append(args, status)
	}

	var total int64
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM VoucherCodes v WHERE %s", baseWhere)
	s.db.Raw(countSQL, args...).Scan(&total)

	var vouchers []domain.VoucherCode
	dataSQL := fmt.Sprintf(`
		SELECT v.* FROM VoucherCodes v
		WHERE %s
		ORDER BY v.CreatedAt DESC
		OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
	`, baseWhere)
	dataArgs := append(args, offset, params.Limit)
	err := s.db.Raw(dataSQL, dataArgs...).Scan(&vouchers).Error
	if err != nil {
		return pagination.PaginatedResponse[domain.VoucherCode]{}, err
	}

	return pagination.CreatePaginatedResponse(vouchers, total, params.Page, params.Limit), nil
}

// BulkUploadVouchers는 파트너가 상품 PIN 번호(바우처)를 일괄 업로드할 때 사용됩니다.
// 검증 사항:
// 1. 해당 상품이 존재하는지, 그리고 활성화된 상태인지 확인합니다.
// 2. 해당 상품이 파트너의 재고 등록(AllowPartnerStock)을 허용하는지 확인합니다.
// 3. 파트너의 일일 PIN 업로드 한도를 초과하지 않는지 확인합니다.
// 4. 업로드하려는 PIN 번호가 이미 시스템에 등록되어 있는지(중복 체크) 확인합니다.
func (s *PartnerService) BulkUploadVouchers(partnerID int, productID int, pinCodes []string) error {
	// 1. 상품 및 파트너 재고 허용 여부 확인
	var product domain.Product
	if err := s.db.Select("Id, AllowPartnerStock, IsActive").First(&product, productID).Error; err != nil {
		return apperror.NotFound("상품을 찾을 수 없습니다")
	}

	if !product.IsActive {
		return apperror.Validation("비활성화된 상품에는 PIN을 등록할 수 없습니다")
	}

	if !product.AllowPartnerStock {
		return apperror.Validation("이 상품은 파트너가 직접 재고를 관리할 수 없는 품목입니다")
	}

	if len(pinCodes) == 0 {
		return apperror.Validation("등록할 PIN 번호가 입력되지 않았습니다")
	}

	// 2. 일일 업로드 한도 검증 (남용 방지 및 보안)
	dailyLimit := s.getDailyPinLimit(partnerID)
	kst, _ := time.LoadLocation("Asia/Seoul")
	if kst == nil {
		kst = time.FixedZone("KST", 9*60*60)
	}
	todayStart := time.Date(time.Now().In(kst).Year(), time.Now().In(kst).Month(), time.Now().In(kst).Day(), 0, 0, 0, 0, kst)

	var todayUploads int64
	s.db.Model(&domain.VoucherCode{}).
		Where("SuppliedByPartnerID = ? AND CreatedAt >= ?", partnerID, todayStart).
		Count(&todayUploads)

	if int(todayUploads)+len(pinCodes) > dailyLimit {
		return apperror.Validationf("일일 PIN 업로드 한도를 초과했습니다 (한도: %d, 오늘 등록: %d, 추가 요청: %d)", dailyLimit, todayUploads, len(pinCodes))
	}

	vouchers := make([]domain.VoucherCode, 0, len(pinCodes))
	hashes := make(map[string]bool, len(pinCodes))

	// 3. PIN 번호 암호화 및 해싱 처리
	for i, pin := range pinCodes {
		if pin == "" {
			continue
		}

		// PIN 중복 체크를 위해 원본값 대신 해시값을 사용
		hash := crypto.SHA256Hash(pin)
		if hashes[hash] {
			return apperror.Validationf("%d번째 PIN이 목록 내에서 중복되었습니다", i+1)
		}
		hashes[hash] = true

		// DB 저장 시에는 보안을 위해 대칭키 암호화 수행
		encrypted, err := crypto.Encrypt(pin, s.encryptionKey)
		if err != nil {
			return apperror.Internal(fmt.Sprintf("%d번째 PIN 암호화 중 오류가 발생했습니다", i+1), err)
		}

		vouchers = append(vouchers, domain.VoucherCode{
			ProductID:           productID,
			PinCode:             encrypted,
			PinHash:             hash,
			Status:              "AVAILABLE", // 등록 즉시 판매 가능한 상태로 설정
			Source:              "PARTNER",
			SuppliedByPartnerID: &partnerID,
		})
	}

	if len(vouchers) == 0 {
		return apperror.Validation("유효한 PIN 번호가 없습니다")
	}

	// 4. DB 수준에서의 중복 검사 (전체 바우처 대상)
	hashList := make([]string, 0, len(hashes))
	for h := range hashes {
		hashList = append(hashList, h)
	}
	var existingCount int64
	s.db.Model(&domain.VoucherCode{}).Where("PinHash IN ?", hashList).Count(&existingCount)
	if existingCount > 0 {
		return apperror.Conflict(fmt.Sprintf("이미 시스템에 등록된 PIN 번호가 %d개 포함되어 있습니다", existingCount))
	}

	return s.db.Create(&vouchers).Error
}

// GetVoucherInventory는 파트너가 공급한 바우처의 상품별 재고 요약을 조회합니다.
func (s *PartnerService) GetVoucherInventory(partnerID int) ([]map[string]any, error) {
	var results []map[string]any
	err := s.db.Raw(`
		SELECT p.Id as productId, p.Name as productName, p.BrandCode as brandCode,
			COUNT(*) as total,
			SUM(CASE WHEN v.Status = 'AVAILABLE' THEN 1 ELSE 0 END) as available,
			SUM(CASE WHEN v.Status = 'SOLD' THEN 1 ELSE 0 END) as sold,
			SUM(CASE WHEN v.Status = 'RESERVED' THEN 1 ELSE 0 END) as reserved,
			SUM(CASE WHEN v.Status = 'EXPIRED' THEN 1 ELSE 0 END) as expired
		FROM VoucherCodes v
		JOIN Products p ON v.ProductId = p.Id
		WHERE v.SuppliedByPartnerID = ?
		GROUP BY p.Id, p.Name, p.BrandCode
		ORDER BY p.BrandCode, p.Name
	`, partnerID).Scan(&results).Error
	return results, err
}

// getDailyPinLimit는 파트너의 일일 PIN 업로드 한도를 반환합니다.
// 우선순위: 파트너 개별 설정 > SiteConfig(캐시) > 기본값(500)
func (s *PartnerService) getDailyPinLimit(partnerID int) int {
	// 1. 파트너 개별 설정 확인
	var user domain.User
	if err := s.db.Select("DailyPinLimit").First(&user, partnerID).Error; err == nil && user.DailyPinLimit != nil {
		return *user.DailyPinLimit
	}

	// 2. SiteConfig 확인 (캐시 활용)
	return s.config.GetConfigInt("PARTNER_DAILY_PIN_LIMIT", 500)
}

// ── Payouts ──

// GetPayouts는 파트너의 정산 내역 (완료된 주문의 파트너 상품 항목)을 조회합니다.
func (s *PartnerService) GetPayouts(partnerID int, params pagination.QueryParams) (pagination.PaginatedResponse[map[string]any], error) {
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

	baseWhere := `
		FROM OrderItems oi
		JOIN Orders o ON oi.OrderId = o.Id
		JOIN Products p ON oi.ProductId = p.Id
		WHERE p.PartnerID = ? AND o.Status IN ('DELIVERED', 'COMPLETED')
	`

	var total int64
	s.db.Raw("SELECT COUNT(*) "+baseWhere, partnerID).Scan(&total)

	var results []map[string]any
	err := s.db.Raw(fmt.Sprintf(`
		SELECT oi.Id as orderItemId, oi.OrderId as orderId, oi.ProductId as productId,
			p.Name as productName, p.BrandCode as brandCode,
			oi.Quantity as quantity, oi.Price as price,
			(oi.Price * oi.Quantity) as amount,
			o.Status as orderStatus, o.CreatedAt as orderDate
		%s
		ORDER BY o.CreatedAt DESC
		OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
	`, baseWhere), partnerID, offset, params.Limit).Scan(&results).Error
	if err != nil {
		return pagination.PaginatedResponse[map[string]any]{}, err
	}

	return pagination.CreatePaginatedResponse(results, total, params.Page, params.Limit), nil
}

// GetPayoutSummary는 기간별 정산 요약을 조회합니다.
func (s *PartnerService) GetPayoutSummary(partnerID int, from, to string) (map[string]any, error) {
	baseWhere := `
		FROM OrderItems oi
		JOIN Orders o ON oi.OrderId = o.Id
		JOIN Products p ON oi.ProductId = p.Id
		WHERE p.PartnerID = ? AND o.Status IN ('DELIVERED', 'COMPLETED')
	`
	args := []any{partnerID}

	if from != "" {
		baseWhere += " AND o.CreatedAt >= ?"
		args = append(args, from)
	}
	if to != "" {
		baseWhere += " AND o.CreatedAt <= ?"
		args = append(args, to)
	}

	var summary struct {
		TotalAmount   float64
		OrderCount    int64
		TotalQuantity int64
	}
	sql := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(oi.Price * oi.Quantity), 0) as TotalAmount,
			COUNT(DISTINCT o.Id) as OrderCount,
			COALESCE(SUM(oi.Quantity), 0) as TotalQuantity
		%s
	`, baseWhere)
	s.db.Raw(sql, args...).Scan(&summary)

	averageOrderValue := float64(0)
	if summary.OrderCount > 0 {
		averageOrderValue = summary.TotalAmount / float64(summary.OrderCount)
	}

	return map[string]any{
		"totalAmount":       summary.TotalAmount,
		"orderCount":        summary.OrderCount,
		"totalQuantity":     summary.TotalQuantity,
		"averageOrderValue": averageOrderValue,
	}, nil
}

// ── Profile ──

// GetProfile는 파트너 프로필 정보를 조회합니다.
func (s *PartnerService) GetProfile(partnerID int) (*domain.User, error) {
	var user domain.User
	err := s.db.Select(
		"Id", "Email", "Name", "Phone", "Role", "PartnerTier", "PartnerSince",
		"BankName", "BankCode", "AccountHolder", "BankVerifiedAt",
		"CreatedAt", "UpdatedAt",
	).First(&user, partnerID).Error
	if err != nil {
		return nil, apperror.NotFound("프로필을 찾을 수 없습니다")
	}
	return &user, nil
}

// UpdateProfile는 파트너 프로필의 제한된 필드를 수정합니다.
func (s *PartnerService) UpdateProfile(partnerID int, updates map[string]any) error {
	// 수정 가능한 필드만 허용 (camelCase → PascalCase 변환)
	keyMap := map[string]string{
		"name": "Name", "Name": "Name",
		"phone": "Phone", "Phone": "Phone",
		"bankName": "BankName", "BankName": "BankName",
		"bankCode": "BankCode", "BankCode": "BankCode",
		"accountHolder": "AccountHolder", "AccountHolder": "AccountHolder",
	}
	filtered := make(map[string]any)
	for k, v := range updates {
		if col, ok := keyMap[k]; ok {
			filtered[col] = v
		}
	}
	if len(filtered) == 0 {
		return apperror.Validation("수정할 항목이 없습니다")
	}
	result := s.db.Model(&domain.User{}).Where("Id = ?", partnerID).Updates(filtered)
	if result.RowsAffected == 0 {
		return apperror.NotFound("프로필을 찾을 수 없습니다")
	}
	return result.Error
}
