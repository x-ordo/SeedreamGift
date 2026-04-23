// Package handlers — Seedreampay consumer-facing HTTP endpoints.
//
// Endpoints mounted here serve both public and JWT-protected traffic for the
// voucher lifecycle after issuance: lookup, verify (pre-flight), redeem, and
// refund. The handler is intentionally thin — service-layer sentinels are
// translated to precise HTTP status codes. Per-IP throttling on /verify is
// handled upstream by middleware.EndpointRateLimit.
package handlers

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/response"
)

// SeedreampayServiceIface is the subset of SeedreampayService the handler
// depends on. Declared here so tests can supply a fake without touching a DB.
type SeedreampayServiceIface interface {
	GetVoucherBySerial(ctx context.Context, serial string) (*services.VoucherView, error)
	VerifyPair(ctx context.Context, serial, secret string) error
	Redeem(ctx context.Context, in services.RedeemInput) (*services.RedeemResult, error)
	Refund(ctx context.Context, in services.RefundInput) error
}

// SeedreampayHandler exposes the four consumer voucher endpoints.
type SeedreampayHandler struct {
	svc SeedreampayServiceIface
}

// NewSeedreampayHandler constructs a handler bound to a SeedreampayService.
func NewSeedreampayHandler(svc *services.SeedreampayService) *SeedreampayHandler {
	return &SeedreampayHandler{svc: svc}
}

// gone emits a 410 with a custom message. No dedicated helper exists for
// "410 Gone" in pkg/response, so we construct the payload inline.
func gone(c *gin.Context, msg string) {
	c.JSON(http.StatusGone, response.Response{
		Success: false,
		Error:   msg,
	})
}

// conflict emits a 409 with a custom message.
func conflict(c *gin.Context, msg string) {
	c.JSON(http.StatusConflict, response.Response{
		Success: false,
		Error:   msg,
	})
}

// GetVoucher handles GET /vouchers/:serialNo — public voucher lookup.
// Returns the safe VoucherView projection (SecretHash is never exposed).
func (h *SeedreampayHandler) GetVoucher(c *gin.Context) {
	serial := c.Param("serialNo")
	if serial == "" {
		response.BadRequest(c, "serialNo는 필수입니다")
		return
	}
	v, err := h.svc.GetVoucherBySerial(c.Request.Context(), serial)
	if err != nil {
		if errors.Is(err, services.ErrVoucherNotFound) {
			response.NotFound(c, "바우처를 찾을 수 없습니다")
			return
		}
		response.InternalServerError(c, "바우처 조회 실패")
		return
	}
	response.Success(c, v)
}

// verifyRequest is the JSON body for POST /vouchers/verify.
type verifyRequest struct {
	SerialNo string `json:"serialNo" binding:"required"`
	Secret   string `json:"secret" binding:"required"`
}

// Verify handles POST /vouchers/verify — public pre-flight check before the
// caller commits to a redeem. Per-IP rate limiting lives in the
// EndpointRateLimit middleware; this handler only maps service errors.
func (h *SeedreampayHandler) Verify(c *gin.Context) {
	var req verifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "serialNo와 secret이 필요합니다")
		return
	}

	err := h.svc.VerifyPair(c.Request.Context(), req.SerialNo, req.Secret)
	if err == nil {
		response.Success(c, gin.H{"valid": true})
		return
	}
	h.mapVerifyLikeError(c, err)
}

// redeemRequest is the JSON body for POST /vouchers/redeem.
type redeemRequest struct {
	SerialNo string `json:"serialNo" binding:"required"`
	Secret   string `json:"secret" binding:"required"`
	OrderID  int    `json:"orderId" binding:"required"`
}

// Redeem handles POST /vouchers/redeem — JWT-protected single-use redemption.
// On successful redeem returns the RedeemResult (serial + amount applied).
func (h *SeedreampayHandler) Redeem(c *gin.Context) {
	var req redeemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "serialNo, secret, orderId가 필요합니다")
		return
	}
	userID := c.GetInt("userId")
	ip := c.ClientIP()

	res, err := h.svc.Redeem(c.Request.Context(), services.RedeemInput{
		SerialNo:   req.SerialNo,
		Secret:     req.Secret,
		UserID:     userID,
		UsageOrder: req.OrderID,
		ClientIP:   ip,
	})
	if err == nil {
		response.Success(c, res)
		return
	}
	h.mapVerifyLikeError(c, err)
}

// Refund handles POST /vouchers/:serialNo/refund — JWT-protected user refund.
// User-initiated refunds are bound to the 7-day policy enforced in the service.
func (h *SeedreampayHandler) Refund(c *gin.Context) {
	serial := c.Param("serialNo")
	if serial == "" {
		response.BadRequest(c, "serialNo는 필수입니다")
		return
	}
	userID := c.GetInt("userId")

	err := h.svc.Refund(c.Request.Context(), services.RefundInput{
		SerialNo:    serial,
		RequestedBy: services.ActorUser,
		UserID:      userID,
	})
	if err == nil {
		response.Success(c, gin.H{"refunded": true})
		return
	}
	switch {
	case errors.Is(err, services.ErrVoucherNotFound):
		response.NotFound(c, "바우처를 찾을 수 없습니다")
	case errors.Is(err, services.ErrVoucherAlreadyUsed):
		conflict(c, "이미 사용되었거나 환불 불가능한 상태입니다")
	case errors.Is(err, services.ErrRefundWindowExpired):
		conflict(c, "환불 가능 기간(7일)이 지났습니다")
	default:
		response.InternalServerError(c, "환불 처리 실패")
	}
}

// mapVerifyLikeError centralises the status-code mapping shared between
// Verify and Redeem.
func (h *SeedreampayHandler) mapVerifyLikeError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrVoucherNotFound):
		response.NotFound(c, "바우처를 찾을 수 없습니다")
	case errors.Is(err, services.ErrSecretMismatch):
		response.Unauthorized(c, "비밀번호가 일치하지 않습니다")
	case errors.Is(err, services.ErrVoucherAlreadyUsed):
		conflict(c, "이미 사용된 바우처입니다")
	case errors.Is(err, services.ErrVoucherRefunded):
		conflict(c, "환불된 바우처입니다")
	case errors.Is(err, services.ErrVoucherExpired):
		gone(c, "만료된 바우처입니다")
	default:
		response.InternalServerError(c, "바우처 처리 실패")
	}
}
