package handlers

import (
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AdminRefundHandler struct {
	service *services.AdminRefundService
}

func NewAdminRefundHandler(service *services.AdminRefundService) *AdminRefundHandler {
	return &AdminRefundHandler{service: service}
}

func (h *AdminRefundHandler) GetAllRefunds(c *gin.Context) {
	var params pagination.QueryParams
	c.ShouldBindQuery(&params)
	res, err := h.service.GetAllRefunds(params)
	if err != nil {
		logger.Log.Error("admin get all refunds failed", zap.Error(err), zap.String("handler", "GetAllRefunds"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminRefundHandler) GetRefund(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.service.GetRefund(id)
	if err != nil {
		response.NotFound(c, "환불 요청을 찾을 수 없습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminRefundHandler) ApproveRefund(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	adminID := c.GetInt("userId")
	if err := h.service.ApproveRefund(id, adminID); err != nil {
		logger.Log.Error("admin approve refund failed", zap.Error(err), zap.String("handler", "ApproveRefund"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "환불이 승인되었습니다"})
}

func (h *AdminRefundHandler) RejectRefund(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	adminID := c.GetInt("userId")
	if err := h.service.RejectRefund(id, adminID); err != nil {
		logger.Log.Error("admin reject refund failed", zap.Error(err), zap.String("handler", "RejectRefund"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "환불이 거절되었습니다"})
}
