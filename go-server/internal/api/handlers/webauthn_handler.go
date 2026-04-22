// Package handlers는 WebAuthn(FIDO2/Passkey) 관련 HTTP 요청을 처리합니다.
// 자격 증명 등록, 인증, 관리를 위한 엔드포인트를 제공합니다.
package handlers

import (
	"net/http"
	"strconv"
	"w-gift-server/internal/app/services"
	"w-gift-server/internal/config"
	"w-gift-server/pkg/jwt"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/protocol"
)

// WebAuthnHandler는 WebAuthn 관련 HTTP 요청을 처리하는 핸들러입니다.
type WebAuthnHandler struct {
	service     *services.WebAuthnService
	authService *services.AuthService
	cfg         *config.Config
}

// NewWebAuthnHandler는 새로운 WebAuthnHandler 인스턴스를 생성합니다.
func NewWebAuthnHandler(service *services.WebAuthnService, authService *services.AuthService, cfg *config.Config) *WebAuthnHandler {
	return &WebAuthnHandler{
		service:     service,
		authService: authService,
		cfg:         cfg,
	}
}

// ════════════════════════════════════════════════════════════════
// Registration (등록) — JWT 인증 필요
// ════════════════════════════════════════════════════════════════

// BeginRegistration godoc
// @Summary WebAuthn 자격 증명 등록 시작
// @Tags WebAuthn
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /auth/webauthn/register/begin [post]
// BeginRegistration은 WebAuthn 자격 증명 등록을 위한 챌린지를 생성합니다.
func (h *WebAuthnHandler) BeginRegistration(c *gin.Context) {
	userID := c.GetInt("userId")

	creation, err := h.service.BeginRegistration(userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, creation)
}

// FinishRegistration godoc
// @Summary WebAuthn 자격 증명 등록 완료
// @Tags WebAuthn
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param name query string false "자격 증명 이름 (예: MacBook Pro)"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /auth/webauthn/register/complete [post]
// FinishRegistration은 클라이언트의 응답을 검증하여 자격 증명을 등록합니다.
func (h *WebAuthnHandler) FinishRegistration(c *gin.Context) {
	userID := c.GetInt("userId")

	// credential name은 query parameter로 전달 (body는 webauthn response 전체)
	credName := c.Query("name")
	if credName == "" {
		credName = "Passkey"
	}

	// Gin의 Request body를 go-webauthn의 protocol parser에 전달
	parsedResponse, err := protocol.ParseCredentialCreationResponseBody(c.Request.Body)
	if err != nil {
		response.BadRequest(c, "자격 증명 응답 파싱 실패: "+err.Error())
		return
	}

	if err := h.service.FinishRegistration(userID, credName, parsedResponse); err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "WebAuthn 자격 증명이 등록되었습니다"})
}

// ════════════════════════════════════════════════════════════════
// Authentication (인증) — 공개 엔드포인트 (로그인 시)
// ════════════════════════════════════════════════════════════════

// BeginAuthenticationRequest는 인증 시작 요청 구조체입니다.
type BeginAuthenticationRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// BeginAuthentication godoc
// @Summary WebAuthn 인증 시작 (로그인)
// @Tags WebAuthn
// @Accept json
// @Produce json
// @Param body body BeginAuthenticationRequest true "이메일 주소"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /auth/webauthn/login/begin [post]
// BeginAuthentication은 이메일로 사용자를 찾고 WebAuthn 인증 챌린지를 생성합니다.
func (h *WebAuthnHandler) BeginAuthentication(c *gin.Context) {
	var req BeginAuthenticationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "이메일을 입력해주세요")
		return
	}

	// 이메일로 사용자 ID 조회 (존재 여부 노출 방지를 위해 동일한 에러 메시지 사용)
	userID, err := h.findUserIDByEmail(req.Email)
	if err != nil {
		response.BadRequest(c, "WebAuthn 인증을 시작할 수 없습니다")
		return
	}

	assertion, err := h.service.BeginAuthentication(userID)
	if err != nil {
		response.BadRequest(c, "WebAuthn 인증을 시작할 수 없습니다")
		return
	}

	response.Success(c, assertion)
}

