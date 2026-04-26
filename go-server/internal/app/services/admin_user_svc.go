package services

import (
	"fmt"
	"time"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/repository"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/crypto"
	"seedream-gift-server/pkg/pagination"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// defaultBcryptCost는 별도 설정이 없을 때 사용하는 bcrypt 작업 계수입니다.
const defaultBcryptCost = 12

// AdminUserService는 관리자의 회원 관리 기능을 처리합니다.
type AdminUserService struct {
	db         *gorm.DB
	userRepo   *repository.BaseRepository[domain.User]
	bcryptCost int
}

// NewAdminUserService는 새로운 AdminUserService를 생성합니다.
func NewAdminUserService(db *gorm.DB) *AdminUserService {
	return &AdminUserService{
		db:         db,
		userRepo:   repository.NewBaseRepository[domain.User](db),
		bcryptCost: defaultBcryptCost,
	}
}

func (s *AdminUserService) GetUsers(params pagination.QueryParams, kycStatus, role, search string) (pagination.PaginatedResponse[domain.User], error) {
	var items []domain.User
	var total int64

	db := s.db.Model(&domain.User{}).Where("DeletedAt IS NULL")
	if kycStatus != "" {
		db = db.Where("KycStatus = ?", kycStatus)
	}
	if role != "" {
		db = db.Where("Role = ?", role)
	}
	if search != "" {
		searchPattern := "%" + search + "%"
		db = db.Where("Name LIKE ? OR Email LIKE ? OR Phone LIKE ?", searchPattern, searchPattern, searchPattern)
	}
	db.Count(&total)

	if params.Limit <= 0 {
		params.Limit = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}
	offset := (params.Page - 1) * params.Limit

	err := db.Order("Id DESC").Offset(offset).Limit(params.Limit).Find(&items).Error
	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), err
}

func (s *AdminUserService) GetUserDetail(id int) (*domain.User, error) {
	return s.userRepo.FindByID(id)
}

func (s *AdminUserService) CreateUser(user *domain.User) error {
	if err := domain.ValidateEmail(user.Email); err != nil {
		return err
	}
	if err := domain.ValidatePassword(user.Password); err != nil {
		return err
	}
	// 이메일 중복 검사: 동일한 이메일을 가진 사용자가 이미 존재하면 생성을 거부합니다.
	var count int64
	s.db.Model(&domain.User{}).Where("Email = ?", user.Email).Count(&count)
	if count > 0 {
		return apperror.Conflict("이미 사용 중인 이메일입니다")
	}
	// bcryptCost 필드를 사용하여 설정값에 따른 해싱 강도를 적용합니다.
	hashedPassword, err := crypto.HashPassword(user.Password, s.bcryptCost)
	if err != nil {
		return err
	}
	user.Password = hashedPassword
	if user.Role == "" {
		user.Role = "USER"
	}
	if err := domain.ValidateRole(user.Role); err != nil {
		return err
	}
	return s.userRepo.Create(user)
}

// UpdateUser는 허용된 필드만 담긴 맵을 받아 회원 정보를 수정합니다.
// Role, Password 등 민감 필드는 호출 측(핸들러)에서 걸러져야 합니다.
func (s *AdminUserService) UpdateUser(id int, updates map[string]any) error {
	// 이메일 변경 시 다른 사용자와의 중복 여부를 확인합니다.
	if email, ok := updates["Email"]; ok {
		var count int64
		s.db.Model(&domain.User{}).Where("Email = ? AND Id != ?", email, id).Count(&count)
		if count > 0 {
			return apperror.Validation("이미 사용 중인 이메일입니다")
		}
	}
	return s.db.Model(&domain.User{}).Where("Id = ?", id).Updates(updates).Error
}

