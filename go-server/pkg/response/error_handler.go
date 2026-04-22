package response

import (
	"errors"

	"w-gift-server/pkg/apperror"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// HandleError는 서비스 계층에서 반환된 에러를 적절한 HTTP 응답으로 변환합니다.
// 1. AppError인 경우 해당 에러의 HTTP 상태 코드와 메시지를 사용합니다.
// 2. GORM의 ErrRecordNotFound인 경우 404 응답을 반환합니다.
// 3. 그 외의 에러는 500 응답을 반환합니다.
func HandleError(c *gin.Context, err error) {
	if err == nil {
		return
	}

	// 1. AppError → 타입에 따라 적절한 HTTP 상태 코드 사용
	if ae, ok := apperror.As(err); ok {
		if ae.HTTPStatus() >= 500 {
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

	// 3. Fallback: 500
	InternalServerError(c, "서버 오류가 발생했습니다")
}