// FinishAuthentication godoc
// @Summary WebAuthn 인증 완료 (로그인)
// @Tags WebAuthn
// @Accept json
// @Produce json
// @Param email query string true "이메일 주소"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 401 {object} APIResponse
// @Router /auth/webauthn/login/complete [post]
// FinishAuthentication은 WebAuthn 인증을 완료하고 JWT 토큰을 발급합니다.
func (h *WebAuthnHandler) FinishAuthentication(c *gin.Context) {
	email := c.Query("email")
	if email == "" {
		response.BadRequest(c, "이메일이 필요합니다")
		return
	}

	userID, err := h.findUserIDByEmail(email)
	if err != nil {
		response.Unauthorized(c, "인증에 실패했습니다")
		return
	}

	// Gin의 Request body를 go-webauthn의 assertion parser에 전달
	parsedResponse, err := protocol.ParseCredentialRequestResponseBody(c.Request.Body)
	if err != nil {
		response.BadRequest(c, "인증 응답 파싱 실패: "+err.Error())
		return
	}

	if err := h.service.FinishAuthentication(userID, parsedResponse); err != nil {
		response.Unauthorized(c, "WebAuthn 인증에 실패했습니다")
		return
	}

	// WebAuthn 인증 성공 — 전체 세션 발급 (MFA 우회, 이미 하드웨어 인증 완료)
	userAgent := c.GetHeader("User-Agent")
	ipAddress := c.ClientIP()

	loginResp, rawRefreshToken, err := h.authService.IssueSessionForUser(userID, userAgent, ipAddress)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	// Refresh token cookie 설정
	h.setRefreshCookie(c, rawRefreshToken)
	response.Success(c, loginResp)
}

// ════════════════════════════════════════════════════════════════
// MFA 단계 WebAuthn 인증 (MFA 토큰 기반)
// ════════════════════════════════════════════════════════════════

