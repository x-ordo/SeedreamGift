package handlers

import (
	"net/http"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// PartnerOrderHandler는 파트너 구매 주문 관련 HTTP 요청을 처리합니다.
type PartnerOrderHandler struct {
	service *services.PartnerOrderService
}

// NewPartnerOrderHandler는 새로운 PartnerOrderHandler 인스턴스를 생성합니다.
func NewPartnerOrderHandler(service *services.PartnerOrderService) *PartnerOrderHandler {
	return &PartnerOrderHandler{service: service}
}

// GetPurchasableProducts는 파트너가 구매 가능한 상품 목록을 반환합니다.
// 파트너별로 설정된 단가가 있으면 함께 반환됩니다.
func (h *PartnerOrderHandler) GetPurchasableProducts(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 쿼리 파라미터입니다")
		return
	}

	items, total, err := h.service.GetPurchasableProducts(partnerID, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit))
}

// CreateOrder는 파트너 구매 주문을 생성합니다.
func (h *PartnerOrderHandler) CreateOrder(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var input services.CreatePartnerOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	order, err := h.service.CreatePartnerOrder(partnerID, input)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, order)
}

// GetMyPurchases는 파트너의 구매 주문 목록을 반환합니다.
func (h *PartnerOrderHandler) GetMyPurchases(c *gin.Context) {
	partnerID := c.GetInt("userId")
	status := c.Query("status")
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 쿼리 파라미터입니다")
		return
	}

	items, total, err := h.service.GetMyPurchases(partnerID, status, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit))
}

// CancelOrder는 파트너 구매 주문을 취소합니다.
func (h *PartnerOrderHandler) CancelOrder(c *gin.Context) {
	partnerID := c.GetInt("userId")
	orderID, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.service.CancelPartnerOrder(partnerID, orderID); err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "주문이 취소되었습니다"})
}

// ExportPins는 파트너 주문의 PIN 코드를 CSV 파일로 내보냅니다.
// UTF-8 BOM을 포함하여 Excel에서 한글이 올바르게 표시됩니다.
func (h *PartnerOrderHandler) ExportPins(c *gin.Context) {
	partnerID := c.GetInt("userId")
	orderID, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	csvContent, err := h.service.ExportOrderPins(partnerID, orderID)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	filename := "pins_order_" + c.Param("id") + ".csv"
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Status(http.StatusOK)
	c.Writer.WriteString(csvContent) //nolint:errcheck
}
