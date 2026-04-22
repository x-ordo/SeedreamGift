package services

import (
	"fmt"
	"time"
	"w-gift-server/internal/domain"
	"w-gift-server/internal/infra/repository"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/crypto"
	"w-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// AdminVoucherService는 관리자의 바우처 관리 기능을 처리합니다.
type AdminVoucherService struct {
	db            *gorm.DB
	encryptionKey string
	voucherRepo   *repository.BaseRepository[domain.VoucherCode]
}

func NewAdminVoucherService(db *gorm.DB, encryptionKey string) *AdminVoucherService {
	return &AdminVoucherService{
		db:            db,
		encryptionKey: encryptionKey,
		voucherRepo:   repository.NewBaseRepository[domain.VoucherCode](db),
	}
}

func (s *AdminVoucherService) BulkUploadVouchers(vouchers []domain.VoucherCode) error {
	if len(vouchers) == 0 {
		return apperror.Validation("no vouchers to upload")
	}

	hashes := make(map[string]bool, len(vouchers))
	for i := range vouchers {
		if vouchers[i].PinCode == "" {
			return apperror.Validationf("voucher #%d: pinCode is required", i+1)
		}
		if vouchers[i].ProductID == 0 {
			return apperror.Validationf("voucher #%d: productId is required", i+1)
		}

		hash := crypto.SHA256Hash(vouchers[i].PinCode)

		if hashes[hash] {
			return apperror.Validationf("voucher #%d: duplicate PIN in batch", i+1)
		}
		hashes[hash] = true

		encrypted, err := crypto.Encrypt(vouchers[i].PinCode, s.encryptionKey)
		if err != nil {
			return apperror.Internal(fmt.Sprintf("voucher #%d: encryption failed", i+1), err)
		}

		vouchers[i].PinCode = encrypted
		vouchers[i].PinHash = hash
		vouchers[i].Status = "AVAILABLE"
		vouchers[i].Source = "ADMIN"
	}

	// Fix 5: 고유 ProductID 수집 후 상품 존재 및 활성 상태 검증
	productIDs := make(map[int]bool)
	for _, v := range vouchers {
		productIDs[v.ProductID] = true
	}
	for pid := range productIDs {
		var product domain.Product
		if err := s.db.Select("Id", "IsActive").First(&product, pid).Error; err != nil {
			return apperror.Validationf("상품 ID %d를 찾을 수 없습니다", pid)
		}
		if !product.IsActive {
			return apperror.Validationf("상품 ID %d는 비활성 상태입니다", pid)
		}
	}

	hashList := make([]string, 0, len(hashes))
	for h := range hashes {
		hashList = append(hashList, h)
	}
	var existingCount int64
	s.db.Model(&domain.VoucherCode{}).Where("PinHash IN ?", hashList).Count(&existingCount)
	if existingCount > 0 {
		return apperror.Conflict(fmt.Sprintf("%d duplicate PIN(s) already exist in database", existingCount))
	}

	// Fix 6: 전체 업로드 작업을 트랜잭션으로 묶어 원자성 보장
	return s.db.Transaction(func(tx *gorm.DB) error {
		return tx.Create(&vouchers).Error
	})
}

func (s *AdminVoucherService) GetVoucherList(params pagination.QueryParams, status string, productID int) (pagination.PaginatedResponse[domain.VoucherCode], error) {
	where := make(map[string]any)
	if status != "" {
		where["Status"] = status
	}
	if productID > 0 {
		where["ProductId"] = productID
	}
	result, err := s.voucherRepo.FindAll(params, where)
	if err != nil {
		return result, err
	}
	// Fix 4: 목록 조회 시 PIN 코드 마스킹 (상세 조회에서만 실제 값 노출)
	for i := range result.Items {
		if result.Items[i].PinCode != "" {
			result.Items[i].PinCode = "****"
		}
	}
	return result, nil
}

func (s *AdminVoucherService) GetVoucherDetail(id int) (*domain.VoucherCode, error) {
	return s.voucherRepo.FindByID(id)
}

func (s *AdminVoucherService) UpdateVoucher(id int, data map[string]any) error {
	if newStatus, ok := data["Status"].(string); ok {
		var voucher domain.VoucherCode
		if err := s.db.Select("Status").First(&voucher, id).Error; err != nil {
			return apperror.NotFoundf("voucher %d not found", id)
		}
		if err := domain.ValidateVoucherTransition(voucher.Status, newStatus); err != nil {
			return apperror.Validation(err.Error())
		}
	}
	return s.db.Model(&domain.VoucherCode{}).Where("Id = ?", id).Updates(data).Error
}

func (s *AdminVoucherService) DeleteVoucher(id int) error {
	var voucher domain.VoucherCode
	if err := s.db.Select("Status").First(&voucher, id).Error; err != nil {
		return apperror.NotFoundf("voucher %d not found", id)
	}
	if !domain.CanDeleteVoucher(voucher.Status) {
		return apperror.Validationf("cannot delete voucher in %s status", voucher.Status)
	}
	return s.voucherRepo.Delete(id)
}

func (s *AdminVoucherService) GetStockCount(productID int) (map[string]any, error) {
	type stockResult struct {
		Total     int64
		Available int64
	}
	var sr stockResult
	if err := s.db.Raw(
		"SELECT COUNT(*) AS Total, SUM(CASE WHEN Status = 'AVAILABLE' THEN 1 ELSE 0 END) AS Available FROM VoucherCodes WHERE ProductId = ?",
		productID,
	).Scan(&sr).Error; err != nil {
		return nil, err
	}
	return map[string]any{
		"productId": productID,
		"available": sr.Available,
		"total":     sr.Total,
	}, nil
}

// GetExpiringVouchers는 N일 이내에 만료 예정인 AVAILABLE 바우처 목록을 조회합니다.
func (s *AdminVoucherService) GetExpiringVouchers(days int) ([]domain.VoucherCode, error) {
	var vouchers []domain.VoucherCode
	now := time.Now()
	deadline := now.AddDate(0, 0, days)
	err := s.db.Where("Status = 'AVAILABLE' AND ExpiredAt IS NOT NULL AND ExpiredAt > ? AND ExpiredAt < ?", now, deadline).
		Preload("Product").
		Order("ExpiredAt ASC").
		Find(&vouchers).Error
	return vouchers, err
}

func (s *AdminVoucherService) GetVoucherInventory() ([]map[string]any, error) {
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
		GROUP BY p.Id, p.Name, p.BrandCode
		ORDER BY p.BrandCode, p.Name
	`).Scan(&results).Error
	return results, err
}
