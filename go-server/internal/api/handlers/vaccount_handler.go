package handlers

import (
	"strings"

	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// VAccountHandler 는 Seedream VA 결제 관련 HTTP 요청을 처리합니다.
// Phase 2 에서는 POST /payments/initiate 만 지원 — 취소/환불은
// POST /payment/seedream/cancel (Phase 4 SeedreamCancelHandler).
type VAccountHandler struct {
	service *services.VAccountService
}

func NewVAccountHandler(svc *services.VAccountService) *VAccountHandler {
	return &VAccountHandler{service: svc}
}

// InitiateRequest 는 POST /payments/initiate 요청 바디.
type InitiateRequest struct {
	OrderID    int    `json:"orderId" binding:"required"`
	ClientType string `json:"clientType" binding:"required,oneof=P M"` // P=PC, M=Mobile
	// BankCode 는 선택 — 발급 가능한 은행을 콤마구분으로 제한합니다 (예: "088" 또는 "088,004").
	// 빈 문자열이면 모든 은행 허용 (omitempty 로 Seedream 호출 시 자동 누락).
	BankCode string `json:"bankCode,omitempty"`
}

// Initiate 은 주문 ID 로 Seedream LINK 모드 VA 발급을 시작합니다.
//
// POST /api/v1/payments/initiate
//
// 응답의 targetUrl + formData 는 서버 저장 금지 — 브라우저가 HTML auto-submit
// form 으로 렌더해 키움페이 은행 선택 창으로 이동시킵니다 (설계 D5).
func (h *VAccountHandler) Initiate(c *gin.Context) {
	var req InitiateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	caller := callerContextFromGin(c)
	res, err := h.service.Issue(c.Request.Context(), caller, req.OrderID, req.ClientType, req.BankCode)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// Resume 은 이미 PENDING Payment 가 있는 주문에 대해 결제창을 다시 엽니다.
// 기존 PENDING Payment 를 취소하고 새 VA 를 발급합니다 (TOKEN 1회용 특성).
//
// POST /api/v1/payments/resume
func (h *VAccountHandler) Resume(c *gin.Context) {
	var req InitiateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	caller := callerContextFromGin(c)
	res, err := h.service.Resume(c.Request.Context(), caller, req.OrderID, req.ClientType, req.BankCode)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// callerContextFromGin 은 Gin context 에서 services.CallerContext 를 추출합니다.
// JWT middleware 가 userId, userRole 을 세팅해 둠. partnerId 는 현재
// 주입되지 않으므로 항상 nil — PARTNER 발급 경로는 VAccountService.Issue 가
// Phase 4 제한 오류로 거부합니다.
func callerContextFromGin(c *gin.Context) services.CallerContext {
	caller := services.CallerContext{
		UserID:  c.GetInt("userId"),
		Role:    strings.ToUpper(c.GetString("userRole")),
		TraceID: c.GetHeader("X-Trace-Id"),
	}
	if pid := c.GetString("partnerId"); pid != "" {
		caller.PartnerID = &pid
	}
	if caller.TraceID == "" {
		caller.TraceID = c.GetString("requestId")
	}
	return caller
}
