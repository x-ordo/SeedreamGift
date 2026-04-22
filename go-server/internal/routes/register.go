package routes

import (
	"time"
	"seedream-gift-server/internal/api/middleware"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/config"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Register wires all route groups onto the given Gin engine.
// Each domain is registered by a dedicated function for easy navigation and modification.
func Register(api *gin.RouterGroup, cfg *config.Config, h *Handlers, db *gorm.DB) {
	RegisterAuthRoutes(api, cfg, h)
	RegisterPublicRoutes(api, cfg, h)
	RegisterProtectedRoutes(api, cfg, h, db)
	RegisterAdminRoutes(api, cfg, h)
	RegisterPartnerRoutes(api, cfg, h)
}

// IPWhitelistService returns the service instance for route-level middleware use.
func (h *Handlers) IPWhitelistService() *services.IPWhitelistService {
	return h.ipWhitelistSvc
}

// RegisterAuthRoutes sets up /auth/* endpoints (login, register, sessions, MFA).
func RegisterAuthRoutes(api *gin.RouterGroup, cfg *config.Config, h *Handlers) {
	auth := api.Group("/auth")
	{
		// Brute-force protected endpoints
		limited := auth.Group("")
		limited.Use(middleware.LoginBruteForceGuard())
		{
			limited.POST("/login", h.Auth.Login)
			limited.POST("/login/mfa", h.Auth.LoginMFA)
			limited.POST("/register", h.Auth.Register)
			limited.POST("/forgot-password", h.Auth.ForgotPassword)
			limited.POST("/reset-password", h.Auth.ResetPassword)
		}

		auth.POST("/refresh", middleware.EndpointRateLimit(20, time.Minute), h.Auth.Refresh)
		auth.POST("/logout", h.Auth.Logout)

		// Authenticated auth endpoints
		authed := auth.Group("")
		authed.Use(middleware.JWTAuth(cfg.JWTSecret))
		{
			authed.GET("/me", h.Auth.GetMe)
			authed.PATCH("/profile", h.Auth.UpdateProfile)
			authed.PATCH("/password", middleware.EndpointRateLimit(5, time.Minute), h.Auth.ChangePassword)

			// Sessions
			authed.GET("/sessions", h.Auth.GetSessions)
			authed.DELETE("/sessions", h.Auth.DeleteAllSessions)
			authed.DELETE("/sessions/:id", h.Auth.DeleteSession)

			// MFA
			mfa := authed.Group("/mfa")
			{
				mfa.POST("/setup", h.Auth.SetupMFA)
				mfa.POST("/verify", h.Auth.VerifyAndEnableMFA)
				mfa.GET("/status", h.Auth.GetMFAStatus)
				mfa.POST("/disable", h.Auth.DisableMFA)
			}

			// WebAuthn — authenticated credential management & registration
			waAuthed := authed.Group("/webauthn")
			{
				waAuthed.POST("/register/begin", h.WebAuthn.BeginRegistration)
				waAuthed.POST("/register/complete", h.WebAuthn.FinishRegistration)
				waAuthed.GET("/credentials", h.WebAuthn.ListCredentials)
				waAuthed.DELETE("/credentials/:id", h.WebAuthn.DeleteCredential)
				waAuthed.PATCH("/credentials/:id", h.WebAuthn.RenameCredential)
			}
		}

		// WebAuthn — public endpoints (패스키 직접 로그인 + OTP MFA)
		waPublic := auth.Group("/webauthn")
		waPublic.Use(middleware.LoginBruteForceGuard())
		{
			// 패스키 직접 로그인 (비밀번호 불필요, 2팩터 내장)
			waPublic.POST("/login/begin", h.WebAuthn.BeginAuthentication)
			waPublic.POST("/login/complete", h.WebAuthn.FinishAuthentication)
			// OTP MFA (비밀번호 로그인 후 2차 인증)
			waPublic.POST("/mfa/begin", h.WebAuthn.BeginMFAAuthentication)
			waPublic.POST("/mfa/complete", h.WebAuthn.FinishMFAAuthentication)
		}
	}
}
