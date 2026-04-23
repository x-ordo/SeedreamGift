package seedream

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// CancelIssued 는 POST /api/v1/payment/cancel (payMethod=VACCOUNT-ISSUECAN) 을 호출해
// 입금 전 발급을 취소합니다.
//
// Idempotency-Key 는 "gift:cancel:{orderNo}" 권장 (호출자가 생성).
// traceID 가 빈 값이면 자동 UUID 생성.
func (c *Client) CancelIssued(
	ctx context.Context,
	orderNo, trxID string,
	amount int64,
	reason string,
	idempotencyKey, traceID string,
) (*CancelResponse, error) {
	return c.doCancel(ctx, CancelPaymentRequest{
		PayMethod:    CancelVAccountIssue,
		TrxID:        trxID,
		Amount:       amount,
		CancelReason: reason,
	}, orderNo, idempotencyKey, traceID)
}

// RefundDeposited 는 POST /api/v1/payment/cancel (payMethod=BANK) 을 호출해
// 입금 후 환불을 실행합니다.
//
// Idempotency-Key 는 "gift:refund:{orderNo}:{yyyymmddhhmmss}" 권장 (호출자가 생성).
// bankCode 는 통합 가이드 §4.1 9개 화이트리스트 중 하나, accountNo 는 숫자/하이픈 6~20자.
// 검증은 호출자(CancelService) 레이어에서 — Client 는 와이어링만 담당.
func (c *Client) RefundDeposited(
	ctx context.Context,
	orderNo, trxID string,
	amount int64,
	reason, bankCode, accountNo string,
	idempotencyKey, traceID string,
) (*CancelResponse, error) {
	return c.doCancel(ctx, CancelPaymentRequest{
		PayMethod:    CancelBank,
		TrxID:        trxID,
		Amount:       amount,
		CancelReason: reason,
		BankCode:     bankCode,
		AccountNo:    accountNo,
	}, orderNo, idempotencyKey, traceID)
}

// doCancel 은 CancelIssued + RefundDeposited 의 공용 HTTP 와이어링.
// IssueVAccount 패턴과 동일한 구조.
func (c *Client) doCancel(
	ctx context.Context,
	req CancelPaymentRequest,
	orderNo, idempotencyKey, traceID string,
) (*CancelResponse, error) {
	if idempotencyKey == "" {
		return nil, errors.New("seedream: Idempotency-Key 누락")
	}
	if traceID == "" {
		traceID = uuid.NewString()
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("seedream: marshal cancel request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/v1/payment/cancel", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("seedream: build cancel request: %w", err)
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
		return nil, fmt.Errorf("seedream: read cancel response: %w", err)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		retry := resp.Header.Get("Retry-After")
		c.logger.Warn("seedream rate limited (cancel)",
			zap.String("retryAfter", retry),
			zap.String("traceId", traceID))
	}

	var env Envelope[CancelResponse]
	if err := json.Unmarshal(respBody, &env); err != nil {
		return nil, fmt.Errorf("seedream: parse cancel envelope (status %d): %w", resp.StatusCode, err)
	}

	c.logger.Info("seedream cancel",
		zap.String("orderNo", orderNo),
		zap.String("payMethod", string(req.PayMethod)),
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