func (s *AdminUserService) DeleteUser(id int) error {
	// 마지막 관리자 보호: 삭제 대상이 ADMIN이고, 활성 ADMIN이 1명뿐이면 거부.
	// 시스템에서 ADMIN이 한 명도 남지 않으면 관리 콘솔 접근이 영구 차단되므로 lockout을 사전 차단합니다.
	var target domain.User
	if err := s.db.Select("Id", "Role").First(&target, id).Error; err != nil {
		return apperror.NotFoundf("user %d not found", id)
	}
	if target.Role == "ADMIN" {
		var adminCount int64
		s.db.Model(&domain.User{}).
			Where("Role = ? AND IsDeleted = 0 AND DeletedAt IS NULL", "ADMIN").
			Count(&adminCount)
		if adminCount <= 1 {
			return apperror.Forbidden("최소 1명의 관리자가 필요합니다")
		}
	}

	var pendingOrders int64
	s.db.Model(&domain.Order{}).Where("UserId = ? AND Status IN ?", id, []string{"PENDING", "PAID"}).Count(&pendingOrders)
	if pendingOrders > 0 {
		return apperror.Validationf("cannot delete user: %d pending/paid order(s) exist", pendingOrders)
	}
	// 처리 중인 매입 신청이 있으면 삭제를 거부합니다.
	var tradeInCount int64
	s.db.Model(&domain.TradeIn{}).Where("UserId = ? AND Status IN ?", id, []string{"REQUESTED", "RECEIVED", "VERIFIED"}).Count(&tradeInCount)
	if tradeInCount > 0 {
		return apperror.Validation("처리 중인 매입 신청이 있어 삭제할 수 없습니다")
	}
	// 처리 중인 환불 요청이 있으면 삭제를 거부합니다.
	var refundCount int64
	s.db.Model(&domain.Refund{}).
		Where("OrderId IN (SELECT Id FROM Orders WHERE UserId = ?) AND Status = 'REQUESTED'", id).
		Count(&refundCount)
	if refundCount > 0 {
		return apperror.Validation("처리 중인 환불 요청이 있어 삭제할 수 없습니다")
	}
	// RefreshToken 삭제와 User 삭제를 하나의 트랜잭션으로 묶어 원자성을 보장합니다.
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("UserId = ?", id).Delete(&domain.RefreshToken{}).Error; err != nil {
			return err
		}
		return tx.Delete(&domain.User{}, id).Error
	})
}

func (s *AdminUserService) UpdateUserKycStatus(id int, status string, adminID int) error {
	return s.db.Model(&domain.User{}).Where("Id = ?", id).Updates(map[string]any{
		"KycStatus":     status,
		"KycVerifiedBy": fmt.Sprintf("ADMIN_%d", adminID),
	}).Error
}

// UpdateUserRole는 대상 사용자의 역할을 변경합니다.
// adminID는 요청을 수행하는 관리자의 ID로, 다른 관리자의 역할 변경을 방지하는 데 사용됩니다.
func (s *AdminUserService) UpdateUserRole(id int, role string, adminID int) error {
	// 대상 사용자 조회 및 존재 여부 확인
	var target domain.User
	if err := s.db.Select("Id", "Role").First(&target, id).Error; err != nil {
		return apperror.NotFound("사용자를 찾을 수 없습니다")
	}

	// 다른 관리자의 역할을 변경하는 권한 상승(Privilege Escalation) 방지
	// 자기 자신의 역할 변경은 핸들러 레이어에서 별도로 제한됨
	if target.Role == "ADMIN" && target.ID != adminID {
		return apperror.Forbidden("다른 관리자의 역할은 변경할 수 없습니다")
	}

	result := s.db.Model(&domain.User{}).Where("Id = ?", id).Update("Role", role)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperror.NotFound("사용자를 찾을 수 없습니다")
	}
	return nil
}

func (s *AdminUserService) ResetUserPassword(id int, plainPassword string) error {
	// bcryptCost 필드를 사용하여 설정값에 따른 해싱 강도를 적용합니다.
	hashedPassword, err := crypto.HashPassword(plainPassword, s.bcryptCost)
	if err != nil {
		return err
	}
	// 비밀번호 변경과 동시에 기존 RefreshToken을 모두 폐기합니다.
	// 두 작업을 한 트랜잭션으로 묶어 "새 비번 적용 + 기존 세션 강제 로그아웃"이 원자적으로 일어나도록 보장합니다.
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("UserId = ?", id).Delete(&domain.RefreshToken{}).Error; err != nil {
			return err
		}
		return tx.Model(&domain.User{}).Where("Id = ?", id).Update("Password", hashedPassword).Error
	})
}

