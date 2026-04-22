package handlers

import (
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AdminGiftHandler struct {
	service *services.AdminGiftService
}

func NewAdminGiftHandler(service *services.AdminGiftService) *AdminGiftHandler {
	return &AdminGiftHandler{service: service}
}

func (h *AdminGiftHandler) GetAllGifts(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	res, err := h.service.GetAllGifts(params)
	if err != nil {
		logger.Log.Error("admin get all gifts failed", zap.Error(err), zap.String("handler", "GetAllGifts"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminGiftHandler) GetGiftDetail(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	gift, err := h.service.GetGiftDetail(id)
	if err != nil {
		response.NotFound(c, "선물을 찾을 수 없습니다")
		return
	}
	response.Success(c, gift)
}

func (h *AdminGiftHandler) GetGiftStats(c *gin.Context) {
	stats, err := h.service.GetGiftStats()
	if err != nil {
		logger.Log.Error("admin get gift stats failed", zap.Error(err), zap.String("handler", "GetGiftStats"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, stats)
}
