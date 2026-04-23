// Package middleware는 Gin 호환 미들웨어를 제공합니다.
// Security 미들웨어는 보안 헤더 설정, 봇 차단, 파라미터 오염 방지 등 다양한 보안 기능을 수행합니다.
package middleware

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"seedream-gift-server/internal/monitor"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/telegram"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ─────────────────────────────────────────────────────────────
// 1. HTTP 보안 헤더 (Helmet 동등)
// ─────────────────────────────────────────────────────────────

// SecurityHeaders는 helmet.js와 동일한 수준의 HTTP 보안 헤더를 설정합니다.
// apiDomain이 지정되면 CSP connect-src에 해당 도메인을 추가합니다.
func SecurityHeaders(apiDomain ...string) gin.HandlerFunc {
	isProduction := gin.Mode() == gin.ReleaseMode

	return func(c *gin.Context) {
		// === Helmet 기본 헤더 (항상 적용) ===
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-DNS-Prefetch-Control", "off")
		c.Header("X-Permitted-Cross-Domain-Policies", "none")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("X-XSS-Protection", "0") // 최신 helmet: 비활성화 (브라우저 자체 XSS 필터가 오히려 취약)
		c.Header("Cross-Origin-Opener-Policy", "same-origin")
		c.Header("Cross-Origin-Resource-Policy", "cross-origin")
		c.Header("Origin-Agent-Cluster", "?1")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)")

		// === 프로덕션 전용 ===
		if isProduction {
			// HSTS: 1년, 서브도메인 포함
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

			// CSP: CDN(Swagger UI) 허용, inline style 허용
			connectSrc := "'self' https://cdn.jsdelivr.net https://pf.kakao.com https://*.kakao.com"
			if len(apiDomain) > 0 && apiDomain[0] != "" {
				connectSrc += " " + apiDomain[0]
			}
			c.Header("Content-Security-Policy", strings.Join([]string{
				"default-src 'self'",
				"script-src 'self'",
				"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
				"img-src 'self' data:",
				"connect-src " + connectSrc,
				"font-src 'self' https://cdn.jsdelivr.net",
				"object-src 'none'",
				"frame-ancestors 'none'",
				"form-action 'self'",
				"base-uri 'self'",
			}, "; "))

			// COEP: 프로덕션에서만 (개발 중 외부 리소스 차단 방지)
			c.Header("Cross-Origin-Embedder-Policy", "require-corp")
		}

		c.Next()
	}
}

// NoCacheAPI는 API 응답이 프록시/브라우저에 캐시되지 않도록 헤더를 설정합니다.
// 인증 토큰, 사용자 정보 등 민감 데이터가 중간 캐시에 저장되는 것을 방지합니다.
func NoCacheAPI() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "private, no-store, no-cache, must-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Next()
	}
}

// ─────────────────────────────────────────────────────────────
// 2. 봇/스캐너 차단
// ─────────────────────────────────────────────────────────────

// allowedMethods는 서버가 처리하는 표준 HTTP 메서드 집합입니다.
var allowedMethods = map[string]bool{
	"GET": true, "POST": true, "PUT": true, "PATCH": true,
	"DELETE": true, "OPTIONS": true, "HEAD": true,
}

// botPatterns는 일반적인 취약점 스캔이나 악성 봇이 탐색하는 경로들을 정의하는 정규표현식입니다.
var botPatterns = regexp.MustCompile(`(?i)` + strings.Join([]string{
	`\.env($|\b|[./])`,
	`\.php($|\?)`,
	`\.git(/|$)`,
	`\.(htaccess|htpasswd|DS_Store)`,
	`/(backup|dump)\.(zip|tar|gz|sql)`,
	`/(aws-secret|credentials|config)\.(json|yml|yaml)`,
	`/(debug|info\.php|phpinfo|adminer|phpmyadmin)`,
	`/wp-(admin|login|content|includes)`,
	`/\.well-known/security\.txt`,
	`/cgi-bin/`,
	`/vendor/phpunit`,
	`/xmlrpc\.php`,
	`/eval-stdin\.php`,
	`/php-cgi`,
	`/shell`,
	`/actuator`,
}, "|"))

