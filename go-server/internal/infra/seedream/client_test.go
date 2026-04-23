package seedream

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

// newTestServer 는 Seedream API 를 흉내내는 httptest 서버를 반환합니다.
func newTestServer(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	return httptest.NewServer(handler)
}

func TestClient_IssueVAccount_Success(t *testing.T) {
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		// 요청 검증
		assert.Equal(t, "sk_test_abc", r.Header.Get("X-API-Key"))
		assert.Equal(t, "gift:vaccount:ORD-1", r.Header.Get("Idempotency-Key"))
		assert.Equal(t, "trace-xyz", r.Header.Get("X-Trace-Id"))
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/api/v1/vaccount", r.URL.Path)

		// 응답
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Trace-Id", "trace-xyz")
		_ = json.NewEncoder(w).Encode(Envelope[VAccountIssueResponse]{
			Success: true,
			Data: VAccountIssueResponse{
				ID:               102847,
				OrderNo:          "ORD-1",
				Amount:           50000,
				Status:           "PENDING",
				Phase:            "awaiting_bank_selection",
				TargetURL:        "https://testpg.kiwoompay.co.kr/pay/xyz",
				FormData:         map[string]string{"PAYMETHOD": "VACCT", "TOKEN": "tok-123"},
				ReservedIndex1:   "seedreamgift",
				ReservedIndex2:   "partner-default",
				ReservedString:   "default",
				DepositEndDate:   "20260422180000",
				DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
				CreatedAt:        time.Now().UTC(),
				UpdatedAt:        time.Now().UTC(),
			},
			Meta: &Meta{TraceID: "trace-xyz", Timestamp: time.Now().UTC(), APIVersion: "v1"},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk_test_abc"}, nil, nil, zap.NewNop())
	res, err := c.IssueVAccount(context.Background(), VAccountIssueRequest{
		OrderNo: "ORD-1", Amount: 50000, ProductName: "Test",
		Type: "P", IssueMode: "link", ProductType: "2", BillType: "1",
		ReservedIndex1: "seedreamgift", ReservedIndex2: "partner-default", ReservedString: "default",
		DepositEndDate: "20260422180000",
	}, "gift:vaccount:ORD-1", "trace-xyz")

	require.NoError(t, err)
	assert.Equal(t, int64(102847), res.ID)
	assert.Equal(t, "awaiting_bank_selection", res.Phase)
	assert.Equal(t, "tok-123", res.FormData["TOKEN"])
}

func TestClient_IssueVAccount_ErrorMapping(t *testing.T) {
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(w).Encode(Envelope[any]{
			Success: false, ErrorCode: "IDEMPOTENCY_KEY_REUSE",
			Error: "같은 키로 다른 바디", ErrorID: "ERR-DEADBEEF12345678",
			Meta: &Meta{TraceID: "t-9"},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk"}, nil, nil, zap.NewNop())
	_, err := c.IssueVAccount(context.Background(), VAccountIssueRequest{OrderNo: "X"}, "k", "")
	assert.True(t, errors.Is(err, ErrIdempotencyReuse))

	var apiErr *APIError
	require.True(t, errors.As(err, &apiErr))
	assert.Equal(t, "ERR-DEADBEEF12345678", apiErr.ErrorID)
	assert.Equal(t, "t-9", apiErr.TraceID)
}

func TestClient_IssueVAccount_Timeout(t *testing.T) {
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk", Timeout: 100 * time.Millisecond}, nil, nil, zap.NewNop())
	_, err := c.IssueVAccount(context.Background(), VAccountIssueRequest{OrderNo: "X"}, "k", "")
	assert.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "deadline") || strings.Contains(err.Error(), "timeout"))
}

func TestClient_IssueVAccount_RequiresIdempotencyKey(t *testing.T) {
	c := New(ClientConfig{BaseURL: "http://example.com", APIKey: "sk"}, nil, nil, zap.NewNop())
	_, err := c.IssueVAccount(context.Background(), VAccountIssueRequest{OrderNo: "X"}, "", "trace")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Idempotency-Key")
}

// ─────────────────────────────────────────────────────────
// GetVAccountByOrderNo (Phase 4 Pre-Task-5a)
// ─────────────────────────────────────────────────────────

func TestClient_GetVAccountByOrderNo_Success(t *testing.T) {
	daou := "DAOU-20260423-0001"
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		// 요청 검증
		assert.Equal(t, "sk_test_abc", r.Header.Get("X-API-Key"))
		assert.Equal(t, "trace-get-1", r.Header.Get("X-Trace-Id"))
		assert.Equal(t, http.MethodGet, r.Method)
		assert.Equal(t, "/api/v1/vaccount", r.URL.Path)
		assert.Equal(t, "GIFT-20260423-00001", r.URL.Query().Get("orderNo"))
		// GET 은 Idempotency-Key 불요
		assert.Empty(t, r.Header.Get("Idempotency-Key"))

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Trace-Id", "trace-get-1")
		_ = json.NewEncoder(w).Encode(Envelope[VAccountListPage]{
			Success: true,
			Data: VAccountListPage{
				Items: []VAccountResult{{
					ID:        9001,
					OrderNo:   "GIFT-20260423-00001",
					Amount:    50000,
					Status:    "PENDING",
					Phase:     "awaiting_deposit",
					DaouTrx:   &daou,
					CreatedAt: time.Now().UTC(),
					UpdatedAt: time.Now().UTC(),
				}},
				Total: 1, Page: 1, Limit: 20, HasMore: false,
			},
			Meta: &Meta{TraceID: "trace-get-1", Timestamp: time.Now().UTC(), APIVersion: "v1"},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk_test_abc"}, nil, nil, zap.NewNop())
	res, err := c.GetVAccountByOrderNo(context.Background(), "GIFT-20260423-00001", "trace-get-1")

	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Equal(t, "GIFT-20260423-00001", res.OrderNo)
	require.NotNil(t, res.DaouTrx)
	assert.Equal(t, daou, *res.DaouTrx)
	assert.Equal(t, "awaiting_deposit", res.Phase)
}

func TestClient_GetVAccountByOrderNo_NotFound(t *testing.T) {
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// Seedream 계약: orderNo 필터 미매치는 200 + 빈 items (에러 아님).
		_ = json.NewEncoder(w).Encode(Envelope[VAccountListPage]{
			Success: true,
			Data:    VAccountListPage{Items: []VAccountResult{}, Total: 0, Page: 1, Limit: 20, HasMore: false},
			Meta:    &Meta{TraceID: "t-empty"},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk"}, nil, nil, zap.NewNop())
	res, err := c.GetVAccountByOrderNo(context.Background(), "GIFT-MISSING", "")

	assert.NoError(t, err)
	assert.Nil(t, res)
}

func TestClient_GetVAccountByOrderNo_SeedreamError(t *testing.T) {
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(Envelope[any]{
			Success:   false,
			ErrorCode: "UNAUTHORIZED",
			Error:     "X-API-Key 누락",
			ErrorID:   "ERR-CAFEBABE00001111",
			Meta:      &Meta{TraceID: "t-err"},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk"}, nil, nil, zap.NewNop())
	res, err := c.GetVAccountByOrderNo(context.Background(), "GIFT-X", "")

	assert.Nil(t, res)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrUnauthorized))

	var apiErr *APIError
	require.True(t, errors.As(err, &apiErr))
	assert.Equal(t, "ERR-CAFEBABE00001111", apiErr.ErrorID)
	assert.Equal(t, "t-err", apiErr.TraceID)
}
