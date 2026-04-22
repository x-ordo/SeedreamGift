/*
Package handlers는 인증 및 권한 부여를 위한 HTTP 요청/응답 핸들링 로직을 제공합니다.
사용자 등록, 로그인, 프로필 조회 등 사용자 라이프사이클 이벤트를 관리합니다.

주요 역할:
- 사용자 인증(로그인) 및 등록(회원가입) 처리
- 보안 자격 증명 검증 및 JWT 기반 세션 상태 관리
- 사용자 프로필 정보에 대한 보안 액세스 제공
- 효율적인 자격 증명 확인 및 토큰 발행 보장
*/
package handlers

import (
	"net/http"
	"strconv"
	"w-gift-server/internal/api/middleware"
	"w-gift-server/internal/app/services"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/email"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/notification"
	"w-gift-server/pkg/response"
	"w-gift-server/pkg/telegram"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AuthHandler는 인증 관련 HTTP 요청을 처리하는 핸들러입니다.
type AuthHandler struct {
	service      *services.AuthService
	cfg          *config.Config
	emailService *email.Service
	notif        *notification.Service
}

// NewAuthHandler는 새로운 AuthHandler 인스턴스를 생성합니다.
func NewAuthHandler(service *services.AuthService, cfg *config.Config, emailSvc *email.Service, notifSvc *notification.Service) *AuthHandler {
	return &AuthHandler{
		service:      service,
		cfg:          cfg,
		emailService: emailSvc,
		notif:        notifSvc,
	}
}

// setRefreshCookie는 HttpOnly 속성의 refresh_token 쿠키를 설정합니다.
// maxAge를 0으로 설정하면 쿠키가 삭제됩니다.
// Path를 /api/v1/auth로 제한하여 다른 경로로의 자동 쿠키 전송을 차단합니다.
func (h *AuthHandler) setRefreshCookie(c *gin.Context, token string, maxAge int) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    token,
		MaxAge:   maxAge,
		Path:     "/api/v1/auth",
		Domain:   h.cfg.CookieDomain,
		Secure:   h.cfg.CookieSecure,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
}

// LoginRequest는 로그인 요청 시 사용되는 구조체입니다.
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
	Source   string `json:"source"` // "admin" 일 경우 ADMIN 역할 검증
}

// Login godoc
// @Summary 로그인
// @Tags Auth
// @Accept json
// @Produce json
// @Param body body LoginRequest true "로그인 정보"
// @Success 200 {object} APIResponse
// @Failure 401 {object} APIResponse
// @Router /auth/login [post]
// Login은 사용자의 자격 증명을 확인하고 액세스 토큰을 발급합니다.
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "요청 형식이 올바르지 않습니다")
		return
	}

	userAgent := c.GetHeader("User-Agent")
	ipAddress := c.ClientIP()

	res, rawRefreshToken, err := h.service.Login(req.Email, req.Password, userAgent, ipAddress)
	if err != nil {
		middleware.RecordLoginFailure(ipAddress)
		response.HandleError(c, err)
		return
	}
	middleware.ResetLoginFailures(ipAddress)

	// MFA step required — return the intermediate token without setting a cookie.
	if mfaResp, ok := res.(*services.MFARequiredResponse); ok {
		response.Success(c, mfaResp)
		return
	}

	// admin 소스에서 로그인 시 ADMIN 역할이 아니면 토큰 발급 거부
	if req.Source == "admin" {
		if loginRes, ok := res.(*services.LoginResponse); ok && loginRes.User.Role != "ADMIN" {
			response.Forbidden(c, "관리자 권한이 필요합니다")
			return
		}
	}

	refreshMaxAge := int(h.cfg.JWTRefreshExpiry.Seconds())
	h.setRefreshCookie(c, rawRefreshToken, refreshMaxAge)
	response.Success(c, res)
}

