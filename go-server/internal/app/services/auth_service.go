// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// Auth Service는 사용자 인증, 회원가입 및 세션 관리를 처리합니다.
package services

import (
	crand "crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"sync"
	"time"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/internal/infra/repository"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/crypto"
	"w-gift-server/pkg/jwt"
	"w-gift-server/pkg/logger"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// usedMFATokens는 이미 소비된 MFA 토큰 해시를 추적하여 재사용(리플레이)을 방지합니다.
// 토큰 만료(기본 5분) 후 자동으로 제거됩니다.
var usedMFATokens sync.Map

// AuthService는 사용자의 인증, 인가, 보안 정책(로그인 시도 제한, MFA 등)을 총괄하는 서비스입니다.
type AuthService struct {
	userRepo   *repository.BaseRepository[domain.User]
	tokenRepo  *repository.BaseRepository[domain.RefreshToken]
	mfaService *MfaService
	cfg        *config.Config
	db         *gorm.DB
}

// NewAuthService는 리포지토리와 설정값, MFA 서비스를 주입받아 AuthService를 초기화합니다.
func NewAuthService(db *gorm.DB, cfg *config.Config, mfaService *MfaService) *AuthService {
	return &AuthService{
		userRepo:   repository.NewBaseRepository[domain.User](db),
		tokenRepo:  repository.NewBaseRepository[domain.RefreshToken](db),
		mfaService: mfaService,
		cfg:        cfg,
		db:         db,
	}
}

// GetDB는 트랜잭션 처리가 필요한 경우를 위해 내부 DB 인스턴스를 반환합니다.
func (s *AuthService) GetDB() *gorm.DB {
	return s.db
}

// UserResponse는 클라이언트에 응답으로 보낼 사용자 정보입니다.
// 보안상 민감한 필드(해싱된 비밀번호, 로그인 실패 횟수 등)를 제외하고 가공된 데이터만 포함합니다.
type UserResponse struct {
	ID                int    `json:"id"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	Phone             string `json:"phone"`
	Role              string `json:"role"`
	KycStatus         string `json:"kycStatus"`
	EmailNotification bool   `json:"emailNotification"`
	PushNotification  bool   `json:"pushNotification"`
	ZipCode           string `json:"zipCode"`
	Address           string `json:"address"`
	AddressDetail     string `json:"addressDetail"`
	MfaEnabled        bool   `json:"mfaEnabled"`
	WebAuthnEnabled   bool   `json:"webAuthnEnabled"`
}

// toUserResponse는 도메인 엔티티를 클라이언트 응답용 구조체로 변환합니다.
// 포인터 타입인 필드들을 안전하게 문자열로 변환하여 프론트엔드에서의 null 참조를 방지합니다.
func toUserResponse(user domain.User) UserResponse {
	name := ""
	if user.Name != nil {
		name = *user.Name
	}
	phone := ""
	if user.Phone != nil {
		phone = *user.Phone
	}
	return UserResponse{
		ID:                user.ID,
		Email:             user.Email,
		Name:              name,
		Phone:             phone,
		Role:              user.Role,
		KycStatus:         user.KycStatus,
		EmailNotification: user.EmailNotification,
		PushNotification:  user.PushNotification,
		ZipCode:           user.ZipCode,
		Address:           user.Address,
		AddressDetail:     user.AddressDetail,
		MfaEnabled:        user.MfaEnabled,
		WebAuthnEnabled:   user.WebAuthnEnabled,
	}
}

// LoginResponse는 로그인 성공 시 반환되는 데이터입니다.
type LoginResponse struct {
	AccessToken string       `json:"access_token"`
	User        UserResponse `json:"user"`
}

// MFARequiredResponse는 2차 인증(MFA)이 필요한 경우 반환되는 정보입니다.
type MFARequiredResponse struct {
	MFARequired     bool     `json:"mfa_required"`
	MFAToken        string   `json:"mfa_token"`        // MFA 인증 단계에서만 유효한 임시 토큰
	MFAMethods      []string `json:"mfa_methods"`      // 사용 가능한 MFA 방식 ("totp", "webauthn")
	WebAuthnEnabled bool     `json:"webauthn_enabled"` // WebAuthn 자격 증명 보유 여부
}

// Login은 이메일과 비밀번호를 검증하고 세션을 생성합니다.
// 연속 실패 시 계정 잠금 정책을 적용하며, MFA 활성 시 2차 인증 단계를 안내합니다.
func (s *AuthService) Login(email, password string, userAgent, ipAddress string) (any, string, error) {
	user, err := s.userRepo.FindOne(map[string]any{"Email": email})
	if err != nil {
		return nil, "", apperror.Unauthorized("이메일 또는 비밀번호가 올바르지 않습니다")
	}

	// 계정 잠금 상태 확인 (도메인 메서드 활용)
	if user.IsLocked() {
		return nil, "", apperror.Unauthorized("비밀번호 오류 횟수 초과로 계정이 잠시 잠겼습니다. 나중에 다시 시도해주세요.")
	}

	// 비밀번호 해시 검증
	if !crypto.CheckPasswordHash(password, user.Password) {
		// 도메인 메서드로 실패 기록 및 임계치 초과 시 잠금 처리
		user.RecordLoginFailure(s.cfg.AccountLockThreshold, s.cfg.AccountLockDuration)
		if updateErr := s.userRepo.Update(user.ID, user); updateErr != nil {
			logger.Log.Error("로그인 실패 횟수 업데이트 실패", zap.Error(updateErr))
		}
		return nil, "", apperror.Unauthorized("이메일 또는 비밀번호가 올바르지 않습니다")
	}

	// 비밀번호 로그인의 2차 인증: OTP가 활성화된 경우에만 MFA 요구
	// 패스키 로그인은 별도 엔드포인트(/webauthn/login/begin,complete)로 처리되므로 여기서 WebAuthn은 체크하지 않음
	if user.MfaEnabled {
		mfaToken, err := jwt.GenerateMFAToken(user.ID, s.cfg.JWTSecret, s.cfg.MFATokenExpiry)
		if err != nil {
			return nil, "", apperror.Internal("MFA 토큰 생성 실패", err)
		}

		hasWebAuthn := user.WebAuthnEnabled && s.hasWebAuthnCredentials(user.ID)

		return &MFARequiredResponse{
			MFARequired:     true,
			MFAToken:        mfaToken,
			MFAMethods:      []string{"totp"},
			WebAuthnEnabled: hasWebAuthn,
		}, "", nil
	}

	// 일반 로그인 완료 처리
	return s.issueFullSession(user, userAgent, ipAddress)
}

// ConsumeMFAToken은 MFA 토큰을 검증하고 단일 사용으로 소비합니다.
// TOTP 경로(LoginMFA)와 WebAuthn 경로(FinishMFAAuthentication) 모두에서 호출되어
// 동일 토큰의 재사용(리플레이 공격)을 일관되게 차단합니다.
func (s *AuthService) ConsumeMFAToken(mfaToken string) error {
	tokenHash := crypto.SHA256Hash(mfaToken)
	if _, alreadyUsed := usedMFATokens.LoadOrStore(tokenHash, struct{}{}); alreadyUsed {
		return apperror.Unauthorized("이미 사용된 인증 토큰입니다")
	}
	go func() {
		time.Sleep(s.cfg.MFATokenExpiry + time.Minute)
		usedMFATokens.Delete(tokenHash)
	}()
	return nil
}

// LoginMFA는 MFA 2차 인증(TOTP) 코드를 확인하고 최종 세션을 발급합니다.
func (s *AuthService) LoginMFA(mfaToken, totpCode string, userAgent, ipAddress string) (*LoginResponse, string, error) {
	// 1단계에서 발급한 임시 MFA 토큰 검증
	claims, err := jwt.ValidateToken(mfaToken, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", apperror.Unauthorized("유효하지 않거나 만료된 인증 토큰입니다")
	}
	if claims.Purpose != "mfa" {
		return nil, "", apperror.Unauthorized("인증 용도가 올바르지 않은 토큰입니다")
	}

	// 구글 OTP 등 TOTP 코드 검증 (토큰 소비 전에 수행하여 원자성 보장)
	if err := s.mfaService.VerifyTOTP(claims.UserID, totpCode); err != nil {
		return nil, "", err
	}

	// 모든 검증 통과 후 MFA 토큰 소비 (리플레이 방지)
	if err := s.ConsumeMFAToken(mfaToken); err != nil {
		return nil, "", err
	}

	user, err := s.userRepo.FindByID(claims.UserID)
	if err != nil {
		return nil, "", apperror.NotFound("사용자를 찾을 수 없습니다")
	}

	return s.issueFullSession(user, userAgent, ipAddress)
}

// issueFullSession은 AccessToken과 RefreshToken을 생성하여 반환합니다.
// 보안을 위해 RefreshToken의 원본은 클라이언트에만 전달하고, 서버 DB에는 해시값만 저장합니다.
func (s *AuthService) issueFullSession(user *domain.User, userAgent, ipAddress string) (*LoginResponse, string, error) {
	// 단기 유효 AccessToken 생성 (Bearer 인증용)
	accessToken, err := jwt.GenerateToken(user.ID, user.Email, user.Role, s.cfg.JWTSecret, s.cfg.JWTAccessExpiry)
	if err != nil {
		return nil, "", apperror.Internal("액세스 토큰 생성 실패", err)
	}

	// 장기 유효 RefreshToken 생성 (암호학적으로 안전한 랜덤 바이트 사용)
	tokenBytes := make([]byte, 32)
	if _, err := io.ReadFull(crand.Reader, tokenBytes); err != nil {
		return nil, "", apperror.Internal("리프레시 토큰 생성 실패", err)
	}
	refreshTokenStr := hex.EncodeToString(tokenBytes)

	// 데이터베이스 보안: 리프레시 토큰 탈취 시 피해 최소화를 위해 해시하여 저장
	tokenHash := crypto.SHA256Hash(refreshTokenStr)

	ua := userAgent
	ip := ipAddress
	refreshToken := &domain.RefreshToken{
		Token:     tokenHash,
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(s.cfg.JWTRefreshExpiry),
		UserAgent: &ua,
		IPAddress: &ip,
	}
	if err := s.tokenRepo.Create(refreshToken); err != nil {
		return nil, "", apperror.Internal("리프레시 토큰 저장 실패", err)
	}

	// 동시 세션 수를 최대 5개로 제한: 신규 토큰 생성 후 초과분(가장 오래된 것)을 삭제합니다.
	const maxConcurrentSessions = 5
	var sessionCount int64
	s.db.Model(&domain.RefreshToken{}).
		Where("UserId = ? AND ExpiresAt > ?", user.ID, time.Now()).
		Count(&sessionCount)
	if sessionCount > maxConcurrentSessions {
		var oldTokenIDs []int
		s.db.Model(&domain.RefreshToken{}).
			Where("UserId = ? AND ExpiresAt > ?", user.ID, time.Now()).
			Order("CreatedAt ASC").
			Limit(int(sessionCount)-maxConcurrentSessions).
			Pluck("Id", &oldTokenIDs)
		if len(oldTokenIDs) > 0 {
			s.db.Where("Id IN ?", oldTokenIDs).Delete(&domain.RefreshToken{})
		}
	}

	// 마지막 로그인 정보 업데이트 및 실패 횟수 초기화 (도메인 메서드 활용)
	user.ResetLoginFailures()
	now := time.Now()
	_ = s.db.Model(user).Updates(map[string]any{
		"LastLoginAt":         now,
		"FailedLoginAttempts": user.FailedLoginAttempts,
		"LockedUntil":         user.LockedUntil,
	})

	logger.Log.Info("사용자 로그인 완료",
		zap.Int("userId", user.ID),
		zap.String("email", user.Email),
	)

	return &LoginResponse{
		AccessToken: accessToken,
		User:        toUserResponse(*user),
	}, refreshTokenStr, nil
}

// BankInfo는 회원가입 시 전달되는 은행 인증 정보입니다.
type BankInfo struct {
	BankName      string
	BankCode      *string
	AccountNumber string
	AccountHolder *string
}

// Register는 새로운 사용자를 등록합니다. 비밀번호를 안전하게 해싱하고 초기 권한을 부여합니다.
// 은행 정보가 함께 전달되면 단일 트랜잭션 내에서 암호화 후 저장합니다.
func (s *AuthService) Register(user *domain.User, bank *BankInfo) error {
	if err := domain.ValidateEmail(user.Email); err != nil {
		return err
	}
	if err := domain.ValidatePassword(user.Password); err != nil {
		return err
	}
	if user.Phone != nil {
		if err := domain.ValidatePhone(*user.Phone); err != nil {
			return err
		}
	}
	hashedPassword, err := crypto.HashPassword(user.Password, s.cfg.BcryptCost)
	if err != nil {
		return err
	}
	user.Password = hashedPassword
	user.Role = "USER"
	user.KycStatus = "NONE"

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}

		if bank != nil {
			encryptedAcct, err := crypto.EncryptCBC(bank.AccountNumber, s.cfg.EncryptionKey)
			if err != nil {
				return apperror.Internal("계좌 정보 암호화 실패", err)
			}
			now := time.Now()
			if err := tx.Model(user).Updates(map[string]any{
				"BankName":       bank.BankName,
				"BankCode":       bank.BankCode,
				"AccountNumber":  encryptedAcct,
				"AccountHolder":  bank.AccountHolder,
				"BankVerifiedAt": now,
				"KycStatus":      "VERIFIED",
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// GetUserByID는 ID를 사용하여 사용자 정보를 조회합니다.
func (s *AuthService) GetUserByID(id int) (*domain.User, error) {
	return s.userRepo.FindByID(id)
}

// GetUserProfile은 ID로 사용자를 조회하고 클라이언트 응답용 UserResponse로 변환하여 반환합니다.
func (s *AuthService) GetUserProfile(id int) (*UserResponse, error) {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	resp := toUserResponse(*user)
	return &resp, nil
}

// RefreshToken은 기존 리프레시 토큰을 확인하고 새로운 토큰 세트(Rotation)를 발급합니다.
// 토큰 재사용 공격 방지를 위해 한 번 사용된 리프레시 토큰은 즉시 무효화하고 갱신합니다.
func (s *AuthService) RefreshToken(refreshTokenStr string) (*LoginResponse, string, error) {
	var accessToken string
	var newRefreshTokenStr string
	var resultUser *domain.User

	// 클라이언트가 전달한 토큰을 해시하여 DB 내 해시값과 대조
	incomingHash := crypto.SHA256Hash(refreshTokenStr)

	err := s.db.Transaction(func(tx *gorm.DB) error {
		// 동시 요청에 의한 중복 갱신을 막기 위해 행 잠금(UPDLOCK) 적용
		var storedToken domain.RefreshToken
		if err := tx.Set("gorm:query_option", "WITH (UPDLOCK)").
			Where("Token = ?", incomingHash).First(&storedToken).Error; err != nil {
			return apperror.Unauthorized("유효하지 않은 리프레시 토큰입니다")
		}

		if storedToken.ExpiresAt.Before(time.Now()) {
			_ = tx.Delete(&storedToken)
			return apperror.Unauthorized("만료된 리프레시 토큰입니다")
		}

		user, err := s.userRepo.FindByID(storedToken.UserID)
		if err != nil {
			return apperror.NotFound("사용자를 찾을 수 없습니다")
		}

		accessToken, err = jwt.GenerateToken(user.ID, user.Email, user.Role, s.cfg.JWTSecret, s.cfg.JWTAccessExpiry)
		if err != nil {
			return apperror.Internal("새 액세스 토큰 생성 실패", err)
		}

		// Refresh Token Rotation: 보안을 위해 매 갱신 시마다 리프레시 토큰 자체도 교체
		rotateBytes := make([]byte, 32)
		if _, err = io.ReadFull(crand.Reader, rotateBytes); err != nil {
			return apperror.Internal("새 리프레시 토큰 생성 실패", err)
		}
		newRefreshTokenStr = hex.EncodeToString(rotateBytes)

		storedToken.Token = crypto.SHA256Hash(newRefreshTokenStr)
		storedToken.ExpiresAt = time.Now().Add(s.cfg.JWTRefreshExpiry)
		if err := tx.Save(&storedToken).Error; err != nil {
			return apperror.Internal("갱신된 리프레시 토큰 저장 실패", err)
		}

		resultUser = user
		return nil
	})
	if err != nil {
		return nil, "", err
	}

	return &LoginResponse{
		AccessToken: accessToken,
		User:        toUserResponse(*resultUser),
	}, newRefreshTokenStr, nil
}

// Logout은 현재 세션(리프레시 토큰)을 데이터베이스에서 삭제하여 무효화합니다.
func (s *AuthService) Logout(refreshTokenStr string) error {
	tokenHash := crypto.SHA256Hash(refreshTokenStr)
	storedToken, err := s.tokenRepo.FindOne(map[string]any{"Token": tokenHash})
	if err != nil {
		return nil // 이미 로그아웃된 경우
	}
	return s.tokenRepo.Delete(storedToken.ID)
}

// VerifyPassword는 사용자의 현재 비밀번호를 검증합니다.
// MFA 설정 등 민감한 작업 전 재인증에 사용됩니다.
func (s *AuthService) VerifyPassword(userID int, password string) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return apperror.NotFound("사용자를 찾을 수 없습니다")
	}
	if !crypto.CheckPasswordHash(password, user.Password) {
		return apperror.Unauthorized("비밀번호가 올바르지 않습니다")
	}
	return nil
}

// ChangePassword는 비밀번호를 변경하고 보안을 위해 다른 모든 기기에서의 세션을 강제 종료합니다.
func (s *AuthService) ChangePassword(userID int, oldPassword, newPassword string) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return apperror.NotFound("사용자를 찾을 수 없습니다")
	}

	if !crypto.CheckPasswordHash(oldPassword, user.Password) {
		return apperror.Unauthorized("현재 비밀번호가 일치하지 않습니다")
	}

	if err := domain.ValidatePassword(newPassword); err != nil {
		return err
	}

	hashedPassword, err := crypto.HashPassword(newPassword, s.cfg.BcryptCost)
	if err != nil {
		return err
	}

	user.Password = hashedPassword
	if err := s.userRepo.Update(userID, user); err != nil {
		return err
	}

	// 비밀번호 유출 상황을 가정하여 모든 토큰 삭제 (Force Logout)
	_ = s.db.Where("UserId = ?", userID).Delete(&domain.RefreshToken{})
	return nil
}

// ForgotPassword는 비밀번호를 분실한 사용자를 위해 임시 재설정 토큰을 생성합니다.
func (s *AuthService) ForgotPassword(email string) (string, error) {
	user, err := s.userRepo.FindOne(map[string]any{"Email": email})
	if err != nil {
		return "", apperror.NotFound("등록된 이메일이 아닙니다")
	}

	tokenBytes := make([]byte, 32) // 256-bit entropy
	if _, err := crand.Read(tokenBytes); err != nil {
		return "", apperror.Internal("재설정 토큰 생성 실패", err)
	}
	token := fmt.Sprintf("%x", tokenBytes)
	tokenHash := crypto.SHA256Hash(token)
	expiresAt := time.Now().Add(s.cfg.PasswordResetExpiry)

	// DB에는 재설정 토큰의 해시만 저장
	if err := s.db.Model(&domain.User{}).Where("Id = ?", user.ID).Updates(map[string]any{
		"PasswordResetToken":  tokenHash,
		"PasswordResetExpiry": expiresAt,
	}).Error; err != nil {
		return "", err
	}

	return token, nil
}

// UpdateProfile은 사용자의 기본 정보를 수정합니다.
// 이메일이나 휴대폰 번호가 변경되면 본인인증(KYC) 상태를 초기화하여 재인증을 유도합니다.
func (s *AuthService) UpdateProfile(userID int, updates map[string]any) (*UserResponse, error) {
	// 이메일과 이름은 KYC 인증 정보이므로 API에서 변경을 차단
	if _, ok := updates["email"]; ok {
		return nil, apperror.Validation("이메일은 본인 인증 정보로 변경할 수 없습니다")
	}
	if _, ok := updates["name"]; ok {
		return nil, apperror.Validation("이름은 본인 인증 정보로 변경할 수 없습니다")
	}

	allowed := map[string]string{
		"phone": "Phone",
		"zipCode": "ZipCode", "address": "Address", "addressDetail": "AddressDetail",
		"emailNotification": "EmailNotification", "pushNotification": "PushNotification",
	}

	dbUpdates := make(map[string]any)
	for k, v := range updates {
		if col, ok := allowed[k]; ok {
			dbUpdates[col] = v
		}
	}

	if len(dbUpdates) == 0 {
		return s.GetUserProfile(userID)
	}

	// 중복 전화번호 체크
	if phone, ok := dbUpdates["Phone"]; ok {
		var existing domain.User
		err := s.db.Where("Phone = ? AND Id != ?", phone, userID).First(&existing).Error
		if err == nil {
			return nil, apperror.Conflict("이미 등록된 휴대폰 번호입니다")
		}
	}

	// 전화번호 변경 시 KYC 상태를 초기화(PENDING)하여 보안 수준 유지
	if _, phoneChanged := dbUpdates["Phone"]; phoneChanged {
		currentUser, err := s.userRepo.FindByID(userID)
		if err == nil && currentUser.KycStatus == "VERIFIED" {
			dbUpdates["KycStatus"] = "PENDING"
		}
	}

	if err := s.db.Model(&domain.User{}).Where("Id = ?", userID).Updates(dbUpdates).Error; err != nil {
		return nil, err
	}
	return s.GetUserProfile(userID)
}

// IssueSessionForUser는 사용자 ID만으로 전체 세션(AccessToken + RefreshToken)을 발급합니다.
// WebAuthn 인증 등 비밀번호/MFA 외 인증 수단으로 로그인 완료 시 사용합니다.
func (s *AuthService) IssueSessionForUser(userID int, userAgent, ipAddress string) (*LoginResponse, string, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, "", apperror.NotFound("사용자를 찾을 수 없습니다")
	}
	return s.issueFullSession(user, userAgent, ipAddress)
}

// GetMFAStatus는 사용자가 MFA 기능을 사용 중인지 확인합니다.
func (s *AuthService) GetMFAStatus(userID int) (bool, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return false, apperror.NotFound("사용자를 찾을 수 없습니다")
	}
	return user.MfaEnabled, nil
}

// SetupMFA는 OTP 앱 등록을 위한 시크릿 키와 QR 코드를 생성합니다.
func (s *AuthService) SetupMFA(userID int, email string) (string, string, error) {
	return s.mfaService.GenerateSetup(userID, email)
}

// VerifyAndEnableMFA는 사용자가 입력한 OTP 코드를 최종 확인하고 MFA 기능을 활성화합니다.
func (s *AuthService) VerifyAndEnableMFA(userID int, code string) error {
	return s.mfaService.VerifyAndEnable(userID, code)
}

// DisableMFA는 OTP 코드 확인 후 MFA 기능을 끕니다.
func (s *AuthService) DisableMFA(userID int, totpCode string) error {
	return s.mfaService.DisableMFA(userID, totpCode)
}

// hasWebAuthnCredentials는 사용자가 WebAuthn 자격 증명을 보유하고 있는지 DB에서 확인합니다.
func (s *AuthService) hasWebAuthnCredentials(userID int) bool {
	var count int64
	s.db.Model(&domain.WebAuthnCredential{}).Where("UserId = ?", userID).Count(&count)
	return count > 0
}

// GetSessions는 현재 로그인되어 있는 활성 세션 목록을 반환합니다.
func (s *AuthService) GetSessions(userID int) ([]domain.RefreshToken, error) {
	var sessions []domain.RefreshToken
	err := s.db.
		Where("UserId = ? AND ExpiresAt > ?", userID, time.Now()).
		Order("CreatedAt DESC").
		Find(&sessions).Error
	if err != nil {
		return nil, err
	}
	return sessions, nil
}

// DeleteOtherSessions는 현재 세션을 제외한 다른 모든 기기에서의 로그아웃을 수행합니다.
// DB에는 토큰 해시만 저장되므로 currentToken을 SHA-256 해시로 변환 후 비교합니다.
func (s *AuthService) DeleteOtherSessions(userID int, currentToken string) error {
	currentHash := crypto.SHA256Hash(currentToken)
	return s.db.
		Where("UserId = ? AND Token != ?", userID, currentHash).
		Delete(&domain.RefreshToken{}).Error
}

// DeleteSession은 특정 세션 하나를 명시적으로 종료합니다.
func (s *AuthService) DeleteSession(userID int, sessionID int) error {
	result := s.db.
		Where("Id = ? AND UserId = ?", sessionID, userID).
		Delete(&domain.RefreshToken{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperror.NotFound("세션을 찾을 수 없습니다")
	}
	return nil
}

// ResetPassword는 재설정 토큰을 확인하고 새로운 비밀번호를 설정합니다.
// 성공 시 모든 세션을 종료하여 보안을 강화합니다.
func (s *AuthService) ResetPassword(email, token, newPassword string) error {
	// 보안: 만료/잘못된 토큰에 동일한 에러 메시지 반환 (정보 누출 방지)
	const invalidTokenMsg = "유효하지 않거나 만료된 재설정 토큰입니다"

	tokenHash := crypto.SHA256Hash(token)
	user, err := s.userRepo.FindOne(map[string]any{
		"Email":              email,
		"PasswordResetToken": tokenHash,
	})
	if err != nil {
		logger.Log.Warn("비밀번호 재설정 실패: 토큰 불일치", zap.String("email", email))
		return apperror.Unauthorized(invalidTokenMsg)
	}

	if user.PasswordResetExpiry == nil || user.PasswordResetExpiry.Before(time.Now()) {
		_ = s.db.Model(user).Updates(map[string]any{
			"PasswordResetToken":  nil,
			"PasswordResetExpiry": nil,
		})
		logger.Log.Warn("비밀번호 재설정 실패: 토큰 만료", zap.Int("userId", user.ID))
		return apperror.Unauthorized(invalidTokenMsg)
	}

	if err := domain.ValidatePassword(newPassword); err != nil {
		return err
	}

	hashedPassword, err := crypto.HashPassword(newPassword, s.cfg.BcryptCost)
	if err != nil {
		return err
	}

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(user).Updates(map[string]any{
			"Password":            hashedPassword,
			"PasswordResetToken":  nil,
			"PasswordResetExpiry": nil,
		}).Error; err != nil {
			return err
		}
		// 모든 세션 초기화하여 모든 기기 로그아웃 처리
		if err := tx.Where("UserId = ?", user.ID).Delete(&domain.RefreshToken{}).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		return err
	}

	// 감사 로그: 비밀번호 재설정 성공
	logger.Log.Info("비밀번호 재설정 완료",
		zap.Int("userId", user.ID),
		zap.String("email", email),
	)

	return nil
}