// BotBlocker는 비표준 HTTP 메서드 및 봇/스캐너의 경로 탐색 요청을 차단합니다.
// 반복 침해 시도 IP는 자동으로 블랙리스트에 등록됩니다 (5회 누적).
func BotBlocker() gin.HandlerFunc {
	return func(c *gin.Context) {
		// /webhook/seedream 는 §8.6.3 "never 4xx" 정책 — middleware 4xx 차단 무효화.
		// 웹훅 핸들러가 자체 1 MiB body cap + HMAC 검증 수행 (500 로 통일 반환).
		if c.Request.URL.Path == "/webhook/seedream" {
			c.Next()
			return
		}
		// 비표준 HTTP 메서드 차단 (PROPFIND, TRACE 등)
		if !allowedMethods[c.Request.Method] {
			monitor.RecordThreatStrike(c.ClientIP())
			c.AbortWithStatus(405)
			return
		}
		if botPatterns.MatchString(c.Request.URL.Path) {
			monitor.RecordThreatStrike(c.ClientIP())
			c.AbortWithStatus(404)
			return
		}
		c.Next()
	}
}

// HPPGuard는 HTTP 파라미터 오염(Parameter Pollution)을 방지하기 위해 중복 파라미터 중 마지막 값만 유지합니다.
func HPPGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Request.URL.Query()
		for key, values := range query {
			if len(values) > 1 {
				query.Set(key, values[len(values)-1])
			}
		}
		c.Request.URL.RawQuery = query.Encode()
		c.Next()
	}
}

// ─────────────────────────────────────────────────────────────
// 3. Trace ID
// ─────────────────────────────────────────────────────────────

// TraceID는 요청 추적을 위한 X-Trace-Id 헤더를 생성하거나 전파합니다.
func TraceID() gin.HandlerFunc {
	return func(c *gin.Context) {
		traceID := c.GetHeader("X-Trace-Id")
		if traceID == "" {
			traceID = uuid.New().String()
		}
		c.Set("traceId", traceID)
		c.Header("X-Trace-Id", traceID)
		c.Next()
	}
}

// ─────────────────────────────────────────────────────────────
// 4. 요청 본문 크기 제한
// ─────────────────────────────────────────────────────────────

// MaxBodySize는 요청 본문의 크기를 지정된 바이트 수로 제한합니다.
// H-9: MaxBytesReader를 ContentLength 검사보다 먼저 설정하여 청크 인코딩(chunked encoding)으로
// Content-Length 헤더가 없는(-1) 요청도 크기 제한이 반드시 적용되도록 합니다.
func MaxBodySize(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		// /webhook/seedream 는 §8.6.3 "never 4xx" 정책 — middleware 4xx 차단 무효화.
		// 웹훅 핸들러가 자체 1 MiB body cap + HMAC 검증 수행 (500 로 통일 반환).
		if c.Request.URL.Path == "/webhook/seedream" {
			c.Next()
			return
		}
		// 청크 요청 포함 모든 요청에 항상 MaxBytesReader 적용 (H-9 우회 방지)
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)

		// Content-Length가 명시된 경우 헤더 값으로 조기 거부 (빠른 경로)
		if c.Request.ContentLength > maxBytes {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
				"success": false,
				"error":   "요청 본문이 너무 큽니다",
			})
			return
		}
		c.Next()
	}
}

// ─────────────────────────────────────────────────────────────
// 5. 씨드림기프트 프로젝트 특화 — 로그인 브루트포스 방어
// ─────────────────────────────────────────────────────────────

var (
	loginMaxFailures   = 10
	loginBlockDuration = 15 * time.Minute
	txMaxPerMin        = 5
)

// ConfigureRateLimits는 브루트포스 방어 및 거래 제한에 사용될 파라미터를 설정합니다.
func ConfigureRateLimits(maxFailures int, blockDuration time.Duration, txMax int) {
	loginMaxFailures = maxFailures
	loginBlockDuration = blockDuration
	txMaxPerMin = txMax
}

// loginAttempt는 특정 IP의 로그인 실패 상태를 추적하기 위한 구조체입니다.
type loginAttempt struct {
	mu         sync.Mutex
	failures   int       // 연속 실패 횟수
	blockedAt  time.Time // 차단 시작 시간
	lastFailAt time.Time // 마지막 실패 시간
}

var (
	// loginAttempts는 IP를 키로 하여 로그인 시도 상태를 저장하는 동시성 안전 맵입니다.
	loginAttempts sync.Map // map[string]*loginAttempt (key = IP)
)

// RecordLoginFailure는 특정 IP의 로그인 실패 횟수를 증가시킵니다.
func RecordLoginFailure(ip string) {
	val, _ := loginAttempts.LoadOrStore(ip, &loginAttempt{})
	attempt := val.(*loginAttempt)
	attempt.mu.Lock()
	attempt.failures++
	attempt.lastFailAt = time.Now()
	if attempt.failures >= loginMaxFailures {
		attempt.blockedAt = time.Now()
		go telegram.NotifySecurity("로그인 차단", fmt.Sprintf("IP %s — %d회 실패", ip, loginMaxFailures), ip)
	}
	attempt.mu.Unlock()
}

