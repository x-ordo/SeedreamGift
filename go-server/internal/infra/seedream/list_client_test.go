package seedream

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func TestClient_ListVAccounts_Success(t *testing.T) {
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/api/v1/vaccount", r.URL.Path)
		assert.Equal(t, "sk_test", r.Header.Get("X-API-Key"))

		// 쿼리 파라미터 검증
		q := r.URL.Query()
		assert.Equal(t, "seedreamgift", q.Get("reservedIndex1"))
		assert.Equal(t, "1", q.Get("page"))
		assert.Equal(t, "100", q.Get("pageSize"))
		assert.NotEmpty(t, q.Get("from"), "from 파라미터 필수")

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Envelope[VAccountListPage]{
			Success: true,
			Data: VAccountListPage{
				Items: []VAccountResult{
					{ID: 1, OrderNo: "ORD-A", Status: "SUCCESS", Phase: "completed", Amount: 50000},
					{ID: 2, OrderNo: "ORD-B", Status: "PENDING", Phase: "awaiting_deposit", Amount: 30000},
				},
				Total: 2, Page: 1, Limit: 100, HasMore: false,
			},
			Meta: &Meta{TraceID: "trace-list", Timestamp: time.Now().UTC()},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk_test"}, nil, nil, zap.NewNop())
	resp, err := c.ListVAccounts(context.Background(), VAccountListQuery{
		From:           time.Now().Add(-15 * time.Minute),
		ReservedIndex1: "seedreamgift",
	}, "trace-list")

	require.NoError(t, err)
	assert.Len(t, resp.Items, 2)
	assert.Equal(t, "ORD-A", resp.Items[0].OrderNo)
	assert.False(t, resp.HasMore)
}

func TestClient_ListVAccounts_ErrorEnvelope(t *testing.T) {
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(Envelope[VAccountListPage]{
			Success:   false,
			ErrorCode: "UNAUTHORIZED",
			Error:     "유효하지 않은 API 키입니다",
			ErrorID:   "ERR-1234567890ABCDEF",
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk_bad"}, nil, nil, zap.NewNop())
	_, err := c.ListVAccounts(context.Background(), VAccountListQuery{}, "")

	require.Error(t, err)
	assert.Contains(t, strings.ToUpper(err.Error()), "UNAUTHORIZED")
}

func TestClient_WalkVAccountsSince_MultiPage(t *testing.T) {
	var pageCount int32
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&pageCount, 1)
		p, _ := strconv.Atoi(r.URL.Query().Get("page"))
		assert.Equal(t, int(n), p)

		hasMore := p < 3
		items := []VAccountResult{
			{ID: int64(p*10 + 1), OrderNo: "ORD-P" + strconv.Itoa(p) + "-1", Status: "PENDING"},
			{ID: int64(p*10 + 2), OrderNo: "ORD-P" + strconv.Itoa(p) + "-2", Status: "PENDING"},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Envelope[VAccountListPage]{
			Success: true,
			Data: VAccountListPage{
				Items: items, Total: 6, Page: p, Limit: 100, HasMore: hasMore,
			},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk"}, nil, nil, zap.NewNop())
	var visited []string
	err := c.WalkVAccountsSince(context.Background(), VAccountListQuery{}, func(_ context.Context, item VAccountResult) error {
		visited = append(visited, item.OrderNo)
		return nil
	}, "")

	require.NoError(t, err)
	assert.Len(t, visited, 6, "3 페이지 × 2 아이템")
	assert.Equal(t, int32(3), atomic.LoadInt32(&pageCount))
}

func TestClient_WalkVAccountsSince_PageLimitExceeded(t *testing.T) {
	// 항상 HasMore=true 응답해 maxPages(50) 초과 에러 유도
	var pageCount int32
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&pageCount, 1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(Envelope[VAccountListPage]{
			Success: true,
			Data: VAccountListPage{
				Items:   []VAccountResult{{ID: 1, OrderNo: "X"}},
				HasMore: true,
			},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk"}, nil, nil, zap.NewNop())
	err := c.WalkVAccountsSince(context.Background(), VAccountListQuery{}, func(context.Context, VAccountResult) error { return nil }, "")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "exceeded")
	assert.Equal(t, int32(50), atomic.LoadInt32(&pageCount), "maxPages=50 까지만 호출")
}