// LoginMFA godoc
// @Summary MFA 2단계 로그인
// @Tags Auth
// @Accept json
// @Produce json
// @Param body body object true "MFA 토큰 및 TOTP 코드" SchemaExample({"mfa_token":"string","code":"string"})
// @Success 200 {object} APIResponse
// @Failure 401 {object} APIResponse
// @Router /auth/login/mfa [post]
// LoginMFA는 MFA 2단계 인증을 처리합니다.
func (h *AuthHandler) LoginMFA(c *gin.Context) {
	var req struct {
		MFAToken string `json:"mfa_token" binding:"required"`
		Code     string `json:"code"      binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "mfa_token과 code가 필요합니다")
		return
	}

	userAgent := c.GetHeader("User-Agent")
	ipAddress := c.ClientIP()

	res, rawRefreshToken, err := h.service.LoginMFA(req.MFAToken, req.Code, userAgent, ipAddress)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	refreshMaxAge := int(h.cfg.JWTRefreshExpiry.Seconds())
	h.setRefreshCookie(c, rawRefreshToken, refreshMaxAge)
	response.Success(c, res)
}

// Register godoc
// @Summary 회원가입
// @Tags Auth
// @Accept json
// @Produce json
// @Param body body domain.User true "회원가입 정보"
// @Success 201 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 409 {object} APIResponse
// @Router /auth/register [post]
// RegisterRequest limits registration to email/password with optional bank data from KYC.
type RegisterRequest struct {
	Email         string  `json:"email" binding:"required"`
	Password      string  `json:"password" binding:"required,min=8"`
	Name          *string `json:"name"`
	Phone         *string `json:"phone"`
	BankName      *string `json:"bankName"`
	BankCode      *string `json:"bankCode"`
	AccountNumber *string `json:"accountNumber"`
	AccountHolder *string `json:"accountHolder"`
}

// Register는 새로운 사용자를 등록합니다.
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	user := domain.User{
		Email:    req.Email,
		Password: req.Password,
		Name:     req.Name,
		Phone:    req.Phone,
	}

	// 은행 정보가 포함된 경우 서비스에 전달하여 단일 트랜잭션으로 처리
	var bank *services.BankInfo
	if req.BankName != nil && req.AccountNumber != nil {
		bank = &services.BankInfo{
			BankName:      *req.BankName,
			BankCode:      req.BankCode,
			AccountNumber: *req.AccountNumber,
			AccountHolder: req.AccountHolder,
		}
	}

	if err := h.service.Register(&user, bank); err != nil {
		if ae, ok := apperror.As(err); ok {
			if ae.Code == apperror.CodeConflict {
				// 이메일 존재 여부를 정확히 노출하지 않되, 프론트엔드가 적절히 대응할 수 있도록 409 반환
				response.HandleError(c, apperror.Conflict("이미 가입된 이메일이거나 입력 정보를 확인해주세요"))
				return
			}
			response.HandleError(c, err)
			return
		}
		// DB duplicate constraint errors (non-AppError)
		logger.Log.Error("register failed", zap.Error(err), zap.String("handler", "Register"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}

	nameStr := "미입력"
	if req.Name != nil && *req.Name != "" {
		nameStr = *req.Name
	}
	go telegram.NotifyRegistration(req.Email, nameStr)

	// 환영 알림 (이메일 + 카카오)
	if h.notif != nil {
		phoneStr := ""
		if req.Phone != nil {
			phoneStr = *req.Phone
		}
		h.notif.Welcome(nameStr, req.Email, phoneStr)
	}

	response.Created(c, "회원가입이 완료되었습니다")
}

// GetMe godoc
// @Summary 내 정보 조회
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Router /auth/me [get]
// GetMe는 현재 로그인한 사용자의 정보를 조회합니다.
// 보안 내부 필드 노출을 막기 위해 UserResponse로 변환하여 반환합니다.
func (h *AuthHandler) GetMe(c *gin.Context) {
	userId := c.GetInt("userId")
	user, err := h.service.GetUserProfile(userId)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, user)
}

// Refresh godoc
// @Summary 토큰 갱신 (쿠키 기반)
// @Tags Auth
// @Produce json
// @Success 200 {object} APIResponse
// @Failure 401 {object} APIResponse
// @Router /auth/refresh [post]
// Refresh는 Refresh Token 쿠키를 사용하여 액세스 토큰을 갱신합니다.
func (h *AuthHandler) Refresh(c *gin.Context) {
	cookieToken, err := c.Cookie("refresh_token")
	if err != nil || cookieToken == "" {
		response.Unauthorized(c, "로그인 세션이 만료되었습니다. 다시 로그인해주세요")
		return
	}

	res, newRawRefreshToken, err := h.service.RefreshToken(cookieToken)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	refreshMaxAge := int(h.cfg.JWTRefreshExpiry.Seconds())
	h.setRefreshCookie(c, newRawRefreshToken, refreshMaxAge)
	response.Success(c, res)
}

// Logout godoc
// @Summary 로그아웃
// @Tags Auth
// @Produce json
// @Success 200 {object} APIResponse
// @Router /auth/logout [post]
// Logout은 현재 세션을 종료하고 토큰 쿠키를 삭제합니다.
func (h *AuthHandler) Logout(c *gin.Context) {
	cookieToken, err := c.Cookie("refresh_token")
	if err == nil && cookieToken != "" {
		_ = h.service.Logout(cookieToken) // best-effort DB cleanup
	}

	h.setRefreshCookie(c, "", 0) // clear cookie
	response.Success(c, gin.H{"message": "로그아웃되었습니다"})
}

// ChangePassword godoc
// @Summary 비밀번호 변경
// @Tags Auth
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body object true "기존/새 비밀번호" SchemaExample({"oldPassword":"string","newPassword":"string"})
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /auth/password [patch]
// ChangePassword는 사용자의 비밀번호를 변경합니다.
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var req struct {
		OldPassword string `json:"oldPassword" binding:"required"`
		NewPassword string `json:"newPassword" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "비밀번호 변경 요청이 올바르지 않습니다")
		return
	}

	userId := c.GetInt("userId")
	if err := h.service.ChangePassword(userId, req.OldPassword, req.NewPassword); err != nil {
		response.HandleError(c, err)
		return
	}

	// 비밀번호 변경 시 현재 세션의 refresh_token 쿠키도 클리어 (전 세션 강제 로그아웃)
	h.setRefreshCookie(c, "", 0)
	response.Success(c, gin.H{"message": "비밀번호가 변경되었습니다"})
}

