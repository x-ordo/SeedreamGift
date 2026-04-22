package handlers

import (
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// PartnerPaymentHandler는 파트너 결제현황 조회 HTTP 요청을 처리합니다.
// 파트너가 보는 결제는 자기 상품(Product.PartnerID=자신)이 포함된 주문의 결제로 제한됩니다.
type PartnerPaymentHandler struct {
	svc *services.PaymentQueryService
}

// NewPartnerPaymentHandler는 PartnerPaymentHandler를 생성합니다.
func NewPartnerPaymentHandler(svc *services.PaymentQueryService) *PartnerPaymentHandler {
	return &PartnerPaymentHandler{svc: svc}
}

// ListPayments godoc
// @Summary 파트너 결제현황 조회
// @Description 내 상품이 포함된 주문의 결제 상태 리스트 및 요약을 반환합니다 (민감 필드는 마스킹됨).
// @Tags PartnerPayments
// @Produce json
// @Security BearerAuth
// @Param status query string false "PENDING|SUCCESS|FAILED|CANCELLED"
// @Param method query string false "CARD|VIRTUAL_ACCOUNT|BANK_TRANSFER"
// @Param from query string false "YYYY-MM-DD"
// @Param to query string false "YYYY-MM-DD"
// @Param search query string false "주문코드 LIKE 검색"
// @Param page query int false "default 1"
// @Param pageSize query int false "default 20, max 100"
// @Success 200 {object} APIResponse
// @Router /partner/payments [get]
func (h *PartnerPaymentHandler) ListPayments(c *gin.Context) {
	partnerID := c.GetInt("userId")
	f := parsePaymentFilters(c)
	f.PartnerUserID = partnerID
	resp, err := h.svc.ListPayments(services.PaymentScopePartner, f)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, resp)
}
