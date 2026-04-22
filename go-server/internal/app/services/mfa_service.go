// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// MFA(Multi-Factor Authentication) 서비스는 사용자 계정에 대한 추가 보안 계층을 제공합니다.
package services

import (
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/crypto"

	"github.com/pquerna/otp/totp"
	"gorm.io/gorm"
)

// MfaService는 다요소 인증 관련 비즈니스 로직을 처리하는 서비스입니다.
type MfaService struct {
	db  *gorm.DB
	cfg *config.Config
}

// NewMfaService는 새로운 MfaService 인스턴스를 생성합니다.
func NewMfaService(db *gorm.DB, cfg *config.Config) *MfaService {
	return &MfaService{db: db, cfg: cfg}
}

// GenerateSetup은 사용자를 위한 새로운 TOTP 비밀키와 등록용 URL을 생성합니다.
func (s *MfaService) GenerateSetup(userID int, email string) (string, string, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "w-gift",
		AccountName: email,
	})
	if err != nil {
		return "", "", err
	}

	secret := key.Secret()
	encryptedSecret, err := crypto.Encrypt(secret, s.cfg.EncryptionKey)
	if err != nil {
		return "", "", err
	}

	err = s.db.Model(&domain.User{}).Where("Id = ?", userID).Updates(map[string]any{
		"TotpSecret": encryptedSecret,
	}).Error

	return secret, key.URL(), err
}

// VerifyAndEnable은 사용자가 입력한 OTP 코드를 검증하고 성공 시 MFA 기능을 활성화합니다.
func (s *MfaService) VerifyAndEnable(userID int, code string) error {
	var user domain.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return err
	}

	if user.TotpSecret == nil {
		return apperror.Validation("MFA not set up")
	}

	decryptedSecret, err := crypto.Decrypt(*user.TotpSecret, s.cfg.EncryptionKey)
	if err != nil {
		return apperror.Internal("failed to decrypt MFA secret", err)
	}

	valid := totp.Validate(code, decryptedSecret)
	if !valid {
		return apperror.Unauthorized("invalid MFA code")
	}

	return s.db.Model(&user).Update("MfaEnabled", true).Error
}

// VerifyTOTP는 사용자의 저장된 비밀키를 사용하여 OTP 코드를 검증합니다. (DB 상태를 변경하지 않음)
func (s *MfaService) VerifyTOTP(userID int, code string) error {
	var user domain.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return apperror.NotFound("사용자를 찾을 수 없습니다")
	}

	if user.TotpSecret == nil || !user.MfaEnabled {
		return apperror.Validation("MFA not enabled for this account")
	}

	decryptedSecret, err := crypto.Decrypt(*user.TotpSecret, s.cfg.EncryptionKey)
	if err != nil {
		return apperror.Internal("failed to decrypt MFA secret", err)
	}

	if !totp.Validate(code, decryptedSecret) {
		return apperror.Unauthorized("invalid MFA code")
	}
	return nil
}

// DisableMFA는 OTP 코드를 검증한 후 사용자의 MFA 기능을 비활성화합니다.
func (s *MfaService) DisableMFA(userID int, code string) error {
	if err := s.VerifyTOTP(userID, code); err != nil {
		return err
	}
	return s.db.Model(&domain.User{}).Where("Id = ?", userID).Updates(map[string]any{
		"MfaEnabled": false,
		"TotpSecret": nil,
	}).Error
}
