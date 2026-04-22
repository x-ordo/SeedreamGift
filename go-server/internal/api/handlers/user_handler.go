// Package handlers는 HTTP 요청 및 응답 처리 로직을 제공합니다.
// UserHandler는 회원 탈퇴와 같은 사용자 자가 서비스 기능을 처리합니다.
package handlers

import (
	"net/http"
	"w-gift-server/internal/app/services"
	"w-gift-server/internal/config"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// UserHandler는 사용자 관련 HTTP 요청을 처리하는 핸들러입니다.
type UserHandler struct {
	service *services.UserService
	cfg     *config.Config
}

// NewUserHandler는 새로운 UserHandler 인스턴스를 생성합니다.
func NewUserHandler(service *services.UserService, cfg *config.Config) *UserHandler {
	return &UserHandler{service: service, cfg: cfg}
}

// DeleteMe는 현재 로그인한 사용자의 탈퇴 요청을 처리합니다.
func (h *UserHandler) DeleteMe(c *gin.Context) {
	var req struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "password is required")
		return
	}
	userID := c.GetInt("userId")
	if err := h.service.SoftDelete(userID, req.Password); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// 탈퇴 후 refresh_token 쿠키 클리어
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		MaxAge:   0,
		Path:     "/",
		Domain:   h.cfg.CookieDomain,
		Secure:   h.cfg.CookieSecure,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
	response.Success(c, gin.H{"message": "회원 탈퇴가 완료되었습니다."})
}
