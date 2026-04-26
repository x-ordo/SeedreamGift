// Package response는 표준화된 HTTP 응답 구조와 유틸리티 함수를 제공합니다.
// 모든 API 엔드포인트가 클라이언트에 일관된 JSON 페이로드를 전달하도록 보장합니다.
package response

import (
	"fmt"
	"net/http"
	"time"

	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/telegram"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// telegramToken과 telegramChatID는 텔레그램 알림을 위한 인증 정보를 담습니다.
var (
	telegramToken  string
	telegramChatID string
)

// SetTelegramConfig는 5xx 에러 발생 시 알림을 보낼 텔레그램 봇 설정을 저장합니다.
func SetTelegramConfig(token, chatID string) {
	telegramToken = token
	telegramChatID = chatID
}

// Response는 API 응답의 표준 구조를 정의합니다.
type Response struct {
	// Success는 요청의 성공 여부를 나타냅니다.
	Success bool `json:"success"`
	// Data는 요청에 대한 결과 데이터를 담습니다.
	Data any `json:"data,omitempty"`
	// Message는 추가적인 정보 메시지를 담습니다.
	Message string `json:"message,omitempty"`
	// Error는 에러 발생 시 에러 메시지를 담습니다.
	Error string `json:"error,omitempty"`
	// ErrorID는 에러 추적을 위한 고유 식별자입니다.
	ErrorID string `json:"errorId,omitempty"`
	// ValidationErrors는 필드별 검증 에러를 담습니다.
	ValidationErrors map[string]string `json:"validationErrors,omitempty"`
}

// Success는 HTTP 200 OK 응답을 반환합니다.
func Success(c *gin.Context, data any) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

// Created는 HTTP 201 Created 응답을 반환합니다.
func Created(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, Response{
		Success: true,
		Data:    data,
	})
}

// Error는 지정된 상태 코드와 메시지로 에러 응답을 반환합니다.
// 1. 모든 에러에 대해 고유한 ErrorID를 생성하여 로그 추적성을 확보합니다.
// 2. 500 이상의 서버 에러인 경우, 상세한 구현부 노출을 방지하기 위해 클라이언트용 메시지를 마스킹합니다.
// 3. 치명적 에러(5xx) 발생 시 즉시 텔레그램으로 알림을 발송하여 운영팀이 인지할 수 있도록 합니다.
// 4. 4xx 클라이언트 에러는 정상 흐름(404, 401, 400 등)이므로 WARN, 5xx 서버 에러는 ERROR로 로깅하여
//    알람 노이즈를 분리합니다. 텔레그램 알림은 5xx에 한정.
func Error(c *gin.Context, code int, message string) {
	// 에러 추적을 위한 고유 ID 생성 (나노초 단위 타임스탬프 활용)
	errorID := fmt.Sprintf("ERR-%X", time.Now().UnixNano())

	// 서버 측 로그 기록: 에러 원인 분석을 위해 모든 세부 정보를 기록합니다.
	logFields := []zap.Field{
		zap.String("errorId", errorID),
		zap.Int("statusCode", code),
		zap.String("path", c.Request.URL.Path),
		zap.String("clientIP", c.ClientIP()),
		zap.String("message", message),
	}
	if code >= 500 {
		logger.Log.Error("API Error", logFields...)
	} else {
		logger.Log.Warn("API Error", logFields...)
	}

	// 보안 및 알림 처리
	clientMessage := message
	if code >= 500 {
		// 보안: 내부 에러 메시지(SQL 쿼리 등)를 클라이언트에 노출하지 않고 ErrorID만 전달합니다.
		clientMessage = fmt.Sprintf("서버 오류가 발생했습니다. (ErrorID: %s)", errorID)

		// 운영 알림: 비동기 고루틴으로 텔레그램 메시지를 발송합니다.
		alertMsg := fmt.Sprintf(
			"🚨 <b>서버 오류</b>\n"+
				"<b>Path:</b> %s\n"+
				"<b>Status:</b> %d\n"+
				"<b>ErrorID:</b> <code>%s</code>\n"+
				"<b>Message:</b> %s\n"+
				"<b>IP:</b> %s\n"+
				"<b>Time:</b> %s",
			c.Request.URL.Path,
			code,
			errorID,
			message,
			c.ClientIP(),
			time.Now().Format("2006-01-02 15:04:05"),
		)
		go func() {
			if err := telegram.SendAlert(telegramToken, telegramChatID, alertMsg); err != nil {
				logger.Log.Warn("telegram alert failed", zap.Error(err))
			}
		}()
	}

	c.JSON(code, Response{
		Success: false,
		Error:   clientMessage,
		ErrorID: errorID,
	})
}

// ErrorWithFields는 필드별 검증 에러를 포함한 에러 응답을 반환합니다.
func ErrorWithFields(c *gin.Context, code int, message string, fields map[string]string) {
	errorID := fmt.Sprintf("ERR-%X", time.Now().UnixNano())

	logger.Log.Warn("Validation Error",
		zap.String("errorId", errorID),
		zap.String("path", c.Request.URL.Path),
		zap.String("message", message),
		zap.Any("fields", fields),
	)

	c.JSON(code, Response{
		Success:          false,
		Error:            message,
		ErrorID:          errorID,
		ValidationErrors: fields,
	})
}

// BadRequest는 HTTP 400 Bad Request 응답을 반환합니다.
func BadRequest(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, message)
}

// Unauthorized는 HTTP 401 Unauthorized 응답을 반환합니다.
func Unauthorized(c *gin.Context, message string) {
	Error(c, http.StatusUnauthorized, message)
}

// Forbidden는 HTTP 403 Forbidden 응답을 반환합니다.
func Forbidden(c *gin.Context, message string) {
	Error(c, http.StatusForbidden, message)
}

// NotFound는 HTTP 404 Not Found 응답을 반환합니다.
func NotFound(c *gin.Context, message string) {
	Error(c, http.StatusNotFound, message)
}

// InternalServerError는 HTTP 500 Internal Server Error 응답을 반환합니다.
func InternalServerError(c *gin.Context, message string) {
	Error(c, http.StatusInternalServerError, message)
}