// UpdateProfile godoc
// @Summary 프로필 수정
// @Tags Auth
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body object true "수정할 프로필 필드 (key-value)"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 409 {object} APIResponse
// @Router /auth/profile [patch]
// UpdateProfileRequest는 프로필 수정 시 허용되는 필드를 타입 안전하게 정의합니다.
type UpdateProfileRequest struct {
	Name              *string `json:"name"`
	Email             *string `json:"email"`
	Phone             *string `json:"phone"`
	ZipCode           *string `json:"zipCode"`
	Address           *string `json:"address"`
	AddressDetail     *string `json:"addressDetail"`
	EmailNotification *bool   `json:"emailNotification"`
	PushNotification  *bool   `json:"pushNotification"`
}

// ToMap은 nil이 아닌 필드만 서비스 레이어가 기대하는 map으로 변환합니다.
func (r *UpdateProfileRequest) ToMap() map[string]any {
	m := make(map[string]any)
	if r.Name != nil {
		m["name"] = *r.Name
	}
	if r.Email != nil {
		m["email"] = *r.Email
	}
	if r.Phone != nil {
		m["phone"] = *r.Phone
	}
	if r.ZipCode != nil {
		m["zipCode"] = *r.ZipCode
	}
	if r.Address != nil {
		m["address"] = *r.Address
	}
	if r.AddressDetail != nil {
		m["addressDetail"] = *r.AddressDetail
	}
	if r.EmailNotification != nil {
		m["emailNotification"] = *r.EmailNotification
	}
	if r.PushNotification != nil {
		m["pushNotification"] = *r.PushNotification
	}
	return m
}

// UpdateProfile은 사용자의 프로필 정보를 업데이트합니다.
func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "요청 형식이 올바르지 않습니다")
		return
	}
	userID := c.GetInt("userId")
	user, err := h.service.UpdateProfile(userID, req.ToMap())
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, user)
}

// ForgotPassword godoc
// @Summary 비밀번호 재설정 토큰 발급
// @Tags Auth
// @Accept json
// @Produce json
// @Param body body object true "이메일 주소" SchemaExample({"email":"user@example.com"})
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /auth/forgot-password [post]
// ForgotPassword는 비밀번호 재설정을 위한 임시 토큰을 생성합니다.
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "이메일을 입력해주세요")
		return
	}
	// Fire and forget — don't reveal whether email exists
	go func() {
		token, err := h.service.ForgotPassword(req.Email)
		if err != nil || token == "" || h.emailService == nil {
			return
		}
		if sendErr := h.emailService.SendPasswordReset(req.Email, token, h.cfg.FrontendUrl); sendErr != nil {
			logger.Log.Error("비밀번호 재설정 이메일 발송 실패", zap.String("email", req.Email), zap.Error(sendErr))
		}
	}()
	response.Success(c, gin.H{"message": "등록된 이메일이라면 비밀번호 재설정 링크가 발송됩니다"})
}

// ResetPassword godoc
// @Summary 비밀번호 재설정
// @Tags Auth
// @Accept json
// @Produce json
// @Param body body object true "이메일, 재설정 토큰, 새 비밀번호" SchemaExample({"email":"user@example.com","token":"string","newPassword":"string"})
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /auth/reset-password [post]
// ResetPassword는 발급된 토큰을 확인하고 사용자의 비밀번호를 재설정합니다.
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Email       string `json:"email" binding:"required,email"`
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"newPassword" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "비밀번호 재설정 요청이 올바르지 않습니다")
		return
	}

	if err := h.service.ResetPassword(req.Email, req.Token, req.NewPassword); err != nil {
		response.HandleError(c, err)
		return
	}

	// 비밀번호 변경 완료 확인 이메일 발송 (비동기)
	if h.emailService != nil {
		go func() {
			body := "비밀번호가 정상적으로 변경되었습니다.<br>본인이 변경하지 않으셨다면 즉시 고객센터(02-569-7334)로 연락해주세요."
			if sendErr := h.emailService.Send(req.Email, h.emailService.Prefix()+"비밀번호 변경 완료", email.WrapLayout("비밀번호가 변경되었습니다", body)); sendErr != nil {
				logger.Log.Error("비밀번호 변경 확인 이메일 발송 실패", zap.String("email", req.Email), zap.Error(sendErr))
			}
		}()
	}

	// 비밀번호 재설정 후 혹시 남아있을 수 있는 refresh_token 쿠키 클리어
	h.setRefreshCookie(c, "", 0)
	response.Success(c, gin.H{"message": "비밀번호가 재설정되었습니다"})
}

