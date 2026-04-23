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