// BeginMFAAuthentication godoc
// @Summary MFA 단계 WebAuthn 인증 시작
// @Tags WebAuthn
// @Accept json
// @Produce json
// @Param body body object true "MFA 토큰" SchemaExample({"mfa_token":"string"})
// @Success 200 {object} APIResponse
// @Failure 401 {object} APIResponse
// @Router /auth/webauthn/mfa/begin [post]
// BeginMFAAuthentication은 MFA 토큰으로 사용자를 식별한 후 WebAuthn 챌린지를 생성합니다.
func (h *WebAuthnHandler) BeginMFAAuthentication(c *gin.Context) {
	var req struct {
		MFAToken string `json:"mfa_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "MFA 토큰이 필요합니다")
		return
	}

	claims, err := jwt.ValidateToken(req.MFAToken, h.cfg.JWTSecret)
	if err != nil || claims.Purpose != "mfa" {
		response.Unauthorized(c, "유효하지 않거나 만료된 MFA 토큰입니다")
		return
	}

	assertion, err := h.service.BeginAuthentication(claims.UserID)
	if err != nil {
		response.BadRequest(c, "WebAuthn 인증을 시작할 수 없습니다")
		return
	}

	response.Success(c, assertion)
}

// FinishMFAAuthentication godoc
// @Summary MFA 단계 WebAuthn 인증 완료
// @Tags WebAuthn
// @Accept json
// @Produce json
// @Param mfa_token query string true "MFA 토큰"
// @Success 200 {object} APIResponse
// @Failure 401 {object} APIResponse
// @Router /auth/webauthn/mfa/complete [post]
// FinishMFAAuthentication은 MFA 토큰을 검증하고 WebAuthn 인증을 완료하여 세션을 발급합니다.
func (h *WebAuthnHandler) FinishMFAAuthentication(c *gin.Context) {
	mfaToken := c.Query("mfa_token")
	if mfaToken == "" {
		response.BadRequest(c, "MFA 토큰이 필요합니다")
		return
	}

	claims, err := jwt.ValidateToken(mfaToken, h.cfg.JWTSecret)
	if err != nil || claims.Purpose != "mfa" {
		response.Unauthorized(c, "유효하지 않거나 만료된 MFA 토큰입니다")
		return
	}

	parsedResponse, err := protocol.ParseCredentialRequestResponseBody(c.Request.Body)
	if err != nil {
		response.BadRequest(c, "인증 응답 파싱 실패: "+err.Error())
		return
	}

	if err := h.service.FinishAuthentication(claims.UserID, parsedResponse); err != nil {
		response.Unauthorized(c, "WebAuthn 인증에 실패했습니다")
		return
	}

	// 모든 검증 통과 후 MFA 토큰 소비 (리플레이 방지, 원자성 보장)
	if err := h.authService.ConsumeMFAToken(mfaToken); err != nil {
		response.Unauthorized(c, "이미 사용된 인증 토큰입니다")
		return
	}

	// 세션 발급
	userAgent := c.GetHeader("User-Agent")
	ipAddress := c.ClientIP()

	loginResp, rawRefreshToken, err := h.authService.IssueSessionForUser(claims.UserID, userAgent, ipAddress)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	h.setRefreshCookie(c, rawRefreshToken)
	response.Success(c, loginResp)
}

// ════════════════════════════════════════════════════════════════
// Credential Management (관리) — JWT 인증 필요
// ════════════════════════════════════════════════════════════════

// ListCredentials godoc
// @Summary WebAuthn 자격 증명 목록 조회
// @Tags WebAuthn
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Router /auth/webauthn/credentials [get]
// ListCredentials는 사용자의 등록된 WebAuthn 자격 증명 목록을 반환합니다.
func (h *WebAuthnHandler) ListCredentials(c *gin.Context) {
	userID := c.GetInt("userId")
	creds, err := h.service.GetCredentials(userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, creds)
}

// DeleteCredential godoc
// @Summary WebAuthn 자격 증명 삭제
// @Tags WebAuthn
// @Produce json
// @Security BearerAuth
// @Param id path int true "자격 증명 ID"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Router /auth/webauthn/credentials/{id} [delete]
// DeleteCredential은 특정 WebAuthn 자격 증명을 삭제합니다.
func (h *WebAuthnHandler) DeleteCredential(c *gin.Context) {
	userID := c.GetInt("userId")
	credID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 자격 증명 ID")
		return
	}

	if err := h.service.DeleteCredential(userID, credID); err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "자격 증명이 삭제되었습니다"})
}

// RenameCredential은 특정 WebAuthn 자격 증명의 이름을 변경합니다.
func (h *WebAuthnHandler) RenameCredential(c *gin.Context) {
	userID := c.GetInt("userId")
	credID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 ID입니다")
		return
	}
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "이름을 입력해주세요")
		return
	}
	if err := h.service.RenameCredential(userID, credID, req.Name); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "패스키 이름이 변경되었습니다"})
}

// ════════════════════════════════════════════════════════════════
// Internal Helpers
// ════════════════════════════════════════════════════════════════

// findUserIDByEmail은 이메일로 사용자 ID를 조회합니다.
func (h *WebAuthnHandler) findUserIDByEmail(email string) (int, error) {
	db := h.authService.GetDB()
	var result struct {
		ID int `gorm:"column:Id"`
	}
	if err := db.Table("Users").Select("Id").
		Where("Email = ? AND DeletedAt IS NULL", email).
		First(&result).Error; err != nil {
		return 0, err
	}
	return result.ID, nil
}

// setRefreshCookie는 HttpOnly refresh_token 쿠키를 설정합니다.
func (h *WebAuthnHandler) setRefreshCookie(c *gin.Context, token string) {
	maxAge := int(h.cfg.JWTRefreshExpiry.Seconds())
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    token,
		MaxAge:   maxAge,
		Path:     "/",
		Domain:   h.cfg.CookieDomain,
		Secure:   h.cfg.CookieSecure,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
}