// SetupMFA godoc
// @Summary MFA 설정 (QR 코드 생성)
// @Tags MFA
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /auth/mfa/setup [post]
// SetupMFA는 MFA 설정을 위한 시크릿 키와 QR 코드 URL을 생성합니다.
// 보안: 토큰 탈취 시 공격자의 MFA 장악을 방지하기 위해 현재 비밀번호 재확인을 요구합니다.
func (h *AuthHandler) SetupMFA(c *gin.Context) {
	var req struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "비밀번호를 입력해주세요")
		return
	}

	uid := c.GetInt("userId")
	// 비밀번호 재확인
	if err := h.service.VerifyPassword(uid, req.Password); err != nil {
		response.Unauthorized(c, "비밀번호가 올바르지 않습니다")
		return
	}

	email := c.GetString("email")
	sec, url, err := h.service.SetupMFA(uid, email)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"secret": sec, "qrUrl": url})
}

// VerifyAndEnableMFA godoc
// @Summary MFA 활성화 (TOTP 코드 검증)
// @Tags MFA
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body object true "TOTP 코드" SchemaExample({"code":"123456"})
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /auth/mfa/verify [post]
// VerifyAndEnableMFA는 TOTP 코드를 검증하고 사용자의 MFA를 활성화합니다.
func (h *AuthHandler) VerifyAndEnableMFA(c *gin.Context) {
	var body struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "인증 코드를 입력해주세요")
		return
	}
	if err := h.service.VerifyAndEnableMFA(c.GetInt("userId"), body.Code); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "이중 인증이 활성화되었습니다"})
}

// GetMFAStatus godoc
// @Summary MFA 활성화 상태 조회
// @Tags MFA
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Router /auth/mfa/status [get]
// GetMFAStatus는 현재 사용자의 MFA 활성화 상태를 조회합니다.
func (h *AuthHandler) GetMFAStatus(c *gin.Context) {
	userID := c.GetInt("userId")
	enabled, err := h.service.GetMFAStatus(userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"mfa_enabled": enabled})
}

// DisableMFA godoc
// @Summary MFA 비활성화
// @Tags MFA
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body object true "현재 TOTP 코드" SchemaExample({"code":"123456"})
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /auth/mfa/disable [post]
// DisableMFA는 TOTP 코드 확인 후 사용자의 MFA를 비활성화합니다.
func (h *AuthHandler) DisableMFA(c *gin.Context) {
	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "인증 코드를 입력해주세요")
		return
	}
	userID := c.GetInt("userId")
	if err := h.service.DisableMFA(userID, req.Code); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "이중 인증이 비활성화되었습니다"})
}

// GetSessions godoc
// @Summary 활성 세션 목록 조회
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /auth/sessions [get]
// GetSessions는 사용자의 모든 활성 세션(리프레시 토큰) 목록을 조회합니다.
func (h *AuthHandler) GetSessions(c *gin.Context) {
	userID := c.GetInt("userId")
	sessions, err := h.service.GetSessions(userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, sessions)
}

// DeleteAllSessions godoc
// @Summary 다른 모든 세션 삭제
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /auth/sessions [delete]
// DeleteAllSessions는 현재 사용 중인 세션을 제외한 모든 다른 세션을 강제 종료합니다.
func (h *AuthHandler) DeleteAllSessions(c *gin.Context) {
	userID := c.GetInt("userId")
	currentToken, _ := c.Cookie("refresh_token") // may be empty in API-key flows
	if err := h.service.DeleteOtherSessions(userID, currentToken); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "다른 모든 세션이 종료되었습니다"})
}

// DeleteSession godoc
// @Summary 특정 세션 삭제
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Param id path int true "세션 ID"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /auth/sessions/{id} [delete]
// DeleteSession은 특정 ID의 세션을 강제 종료합니다.
func (h *AuthHandler) DeleteSession(c *gin.Context) {
	userID := c.GetInt("userId")
	sessionID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "올바르지 않은 세션 ID입니다")
		return
	}
	if err := h.service.DeleteSession(userID, sessionID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "세션이 종료되었습니다"})
}
