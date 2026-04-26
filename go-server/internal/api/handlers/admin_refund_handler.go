package handlers

import (
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AdminRefundHandler struct {
	service *services.AdminRefundService
}

func NewAdminRefundHandler(service *services.AdminRefundService) *AdminRefundHandler {
	return &AdminRefundHandler{service: service}
}

func (h *AdminRefundHandler) GetAllRefunds(c *gin.Context) {
	var params pagination.QueryParams
	c.ShouldBindQuery(&params)
	res, err := h.service.GetAllRefunds(params)
	if err != nil {
		logger.Log.Error("admin get all refunds failed", zap.Error(err), zap.String("handler", "GetAllRefunds"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminRefundHandler) GetRefund(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.service.GetRefund(id)
	if err != nil {
		response.NotFound(c, "환불 요청을 찾을 수 없습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminRefundHandler) ApproveRefund(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	adminID := c.GetInt("userId")
	if err := h.service.ApproveRefund(id, adminID); err != nil {
		logger.Log.Error("admin approve refund failed", zap.Error(err), zap.String("handler", "ApproveRefund"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "환불이 승인되었습니다"})
}

func (h *AdminRefundHandler) RejectRefund(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	adminID := c.GetInt("userId")
	if err := h.service.RejectRefund(id, adminID); err != nil {
		logger.Log.Error("admin reject refund failed", zap.Error(err), zap.String("handler", "RejectRefund"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "환불이 거절되었습니다"})
}

// SeedreamRefundRequest 는 관리자 VA 수동환불 요청 바디입니다.
// fulfillment 자동환불이 차단된 VA 주문(IssuanceLog.Status=FAILED_REFUND_PENDING)을
// 운영팀이 admin panel 에서 처리할 때 사용. CancelService 검증 규칙은 그대로 적용됩니다.
type SeedreamRefundRequest struct {
	BankCode     string `json:"bankCode" binding:"required"`     // BankCodesCancel 9개 화이트리스트
	AccountNo    string `json:"accountNo" binding:"required"`    // 6~20자 숫자/하이픈
	CancelReason string `json:"cancelReason" binding:"required"` // 5~50 rune
}

// SeedreamRefund godoc
// @Summary VA 주문 Seedream 수동환불
// @Description VA 주문(VIRTUAL_ACCOUNT*)의 입금을 Seedream RefundDeposited API 로 환불합니다. 성공 시 Refund/Order 상태가 APPROVED/REFUNDED 로 전이되고 복식부기 원장이 기록됩니다.
// @Tags Admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Refund ID"
// @Param body body SeedreamRefundRequest true "은행 코드 + 계좌번호 + 취소사유"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /admin/refunds/{id}/seedream-refund [post]
//
// VA 주문에 대해 Seedream RefundDeposited API 를 호출하고 후처리(상태 전이/원장)까지 수행합니다.
func (h *AdminRefundHandler) SeedreamRefund(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req SeedreamRefundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "잘못된 요청입니다: "+err.Error())
		return
	}
	adminID := c.GetInt("userId")
	if err := h.service.SeedreamRefund(c.Request.Context(), id, adminID, services.AdminSeedreamRefundInput{
		BankCode:     req.BankCode,
		AccountNo:    req.AccountNo,
		CancelReason: req.CancelReason,
	}); err != nil {
		logger.Log.Error("admin seedream refund failed",
			zap.Int("refundId", id),
			zap.Int("adminId", adminID),
			zap.Error(err),
		)
		// AppError 면 적절한 HTTP status, 그 외는 500
		if appErr, ok := apperror.As(err); ok {
			response.Error(c, appErr.HTTPStatus(), appErr.Message)
			return
		}
		response.InternalServerError(c, "Seedream 환불 호출 실패: "+err.Error())
		return
	}
	response.Success(c, gin.H{"message": "Seedream 환불이 완료되었습니다"})
}

// CancelVAccountPaymentRequest 는 관리자 입금 전 VA 발급 취소 요청 바디입니다.
type CancelVAccountPaymentRequest struct {
	CancelReason string `json:"cancelReason" binding:"required,min=5,max=50"`
}

// CancelVAccountPayment godoc
// @Summary VA 주문 입금 전 결제 취소 (관리자)
// @Description PENDING/ISSUED 상태의 VA 주문에 대해 Seedream CancelIssued API 로 취소합니다. owner check 는 admin 권한으로 우회됩니다. 성공 시 webhook 경로로 Order.Status 가 CANCELLED 로 전이됩니다.
// @Tags Admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Order ID"
// @Param body body CancelVAccountPaymentRequest true "취소 사유 (5~50자)"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /admin/orders/{id}/cancel-payment [post]
func (h *AdminRefundHandler) CancelVAccountPayment(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req CancelVAccountPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "잘못된 요청입니다: "+err.Error())
		return
	}
	adminID := c.GetInt("userId")
	if err := h.service.CancelVAccountIssued(c.Request.Context(), adminID, services.AdminCancelVAccountInput{
		OrderID:      id,
		CancelReason: req.CancelReason,
	}); err != nil {
		logger.Log.Error("admin cancel vaccount issued failed",
			zap.Int("orderId", id),
			zap.Int("adminId", adminID),
			zap.Error(err),
		)
		if appErr, ok := apperror.As(err); ok {
			response.Error(c, appErr.HTTPStatus(), appErr.Message)
			return
		}
		response.InternalServerError(c, "결제 취소 호출 실패: "+err.Error())
		return
	}
	response.Success(c, gin.H{"message": "결제 취소가 접수되었습니다"})
}
