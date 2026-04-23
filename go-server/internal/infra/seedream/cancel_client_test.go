package seedream

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

// TestCancelIssued_Success 는 입금 전 발급 취소 happy path.
// - payMethod=VACCOUNT-ISSUECAN, bankCode/accountNo 는 omitempty 로 빠져야 함
// - Idempotency-Key 헤더 = "gift:cancel:ORD-1"
// - 응답 CancelResponse.ResultCode == "0000", Amount == "50000"
func TestCancelIssued_Success(t *testing.T) {
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		// 요청 검증
		assert.Equal(t, "sk_test_abc", r.Header.Get("X-API-Key"))
		assert.Equal(t, "gift:cancel:ORD-1", r.Header.Get("Idempotency-Key"))
		assert.Equal(t, "trace-cancel-1", r.Header.Get("X-Trace-Id"))
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/api/v1/payment/cancel", r.URL.Path)

		// 바디 파싱 후 필드 검증 (bankCode/accountNo 가 omitempty 로 빠져있는지 map 으로 확인)
		bodyBytes, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		var raw map[string]any
		require.NoError(t, json.Unmarshal(bodyBytes, &raw))
		assert.Equal(t, "VACCOUNT-ISSUECAN", raw["payMethod"])
		assert.Equal(t, "T123", raw["trxId"])
		assert.EqualValues(t, 50000, raw["amount"])
		assert.Equal(t, "단순 변심", raw["cancelReason"])
		_, hasBankCode := raw["bankCode"]
		assert.False(t, hasBankCode, "bankCode 는 VACCOUNT-ISSUECAN 에서 omitempty 로 빠져야 함")
		_, hasAccountNo := raw["accountNo"]
		assert.False(t, hasAccountNo, "accountNo 는 VACCOUNT-ISSUECAN 에서 omitempty 로 빠져야 함")

		// 응답
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Trace-Id", "trace-cancel-1")
		_ = json.NewEncoder(w).Encode(Envelope[CancelResponse]{
			Success: true,
			Data: CancelResponse{
				Token:      "tok-cancel-1",
				ResultCode: "0000",
				TrxID:      "T123",
				Amount:     "50000",
				CancelDate: "20260423091500",
			},
			Meta: &Meta{TraceID: "trace-cancel-1", Timestamp: time.Now().UTC(), APIVersion: "v1"},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk_test_abc"}, nil, nil, zap.NewNop())
	res, err := c.CancelIssued(context.Background(),
		"ORD-1", "T123", 50000, "단순 변심",
		"gift:cancel:ORD-1", "trace-cancel-1")

	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Equal(t, "0000", res.ResultCode)
	assert.Equal(t, "50000", res.Amount)
	assert.Equal(t, "T123", res.TrxID)
	assert.Equal(t, "20260423091500", res.CancelDate)
}

// TestRefundDeposited_Success 는 입금 후 환불 happy path.
// - payMethod=BANK, bankCode/accountNo 포함
// - Idempotency-Key 헤더가 호출자가 넘긴 값과 일치
// - CancelResponse.ResultCode == "0000"
func TestRefundDeposited_Success(t *testing.T) {
	const customIdemKey = "gift:refund:ORD-2:20260423091500"
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "sk_test_abc", r.Header.Get("X-API-Key"))
		assert.Equal(t, customIdemKey, r.Header.Get("Idempotency-Key"))
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/api/v1/payment/cancel", r.URL.Path)

		bodyBytes, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		var raw map[string]any
		require.NoError(t, json.Unmarshal(bodyBytes, &raw))
		assert.Equal(t, "BANK", raw["payMethod"])
		assert.Equal(t, "T456", raw["trxId"])
		assert.EqualValues(t, 50000, raw["amount"])
		assert.Equal(t, "고객 요청", raw["cancelReason"])
		assert.Equal(t, "088", raw["bankCode"])
		assert.Equal(t, "110-1", raw["accountNo"])

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Envelope[CancelResponse]{
			Success: true,
			Data: CancelResponse{
				Token:      "tok-refund-1",
				ResultCode: "0000",
				TrxID:      "T456",
				Amount:     "50000",
				CancelDate: "20260423091600",
			},
			Meta: &Meta{TraceID: "trace-refund-1", Timestamp: time.Now().UTC(), APIVersion: "v1"},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk_test_abc"}, nil, nil, zap.NewNop())
	res, err := c.RefundDeposited(context.Background(),
		"ORD-2", "T456", 50000, "고객 요청",
		"088", "110-1",
		customIdemKey, "") // traceID 빈 값 → 자동 UUID

	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Equal(t, "0000", res.ResultCode)
	assert.Equal(t, "50000", res.Amount)
}

// TestCancelIssued_SeedreamError 는 Seedream 이 errorCode 를 반환할 때
// MapErrorCode 가 non-nil error 를 내보내는지 확인.
func TestCancelIssued_SeedreamError(t *testing.T) {
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(w).Encode(Envelope[any]{
			Success:   false,
			ErrorCode: "CANCEL_INVALID_STATE",
			Error:     "현재 상태에서 취소 불가",
			ErrorID:   "ERR-CAFEBABE12345678",
			Meta:      &Meta{TraceID: "t-cancel-err"},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk"}, nil, nil, zap.NewNop())
	res, err := c.CancelIssued(context.Background(),
		"ORD-3", "T789", 10000, "테스트",
		"gift:cancel:ORD-3", "")
	assert.Nil(t, res)
	assert.Error(t, err)
}
