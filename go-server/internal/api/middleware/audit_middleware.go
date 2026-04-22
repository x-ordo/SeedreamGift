// Package middleware는 Gin 호환 미들웨어를 제공합니다.
// Audit 미들웨어는 개인정보 보호 및 규정 준수를 위해 시스템의 주요 변경 사항과 민감한 데이터 조회를 기록합니다.
package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strings"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// sensitiveFields는 로그 기록 시 마스킹 처리할 민감한 필드 이름 목록입니다.
var sensitiveFields = []string{
	"password", "pinCode", "pin", "accountNumber", "accountNum", "bankAccount",
	"cardNumber", "cvv", "token", "refreshToken", "accessToken", "secret",
	"apiKey", "securityCode", "giftNumber", "encryptionKey",
}

// sensitiveFieldPatterns는 sanitizeBody에서 JSON 문자열 내 민감 필드를 교체하기 위해
// 패키지 초기화 시 한 번만 컴파일되는 정규표현식 패턴 목록입니다.
var sensitiveFieldPatterns []*regexp.Regexp

func init() {
	fields := []string{"password", "token", "pinCode", "accountNumber", "securityCode", "mfa_token", "totpSecret"}
	for _, field := range fields {
		sensitiveFieldPatterns = append(sensitiveFieldPatterns,
			regexp.MustCompile(`"`+field+`"\s*:\s*"[^"]*"`))
	}
}

// sensitiveGetPatterns는 민감한 정보를 반환하여 조회가 기록되어야 하는 GET 엔드포인트 패턴 목록입니다.
var sensitiveGetPatterns = []*regexp.Regexp{
	regexp.MustCompile(`^/api/admin/users/\d+$`),
	regexp.MustCompile(`^/api/admin/vouchers/\d+$`),
	regexp.MustCompile(`^/api/admin/trade-ins/\d+$`),
}

// auditSem은 동시 감사 로그 고루틴의 수를 제한하는 세마포어입니다.
// 트래픽 폭증 시 고루틴 폭발을 방지합니다.
var auditSem = make(chan struct{}, 50)

// AuditMiddleware는 POST, PATCH, DELETE, PUT과 같은 변경 요청 및 민감한 GET 요청을 기록하는 미들웨어입니다.
// 1. 요청의 메서드와 URL을 확인하여 감사 기록 대상인지 판단합니다.
// 2. 변경 요청(Mutating)인 경우, 요청 바디를 캡처하되 민감 정보는 마스킹 처리합니다.
// 3. 메인 요청 처리에 지연이 없도록 로그 기록 작업은 별도의 고루틴(Async)에서 처리합니다.
// 4. 동시 고루틴 수는 50개로 제한되며, 한도 초과 시 해당 감사 로그는 건너뜁니다.
func AuditMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		method := c.Request.Method
		url := c.Request.URL.Path

		// 로그 기록 여부 판단: 데이터 변경 작업 또는 사전에 정의된 민감한 조회 패턴 확인
		isMutating := method == "POST" || method == "PATCH" || method == "DELETE" || method == "PUT"
		isSensitiveGet := false
		if method == "GET" {
			for _, pattern := range sensitiveGetPatterns {
				if pattern.MatchString(url) {
					isSensitiveGet = true
					break
				}
			}
		}

		// 대상이 아니면 즉시 다음 핸들러로 넘김
		if !isMutating && !isSensitiveGet {
			c.Next()
			return
		}

		// 요청 바디 캡처: 나중에 비동기 로그에서 사용할 수 있도록 스트림을 복사해 둡니다.
		// Content-Length가 4KB를 초과하는 경우(파일 업로드, 대량 임포트 등) 바디 읽기를 건너뜁니다.
		// 이렇게 하면 핸들러가 읽을 전체 바디를 보존하면서 감사 로그의 메모리 할당을 제한합니다.
		const auditBodyLimit = 4096
		var bodyBytes []byte
		if isMutating && c.Request.Body != nil {
			if c.Request.ContentLength < 0 || c.Request.ContentLength <= auditBodyLimit {
				// 크기를 알 수 없거나 제한 이내인 경우에만 읽기 수행
				bodyBytes, _ = io.ReadAll(c.Request.Body)
				// ReadAll 이후에 Body 스트림이 닫히거나 비워지므로, 다시 채워 넣어야 핸들러에서 읽을 수 있습니다.
				c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			}
			// ContentLength > auditBodyLimit인 경우: bodyBytes는 nil로 유지하고 Body는 그대로 둡니다.
			// 핸들러는 스트림을 정상적으로 읽을 수 있으며, 감사 로그에는 바디가 기록되지 않습니다.
		}

		// 다음 핸들러 실행 (비즈니스 로직 수행)
		c.Next()

		// 요청 처리 완료 후 비동기로 감사 로그 저장
		// 세마포어가 가득 찬 경우 해당 감사 로그는 건너뛰어 고루틴 폭발을 방지합니다.
		select {
		case auditSem <- struct{}{}:
		default:
			logger.Log.Warn("audit goroutine limit reached, skipping audit log",
				zap.String("method", method),
				zap.String("url", url),
			)
			return
		}
		go func(m string, u string, b []byte, status int, mutating bool, ctx *gin.Context) {
			defer func() { <-auditSem }()
			defer func() {
				// 고루틴 내 패닉 발생 시 서버 중단을 방지하기 위한 복구 로직
				if r := recover(); r != nil {
					logger.Log.Error("audit middleware goroutine panic",
						zap.Any("recover", r),
						zap.String("method", m),
						zap.String("url", u),
					)
				}
			}()

			// 컨텍스트에서 사용자 ID 추출 (인증된 요청인 경우)
			userIDVal, _ := ctx.Get("userId")
			var userID *int
			if id, ok := userIDVal.(int); ok {
				userID = &id
			}

			ip := ctx.ClientIP()
			userAgent := ctx.GetHeader("User-Agent")

			// 저장할 값 결정: 단순 조회인 경우 표시만 하고, 변경인 경우 바디를 마스킹하여 저장
			newValue := `{"_type": "SENSITIVE_READ"}`
			if mutating {
				newValue = sanitizeBody(b)
			}

			// URL 구조 분석을 통한 리소스 및 식별자 추출
			resource := extractResource(u)
			resourceID := extractResourceID(u)

			auditLog := domain.AuditLog{
				UserID:     userID,
				Action:     m + " " + u,
				Resource:   resource,
				ResourceID: resourceID,
				Method:     &m,
				StatusCode: &status,
				NewValue:   &newValue,
				IP:         &ip,
				UserAgent:  &userAgent,
			}

			// DB에 감사 로그 삽입
			if err := db.Create(&auditLog).Error; err != nil {
				logger.Log.Error("audit log insert failed",
					zap.Error(err),
					zap.String("action", auditLog.Action),
				)
			}
		}(method, url, bodyBytes, c.Writer.Status(), isMutating, c.Copy())
	}
}

