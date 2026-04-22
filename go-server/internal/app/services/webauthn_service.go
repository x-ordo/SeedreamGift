// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// WebAuthn(FIDO2/Passkey) 서비스는 비밀번호 없는 인증 및 2차 인증 수단을 제공합니다.
package services

import (
	"encoding/base64"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/logger"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ════════════════════════════════════════════════════════════════
// WebAuthn User Adapter
// ════════════════════════════════════════════════════════════════

// webAuthnUser는 domain.User를 go-webauthn 라이브러리가 요구하는 webauthn.User 인터페이스로 래핑합니다.
type webAuthnUser struct {
	user        *domain.User
	credentials []webauthn.Credential
}

func (u *webAuthnUser) WebAuthnID() []byte {
	return []byte(fmt.Sprintf("%d", u.user.ID))
}

func (u *webAuthnUser) WebAuthnName() string {
	return u.user.Email
}

func (u *webAuthnUser) WebAuthnDisplayName() string {
	if u.user.Name != nil {
		return *u.user.Name
	}
	return u.user.Email
}

func (u *webAuthnUser) WebAuthnCredentials() []webauthn.Credential {
	return u.credentials
}

// ════════════════════════════════════════════════════════════════
// Session Store (challenge 임시 저장)
// ════════════════════════════════════════════════════════════════

// sessionEntry는 WebAuthn 등록/인증 과정에서 생성된 챌린지 세션 데이터를 보관합니다.
type sessionEntry struct {
	data      *webauthn.SessionData
	expiresAt time.Time
}

// ════════════════════════════════════════════════════════════════
// WebAuthnService
// ════════════════════════════════════════════════════════════════

// WebAuthnService는 WebAuthn(FIDO2/Passkey) 관련 비즈니스 로직을 처리하는 서비스입니다.
type WebAuthnService struct {
	db       *gorm.DB
	wa       *webauthn.WebAuthn
	sessions sync.Map // key: "reg:{userID}" or "login:{userID}", value: sessionEntry
}

const (
	sessionTTL      = 5 * time.Minute
	sessionKeyReg   = "reg:%d"
	sessionKeyLogin = "login:%d"
)

// NewWebAuthnService는 WebAuthn 인스턴스를 생성합니다.
// FrontendUrl에서 RPID(도메인)를 추출하고, FrontendUrl과 AdminUrl을 RPOrigins로 설정합니다.
func NewWebAuthnService(db *gorm.DB, cfg *config.Config) *WebAuthnService {
	rpID := extractDomain(cfg.FrontendUrl)
	var origins []string
	if cfg.FrontendUrl != "" {
		origins = append(origins, normalizeOrigin(cfg.FrontendUrl))
	}
	if cfg.AdminUrl != "" {
		adminOrigin := normalizeOrigin(cfg.AdminUrl)
		// 중복 방지
		if adminOrigin != "" {
			duplicate := false
			for _, o := range origins {
				if o == adminOrigin {
					duplicate = true
					break
				}
			}
			if !duplicate {
				origins = append(origins, adminOrigin)
			}
		}
	}

	// 개발 환경용: localhost 오리진 추가
	if rpID == "" || rpID == "localhost" {
		rpID = "localhost"
		hasLocalhost := false
		for _, o := range origins {
			if strings.Contains(o, "localhost") {
				hasLocalhost = true
				break
			}
		}
		if !hasLocalhost {
			origins = append(origins, "http://localhost:5173", "http://localhost:5174")
		}
	}

	if len(origins) == 0 {
		origins = []string{"http://localhost:5173"}
	}

	wa, err := webauthn.New(&webauthn.Config{
		RPDisplayName: cfg.SiteName,
		RPID:          rpID,
		RPOrigins:     origins,
	})
	if err != nil {
		logger.Log.Fatal("WebAuthn 초기화 실패", zap.Error(err))
	}

	logger.Log.Info("WebAuthn 서비스 초기화",
		zap.String("rpID", rpID),
		zap.Strings("origins", origins),
	)

	return &WebAuthnService{
		db: db,
		wa: wa,
	}
}

// ════════════════════════════════════════════════════════════════
// Registration (등록)
// ════════════════════════════════════════════════════════════════

// BeginRegistration은 WebAuthn 자격 증명 등록을 시작합니다.
// 사용자의 기존 자격 증명을 제외(excludeCredentials)하여 중복 등록을 방지합니다.
func (s *WebAuthnService) BeginRegistration(userID int) (*protocol.CredentialCreation, error) {
	user, waUser, err := s.loadWebAuthnUser(userID)
	if err != nil {
		return nil, err
	}
	_ = user

	// 기존 자격 증명을 exclude 목록에 추가하여 중복 등록 방지
	excludeList := make([]protocol.CredentialDescriptor, len(waUser.credentials))
	for i, cred := range waUser.credentials {
		excludeList[i] = cred.Descriptor()
	}
	creation, session, err := s.wa.BeginRegistration(waUser,
		webauthn.WithExclusions(excludeList),
	)
	if err != nil {
		return nil, apperror.Internal("WebAuthn 등록 시작 실패", err)
	}

	s.sessions.Store(fmt.Sprintf(sessionKeyReg, userID), sessionEntry{
		data:      session,
		expiresAt: time.Now().Add(sessionTTL),
	})

	return creation, nil
}

// FinishRegistration은 클라이언트의 응답을 검증하여 WebAuthn 자격 증명을 최종 등록합니다.
func (s *WebAuthnService) FinishRegistration(userID int, credName string, ccr *protocol.ParsedCredentialCreationData) error {
	sessionKey := fmt.Sprintf(sessionKeyReg, userID)
	raw, ok := s.sessions.LoadAndDelete(sessionKey)
	if !ok {
		return apperror.Unauthorized("등록 세션이 만료되었거나 존재하지 않습니다")
	}
	entry := raw.(sessionEntry)
	if time.Now().After(entry.expiresAt) {
		return apperror.Unauthorized("등록 세션이 만료되었습니다")
	}

	_, waUser, err := s.loadWebAuthnUser(userID)
	if err != nil {
		return err
	}

	credential, err := s.wa.CreateCredential(waUser, *entry.data, ccr)
	if err != nil {
		return apperror.Internal("WebAuthn 자격 증명 생성 실패", err)
	}

	// Transport를 쉼표 구분 문자열로 변환
	var transports []string
	for _, t := range credential.Transport {
		transports = append(transports, string(t))
	}

	// AAGUID를 hex 문자열로 변환
	aaguid := fmt.Sprintf("%x", credential.Authenticator.AAGUID)

	// 자격 증명 이름이 비어 있으면 기본값 설정
	if credName == "" {
		credName = "Passkey"
	}

	dbCred := domain.WebAuthnCredential{
		UserID:          userID,
		CredentialID:    base64.RawURLEncoding.EncodeToString(credential.ID),
		PublicKey:       credential.PublicKey,
		AttestationType: credential.AttestationType,
		Transport:       strings.Join(transports, ","),
		SignCount:       credential.Authenticator.SignCount,
		AAGUID:          aaguid,
		Name:            credName,
	}

	if err := s.db.Create(&dbCred).Error; err != nil {
		return apperror.Internal("자격 증명 DB 저장 실패", err)
	}

	// 사용자의 WebAuthnEnabled 플래그 활성화
	s.db.Model(&domain.User{}).Where("Id = ?", userID).Update("WebAuthnEnabled", true)

	logger.Log.Info("WebAuthn 자격 증명 등록 완료",
		zap.Int("userID", userID),
		zap.String("credName", credName),
	)

	return nil
}

// ════════════════════════════════════════════════════════════════
// Authentication (인증)
// ════════════════════════════════════════════════════════════════

// BeginAuthentication은 WebAuthn 인증 챌린지를 생성합니다.
func (s *WebAuthnService) BeginAuthentication(userID int) (*protocol.CredentialAssertion, error) {
	_, waUser, err := s.loadWebAuthnUser(userID)
	if err != nil {
		return nil, err
	}

	if len(waUser.WebAuthnCredentials()) == 0 {
		return nil, apperror.NotFound("등록된 WebAuthn 자격 증명이 없습니다")
	}

	assertion, session, err := s.wa.BeginLogin(waUser)
	if err != nil {
		return nil, apperror.Internal("WebAuthn 인증 시작 실패", err)
	}

	s.sessions.Store(fmt.Sprintf(sessionKeyLogin, userID), sessionEntry{
		data:      session,
		expiresAt: time.Now().Add(sessionTTL),
	})

	return assertion, nil
}

// FinishAuthentication은 WebAuthn 인증 응답을 검증합니다.
func (s *WebAuthnService) FinishAuthentication(userID int, car *protocol.ParsedCredentialAssertionData) error {
	sessionKey := fmt.Sprintf(sessionKeyLogin, userID)
	raw, ok := s.sessions.LoadAndDelete(sessionKey)
	if !ok {
		return apperror.Unauthorized("인증 세션이 만료되었거나 존재하지 않습니다")
	}
	entry := raw.(sessionEntry)
	if time.Now().After(entry.expiresAt) {
		return apperror.Unauthorized("인증 세션이 만료되었습니다")
	}

	_, waUser, err := s.loadWebAuthnUser(userID)
	if err != nil {
		return err
	}

	credential, err := s.wa.ValidateLogin(waUser, *entry.data, car)
	if err != nil {
		return apperror.Unauthorized("WebAuthn 인증 실패")
	}

	// SignCount 및 LastUsedAt 업데이트
	credIDBase64 := base64.RawURLEncoding.EncodeToString(credential.ID)
	now := time.Now()
	s.db.Model(&domain.WebAuthnCredential{}).
		Where("CredentialId = ?", credIDBase64).
		Updates(map[string]any{
			"SignCount":  credential.Authenticator.SignCount,
			"LastUsedAt": now,
		})

	return nil
}

// ════════════════════════════════════════════════════════════════
// Credential Management (자격 증명 관리)
// ════════════════════════════════════════════════════════════════

// GetCredentials는 사용자의 모든 WebAuthn 자격 증명을 조회합니다.
func (s *WebAuthnService) GetCredentials(userID int) ([]domain.WebAuthnCredential, error) {
	var creds []domain.WebAuthnCredential
	if err := s.db.Where("UserId = ?", userID).Order("CreatedAt DESC").Find(&creds).Error; err != nil {
		return nil, err
	}
	return creds, nil
}

// DeleteCredential은 사용자의 특정 WebAuthn 자격 증명을 삭제합니다.
// 마지막 자격 증명이 삭제되면 사용자의 WebAuthnEnabled 플래그를 비활성화합니다.
func (s *WebAuthnService) DeleteCredential(userID int, credentialID int) error {
	result := s.db.Where("Id = ? AND UserId = ?", credentialID, userID).Delete(&domain.WebAuthnCredential{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return apperror.NotFound("자격 증명을 찾을 수 없습니다")
	}

	// 남아있는 자격 증명이 없으면 WebAuthnEnabled 비활성화
	var count int64
	s.db.Model(&domain.WebAuthnCredential{}).Where("UserId = ?", userID).Count(&count)
	if count == 0 {
		s.db.Model(&domain.User{}).Where("Id = ?", userID).Update("WebAuthnEnabled", false)
	}

	return nil
}

// RenameCredential은 사용자의 특정 WebAuthn 자격 증명의 이름을 변경합니다.
func (s *WebAuthnService) RenameCredential(userID, credentialID int, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return apperror.Validation("패스키 이름을 입력해주세요")
	}
	if len([]rune(name)) > 50 {
		return apperror.Validation("패스키 이름은 50자 이내로 입력해주세요")
	}
	result := s.db.Model(&domain.WebAuthnCredential{}).
		Where("Id = ? AND UserId = ?", credentialID, userID).
		Update("Name", name)
	if result.RowsAffected == 0 {
		return apperror.NotFound("패스키를 찾을 수 없습니다")
	}
	return result.Error
}

// HasCredentials는 사용자가 WebAuthn 자격 증명을 보유하고 있는지 확인합니다.
func (s *WebAuthnService) HasCredentials(userID int) bool {
	var count int64
	s.db.Model(&domain.WebAuthnCredential{}).Where("UserId = ?", userID).Count(&count)
	return count > 0
}

// IsWebAuthnGloballyEnabled는 SiteConfig에서 WEBAUTHN_ENABLED 설정을 확인합니다.
func (s *WebAuthnService) IsWebAuthnGloballyEnabled() bool {
	var cfg domain.SiteConfig
	if err := s.db.Where("[Key] = ?", "WEBAUTHN_ENABLED").First(&cfg).Error; err != nil {
		return false
	}
	return cfg.Value == "true"
}

// ════════════════════════════════════════════════════════════════
// Internal Helpers
// ════════════════════════════════════════════════════════════════

// loadWebAuthnUser는 사용자 정보와 자격 증명을 로드하여 webauthn.User 인터페이스를 구성합니다.
func (s *WebAuthnService) loadWebAuthnUser(userID int) (*domain.User, *webAuthnUser, error) {
	var user domain.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, nil, apperror.NotFound("사용자를 찾을 수 없습니다")
	}

	var dbCreds []domain.WebAuthnCredential
	s.db.Where("UserId = ?", userID).Find(&dbCreds)

	waCreds := make([]webauthn.Credential, 0, len(dbCreds))
	for _, dc := range dbCreds {
		credID, err := base64.RawURLEncoding.DecodeString(dc.CredentialID)
		if err != nil {
			logger.Log.Warn("자격 증명 ID 디코딩 실패", zap.Int("credID", dc.ID), zap.Error(err))
			continue
		}

		var transports []protocol.AuthenticatorTransport
		if dc.Transport != "" {
			for _, t := range strings.Split(dc.Transport, ",") {
				transports = append(transports, protocol.AuthenticatorTransport(strings.TrimSpace(t)))
			}
		}

		waCreds = append(waCreds, webauthn.Credential{
			ID:              credID,
			PublicKey:       dc.PublicKey,
			AttestationType: dc.AttestationType,
			Transport:       transports,
			Authenticator: webauthn.Authenticator{
				SignCount: dc.SignCount,
			},
		})
	}

	waUser := &webAuthnUser{
		user:        &user,
		credentials: waCreds,
	}

	return &user, waUser, nil
}

// extractDomain은 URL에서 호스트 이름(포트 제외)을 추출합니다.
func extractDomain(rawURL string) string {
	if rawURL == "" {
		return ""
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	host := u.Hostname()
	return host
}

// normalizeOrigin은 URL에서 scheme + host (포트 포함) 형태의 origin을 반환합니다.
func normalizeOrigin(rawURL string) string {
	if rawURL == "" {
		return ""
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	// scheme + host (Host에는 포트가 포함될 수 있음)
	origin := u.Scheme + "://" + u.Host
	return origin
}
