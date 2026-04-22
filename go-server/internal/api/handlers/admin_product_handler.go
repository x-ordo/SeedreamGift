package handlers

import (
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AdminProductHandler struct {
	service *services.AdminProductService
}

func NewAdminProductHandler(service *services.AdminProductService) *AdminProductHandler {
	return &AdminProductHandler{service: service}
}

func (h *AdminProductHandler) GetProducts(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	res, err := h.service.GetProducts(params)
	if err != nil {
		logger.Log.Error("admin get products failed", zap.Error(err), zap.String("handler", "GetProducts"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminProductHandler) CreateProduct(c *gin.Context) {
	var product domain.Product
	if err := c.ShouldBindJSON(&product); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.CreateProduct(&product); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, product)
}

func (h *AdminProductHandler) UpdateProduct(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var product domain.Product
	if err := c.ShouldBindJSON(&product); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateProduct(id, &product); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, product)
}

func (h *AdminProductHandler) ApproveProduct(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		ApprovalStatus string `json:"approvalStatus" binding:"required"`
		Reason         string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "approvalStatus is required")
		return
	}
	if err := h.service.UpdateApprovalStatus(id, body.ApprovalStatus, body.Reason); err != nil {
		logger.Log.Error("admin approve product failed", zap.Error(err), zap.Int("productId", id))
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "상품 승인 상태가 변경되었습니다", "approvalStatus": body.ApprovalStatus})
}

func (h *AdminProductHandler) DeleteProduct(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.DeleteProduct(id); err != nil {
		logger.Log.Error("admin delete product failed", zap.Error(err), zap.Int("productId", id))
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "상품이 삭제되었습니다"})
}
