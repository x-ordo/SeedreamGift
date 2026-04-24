package seedream

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ClientConfig 는 Seedream Client 초기화 설정입니다.
type ClientConfig struct {
	BaseURL string        // 예: https://test.seedreamapi.kr
	APIKey  string        // X-API-Key
	Timeout time.Duration // 전체 요청 타임아웃 (기본 10s)
}

// Client 는 Seedream REST API 호출 클라이언트입니다.
// HTTP 와이어링만 담당하며 비즈니스 판단은 호출자 레이어(app/services).
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	logger     *zap.Logger
}

// New 는 Seedream Client 를 생성합니다.
// httpClient 가 nil 이면 기본값(timeout 10s) 으로 생성.
//
// 3번째 인자는 향후 circuit breaker 등 저변동 주입용 placeholder (현재 미사용).
func New(cfg ClientConfig, httpClient *http.Client, _ any, logger *zap.Logger) *Client {
	if httpClient == nil {
		timeout := cfg.Timeout
		if timeout == 0 {
			timeout = 10 * time.Second
		}
		httpClient = &http.Client{Timeout: timeout}
	}
	if logger == nil {
		logger = zap.NewNop()
	}
	return &Client{
		baseURL:    cfg.BaseURL,
		apiKey:     cfg.APIKey,
		httpClient: httpClient,
		logger:     logger,
	}
}

