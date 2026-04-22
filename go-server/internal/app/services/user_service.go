// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// User Service는 회원 계정 생명주기 및 개인정보 관리를 처리합니다.
package services

import (
	"fmt"
	"time"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/crypto"

	"gorm.io/gorm"
)

// UserService는 회원 정보 및 계정 관련 비즈니스 로직을 처리하는 서비스입니다.
type UserService struct {
	db *gorm.DB
}

// NewUserService는 새로운 UserService 인스턴스를 생성합니다.
func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

// SoftDelete는 사용자의 개인정보를 비식별화하고 계정을 소프트 삭제 처리합니다.
// 진행 중인 주문이나 매입 신청이 있는 경우 탈퇴를 제한합니다.
func (s *UserService) SoftDelete(userID int, password string) error {
	var user domain.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return apperror.NotFound("사용자를 찾을 수 없습니다")
	}

	if !crypto.CheckPasswordHash(password, user.Password) {
		return apperror.Unauthorized("invalid password")
	}

	now := time.Now()
	withdrawnEmail := fmt.Sprintf("withdrawn_%d@deleted.local", userID)

	return s.db.Transaction(func(tx *gorm.DB) error {
		// 트랜잭션 내에서 처리 중인 주문을 확인하여 TOCTOU 레이스 컨디션 방지
		var pendingOrders int64
		if err := tx.Model(&domain.Order{}).Where("UserId = ? AND Status = ?", userID, "PENDING").Count(&pendingOrders).Error; err != nil {
			return apperror.Internal("failed to check pending orders", err)
		}
		if pendingOrders > 0 {
			return apperror.Validation("처리 중인 주문이 있어 탈퇴할 수 없습니다.")
		}

		// 트랜잭션 내에서 처리 중인 매입 신청 확인
		var pendingTradeIns int64
		if err := tx.Model(&domain.TradeIn{}).Where("UserId = ? AND Status IN ?", userID, []string{"REQUESTED", "VERIFIED"}).Count(&pendingTradeIns).Error; err != nil {
			return apperror.Internal("failed to check pending trade-ins", err)
		}
		if pendingTradeIns > 0 {
			return apperror.Validation("처리 중인 매입 신청이 있어 탈퇴할 수 없습니다.")
		}

		// 소프트 삭제 처리 및 개인정보(PII) 제거
		if err := tx.Model(&domain.User{}).Where("Id = ?", userID).Updates(map[string]any{
			"IsDeleted":     true,
			"DeletedAt":     now,
			"Email":         withdrawnEmail,
			"Name":          nil,
			"Phone":         nil,
			"AccountNumber": nil,
			"AccountHolder": nil,
			"BankName":      nil,
			"BankCode":      nil,
			"KycData":       nil,
			"KycStatus":     "NONE",
			"MfaEnabled":    false,
			"TotpSecret":    nil,
		}).Error; err != nil {
			return apperror.Internal("failed to soft delete user", err)
		}
		// 리프레시 토큰 삭제
		if err := tx.Where("UserId = ?", userID).Delete(&domain.RefreshToken{}).Error; err != nil {
			return apperror.Internal("failed to delete refresh tokens", err)
		}
		// 장바구니 항목 삭제
		if err := tx.Where("UserId = ?", userID).Delete(&domain.CartItem{}).Error; err != nil {
			return apperror.Internal("failed to delete cart items", err)
		}
		// WebAuthn 자격 증명 삭제
		if err := tx.Where("UserId = ?", userID).Delete(&domain.WebAuthnCredential{}).Error; err != nil {
			return apperror.Internal("failed to delete webauthn credentials", err)
		}
		// 매입 신청 내의 개인정보 익명화
		if err := tx.Model(&domain.TradeIn{}).Where("UserId = ?", userID).Updates(map[string]any{
			"SenderName": nil, "SenderPhone": nil, "SenderEmail": nil,
			"AccountHolder": nil, "BankName": nil, "AccountNum": nil,
		}).Error; err != nil {
			return apperror.Internal("failed to sanitize trade-in PII", err)
		}
		return nil
	})
}
