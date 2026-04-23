// Package handlers — Seedreampay consumer-facing HTTP endpoints.
//
// Endpoints mounted here serve both public and JWT-protected traffic for the
// voucher lifecycle after issuance: lookup, verify (pre-flight), redeem, and
// refund. The handler is intentionally thin — service-layer sentinels are
// translated to precise HTTP status codes, and an optional Redis-backed
// lockout guard is consulted to throttle credential-stuffing attempts.
package handlers

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/infra/lockout"
	"seedream-gift-server/pkg/logger"
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

// SeedreampayLockout is the subset of lockout.Guard the handler uses. Allows
// tests to simulate lockout state without a running Redis.
type SeedreampayLockout interface {
	IsSerialBlocked(ctx context.Context, serial string) (bool, error)
	IsIPBlocked(ctx context.Context, ip string) (bool, error)
	RegisterSerialFailure(ctx context.Context, serial string) (bool, error)
	RegisterIPFailure(ctx context.Context, ip string) (bool, error)
}

// SeedreampayHandler exposes the four consumer voucher endpoints.
type SeedreampayHandler struct {
	svc     SeedreampayServiceIface
	lockout SeedreampayLockout
}

// NewSeedreampayHandler constructs a handler bound to a SeedreampayService.
// Lockout wiring is intentionally separate — call SetLockout post-construction
// to enable Redis-backed rate limiting (only in environments with Redis).
func NewSeedreampayHandler(svc *services.SeedreampayService) *SeedreampayHandler {
	return &SeedreampayHandler{svc: svc}
}

// SetLockout injects a Redis-backed lockout guard. Nil-safe — passing nil
// disables lockout enforcement (useful in unit tests and Redis-free dev).
func (h *SeedreampayHandler) SetLockout(g *lockout.Guard) {
	if g == nil {
		h.lockout = nil
		return
	}
	h.lockout = g
}

// setLockoutIface is a test-only seam: allows injecting a fake lockout that
// satisfies SeedreampayLockout without constructing a real *lockout.Guard.
func (h *SeedreampayHandler) setLockoutIface(g SeedreampayLockout) {
	h.lockout = g
}

// tooManyRequests emits a 429 with a user-visible Korean message. Response
// helpers don't provide a dedicated 429 today, so we write it directly.
func tooManyRequests(c *gin.Context) {
	c.JSON(http.StatusTooManyRequests, response.Response{
		Success: false,
		Error:   "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
	})
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
// caller commits to a redeem. Lockout gates are evaluated before the DB call
// so an abuser cannot burn query cycles. Fails open on Redis outage.
func (h *SeedreampayHandler) Verify(c *gin.Context) {
	var req verifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "serialNo와 secret이 필요합니다")
		return
	}

	ctx := c.Request.Context()
	ip := c.ClientIP()

	if h.lockout != nil {
		if blocked, _ := h.lockout.IsIPBlocked(ctx, ip); blocked {
			logger.Log.Warn("seedreampay verify blocked by ip lockout",
				zap.String("ip", ip),
				zap.String("serialNo", req.SerialNo),
			)
			tooManyRequests(c)
			return
		}
		if blocked, _ := h.lockout.IsSerialBlocked(ctx, req.SerialNo); blocked {
			logger.Log.Warn("seedreampay verify blocked by serial lockout",
				zap.String("ip", ip),
				zap.String("serialNo", req.SerialNo),
			)
			tooManyRequests(c)
			return
		}
	}

	err := h.svc.VerifyPair(ctx, req.SerialNo, req.Secret)
	if err == nil {
		response.Success(c, gin.H{"valid": true})
		return
	}
	h.mapVerifyLikeError(c, err, req.SerialNo)
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
	ctx := c.Request.Context()

	if h.lockout != nil {
		if blocked, _ := h.lockout.IsIPBlocked(ctx, ip); blocked {
			logger.Log.Warn("seedreampay redeem blocked by ip lockout",
				zap.String("ip", ip),
				zap.String("serialNo", req.SerialNo),
			)
			tooManyRequests(c)
			return
		}
		if blocked, _ := h.lockout.IsSerialBlocked(ctx, req.SerialNo); blocked {
			logger.Log.Warn("seedreampay redeem blocked by serial lockout",
				zap.String("ip", ip),
				zap.String("serialNo", req.SerialNo),
			)
			tooManyRequests(c)
			return
		}
	}

	res, err := h.svc.Redeem(ctx, services.RedeemInput{
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
	h.mapVerifyLikeError(c, err, req.SerialNo)
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
// Verify and Redeem. Secret mismatches also bump the lockout counters so the
// next attempt from the same IP or for the same serial may be short-circuited.
func (h *SeedreampayHandler) mapVerifyLikeError(c *gin.Context, err error, serial string) {
	switch {
	case errors.Is(err, services.ErrVoucherNotFound):
		response.NotFound(c, "바우처를 찾을 수 없습니다")
	case errors.Is(err, services.ErrSecretMismatch):
		if h.lockout != nil {
			ctx := c.Request.Context()
			ip := c.ClientIP()
			if _, lerr := h.lockout.RegisterSerialFailure(ctx, serial); lerr != nil {
				logger.Log.Warn("lockout register serial failure error",
					zap.String("serialNo", serial), zap.Error(lerr))
			}
			if _, lerr := h.lockout.RegisterIPFailure(ctx, ip); lerr != nil {
				logger.Log.Warn("lockout register ip failure error",
					zap.String("ip", ip), zap.Error(lerr))
			}
		}
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
