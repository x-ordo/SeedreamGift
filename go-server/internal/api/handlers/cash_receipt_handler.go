/*
Package handlers는 현금영수증 관련 HTTP 요청/응답 핸들링 로직을 제공합니다.
사용자 사후 신청, 조회와 관리자 전체 관리(취소/재발급/동기화) 엔드포인트를 제공합니다.
*/
package handlers

import (
	"strconv"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// CashReceiptHandler는 현금영수증 관련 HTTP 요청을 처리하는 핸들러입니다.
type CashReceiptHandler struct {
	service *services.CashReceiptService
}

// NewCashReceiptHandler는 새로운 CashReceiptHandler 인스턴스를 생성합니다.
func NewCashReceiptHandler(service *services.CashReceiptService) *CashReceiptHandler {
	return &CashReceiptHandler{service: service}
}

// ── 사용자 API ──────────────────────────────────────────────────────────────

// RequestAfterPurchase는 구매 후 사후 현금영수증 신청을 처리합니다.
// POST /cash-receipts/request
func (h *CashReceiptHandler) RequestAfterPurchase(c *gin.Context) {
	userID := c.GetInt("userId")
	var input services.RequestCashReceiptInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	receipt, err := h.service.RequestAfterPurchase(userID, input)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Created(c, receipt)
}

// GetMyReceipts는 로그인한 사용자의 현금영수증 목록을 페이지네이션하여 반환합니다.
// GET /cash-receipts/my?page=1&limit=20
func (h *CashReceiptHandler) GetMyReceipts(c *gin.Context) {
	userID := c.GetInt("userId")

	page := 1
	limit := 20
	if p := c.DefaultQuery("page", "1"); p != "" {
		if v, err := parseInt(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := c.DefaultQuery("limit", "20"); l != "" {
		if v, err := parseInt(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}

	receipts, total, err := h.service.GetMyReceipts(userID, page, limit)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{
		"items": receipts,
		"meta": gin.H{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// GetByID는 로그인한 사용자의 특정 현금영수증 상세 정보를 반환합니다.
// GET /cash-receipts/:id
func (h *CashReceiptHandler) GetByID(c *gin.Context) {
	userID := c.GetInt("userId")
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	receipt, err := h.service.GetByID(userID, id)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, receipt)
}

// ── 관리자 API ──────────────────────────────────────────────────────────────

// AdminGetAll은 관리자용 현금영수증 전체 목록을 페이지네이션하여 반환합니다.
// GET /admin/cash-receipts?page=1&limit=20&status=ISSUED
func (h *CashReceiptHandler) AdminGetAll(c *gin.Context) {
	page := 1
	limit := 20
	if p := c.DefaultQuery("page", "1"); p != "" {
		if v, err := parseInt(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := c.DefaultQuery("limit", "20"); l != "" {
		if v, err := parseInt(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}
	status := c.DefaultQuery("status", "")

	receipts, total, err := h.service.AdminGetAll(page, limit, status)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{
		"items": receipts,
		"meta": gin.H{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// AdminGetByID는 관리자용 특정 현금영수증 상세 정보를 반환합니다.
// GET /admin/cash-receipts/:id
func (h *CashReceiptHandler) AdminGetByID(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	receipt, err := h.service.AdminGetByID(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, receipt)
}

// adminCancelRequest는 현금영수증 취소 요청 바디입니다.
type adminCancelRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// AdminCancel은 관리자가 특정 현금영수증을 취소합니다.
// POST /admin/cash-receipts/:id/cancel
func (h *CashReceiptHandler) AdminCancel(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	var req adminCancelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if err := h.service.AdminCancel(id, req.Reason); err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "현금영수증이 취소되었습니다."})
}

// AdminReissue는 관리자가 FAILED 상태의 현금영수증을 재발급합니다.
// POST /admin/cash-receipts/:id/reissue
func (h *CashReceiptHandler) AdminReissue(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.service.AdminReissue(id); err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "현금영수증이 재발급되었습니다."})
}

// AdminSync는 관리자가 특정 현금영수증의 팝빌 상태를 동기화합니다.
// POST /admin/cash-receipts/:id/sync
func (h *CashReceiptHandler) AdminSync(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	receipt, err := h.service.AdminGetByID(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, receipt)
}

// parseInt는 문자열을 int로 파싱합니다.
func parseInt(s string) (int, error) {
	return strconv.Atoi(s)
}