// IssueVAccount 는 POST /api/v1/vaccount 를 호출해 LINK 모드 VA 발급을 요청합니다.
//
// idempotencyKey 는 필수. traceID 는 선택 (빈 값이면 자동 UUID 생성).
func (c *Client) IssueVAccount(
	ctx context.Context,
	req VAccountIssueRequest,
	idempotencyKey, traceID string,
) (*VAccountIssueResponse, error) {
	if idempotencyKey == "" {
		return nil, errors.New("seedream: Idempotency-Key 누락")
	}
	if traceID == "" {
		traceID = uuid.NewString()
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("seedream: marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/v1/vaccount", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("seedream: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("X-API-Key", c.apiKey)
	httpReq.Header.Set("Idempotency-Key", idempotencyKey)
	httpReq.Header.Set("X-Trace-Id", traceID)

	start := time.Now()
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("seedream: http error: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("seedream: read response: %w", err)
	}

	// 429 특수 처리: Retry-After 를 로그에 남김
	if resp.StatusCode == http.StatusTooManyRequests {
		retry := resp.Header.Get("Retry-After")
		c.logger.Warn("seedream rate limited",
			zap.String("retryAfter", retry),
			zap.String("traceId", traceID))
	}

	var env Envelope[VAccountIssueResponse]
	if err := json.Unmarshal(respBody, &env); err != nil {
		return nil, fmt.Errorf("seedream: parse envelope (status %d): %w", resp.StatusCode, err)
	}

	c.logger.Info("seedream issue",
		zap.String("orderNo", req.OrderNo),
		zap.Int("status", resp.StatusCode),
		zap.Bool("success", env.Success),
		zap.String("errorCode", env.ErrorCode),
		zap.String("errorId", env.ErrorID),
		zap.String("traceId", firstNonEmpty(env.metaTraceID(), resp.Header.Get("X-Trace-Id"), traceID)),
		zap.Int64("latencyMs", time.Since(start).Milliseconds()))

	if !env.Success {
		return nil, MapErrorCode(env.ErrorCode, env.Error, env.ErrorID, env.metaTraceID())
	}
	return &env.Data, nil
}

// GetVAccountByOrderNo 는 GET /api/v1/vaccount?orderNo=X 를 호출해
// 해당 주문의 VAccountResult 를 반환합니다.
//
// 반환 규약:
//   - Items 길이 1: (&item, nil) — 정상 단건.
//   - Items 길이 0: (nil, nil)  — Seedream 미등록. 호출자가 직접 판단 (ErrNotFound 를
//     sentinel 로 쓰지 않는 이유: "없음" 은 정상 경로일 수 있음 — 예: Phase 4 CancelService 가
//     Payment.SeedreamDaouTrx 캐시 누락 시 Seedream 에서 재조회하는데, 계약상 없을 수도 있음).
//   - Items 길이 2+: (nil, error) — orderNo 는 Seedream 쪽에서 unique 이므로
//     발생 시 계약 위반. 방어적으로 에러 반환.
//   - !Success: MapErrorCode 로 APIError 래핑 반환.
//
// 주요 사용처:
//   - Task 5 CancelService: DaouTrx 조회 (Payment 에 캐시 안 돼 있을 때)
//   - Reconcile cron (Phase 5): 상태 재동기화
//
// GET 은 idempotent 이므로 Idempotency-Key 헤더 불요 (통합 가이드 §6.1).
func (c *Client) GetVAccountByOrderNo(ctx context.Context, orderNo, traceID string) (*VAccountResult, error) {
	if orderNo == "" {
		return nil, errors.New("seedream: orderNo 누락")
	}
	if traceID == "" {
		traceID = uuid.NewString()
	}

	reqURL := c.baseURL + "/api/v1/vaccount?orderNo=" + url.QueryEscape(orderNo)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("seedream: build get-vaccount request: %w", err)
	}
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("X-API-Key", c.apiKey)
	httpReq.Header.Set("X-Trace-Id", traceID)

	start := time.Now()
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("seedream: http error (get-vaccount): %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("seedream: read get-vaccount response: %w", err)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		retry := resp.Header.Get("Retry-After")
		c.logger.Warn("seedream rate limited (get-vaccount)",
			zap.String("retryAfter", retry),
			zap.String("traceId", traceID))
	}

	var env Envelope[VAccountListPage]
	if err := json.Unmarshal(respBody, &env); err != nil {
		return nil, fmt.Errorf("seedream: parse get-vaccount envelope (status %d): %w", resp.StatusCode, err)
	}

	c.logger.Info("seedream get-vaccount",
		zap.String("orderNo", orderNo),
		zap.Int("status", resp.StatusCode),
		zap.Bool("success", env.Success),
		zap.Int("items", len(env.Data.Items)),
		zap.String("errorCode", env.ErrorCode),
		zap.String("errorId", env.ErrorID),
		zap.String("traceId", firstNonEmpty(env.metaTraceID(), resp.Header.Get("X-Trace-Id"), traceID)),
		zap.Int64("latencyMs", time.Since(start).Milliseconds()))

	if !env.Success {
		return nil, MapErrorCode(env.ErrorCode, env.Error, env.ErrorID, env.metaTraceID())
	}

	switch len(env.Data.Items) {
	case 0:
		return nil, nil
	case 1:
		item := env.Data.Items[0]
		return &item, nil
	default:
		return nil, fmt.Errorf("seedream: get-vaccount returned %d items for orderNo=%s (expected 0 or 1)",
			len(env.Data.Items), orderNo)
	}
}

// VAccountListQuery 는 ListVAccounts 쿼리 파라미터입니다.
//
// Seedream §6 GET /api/v1/vaccount 의 지원 필터 집합 (§6.7). 다른 필터는
// 서버 미지원 — 내부 DB 에서 필터링해야 합니다.
type VAccountListQuery struct {
	From           time.Time // createdAt >= From (RFC3339). Zero 시 무필터.
	To             time.Time // createdAt <= To. Zero 시 무필터.
	ReservedIndex1 string    // 권장: "seedreamgift" 로 상품권 사이트 발급분만 격리
	Status         string    // 선택: "PENDING" | "SUCCESS" | ...
	Page           int       // 1-based. 0 이면 1.
	PageSize       int       // 0 이면 100 default, max 100.
}

// ListVAccounts 는 GET /api/v1/vaccount 를 호출해 페이지 단위로 VAccountResult 를 반환합니다.
//
// 주된 용도:
//   - Reconcile (Phase 5): since 이후 생성/갱신된 주문을 스캔해 웹훅 유실 감지.
//   - Ops 감사: 특정 기간/상태 주문 확인.
//
// 단건 조회는 GetVAccountByOrderNo 사용 — 이 함수는 목록용.
func (c *Client) ListVAccounts(ctx context.Context, q VAccountListQuery, traceID string) (*VAccountListPage, error) {
	if traceID == "" {
		traceID = uuid.NewString()
	}
	if q.Page == 0 {
		q.Page = 1
	}
	if q.PageSize == 0 {
		q.PageSize = 100
	}

	values := url.Values{}
	if !q.From.IsZero() {
		values.Set("from", q.From.UTC().Format(time.RFC3339))
	}
	if !q.To.IsZero() {
		values.Set("to", q.To.UTC().Format(time.RFC3339))
	}
	if q.ReservedIndex1 != "" {
		values.Set("reservedIndex1", q.ReservedIndex1)
	}
	if q.Status != "" {
		values.Set("status", q.Status)
	}
	values.Set("page", strconv.Itoa(q.Page))
	values.Set("pageSize", strconv.Itoa(q.PageSize))

	reqURL := c.baseURL + "/api/v1/vaccount?" + values.Encode()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("seedream: build list-vaccount request: %w", err)
	}
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("X-API-Key", c.apiKey)
	httpReq.Header.Set("X-Trace-Id", traceID)

	start := time.Now()
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("seedream: http error (list-vaccount): %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("seedream: read list-vaccount response: %w", err)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		retry := resp.Header.Get("Retry-After")
		c.logger.Warn("seedream rate limited (list-vaccount)",
			zap.String("retryAfter", retry),
			zap.String("traceId", traceID))
	}

	var env Envelope[VAccountListPage]
	if err := json.Unmarshal(respBody, &env); err != nil {
		return nil, fmt.Errorf("seedream: parse list-vaccount envelope (status %d): %w", resp.StatusCode, err)
	}

	c.logger.Info("seedream list-vaccount",
		zap.Int("page", q.Page),
		zap.Int("pageSize", q.PageSize),
		zap.Int("status", resp.StatusCode),
		zap.Bool("success", env.Success),
		zap.Int("items", len(env.Data.Items)),
		zap.Int64("total", env.Data.Total),
		zap.Bool("hasMore", env.Data.HasMore),
		zap.String("errorCode", env.ErrorCode),
		zap.String("traceId", firstNonEmpty(env.metaTraceID(), resp.Header.Get("X-Trace-Id"), traceID)),
		zap.Int64("latencyMs", time.Since(start).Milliseconds()))

	if !env.Success {
		return nil, MapErrorCode(env.ErrorCode, env.Error, env.ErrorID, env.metaTraceID())
	}
	return &env.Data, nil
}

// WalkVAccountsSince 는 ListVAccounts 를 페이지네이션으로 순회하며 각 항목에 visit 를 호출합니다.
// visit 가 에러를 반환하면 즉시 중단. HasMore=false 또는 페이지 상한(maxPages=50) 초과 시 종료.
//
// 페이지 상한 초과 시 에러 반환 — 호출자가 From 을 좁혀 다시 호출해야 합니다 (§6.6).
func (c *Client) WalkVAccountsSince(
	ctx context.Context,
	q VAccountListQuery,
	visit func(context.Context, VAccountResult) error,
	traceID string,
) error {
	const maxPages = 50
	if q.PageSize == 0 {
		q.PageSize = 100
	}
	for page := 1; page <= maxPages; page++ {
		q.Page = page
		resp, err := c.ListVAccounts(ctx, q, traceID)
		if err != nil {
			return fmt.Errorf("walk page %d: %w", page, err)
		}
		for _, item := range resp.Items {
			if err := visit(ctx, item); err != nil {
				return fmt.Errorf("walk visit orderNo=%s: %w", item.OrderNo, err)
			}
		}
		if !resp.HasMore {
			return nil
		}
	}
	return fmt.Errorf("walk exceeded %d pages — tighten 'from' filter", maxPages)
}

// metaTraceID 는 Envelope.Meta.TraceID 를 안전히 반환합니다 (Meta nil 방어).
func (e Envelope[T]) metaTraceID() string {
	if e.Meta == nil {
		return ""
	}
	return e.Meta.TraceID
}

func firstNonEmpty(ss ...string) string {
	for _, s := range ss {
		if s != "" {
			return s
		}
	}
	return ""
}

// ParseRetryAfter 는 Retry-After 헤더를 초 단위 Duration 으로 변환합니다.
// HTTP-date 형식은 지원하지 않음 (Seedream 은 초 단위 정수만 반환).
func ParseRetryAfter(h string) (time.Duration, error) {
	secs, err := strconv.Atoi(h)
	if err != nil {
		return 0, err
	}
	return time.Duration(secs) * time.Second, nil
}
