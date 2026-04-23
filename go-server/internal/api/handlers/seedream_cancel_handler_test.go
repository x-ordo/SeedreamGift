package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/infra/seedream"
)

// fakeCancelSvc 는 CancelServiceAPI 의 수동 스텁입니다.
// 각 필드는 closure 로 두어, 개별 테스트 케이스가 필요한 메서드만 덮어쓸 수 있게 합니다.
// 호출 인자는 *InputCapture 필드에 저장돼 테스트에서 assert 가능.
type fakeCancelSvc struct {
	cancelIssuedFn func(ctx context.Context, in services.SeedreamCancelInput) (*services.SeedreamCancelResult, error)
	refundFn       func(ctx context.Context, in services.SeedreamRefundInput) (*services.SeedreamCancelResult, error)

	// capture
	lastCancelInput *services.SeedreamCancelInput
	lastRefundInput *services.SeedreamRefundInput
}

func (f *fakeCancelSvc) CancelIssued(
	ctx context.Context, in services.SeedreamCancelInput,
) (*services.SeedreamCancelResult, error) {
	f.lastCancelInput = &in
	if f.cancelIssuedFn == nil {
		return nil, errors.New("cancelIssuedFn not set")
	}
	return f.cancelIssuedFn(ctx, in)
}

func (f *fakeCancelSvc) Refund(
	ctx context.Context, in services.SeedreamRefundInput,
) (*services.SeedreamCancelResult, error) {
	f.lastRefundInput = &in
	if f.refundFn == nil {
		return nil, errors.New("refundFn not set")
	}
	return f.refundFn(ctx, in)
}

// 컴파일 타임 guard — fakeCancelSvc 가 계속 인터페이스를 만족하는지 확인.
var _ CancelServiceAPI = (*fakeCancelSvc)(nil)

// newTestCancelHandler 는 프로덕션 생성자를 우회해 fake service 로
// SeedreamCancelHandler 를 wire 합니다.
func newTestCancelHandler(fake *fakeCancelSvc) *SeedreamCancelHandler {
	return &SeedreamCancelHandler{cancelSvc: fake}
}

// buildRouter 는 테스트용 Gin 라우터를 만들고, setUserID==true 이면
// 미들웨어 시뮬레이션으로 userId=42 를 context 에 세팅합니다.
func buildRouter(h *SeedreamCancelHandler, setUserID bool) *gin.Engine {
	r := gin.New()
	r.POST("/cancel", func(c *gin.Context) {
		if setUserID {
			c.Set("userId", 42)
		}
		h.Handle(c)
	})
	return r
}

// doCancelReq 는 JSON body 를 POST 하고 결과 ResponseRecorder 를 돌려줍니다.
func doCancelReq(t *testing.T, r *gin.Engine, body any) *httptest.ResponseRecorder {
	t.Helper()
	b, err := json.Marshal(body)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/cancel", bytes.NewBuffer(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// -----------------------------------------------------------------------------
// 1) VACCOUNT-ISSUECAN 성공
// -----------------------------------------------------------------------------

func TestSeedreamCancelHandler_CancelIssued_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	expectedResp := &seedream.CancelResponse{
		Token:        "TOK123",
		ResultCode:   "0000",
		ErrorMessage: "",
		TrxID:        "TRX-ABC",
		Amount:       "50000",
		CancelDate:   "20260423120000",
	}

	fake := &fakeCancelSvc{
		cancelIssuedFn: func(_ context.Context, _ services.SeedreamCancelInput) (*services.SeedreamCancelResult, error) {
			return &services.SeedreamCancelResult{Response: expectedResp}, nil
		},
	}

	h := newTestCancelHandler(fake)
	r := buildRouter(h, true)

	w := doCancelReq(t, r, map[string]any{
		"orderCode":    "ORDER-001",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "고객 단순변심",
	})

	require.Equal(t, http.StatusOK, w.Code)

	var got CancelHTTPResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.True(t, got.Success)
	require.False(t, got.AlreadyDone)
	require.NotNil(t, got.Data)
	require.Equal(t, "0000", got.Data.ResultCode)

	// 서비스가 받은 인자 검증 — 핸들러가 payload 를 정확히 전달했는지.
	require.NotNil(t, fake.lastCancelInput)
	require.Equal(t, "ORDER-001", fake.lastCancelInput.OrderCode)
	require.Equal(t, "고객 단순변심", fake.lastCancelInput.CancelReason)
	require.Equal(t, 42, fake.lastCancelInput.UserID)
}

// -----------------------------------------------------------------------------
// 2) BANK (Refund) 성공
// -----------------------------------------------------------------------------

