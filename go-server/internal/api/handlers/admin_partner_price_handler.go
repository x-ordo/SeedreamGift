package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// AdminPartnerPriceHandler는 관리자의 파트너 단가 관리 HTTP 요청을 처리합니다.
type AdminPartnerPriceHandler struct {
	service *services.AdminPartnerPriceService
}

// NewAdminPartnerPriceHandler는 새로운 AdminPartnerPriceHandler 인스턴스를 생성합니다.
func NewAdminPartnerPriceHandler(service *services.AdminPartnerPriceService) *AdminPartnerPriceHandler {
	return &AdminPartnerPriceHandler{service: service}
}

// GetPrices는 파트너 단가 목록을 페이지네이션하여 반환합니다.
// 쿼리 파라미터 partnerId로 특정 파트너의 단가만 필터링할 수 있습니다.
func (h *AdminPartnerPriceHandler) GetPrices(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 쿼리 파라미터입니다")
		return
	}

	partnerID := 0
	if pid := c.Query("partnerId"); pid != "" {
		if id, ok := parseIntQuery(pid); ok {
			partnerID = id
		}
	}

	items, total, err := h.service.GetPrices(partnerID, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit))
}

// GetPricesByPartner는 특정 파트너의 전체 단가 목록을 반환합니다.
func (h *AdminPartnerPriceHandler) GetPricesByPartner(c *gin.Context) {
	partnerID, ok := parseIDParam(c, "partnerId")
	if !ok {
		return
	}

	items, err := h.service.GetPricesByPartner(partnerID)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, items)
}

// UpsertPrice는 파트너×상품 조합의 단가를 생성하거나 업데이트합니다.
func (h *AdminPartnerPriceHandler) UpsertPrice(c *gin.Context) {
	var body struct {
		PartnerID    int     `json:"partnerId" binding:"required"`
		ProductID    int     `json:"productId" binding:"required"`
		BuyPrice     float64 `json:"buyPrice" binding:"required"`
		TradeInPrice float64 `json:"tradeInPrice" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	pp, err := h.service.UpsertPrice(body.PartnerID, body.ProductID, body.BuyPrice, body.TradeInPrice)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, pp)
}

// DeletePrice는 지정된 파트너 단가 레코드를 삭제합니다.
func (h *AdminPartnerPriceHandler) DeletePrice(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.service.DeletePrice(id); err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "파트너 단가가 삭제되었습니다"})
}
