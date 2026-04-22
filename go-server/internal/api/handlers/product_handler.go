// Package handlers는 상품 관리와 관련된 HTTP 요청 및 응답 처리 로직을 제공합니다.
// 상품 카탈로그 브라우징 및 검색을 위한 기본 인터페이스 역할을 수행합니다.
//
// 주요 역할:
//   - 상품 목록 조회, 검색 및 상세 보기 요청 처리
//   - 복잡한 상품 필터링 로직을 효율적인 서비스 호출로 변환
//   - 고성능 Windows 기반 환경을 위한 상품 데이터 전달 최적화
package handlers

import (
	"strconv"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ProductHandler는 상품 관련 HTTP 요청을 처리하는 핸들러입니다.
type ProductHandler struct {
	service *services.ProductService
}

// NewProductHandler는 새로운 ProductHandler 인스턴스를 생성합니다.
func NewProductHandler(service *services.ProductService) *ProductHandler {
	return &ProductHandler{service: service}
}

// GetProducts godoc
// @Summary 상품 목록 조회
// @Tags Products
// @Produce json
// @Param page query int false "페이지 번호" default(1)
// @Param limit query int false "페이지당 항목 수" default(20)
// @Param brand query string false "브랜드 필터"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /products [get]
func (h *ProductHandler) GetProducts(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}

	brand := c.Query("brand")
	products, err := h.service.GetProducts(params, true, brand)
	if err != nil {
		logger.Log.Error("get products failed", zap.Error(err), zap.String("handler", "GetProducts"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}

	response.Success(c, products)
}

// GetProductRates godoc
// @Summary 실시간 상품 할인율 조회
// @Tags Products
// @Produce json
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /products/live-rates [get]
func (h *ProductHandler) GetProductRates(c *gin.Context) {
	rates, err := h.service.GetProductRates()
	if err != nil {
		logger.Log.Error("get product rates failed", zap.Error(err), zap.String("handler", "GetProductRates"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, rates)
}

// GetProductsByBrand godoc
// @Summary 브랜드별 상품 목록 조회
// @Tags Products
// @Produce json
// @Param brand path string true "브랜드 코드"
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /products/brand/{brand} [get]
func (h *ProductHandler) GetProductsByBrand(c *gin.Context) {
	brand := c.Param("brand")
	products, err := h.service.GetProductsByBrand(brand)
	if err != nil {
		logger.Log.Error("get products by brand failed", zap.Error(err), zap.String("handler", "GetProductsByBrand"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, products)
}

// GetProduct godoc
// @Summary 상품 단건 조회
// @Tags Products
// @Produce json
// @Param id path int true "상품 ID"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Router /products/{id} [get]
func (h *ProductHandler) GetProduct(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		response.BadRequest(c, "올바르지 않은 ID입니다")
		return
	}

	product, err := h.service.GetProductByID(id)
	if err != nil {
		response.NotFound(c, "상품을 찾을 수 없습니다")
		return
	}

	response.Success(c, product)
}
