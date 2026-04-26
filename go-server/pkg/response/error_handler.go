package response

import (
	"errors"

	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// HandleError는 서비스 계층에서 반환된 에러를 적절한 HTTP 응답으로 변환합니다.
// 1. AppError인 경우 해당 에러의 HTTP 상태 코드와 메시지를 사용합니다.
// 2. GORM의 ErrRecordNotFound인 경우 404 응답을 반환합니다.
// 3. 그 외의 에러는 500 응답을 반환합니다.
//
// 5xx 응답을 반환하기 직전에는 wrapped 원본 에러를 별도 ERROR 로그로 보존하여
// 운영 디버깅 시 root cause를 추적할 수 있도록 합니다. 클라이언트에는 마스킹된
// 메시지만 노출되므로, 서버 로그가 유일한 단서가 됩니다.
func HandleError(c *gin.Context, err error) {
	if err == nil {
		return
	}

	// 1. AppError → 타입에 따라 적절한 HTTP 상태 코드 사용
	if ae, ok := apperror.As(err); ok {
		if ae.HTTPStatus() >= 500 {
			logServerError(c, "internal error", err)
			InternalServerError(c, ae.Message)
		} else if len(ae.FieldErrors) > 0 {
			ErrorWithFields(c, ae.HTTPStatus(), ae.Message, ae.FieldErrors)
		} else {
			Error(c, ae.HTTPStatus(), ae.Message)
		}
		return
	}

	// 2. GORM not found → 404
	if errors.Is(err, gorm.ErrRecordNotFound) {
		NotFound(c, "요청한 리소스를 찾을 수 없습니다")
		return
	}

	// 3. Fallback: 500 — 어떤 카테고리에도 매칭되지 않은 raw error.
	// 이 경로가 가장 위험합니다. 호출자가 apperror로 wrap하지 않은 채 raw GORM/네트워크/DB 에러를
	// 그대로 반환했다는 신호이며, root cause 분석을 위해 원본을 반드시 보존해야 합니다.
	logServerError(c, "unhandled error", err)
	InternalServerError(c, "서버 오류가 발생했습니다")
}

// logServerError는 5xx 응답 직전에 wrapped 원본 에러를 traceId/path와 함께 ERROR 레벨로 기록합니다.
// response.Error()는 보안상 클라이언트용 마스킹 메시지만 로그에 남기므로,
// 이 함수가 남기는 로그가 운영 환경에서 유일한 root cause 단서입니다.
func logServerError(c *gin.Context, msg string, err error) {
	logger.Log.Error(msg,
		zap.String("path", c.Request.URL.Path),
		zap.String("clientIP", c.ClientIP()),
		zap.String("traceId", c.GetString("traceId")),
		zap.Error(err),
	)
}
