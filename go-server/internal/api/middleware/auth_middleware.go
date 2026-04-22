/*
Package middleware는 고성능 Go 서버를 위한 Gin 호환 미들웨어를 제공합니다.
Auth 미들웨어는 인증 및 권한 부여를 처리하여 인증된 사용자만 보호된 엔드포인트에 접근할 수 있도록 보장합니다.

주요 역할:
- Authorization 헤더에서 JWT 토큰(Bearer 토큰)을 검증합니다.
- 사용자 식별 정보(ID, 이메일, 역할)를 추출하여 하위 핸들러가 사용할 수 있도록 Gin 컨텍스트에 설정합니다.
- 역할 기반 접근 제어(예: AdminOnly)를 통해 관리자 기능을 제한합니다.
- Windows 기반 Go 백엔드를 위한 견고한 보안 계층을 제공합니다.
*/
package middleware

import (
	"strings"
	"w-gift-server/pkg/jwt"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// JWTAuth는 지정된 비밀 키를 사용하여 JWT 토큰을 검증하는 미들웨어를 반환합니다.
func JWTAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "Authorization header is required")
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			response.Unauthorized(c, "Authorization header format must be Bearer {token}")
			c.Abort()
			return
		}

		claims, err := jwt.ValidateToken(parts[1], secret)
		if err != nil {
			response.Unauthorized(c, "Invalid or expired token")
			c.Abort()
			return
		}

		// MFA 중간 토큰(Purpose="mfa")은 보호된 엔드포인트에 사용할 수 없습니다.
		if claims.Purpose != "" {
			response.Unauthorized(c, "유효하지 않은 토큰입니다")
			c.Abort()
			return
		}

		// Store claims in context
		c.Set("userId", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)

		c.Next()
	}
}

// AdminOnly는 현재 사용자가 관리자 권한(ADMIN 역할)을 가지고 있는지 확인하는 미들웨어입니다.
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists || role != "ADMIN" {
			response.Forbidden(c, "Admin access required")
			c.Abort()
			return
		}
		c.Next()
	}
}

// UserOnly는 일반 사용자(USER) 또는 관리자(ADMIN)만 접근을 허용하고 파트너(PARTNER)는 차단하는 미들웨어입니다.
// 개인 구매, 매입, 선물 등 소비자 전용 기능에 적용합니다.
func UserOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			response.Forbidden(c, "권한 정보가 없습니다")
			c.Abort()
			return
		}
		roleStr, _ := role.(string)
		if roleStr == "PARTNER" {
			response.Forbidden(c, "파트너 계정으로는 이용할 수 없는 기능입니다")
			c.Abort()
			return
		}
		c.Next()
	}
}

// PartnerOnly는 현재 사용자가 파트너 또는 관리자 권한을 가지고 있는지 확인하는 미들웨어입니다.
func PartnerOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			response.Forbidden(c, "권한 정보가 없습니다")
			c.Abort()
			return
		}
		roleStr, _ := role.(string)
		if roleStr != "PARTNER" && roleStr != "ADMIN" {
			response.Forbidden(c, "파트너 권한이 필요합니다")
			c.Abort()
			return
		}
		c.Next()
	}
}
