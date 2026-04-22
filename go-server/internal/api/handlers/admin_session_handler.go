package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AdminSessionHandler struct {
	service *services.AdminSessionService
}

func NewAdminSessionHandler(service *services.AdminSessionService) *AdminSessionHandler {
	return &AdminSessionHandler{service: service}
}

func (h *AdminSessionHandler) GetAuditLogs(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	res, err := h.service.GetAuditLogs(params)
	if err != nil {
		logger.Log.Error("admin get audit logs failed", zap.Error(err), zap.String("handler", "GetAuditLogs"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminSessionHandler) GetAuditLogDetail(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.service.GetAuditLogDetail(id)
	if err != nil {
		response.NotFound(c, "감사 로그를 찾을 수 없습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminSessionHandler) GetSessions(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	res, err := h.service.GetSessions(params)
	if err != nil {
		logger.Log.Error("admin get sessions failed", zap.Error(err), zap.String("handler", "GetSessions"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminSessionHandler) DeleteSession(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	adminID := c.GetInt("userId")
	if err := h.service.DeleteSession(id, adminID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "세션이 삭제되었습니다"})
}

func (h *AdminSessionHandler) DeleteUserSessions(c *gin.Context) {
	userId, ok := parseIDParam(c, "userId")
	if !ok {
		return
	}
	if err := h.service.DeleteUserSessions(userId); err != nil {
		logger.Log.Error("admin delete user sessions failed", zap.Error(err), zap.String("handler", "DeleteUserSessions"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "사용자 세션이 모두 삭제되었습니다"})
}
