// Package handlers는 Gin 프레임워크를 기반으로 한 API 핸들러들을 포함합니다.
package handlers

import (
	"strconv"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// parseIDParam은 Gin 컨텍스트에서 지정된 이름의 ID 파라미터를 추출하고 유효성을 검사합니다.
// 유효하지 않은 경우 400 Bad Request 응답을 반환합니다.
func parseIDParam(c *gin.Context, name string) (int, bool) {
	id, err := strconv.Atoi(c.Param(name))
	if err != nil || id <= 0 {
		response.BadRequest(c, "invalid "+name+" parameter")
		return 0, false
	}
	return id, true
}