// sanitizeMap은 맵 구조를 재귀적으로 탐색하며 민감한 필드(비밀번호, 핀코드 등)를 마스킹 처리합니다.
func sanitizeMap(m map[string]any) map[string]any {
	result := make(map[string]any)
	for k, v := range m {
		lowerK := strings.ToLower(k)
		isSensitive := false
		// sensitiveFields 목록에 포함된 키워드가 컬럼명에 있는지 확인
		for _, sf := range sensitiveFields {
			if strings.Contains(lowerK, strings.ToLower(sf)) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			// 민감 데이터: 실제 값을 [MASKED:길이] 형태의 문자열로 대체하여 노출 방지
			valStr := ""
			if s, ok := v.(string); ok {
				valStr = s
			} else {
				b, _ := json.Marshal(v)
				valStr = string(b)
			}
			result[k] = fmt.Sprintf("[MASKED:%d chars]", len(valStr))
		} else if nestedMap, ok := v.(map[string]any); ok {
			// 중첩된 맵 구조: 재귀 호출을 통해 내부까지 마스킹
			result[k] = sanitizeMap(nestedMap)
		} else if nestedSlice, ok := v.([]any); ok {
			// 슬라이스 구조: 각 요소를 순회하며 맵인 경우 마스킹 적용
			sanitizedSlice := make([]any, len(nestedSlice))
			for i, sv := range nestedSlice {
				if sm, ok := sv.(map[string]any); ok {
					sanitizedSlice[i] = sanitizeMap(sm)
				} else {
					sanitizedSlice[i] = sv
				}
			}
			result[k] = sanitizedSlice
		} else {
			// 일반 데이터: 그대로 유지
			result[k] = v
		}
	}
	return result
}

// sanitizeBody masks sensitive fields (password, token, pinCode, accountNumber, etc.) in request body for audit logging.
// It uses pre-compiled package-level patterns to avoid per-request regexp compilation overhead.
func sanitizeBody(body []byte) string {
	s := string(body)
	fields := []string{"password", "token", "pinCode", "accountNumber", "securityCode", "mfa_token", "totpSecret"}
	for i, re := range sensitiveFieldPatterns {
		s = re.ReplaceAllString(s, `"`+fields[i]+`":"***"`)
	}
	if len(s) > 2000 {
		s = s[:2000] + "...(truncated)"
	}
	return s
}

// extractResource returns the resource name from a URL like /api/v1/orders/123.
func extractResource(url string) string {
	parts := strings.Split(strings.TrimPrefix(url, "/"), "/")
	// parts: [api, v1, orders, 123] → resource = "orders"
	if len(parts) > 2 {
		return parts[2]
	}
	return "unknown"
}

// extractResourceID returns the resource ID from a URL like /api/v1/orders/123.
func extractResourceID(url string) *string {
	parts := strings.Split(strings.TrimPrefix(url, "/"), "/")
	if len(parts) > 3 {
		return &parts[3]
	}
	return nil
}
