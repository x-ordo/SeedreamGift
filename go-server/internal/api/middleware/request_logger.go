// Package middleware는 Gin 호환 미들웨어를 제공합니다.
// RequestLogger는 HTTP 요청의 상세 정보를 구조화된 로그로 기록합니다.
package middleware

import (
	"time"
	"seedream-gift-server/pkg/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// RequestLogger는 Gin의 기본 로거를 대체하며, Zap을 사용하여 구조화된 로그를 생성합니다.
// 1. 요청 시작 시간을 기록하여 응답 지연 시간(Latency)을 측정합니다.
// 2. HTTP 메서드, 경로, 상태 코드, 클라이언트 IP 등 주요 요청 지표를 수집합니다.
// 3. 보안 추적을 위한 TraceID와 인증된 사용자의 경우 UserID 정보를 로그 필드에 추가합니다.
// 4. 상태 코드에 따라 로그 레벨(Info, Warn, Error)을 자동으로 분류하여 기록합니다.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 요청 처리 시작 시각
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		// 다음 핸들러 실행 (실제 API 로직 수행)
		c.Next()

		// 요청 처리 후 메트릭 수집
		latency := time.Since(start)
		status := c.Writer.Status()
		clientIP := c.ClientIP()
		method := c.Request.Method
		userAgent := c.Request.UserAgent()
		bodySize := c.Writer.Size()
		traceID, _ := c.Get("traceId")

		// Zap 로거용 구조화된 필드 구성
		fields := []zap.Field{
			zap.String("method", method),
			zap.String("path", path),
			zap.Int("status", status),
			zap.Duration("latency", latency),
			zap.String("ip", clientIP),
			zap.String("ua", userAgent),
			zap.Int("bytes", bodySize),
		}

		// 조건부 필드 추가
		if query != "" {
			fields = append(fields, zap.String("query", query))
		}
		if traceID != nil {
			fields = append(fields, zap.String("traceId", traceID.(string)))
		}
		if userID := c.GetInt("userId"); userID > 0 {
			fields = append(fields, zap.Int("userId", userID))
		}
		if len(c.Errors) > 0 {
			// 비공개 에러 정보가 있을 경우 문자열로 합쳐서 로그에 포함
			fields = append(fields, zap.String("errors", c.Errors.ByType(gin.ErrorTypePrivate).String()))
		}

		// HTTP 상태 코드에 따른 로그 레벨 분류 전략
		switch {
		case status >= 500:
			// 서버 측 오류 (치명적)
			logger.Log.Error("HTTP", fields...)
		case status >= 400:
			// 클라이언트 측 오류 (경고)
			logger.Log.Warn("HTTP", fields...)
		default:
			// 정상 요청 (정보)
			logger.Log.Info("HTTP", fields...)
		}
	}
}
