package handlers

import (
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/response"
	"w-gift-server/pkg/telegram"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ClientErrorHandler는 프론트엔드에서 발생한 에러를 수집합니다.
type ClientErrorHandler struct{}

func NewClientErrorHandler() *ClientErrorHandler {
	return &ClientErrorHandler{}
}

type clientErrorReport struct {
	Level     string `json:"level" binding:"required"`   // error, warn, info
	Message   string `json:"message" binding:"required"` // 에러 메시지
	URL       string `json:"url"`                        // 발생 페이지 URL
	ErrorID   string `json:"errorId"`                    // 서버 ErrorID (있는 경우)
	Stack     string `json:"stack"`                      // 스택 트레이스
	UserAgent string `json:"userAgent"`                  // 브라우저 정보
	App       string `json:"app"`                        // client, admin, partner
}

// ReportError는 프론트엔드 에러를 수집하여 로깅합니다.
func (h *ClientErrorHandler) ReportError(c *gin.Context) {
	var req clientErrorReport
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "잘못된 에러 리포트 형식")
		return
	}

	// 로그 기록
	fields := []zap.Field{
		zap.String("app", req.App),
		zap.String("url", req.URL),
		zap.String("clientIP", c.ClientIP()),
		zap.String("message", req.Message),
	}
	if req.ErrorID != "" {
		fields = append(fields, zap.String("errorId", req.ErrorID))
	}
	if req.Stack != "" {
		fields = append(fields, zap.String("stack", req.Stack))
	}

	switch req.Level {
	case "error":
		logger.Log.Error("Client Error", fields...)
		// 텔레그램 알림 (5xx 관련 에러만)
		if req.ErrorID != "" {
			go telegram.NotifyClientError(req.App, req.URL, req.Message, req.ErrorID)
		}
	case "warn":
		logger.Log.Warn("Client Warning", fields...)
	default:
		logger.Log.Info("Client Info", fields...)
	}

	response.Success(c, gin.H{"received": true})
}
