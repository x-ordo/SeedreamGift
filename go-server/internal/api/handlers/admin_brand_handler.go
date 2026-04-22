package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AdminBrandHandler struct {
	service *services.AdminBrandService
}

func NewAdminBrandHandler(service *services.AdminBrandService) *AdminBrandHandler {
	return &AdminBrandHandler{service: service}
}

func (h *AdminBrandHandler) GetBrand(c *gin.Context) {
	code := c.Param("code")
	brand, err := h.service.GetBrandByCode(code)
	if err != nil {
		response.NotFound(c, "브랜드를 찾을 수 없습니다")
		return
	}
	response.Success(c, brand)
}

func (h *AdminBrandHandler) GetBrands(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	res, err := h.service.GetBrands(params)
	if err != nil {
		logger.Log.Error("admin get brands failed", zap.Error(err), zap.String("handler", "GetBrands"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminBrandHandler) CreateBrand(c *gin.Context) {
	var brand domain.Brand
	if err := c.ShouldBindJSON(&brand); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.CreateBrand(&brand); err != nil {
		logger.Log.Error("admin create brand failed", zap.Error(err), zap.String("handler", "CreateBrand"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Created(c, brand)
}

func (h *AdminBrandHandler) UpdateBrand(c *gin.Context) {
	code := c.Param("code")
	var brand domain.Brand
	if err := c.ShouldBindJSON(&brand); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateBrand(code, &brand); err != nil {
		logger.Log.Error("admin update brand failed", zap.Error(err), zap.String("handler", "UpdateBrand"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "브랜드가 수정되었습니다"})
}

func (h *AdminBrandHandler) DeleteBrand(c *gin.Context) {
	code := c.Param("code")
	if err := h.service.DeleteBrand(code); err != nil {
		logger.Log.Error("admin delete brand failed", zap.Error(err), zap.String("handler", "DeleteBrand"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "브랜드가 삭제되었습니다"})
}