func TestSeedreamCancelHandler_Refund_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	expectedResp := &seedream.CancelResponse{
		Token:      "TOK_REFUND",
		ResultCode: "0000",
		TrxID:      "TRX-REF",
		Amount:     "50000",
		CancelDate: "20260423120000",
	}

	fake := &fakeCancelSvc{
		refundFn: func(_ context.Context, _ services.SeedreamRefundInput) (*services.SeedreamCancelResult, error) {
			return &services.SeedreamCancelResult{Response: expectedResp}, nil
		},
	}

	h := newTestCancelHandler(fake)
	r := buildRouter(h, true)

	w := doCancelReq(t, r, map[string]any{
		"orderCode":    "ORDER-002",
		"payMethod":    "BANK",
		"cancelReason": "배송 지연으로 환불 요청",
		"bankCode":     "088",
		"accountNo":    "110-1234-5678",
	})

	require.Equal(t, http.StatusOK, w.Code)

	var got CancelHTTPResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.True(t, got.Success)
	require.NotNil(t, got.Data)
	require.Equal(t, "0000", got.Data.ResultCode)

	require.NotNil(t, fake.lastRefundInput)
	require.Equal(t, "088", fake.lastRefundInput.BankCode)
	require.Equal(t, "110-1234-5678", fake.lastRefundInput.AccountNo)
	require.Equal(t, 42, fake.lastRefundInput.UserID)
}

// -----------------------------------------------------------------------------
// 3) AlreadyDone → 200 + alreadyDone:true
// -----------------------------------------------------------------------------

func TestSeedreamCancelHandler_AlreadyDone_200(t *testing.T) {
	gin.SetMode(gin.TestMode)

	fake := &fakeCancelSvc{
		cancelIssuedFn: func(_ context.Context, _ services.SeedreamCancelInput) (*services.SeedreamCancelResult, error) {
			return &services.SeedreamCancelResult{AlreadyDone: true}, nil
		},
	}

	h := newTestCancelHandler(fake)
	r := buildRouter(h, true)

	w := doCancelReq(t, r, map[string]any{
		"orderCode":    "ORDER-003",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "중복 요청 테스트",
	})

	require.Equal(t, http.StatusOK, w.Code)

	var got CancelHTTPResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.True(t, got.Success)
	require.True(t, got.AlreadyDone)
	require.NotEmpty(t, got.Message)
	// data 는 nil 이어야 함 — 재호출은 원본 응답 없음.
	require.Nil(t, got.Data)
}

// -----------------------------------------------------------------------------
// 4) cancelReason 짧음 → binding validator 에 의해 400
// -----------------------------------------------------------------------------

func TestSeedreamCancelHandler_ValidationFailure_400(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// svcFn 은 호출되면 안 됨 — 핸들러에서 binding 단계에서 먼저 차단.
	fake := &fakeCancelSvc{
		cancelIssuedFn: func(_ context.Context, _ services.SeedreamCancelInput) (*services.SeedreamCancelResult, error) {
			t.Fatal("service should NOT be called when binding validation fails")
			return nil, nil
		},
	}

	h := newTestCancelHandler(fake)
	r := buildRouter(h, true)

	w := doCancelReq(t, r, map[string]any{
		"orderCode":    "ORDER-004",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "abc", // min=5 위반
	})

	require.Equal(t, http.StatusBadRequest, w.Code)

	var got map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Equal(t, false, got["success"])
	require.Equal(t, "VALIDATION", got["errorCode"])
}

// -----------------------------------------------------------------------------
// 5) 잘못된 payMethod → binding oneof 로 400
// -----------------------------------------------------------------------------

func TestSeedreamCancelHandler_InvalidPayMethod_400(t *testing.T) {
	gin.SetMode(gin.TestMode)

	fake := &fakeCancelSvc{}

	h := newTestCancelHandler(fake)
	r := buildRouter(h, true)

	w := doCancelReq(t, r, map[string]any{
		"orderCode":    "ORDER-005",
		"payMethod":    "PAYPAL", // 화이트리스트 외
		"cancelReason": "테스트 사유입니다",
	})

	require.Equal(t, http.StatusBadRequest, w.Code)

	var got map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Equal(t, "VALIDATION", got["errorCode"])
}

// -----------------------------------------------------------------------------
// 6) CANCEL_INVALID_STATE → 409
// -----------------------------------------------------------------------------

