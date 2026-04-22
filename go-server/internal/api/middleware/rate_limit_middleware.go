// Package middleware는 Gin 호환 미들웨어를 제공합니다.
// Rate Limiter 미들웨어는 클라이언트당 요청 수를 제한하여 시스템 남용을 방지합니다.
package middleware

import (
	"net/http"
	"w-gift-server/internal/monitor"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/ulule/limiter/v3"
	mgin "github.com/ulule/limiter/v3/drivers/middleware/gin"
	"github.com/ulule/limiter/v3/drivers/store/memory"
	"go.uber.org/zap"
)

// IPBlacklist는 차단된 IP 목록에 포함된 클라이언트의 요청을 거부합니다.
// 1. monitor 패키지를 통해 메모리에 저장된 블랙리스트 IP 정보를 조회합니다.
// 2. 일치할 경우 403 Forbidden 응답과 함께 요청 처리를 즉시 중단(Abort)합니다.
func IPBlacklist() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 클라이언트의 실제 IP가 블랙리스트에 있는지 실시간 확인
		if monitor.IsIPBlacklisted(c.ClientIP()) {
			response.Forbidden(c, "access denied")
			c.Abort() // 이후 핸들러 체인 실행 방지
			return
		}
		c.Next()
	}
}

// RateLimiter는 지정된 속도(예: "100-M", 분당 100회)에 따라 클라이언트당 요청 수를 제한합니다.
// 1. 형식화된 문자열을 파싱하여 속도 제한 규칙을 생성합니다.
// 2. 인메모리 저장소(Memory Store)를 사용하여 클라이언트별 카운터를 유지합니다.
// 3. 한도 초과 시 429 Too Many Requests 응답을 반환합니다.
func RateLimiter(rate string) gin.HandlerFunc {
	// 제한 정책 파싱 (예: "100-M" -> 분당 100회)
	formattedRate, err := limiter.NewRateFromFormatted(rate)
	if err != nil {
		logger.Log.Fatal("invalid rate limiter config", zap.String("rate", rate), zap.Error(err))
	}

	// 저장소 초기화: 분산 환경이 아닌 단일 서버의 경우 고성능 인메모리 저장소를 사용합니다.
	store := memory.NewStore()
	instance := limiter.New(store, formattedRate)

	// Gin 미들웨어 생성: 한도 도달 시 커스텀 핸들러를 통해 일관된 에러 형식을 반환합니다.
	return mgin.NewMiddleware(instance, mgin.WithLimitReachedHandler(func(c *gin.Context) {
		response.Error(c, http.StatusTooManyRequests, "Too many requests, please try again later.")
	}))
}