// LockUser는 지정된 시간까지 사용자 계정을 잠급니다.
func (s *AdminUserService) LockUser(id int, until time.Time, reason string) error {
	result := s.db.Model(&domain.User{}).Where("Id = ?", id).Update("LockedUntil", until)
	if result.RowsAffected == 0 {
		return apperror.NotFoundf("user %d not found", id)
	}
	return result.Error
}

// UnlockUser는 사용자 계정 잠금을 해제합니다.
func (s *AdminUserService) UnlockUser(id int) error {
	result := s.db.Model(&domain.User{}).Where("Id = ?", id).Updates(map[string]any{
		"LockedUntil":         nil,
		"FailedLoginAttempts": 0,
	})
	if result.RowsAffected == 0 {
		return apperror.NotFoundf("user %d not found", id)
	}
	return result.Error
}

// UpdatePartnerTier는 사용자의 파트너 등급을 설정합니다.
func (s *AdminUserService) UpdatePartnerTier(id int, tier string) error {
	validTiers := map[string]bool{"BRONZE": true, "SILVER": true, "GOLD": true, "PLATINUM": true, "": true}
	if !validTiers[tier] {
		return apperror.Validationf("invalid partner tier: %s (allowed: BRONZE, SILVER, GOLD, PLATINUM, or empty)", tier)
	}
	var partnerTier *string
	if tier != "" {
		partnerTier = &tier
	}
	result := s.db.Model(&domain.User{}).Where("Id = ?", id).Update("PartnerTier", partnerTier)
	if result.RowsAffected == 0 {
		return apperror.NotFoundf("user %d not found", id)
	}
	return result.Error
}

// SetCommissionRate는 파트너의 수수료율을 설정합니다.
// rate가 nil이면 전역 기본값이 적용됩니다.
func (s *AdminUserService) SetCommissionRate(id int, rate *float64) error {
	// 파트너 확인
	var user domain.User
	if err := s.db.Select("Id, Role").First(&user, id).Error; err != nil {
		return apperror.NotFoundf("user %d not found", id)
	}
	if user.Role != "PARTNER" {
		return apperror.Validation("파트너 역할의 사용자만 설정할 수 있습니다")
	}

	if rate != nil {
		if *rate < 0 || *rate > 100 {
			return apperror.Validation("commission rate must be between 0 and 100")
		}
		nd := domain.NewNumericDecimal(decimal.NewFromFloat(*rate))
		return s.db.Model(&domain.User{}).Where("Id = ?", id).Update("CommissionRate", &nd).Error
	}
	// nil일 경우 전역 기본값 사용을 위해 NULL로 설정
	return s.db.Model(&domain.User{}).Where("Id = ?", id).Update("CommissionRate", nil).Error
}

// SetPayoutFrequency는 파트너의 정산 주기를 설정합니다.
func (s *AdminUserService) SetPayoutFrequency(id int, frequency *string) error {
	var user domain.User
	if err := s.db.Select("Id, Role").First(&user, id).Error; err != nil {
		return apperror.NotFoundf("user %d not found", id)
	}
	if user.Role != "PARTNER" {
		return apperror.Validation("파트너 역할의 사용자만 설정할 수 있습니다")
	}

	if frequency != nil && *frequency != "" {
		valid := map[string]bool{"INSTANT": true, "WEEKLY": true, "MONTHLY": true, "MANUAL": true}
		if !valid[*frequency] {
			return apperror.Validationf("invalid payout frequency: %s (allowed: INSTANT, WEEKLY, MONTHLY, MANUAL)", *frequency)
		}
	}
	return s.db.Model(&domain.User{}).Where("Id = ?", id).Update("PayoutFrequency", frequency).Error
}

