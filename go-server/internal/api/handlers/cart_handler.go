/*
Package handlers는 장바구니 작업을 위한 HTTP 요청/응답 핸들링 로직을 제공합니다.
사용자의 임시 쇼핑 상태를 관리하며, 결제 전 상품 관리를 가능하게 합니다.

주요 역할:
- 장바구니 항목 관리 (추가, 삭제, 목록 조회)
- 클라이언트와 영구 저장소 간의 장바구니 상태 동기화
- 응답성 높은 사용자 경험을 위한 저지연 업데이트 보장
*/
package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// CartHandler는 장바구니 관련 HTTP 요청을 처리하는 핸들러입니다.
type CartHandler struct {
	service *services.CartService
}

// NewCartHandler는 새로운 CartHandler 인스턴스를 생성합니다.
func NewCartHandler(service *services.CartService) *CartHandler {
	return &CartHandler{service: service}
}

// GetCart godoc
// @Summary 장바구니 조회
// @Tags Cart
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /cart [get]
// GetCart는 현재 사용자의 장바구니 내역을 조회합니다.
func (h *CartHandler) GetCart(c *gin.Context) {
	userId := c.GetInt("userId")
	cartResp, err := h.service.GetCart(userId)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, cartResp)
}

// CheckLimit godoc
// @Summary 장바구니 구매 한도 확인
// @Tags Cart
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /cart/check-limit [get]
// CheckLimit는 장바구니에 담긴 상품들이 구매 가능 한도 내에 있는지 확인합니다.
func (h *CartHandler) CheckLimit(c *gin.Context) {
	userId := c.GetInt("userId")
	res, err := h.service.CheckLimit(userId)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// CartAddItemRequest는 장바구니에 상품을 추가할 때 사용되는 구조체입니다.
type CartAddItemRequest struct {
	ProductID int `json:"productId" binding:"required"`
	Quantity  int `json:"quantity" binding:"required,min=1,max=99"`
}

// AddItem godoc
// @Summary 장바구니에 상품 추가
// @Tags Cart
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body CartAddItemRequest true "추가할 상품 정보"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /cart [post]
// AddItem은 장바구니에 특정 상품을 지정된 수량만큼 추가합니다.
func (h *CartHandler) AddItem(c *gin.Context) {
	userId := c.GetInt("userId")
	var body CartAddItemRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.AddItem(userId, body.ProductID, body.Quantity); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "장바구니에 추가되었습니다"})
}

// CartUpdateQuantityRequest는 장바구니 항목의 수량을 변경할 때 사용되는 구조체입니다.
type CartUpdateQuantityRequest struct {
	Quantity int `json:"quantity" binding:"required,min=1"`
}

// UpdateQuantity godoc
// @Summary 장바구니 상품 수량 변경
// @Tags Cart
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "상품 ID (productId)"
// @Param body body CartUpdateQuantityRequest true "변경할 수량"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /cart/{id} [patch]
// UpdateQuantity는 장바구니 내 특정 상품의 수량을 업데이트합니다.
// URL의 :id 파라미터는 productId입니다 (서비스에서 userId+productId로 조회).
func (h *CartHandler) UpdateQuantity(c *gin.Context) {
	userId := c.GetInt("userId")
	productId, ok := parseIDParam(c, "id")
	if !ok {
		response.BadRequest(c, "올바르지 않은 ID입니다")
		return
	}
	var body CartUpdateQuantityRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateQuantity(userId, productId, body.Quantity); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "수량이 변경되었습니다"})
}

// RemoveItem godoc
// @Summary 장바구니 상품 삭제 (상품 ID 기준)
// @Tags Cart
// @Produce json
// @Security BearerAuth
// @Param id path int true "상품 ID (productId)"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /cart/{id} [delete]
// RemoveItem은 상품 ID를 기준으로 장바구니에서 특정 상품을 제거합니다.
func (h *CartHandler) RemoveItem(c *gin.Context) {
	userId := c.GetInt("userId")
	productId, ok := parseIDParam(c, "id")
	if !ok {
		response.BadRequest(c, "올바르지 않은 ID입니다")
		return
	}
	if err := h.service.RemoveItem(userId, productId); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "상품이 제거되었습니다"})
}

// CartBatchRemoveRequest는 장바구니에서 여러 항목을 일괄 삭제할 때 사용되는 구조체입니다.
type CartBatchRemoveRequest struct {
	ProductIDs []int `json:"productIds" binding:"required"`
}

// ClearCart godoc
// @Summary 장바구니 전체 비우기
// @Tags Cart
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /cart [delete]
// ClearCart는 현재 사용자의 장바구니에 담긴 모든 상품을 제거합니다.
func (h *CartHandler) ClearCart(c *gin.Context) {
	if err := h.service.ClearCart(c.GetInt("userId")); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "장바구니가 비워졌습니다"})
}

// RemoveItemsBatch godoc
// @Summary 장바구니 상품 일괄 삭제
// @Tags Cart
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body CartBatchRemoveRequest true "삭제할 상품 ID 목록"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /cart/batch [delete]
// RemoveItemsBatch는 전달된 상품 ID 목록에 해당하는 모든 상품을 장바구니에서 제거합니다.
func (h *CartHandler) RemoveItemsBatch(c *gin.Context) {
	userId := c.GetInt("userId")
	var body CartBatchRemoveRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	count, err := h.service.RemoveItemsBatch(userId, body.ProductIDs)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"deletedCount": count})
}
