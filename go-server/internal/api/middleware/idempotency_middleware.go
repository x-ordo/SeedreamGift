package middleware

import (
	"bytes"
	"io"
	"net/http"
	"time"
	"w-gift-server/internal/domain"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	idempotencyHeader = "Idempotency-Key"
	idempotencyTTL    = 24 * time.Hour
)

// IdempotencyMiddleware는 Idempotency-Key 헤더 기반 중복 요청 방지 미들웨어입니다.
// 동일한 키로 재요청 시 DB에 저장된 기존 응답을 즉시 반환합니다.
// TTL은 24시간이며, 만료된 키는 크론에서 정리됩니다.
func IdempotencyMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader(idempotencyHeader)
		if key == "" {
			c.Next()
			return
		}

		userID := c.GetInt("userId")

		// 1. 기존 기록 확인
		var existing domain.IdempotencyRecord
		if err := db.Where("IdempotencyKey = ? AND UserId = ? AND ExpiresAt > ?",
			key, userID, time.Now()).First(&existing).Error; err == nil {
			// 캐시 히트 — 기존 응답 반환
			c.Data(existing.StatusCode, "application/json", []byte(existing.Response))
			c.Abort()
			return
		}

		// 2. 응답 캡처를 위한 writer 래핑
		blw := &bodyLogWriter{body: bytes.NewBuffer(nil), ResponseWriter: c.Writer}
		c.Writer = blw

		c.Next()

		// 3. 응답 저장 (2xx 성공 응답만)
		if c.Writer.Status() >= 200 && c.Writer.Status() < 300 {
			record := domain.IdempotencyRecord{
				Key:        key,
				UserID:     userID,
				StatusCode: c.Writer.Status(),
				Response:   blw.body.String(),
				ExpiresAt:  time.Now().Add(idempotencyTTL),
			}
			db.Create(&record) // 저장 실패해도 요청 처리에 영향 없음
		}
	}
}

// bodyLogWriter는 gin.ResponseWriter를 래핑하여 응답 바디를 캡처합니다.
type bodyLogWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *bodyLogWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func (w *bodyLogWriter) WriteString(s string) (int, error) {
	w.body.WriteString(s)
	return io.WriteString(w.ResponseWriter, s)
}

func (w *bodyLogWriter) WriteHeader(code int) {
	w.ResponseWriter.WriteHeader(code)
}

func (w *bodyLogWriter) Status() int {
	return w.ResponseWriter.Status()
}

// CleanupExpiredKeys는 만료된 멱등성 키를 정리합니다.
// 크론에서 매일 호출됩니다.
func CleanupExpiredKeys(db *gorm.DB) {
	db.Where("ExpiresAt < ?", time.Now()).Delete(&domain.IdempotencyRecord{})
}

// ensure interface compliance
var _ http.ResponseWriter = (*bodyLogWriter)(nil)
