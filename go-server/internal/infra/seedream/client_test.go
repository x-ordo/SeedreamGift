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
