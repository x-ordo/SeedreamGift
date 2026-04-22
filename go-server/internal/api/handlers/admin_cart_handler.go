package handlers

import (
	"strconv"
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AdminCartHandler struct {
	service *services.AdminCartService
}

func NewAdminCartHandler(service *services.AdminCartService) *AdminCartHandler {
	return &AdminCartHandler{service: service}
}

func (h *AdminCartHandler) GetAllCarts(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	res, err := h.service.GetAllCarts(params)
	if err != nil {
		logger.Log.Error("admin get all carts failed", zap.Error(err), zap.String("handler", "GetAllCarts"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminCartHandler) GetUserCarts(c *gin.Context) {
	userId, _ := strconv.Atoi(c.Param("userId"))
	res, err := h.service.GetUserCarts(userId)
	if err != nil {
		logger.Log.Error("admin get user carts failed", zap.Error(err), zap.String("handler", "GetUserCarts"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminCartHandler) DeleteCartItem(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.DeleteCartItem(id); err != nil {
		logger.Log.Error("admin delete cart item failed", zap.Error(err), zap.String("handler", "DeleteCartItem"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "장바구니 항목이 삭제되었습니다"})
}

func (h *AdminCartHandler) ClearUserCart(c *gin.Context) {
	userId, _ := strconv.Atoi(c.Param("userId"))
	if err := h.service.ClearUserCart(userId); err != nil {
		logger.Log.Error("admin clear user cart failed", zap.Error(err), zap.String("handler", "ClearUserCart"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "장바구니가 비워졌습니다"})
}