// ResetLoginFailures는 로그인이 성공했을 때 해당 IP의 실패 횟수를 초기화합니다.
func ResetLoginFailures(ip string) {
	loginAttempts.Delete(ip)
}

// LoginBruteForceGuard는 로그인 실패 한도를 초과한 IP를 일시적으로 차단합니다.
// 1. IP별 실패 횟수를 추적하여 임계값(10회) 도달 시 차단합니다.
// 2. 차단 상태에서는 Retry-After 헤더를 통해 다음 시도 가능 시간을 안내합니다.
// 3. 차단 시간이 경과하면 자동으로 제한을 해제하고 기록을 정리(Garbage Collection)합니다.
func LoginBruteForceGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		val, ok := loginAttempts.Load(ip)
		if !ok {
			// 이전에 실패 기록이 없는 IP는 무사 통과
			c.Next()
			return
		}

		attempt := val.(*loginAttempt)
		attempt.mu.Lock()
		// 현재 시각을 기준으로 차단 여부 및 만료 여부 판단
		blocked := !attempt.blockedAt.IsZero() && time.Since(attempt.blockedAt) < loginBlockDuration
		expired := !attempt.blockedAt.IsZero() && time.Since(attempt.blockedAt) >= loginBlockDuration
		blockedAt := attempt.blockedAt
		lastFailAt := attempt.lastFailAt
		failures := attempt.failures
		attempt.mu.Unlock()

		if blocked {
			// 차단된 상태: 남은 대기 시간을 계산하여 헤더에 포함
			remaining := loginBlockDuration - time.Since(blockedAt)
			retryAfter := int(remaining.Seconds()) + 1
			c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
			c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", loginMaxFailures))
			c.Header("X-RateLimit-Remaining", "0")
			logger.Log.Warn("rate limit exceeded",
				zap.String("ip", ip),
				zap.String("path", c.Request.URL.Path),
				zap.String("method", c.Request.Method),
			)
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success":    false,
				"error":      "너무 많은 시도입니다. 잠시 후 다시 시도해주세요.",
				"retryAfter": retryAfter,
			})
			return
		}

		// 차단 시간 경과: 맵에서 해당 IP 정보를 삭제하여 메모리를 확보하고 다음 요청 허용
		if expired {
			loginAttempts.Delete(ip)
			c.Next()
			return
		}

		// 임계값에 도달하지 않았더라도 마지막 실패 후 일정 시간이 흐르면 기록 초기화
		if failures > 0 && time.Since(lastFailAt) > loginBlockDuration {
			loginAttempts.Delete(ip)
		}

		c.Next()
	}
}

// ─────────────────────────────────────────────────────────────
// 6. 씨드림기프트 특화 — 거래 속도 제한 (주문/매입/선물)
// ─────────────────────────────────────────────────────────────

type userRate struct {
	mu      sync.Mutex
	count   int
	resetAt time.Time
}

var (
	transactionRates sync.Map // map[int]*userRate (key = userID)
)

// TransactionThrottle은 사용자별 분당 거래(주문, 매입 등) 생성 횟수를 제한합니다.
func TransactionThrottle() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetInt("userId")
		if userID == 0 {
			c.Next()
			return
		}

		now := time.Now()
		val, _ := transactionRates.LoadOrStore(userID, &userRate{resetAt: now.Add(time.Minute)})
		rate := val.(*userRate)

		rate.mu.Lock()
		if now.After(rate.resetAt) {
			// Window expired: reset in place to avoid TOCTOU gap.
			rate.count = 1
			rate.resetAt = now.Add(time.Minute)
			rate.mu.Unlock()
			c.Next()
			return
		}
		rate.count++
		count := rate.count
		resetAt := rate.resetAt
		if count > txMaxPerMin {
			rate.mu.Unlock()
			retryAfter := int(time.Until(resetAt).Seconds()) + 1
			c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", txMaxPerMin))
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
			logger.Log.Warn("rate limit exceeded",
				zap.String("ip", c.ClientIP()),
				zap.String("path", c.Request.URL.Path),
				zap.String("method", c.Request.Method),
			)
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success":    false,
				"error":      "거래 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",
				"retryAfter": retryAfter,
			})
			return
		}
		rate.mu.Unlock()

		remaining := txMaxPerMin - count
		if remaining < 0 {
			remaining = 0
		}
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", txMaxPerMin))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
		c.Next()
	}
}

// ─────────────────────────────────────────────────────────────
// 7. 씨드림기프트 특화 — Swagger 프로덕션 차단
// ─────────────────────────────────────────────────────────────

