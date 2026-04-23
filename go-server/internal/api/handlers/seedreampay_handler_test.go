package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"seedream-gift-server/internal/app/services"
)

// fakeSdpSvc is a hand-rolled stub matching SeedreampayServiceIface. Each
// field is a closure allowing individual test cases to override only the
// call they care about.
type fakeSdpSvc struct {
	getFn    func(ctx context.Context, serial string) (*services.VoucherView, error)
	verifyFn func(ctx context.Context, serial, secret string) error
	redeemFn func(ctx context.Context, in services.RedeemInput) (*services.RedeemResult, error)
	refundFn func(ctx context.Context, in services.RefundInput) error
}

func (f *fakeSdpSvc) GetVoucherBySerial(ctx context.Context, serial string) (*services.VoucherView, error) {
	return f.getFn(ctx, serial)
}
func (f *fakeSdpSvc) VerifyPair(ctx context.Context, serial, secret string) error {
	return f.verifyFn(ctx, serial, secret)
}
func (f *fakeSdpSvc) Redeem(ctx context.Context, in services.RedeemInput) (*services.RedeemResult, error) {
	return f.redeemFn(ctx, in)
}
func (f *fakeSdpSvc) Refund(ctx context.Context, in services.RefundInput) error {
	return f.refundFn(ctx, in)
}

func init() {
	// Quiet mode so tests don't spam stdout with gin route logs.
	gin.SetMode(gin.TestMode)
}

// newTestHandler wires a fake service into a SeedreampayHandler without
// going through the production constructor (which requires a real service).
func newTestHandler(fake *fakeSdpSvc) *SeedreampayHandler {
	return &SeedreampayHandler{svc: fake}
}

func jsonBody(t *testing.T, v any) *bytes.Buffer {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return bytes.NewBuffer(b)
}

// -----------------------------------------------------------------------------
// GetVoucher
// -----------------------------------------------------------------------------

func TestSeedreampayHandler_GetVoucher(t *testing.T) {
	cases := []struct {
		name     string
		getFn    func(ctx context.Context, serial string) (*services.VoucherView, error)
		wantCode int
	}{
		{
			name: "200 returns voucher view",
			getFn: func(_ context.Context, _ string) (*services.VoucherView, error) {
				return &services.VoucherView{SerialNo: "SEED-10K1-X7AB-K9PD-M3QY", Status: "SOLD"}, nil
			},
			wantCode: http.StatusOK,
		},
		{
			name: "404 when not found",
			getFn: func(_ context.Context, _ string) (*services.VoucherView, error) {
				return nil, services.ErrVoucherNotFound
			},
			wantCode: http.StatusNotFound,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newTestHandler(&fakeSdpSvc{getFn: tc.getFn})
			r := gin.New()
			r.GET("/v/:serialNo", h.GetVoucher)

			req := httptest.NewRequest(http.MethodGet, "/v/SEED-10K1-X7AB-K9PD-M3QY", nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			require.Equal(t, tc.wantCode, w.Code)
		})
	}
}

// -----------------------------------------------------------------------------
// Verify
// -----------------------------------------------------------------------------

func TestSeedreampayHandler_Verify(t *testing.T) {
	cases := []struct {
		name     string
		svcErr   error
		wantCode int
	}{
		{"200 ok", nil, http.StatusOK},
		{"404 not found", services.ErrVoucherNotFound, http.StatusNotFound},
		{"401 secret mismatch", services.ErrSecretMismatch, http.StatusUnauthorized},
		{"409 already used", services.ErrVoucherAlreadyUsed, http.StatusConflict},
		{"410 expired", services.ErrVoucherExpired, http.StatusGone},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newTestHandler(&fakeSdpSvc{verifyFn: func(_ context.Context, _, _ string) error {
				return tc.svcErr
			}})

			r := gin.New()
			r.POST("/verify", h.Verify)

			body := jsonBody(t, map[string]string{"serialNo": "SEED-10K1-X7AB-K9PD-M3QY", "secret": "482917365021"})
			req := httptest.NewRequest(http.MethodPost, "/verify", body)
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			require.Equal(t, tc.wantCode, w.Code)
		})
	}
}

// -----------------------------------------------------------------------------
// Redeem
// -----------------------------------------------------------------------------

func TestSeedreampayHandler_Redeem(t *testing.T) {
	cases := []struct {
		name     string
		svcFn    func(ctx context.Context, in services.RedeemInput) (*services.RedeemResult, error)
		wantCode int
	}{
		{
			name: "200 on success",
			svcFn: func(_ context.Context, _ services.RedeemInput) (*services.RedeemResult, error) {
				return &services.RedeemResult{SerialNo: "SEED-10K1-X7AB-K9PD-M3QY", AmountApplied: 10000}, nil
			},
			wantCode: http.StatusOK,
		},
		{
			name: "401 on secret mismatch",
			svcFn: func(_ context.Context, _ services.RedeemInput) (*services.RedeemResult, error) {
				return nil, services.ErrSecretMismatch
			},
			wantCode: http.StatusUnauthorized,
		},
		{
			name: "409 on already used",
			svcFn: func(_ context.Context, _ services.RedeemInput) (*services.RedeemResult, error) {
				return nil, services.ErrVoucherAlreadyUsed
			},
			wantCode: http.StatusConflict,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newTestHandler(&fakeSdpSvc{redeemFn: tc.svcFn})
			r := gin.New()
			r.POST("/redeem", func(c *gin.Context) {
				c.Set("userId", 42)
				h.Redeem(c)
			})

			body := jsonBody(t, map[string]any{
				"serialNo": "SEED-10K1-X7AB-K9PD-M3QY",
				"secret":   "482917365021",
				"orderId":  1001,
			})
			req := httptest.NewRequest(http.MethodPost, "/redeem", body)
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			require.Equal(t, tc.wantCode, w.Code)
		})
	}
}

// -----------------------------------------------------------------------------
// Refund
// -----------------------------------------------------------------------------

func TestSeedreampayHandler_Refund(t *testing.T) {
	cases := []struct {
		name     string
		svcErr   error
		wantCode int
	}{
		{"200 on success", nil, http.StatusOK},
		{"404 on not found", services.ErrVoucherNotFound, http.StatusNotFound},
		{"409 on already used", services.ErrVoucherAlreadyUsed, http.StatusConflict},
		{"409 on refund window expired", services.ErrRefundWindowExpired, http.StatusConflict},
		{"500 on unexpected error", errors.New("boom"), http.StatusInternalServerError},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newTestHandler(&fakeSdpSvc{refundFn: func(_ context.Context, _ services.RefundInput) error {
				return tc.svcErr
			}})
			r := gin.New()
			r.POST("/:serialNo/refund", func(c *gin.Context) {
				c.Set("userId", 42)
				h.Refund(c)
			})

			req := httptest.NewRequest(http.MethodPost, "/SEED-10K1-X7AB-K9PD-M3QY/refund", nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			require.Equal(t, tc.wantCode, w.Code)
		})
	}
}