// SetPartnerLimits는 파트너의 일일 PIN 업로드 한도를 설정합니다.
func (s *AdminUserService) SetPartnerLimits(id int, dailyPinLimit *int) error {
	var user domain.User
	if err := s.db.Select("Id, Role").First(&user, id).Error; err != nil {
		return apperror.NotFoundf("user %d not found", id)
	}
	if user.Role != "PARTNER" {
		return apperror.Validation("파트너 역할의 사용자만 설정할 수 있습니다")
	}

	if dailyPinLimit != nil && *dailyPinLimit < 0 {
		return apperror.Validation("daily pin limit must be non-negative")
	}
	return s.db.Model(&domain.User{}).Where("Id = ?", id).Update("DailyPinLimit", dailyPinLimit).Error
}

// GetUserWebAuthnCredentials는 사용자의 모든 WebAuthn 자격 증명을 조회합니다.
func (s *AdminUserService) GetUserWebAuthnCredentials(userID int) ([]domain.WebAuthnCredential, error) {
	var creds []domain.WebAuthnCredential
	err := s.db.Where("UserId = ?", userID).Order("CreatedAt DESC").Find(&creds).Error
	return creds, err
}

// ResetUserWebAuthn은 사용자의 모든 WebAuthn 자격 증명을 삭제하고 WebAuthnEnabled를 비활성화합니다.
func (s *AdminUserService) ResetUserWebAuthn(userID int) error {
	if err := s.db.Where("UserId = ?", userID).Delete(&domain.WebAuthnCredential{}).Error; err != nil {
		return apperror.Internal("패스키 초기화 실패", err)
	}
	s.db.Model(&domain.User{}).Where("Id = ?", userID).Update("WebAuthnEnabled", false)
	return nil
}

// GetUserSummary는 사용자의 거래 요약 정보를 반환합니다.
func (s *AdminUserService) GetUserSummary(id int) (map[string]any, error) {
	// 사용자 존재 확인
	var user domain.User
	if err := s.db.Select("Id").First(&user, id).Error; err != nil {
		return nil, apperror.NotFoundf("user %d not found", id)
	}

	// 총 주문 금액
	var orderTotal struct {
		Amount *float64
		Count  int64
	}
	s.db.Model(&domain.Order{}).
		Select("SUM(TotalAmount) as Amount, COUNT(*) as Count").
		Where("UserId = ?", id).
		Scan(&orderTotal)

	// 총 매입 금액
	var tradeInTotal struct {
		Amount *float64
		Count  int64
	}
	s.db.Model(&domain.TradeIn{}).
		Select("SUM(PayoutAmount) as Amount, COUNT(*) as Count").
		Where("UserId = ?", id).
		Scan(&tradeInTotal)

	// 주문 상태별 건수
	var orderStatusCounts []struct {
		Status string
		Count  int64
	}
	s.db.Model(&domain.Order{}).
		Select("Status, COUNT(*) as Count").
		Where("UserId = ?", id).
		Group("Status").
		Find(&orderStatusCounts)

	statusMap := make(map[string]int64)
	for _, sc := range orderStatusCounts {
		statusMap[sc.Status] = sc.Count
	}

	// 최근 5건 주문
	var recentOrders []domain.Order
	s.db.Where("UserId = ?", id).Order("CreatedAt DESC").Limit(5).Find(&recentOrders)

	// 최근 5건 매입
	var recentTradeIns []domain.TradeIn
	s.db.Where("UserId = ?", id).Order("CreatedAt DESC").Limit(5).Find(&recentTradeIns)

	totalOrderAmount := float64(0)
	if orderTotal.Amount != nil {
		totalOrderAmount = *orderTotal.Amount
	}
	totalTradeInAmount := float64(0)
	if tradeInTotal.Amount != nil {
		totalTradeInAmount = *tradeInTotal.Amount
	}

	return map[string]any{
		"userId":             id,
		"totalOrderAmount":   totalOrderAmount,
		"totalOrderCount":    orderTotal.Count,
		"totalTradeInAmount": totalTradeInAmount,
		"totalTradeInCount":  tradeInTotal.Count,
		"orderStatusCounts":  statusMap,
		"recentOrders":       recentOrders,
		"recentTradeIns":     recentTradeIns,
	}, nil
}