// StartCleanupRoutine은 백그라운드에서 주기적으로 오래된 로그인 시도 및 거래 제한 기록을 삭제합니다.
func StartCleanupRoutine() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			now := time.Now()
			loginAttempts.Range(func(key, val any) bool {
				a := val.(*loginAttempt)
				a.mu.Lock()
				stale := a.lastFailAt.IsZero() || time.Since(a.lastFailAt) > loginBlockDuration*2
				a.mu.Unlock()
				if stale {
					loginAttempts.Delete(key)
				}
				return true
			})
			// 침해 시도 카운터 정리 (1시간 이상 지난 기록)
			monitor.CleanupThreatStrikes()

			transactionRates.Range(func(key, val any) bool {
				r := val.(*userRate)
				r.mu.Lock()
				stale := now.After(r.resetAt)
				r.mu.Unlock()
				if stale {
					transactionRates.Delete(key)
				}
				return true
			})
		}
	}()
}

// ─────────────────────────────────────────────────────────────
// 8. 범용 엔드포인트별 Per-IP Rate Limiter
// ─────────────────────────────────────────────────────────────

// endpointRateMaps는 EndpointRateLimit 호출별로 생성된 rates 맵을 공유 정리 루틴에 등록합니다.
// M-10: 호출마다 고루틴을 생성하는 대신 단일 공유 정리 고루틴을 사용합니다.
var (
	endpointRateMaps   []*sync.Map
	endpointRateMapsMu sync.Mutex
	endpointCleanOnce  sync.Once
)

// startEndpointCleanup은 엔드포인트 레이트 리미터용 공유 정리 고루틴을 단 한 번만 시작합니다.
// StartCleanupRoutine 패턴과 동일하게 ticker 기반으로 동작합니다.
func startEndpointCleanup() {
	endpointCleanOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				now := time.Now()
				endpointRateMapsMu.Lock()
				snapshot := make([]*sync.Map, len(endpointRateMaps))
				copy(snapshot, endpointRateMaps)
				endpointRateMapsMu.Unlock()

				for _, m := range snapshot {
					m.Range(func(key, value any) bool {
						r := value.(*endpointIPRate)
						r.mu.Lock()
						stale := now.After(r.resetAt)
						r.mu.Unlock()
						if stale {
							m.Delete(key)
						}
						return true
					})
				}
			}
		}()
	})
}

// endpointIPRate는 엔드포인트별 Per-IP 요청 카운터입니다.
type endpointIPRate struct {
	count   int
	resetAt time.Time
	mu      sync.Mutex
}

// EndpointRateLimit creates a per-IP rate limiter for specific endpoints.
// maxRequests: maximum requests allowed in the window.
// window: time window duration.
// M-10: 호출마다 정리 고루틴을 생성하지 않고 공유 단일 고루틴(startEndpointCleanup)을 사용합니다.
func EndpointRateLimit(maxRequests int, window time.Duration) gin.HandlerFunc {
	var rates sync.Map

	// 공유 정리 루틴 시작 (sync.Once로 한 번만 실행)
	startEndpointCleanup()

	// 이 인스턴스의 맵을 공유 레지스트리에 등록
	endpointRateMapsMu.Lock()
	endpointRateMaps = append(endpointRateMaps, &rates)
	endpointRateMapsMu.Unlock()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		val, _ := rates.LoadOrStore(ip, &endpointIPRate{resetAt: now.Add(window)})
		rate := val.(*endpointIPRate)

		rate.mu.Lock()
		if now.After(rate.resetAt) {
			rate.count = 1
			rate.resetAt = now.Add(window)
			rate.mu.Unlock()
			c.Next()
			return
		}
		rate.count++
		count := rate.count
		resetAt := rate.resetAt
		rate.mu.Unlock()

		if count > maxRequests {
			retryAfter := int(time.Until(resetAt).Seconds()) + 1
			c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
			logger.Log.Warn("rate limit exceeded",
				zap.String("ip", ip),
				zap.String("path", c.Request.URL.Path),
				zap.String("method", c.Request.Method),
			)
			if strings.Contains(c.Request.URL.Path, "/kyc") {
				go telegram.NotifySecurity("KYC Rate Limit", fmt.Sprintf("IP %s — %s", ip, c.Request.URL.Path), ip)
			}
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success":    false,
				"error":      "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
				"retryAfter": retryAfter,
			})
			return
		}
		c.Next()
	}
}

// ─────────────────────────────────────────────────────────────
// 9. 씨드림기프트 특화 — Swagger 프로덕션 차단
// ─────────────────────────────────────────────────────────────

// SwaggerProductionGuard는 프로덕션 모드에서 Swagger 문서(/docs)에 대한 접근을 차단합니다.
func SwaggerProductionGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		if gin.Mode() == gin.ReleaseMode {
			c.AbortWithStatus(404)
			return
		}
		c.Next()
	}
}
