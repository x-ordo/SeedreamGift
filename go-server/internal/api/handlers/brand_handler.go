/*
Package handlers는 브랜드 관리를 위한 HTTP 요청/응답 핸들링 로직을 제공합니다.
시스템에서 사용 가능한 브랜드 카탈로그를 관리합니다.

주요 역할:
- 브랜드 목록 조회 및 상세 정보 조회를 위한 엔드포인트 제공
- 상품 탐색을 위한 브랜드 기반 필터링 및 카테고리화 지원
- 고성능 서버를 위한 효율적인 브랜드 메타데이터 전달 보장
*/
package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// BrandHandler는 브랜드 관련 HTTP 요청을 처리하는 핸들러입니다.
type BrandHandler struct {
	service *services.BrandService
}

// NewBrandHandler는 새로운 BrandHandler 인스턴스를 생성합니다.
func NewBrandHandler(service *services.BrandService) *BrandHandler {
	return &BrandHandler{service: service}
}

// GetBrands godoc
// @Summary 브랜드 목록 조회
// @Tags Brands
// @Produce json
// @Param page query int false "페이지 번호" default(1)
// @Param limit query int false "페이지당 항목 수" default(20)
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /brands [get]
// GetBrands는 등록된 모든 브랜드 목록을 페이징하여 조회합니다.
func (h *BrandHandler) GetBrands(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}

	brands, err := h.service.GetAllBrands(params)
	if err != nil {
		logger.Log.Error("get brands failed", zap.Error(err), zap.String("handler", "GetBrands"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}

	response.Success(c, brands)
}

// GetBrand godoc
// @Summary 브랜드 단건 조회
// @Tags Brands
// @Produce json
// @Param code path string true "브랜드 코드"
// @Success 200 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Router /brands/{code} [get]
// GetBrand는 특정 코드를 가진 브랜드의 상세 정보를 조회합니다.
func (h *BrandHandler) GetBrand(c *gin.Context) {
	code := c.Param("code")
	brand, err := h.service.GetBrandByCode(code)
	if err != nil {
		response.NotFound(c, "브랜드를 찾을 수 없습니다")
		return
	}

	response.Success(c, brand)
}
