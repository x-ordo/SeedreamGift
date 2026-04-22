package middleware

import (
	"strings"
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// IPWhitelistGuard checks whether the authenticated user's IP is in their whitelist.
// Must be placed AFTER JWTAuth middleware so that userId is available in context.
// Skips IP whitelist management endpoints so users can fix their settings if locked out.
func IPWhitelistGuard(svc *services.IPWhitelistService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip IP whitelist management endpoints — prevent lockout
		if strings.Contains(c.FullPath(), "/ip-whitelist") {
			c.Next()
			return
		}

		userID := c.GetInt("userId")
		if userID == 0 {
			c.Next()
			return
		}

		allowed, err := svc.IsIPAllowed(userID, c.ClientIP())
		if err != nil {
			c.Next()
			return
		}

		if !allowed {
			response.Forbidden(c, "현재 IP("+c.ClientIP()+")에서의 접근이 차단되어 있습니다. IP 화이트리스트를 확인해주세요.")
			c.Abort()
			return
		}

		c.Next()
	}
}