func TestSeedreamCancelHandler_CancelInvalidState_409(t *testing.T) {
	gin.SetMode(gin.TestMode)

	fake := &fakeCancelSvc{
		cancelIssuedFn: func(_ context.Context, _ services.SeedreamCancelInput) (*services.SeedreamCancelResult, error) {
			// 서비스가 seedream sentinel 을 wrap 해서 던질 때 errors.Is 로 매칭돼야 함.
			return nil, fmt.Errorf("seedream CancelIssued: %w", seedream.ErrCancelInvalidState)
		},
	}

	h := newTestCancelHandler(fake)
	r := buildRouter(h, true)

	w := doCancelReq(t, r, map[string]any{
		"orderCode":    "ORDER-006",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "상태 불일치 케이스 테스트",
	})

	require.Equal(t, http.StatusConflict, w.Code)

	var got map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Equal(t, "CANCEL_INVALID_STATE", got["errorCode"])
}

// -----------------------------------------------------------------------------
// 7) userId 미세팅 → 401
// -----------------------------------------------------------------------------

func TestSeedreamCancelHandler_Unauthorized_401(t *testing.T) {
	gin.SetMode(gin.TestMode)

	fake := &fakeCancelSvc{
		cancelIssuedFn: func(_ context.Context, _ services.SeedreamCancelInput) (*services.SeedreamCancelResult, error) {
			t.Fatal("service should NOT be called when user is not authenticated")
			return nil, nil
		},
	}

	h := newTestCancelHandler(fake)
	r := buildRouter(h, false) // JWT 미들웨어 시뮬레이션 건너뜀

	w := doCancelReq(t, r, map[string]any{
		"orderCode":    "ORDER-007",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "인증 없는 요청 테스트",
	})

	require.Equal(t, http.StatusUnauthorized, w.Code)

	var got map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Equal(t, "UNAUTHORIZED", got["errorCode"])
}

// -----------------------------------------------------------------------------
// 8) BANK 에 bankCode 누락 → 400 (Service 호출 전 차단)
// -----------------------------------------------------------------------------

func TestSeedreamCancelHandler_BankMissingFields_400(t *testing.T) {
	gin.SetMode(gin.TestMode)

	fake := &fakeCancelSvc{
		refundFn: func(_ context.Context, _ services.SeedreamRefundInput) (*services.SeedreamCancelResult, error) {
			t.Fatal("service should NOT be called when BANK fields missing")
			return nil, nil
		},
	}

	h := newTestCancelHandler(fake)
	r := buildRouter(h, true)

	w := doCancelReq(t, r, map[string]any{
		"orderCode":    "ORDER-008",
		"payMethod":    "BANK",
		"cancelReason": "bankCode 누락 테스트",
		// bankCode / accountNo 누락
	})

	require.Equal(t, http.StatusBadRequest, w.Code)

	var got map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Equal(t, "VALIDATION", got["errorCode"])
}

// -----------------------------------------------------------------------------
// 9) 주문 미발견 (gorm.ErrRecordNotFound wrap) → 404
// -----------------------------------------------------------------------------

func TestSeedreamCancelHandler_OrderNotFound_404(t *testing.T) {
	gin.SetMode(gin.TestMode)

	fake := &fakeCancelSvc{
		cancelIssuedFn: func(_ context.Context, _ services.SeedreamCancelInput) (*services.SeedreamCancelResult, error) {
			// CancelService.loadOrderAndPayment 의 wrap 스타일 재현.
			return nil, fmt.Errorf("order lookup: %w", gorm.ErrRecordNotFound)
		},
	}

	h := newTestCancelHandler(fake)
	r := buildRouter(h, true)

	w := doCancelReq(t, r, map[string]any{
		"orderCode":    "ORDER-009",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "미존재 주문 테스트",
	})

	require.Equal(t, http.StatusNotFound, w.Code)

	var got map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Equal(t, "NOT_FOUND", got["errorCode"])
}

// -----------------------------------------------------------------------------
// 10) Seedream 외부 장애 → 502
// -----------------------------------------------------------------------------

func TestSeedreamCancelHandler_ExternalAPI_502(t *testing.T) {
	gin.SetMode(gin.TestMode)

	fake := &fakeCancelSvc{
		cancelIssuedFn: func(_ context.Context, _ services.SeedreamCancelInput) (*services.SeedreamCancelResult, error) {
			return nil, fmt.Errorf("seedream CancelIssued: %w", seedream.ErrExternalAPI)
		},
	}

	h := newTestCancelHandler(fake)
	r := buildRouter(h, true)

	w := doCancelReq(t, r, map[string]any{
		"orderCode":    "ORDER-010",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "외부 API 실패 테스트",
	})

	require.Equal(t, http.StatusBadGateway, w.Code)

	var got map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Equal(t, "EXTERNAL_API_ERROR", got["errorCode"])
}
