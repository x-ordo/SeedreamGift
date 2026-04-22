package handlers

import (
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// PartnerTradeInHandler는 파트너 매입 신청 관련 HTTP 요청을 처리합니다.
type PartnerTradeInHandler struct {
	service *services.PartnerTradeInService
}

// NewPartnerTradeInHandler는 새로운 PartnerTradeInHandler 인스턴스를 생성합니다.
func NewPartnerTradeInHandler(service *services.PartnerTradeInService) *PartnerTradeInHandler {
	return &PartnerTradeInHandler{service: service}
}

// Create는 파트너 매입 신청을 일괄 생성합니다.
func (h *PartnerTradeInHandler) Create(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var input services.CreatePartnerTradeInInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	tradeIns, err := h.service.CreatePartnerTradeIn(partnerID, input)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, tradeIns)
}

// GetMyTradeIns는 파트너의 매입 신청 목록을 반환합니다.
func (h *PartnerTradeInHandler) GetMyTradeIns(c *gin.Context) {
	partnerID := c.GetInt("userId")
	status := c.Query("status")
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 쿼리 파라미터입니다")
		return
	}

	items, total, err := h.service.GetMyTradeIns(partnerID, status, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit))
}

// GetDetail은 특정 매입 신청 건의 상세 정보를 반환합니다.
func (h *PartnerTradeInHandler) GetDetail(c *gin.Context) {
	partnerID := c.GetInt("userId")
	tradeInID, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	tradeIn, err := h.service.GetTradeInDetail(partnerID, tradeInID)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, tradeIn)
}
