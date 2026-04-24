package services

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ─── manual mock (no external mocking library) ─────────────────────────────

type mockCancelClient struct {
	// GetVAccountByOrderNo
	getResult  *seedream.VAccountResult
	getErr     error
	getCalls   int
	getOrderNo string

	// CancelIssued
	cancelResp            *seedream.CancelResponse
	cancelErr             error
	cancelCalls           int
	cancelOrderNo         string
	cancelTrxID           string
	cancelAmount          int64
	cancelReason          string
	cancelIdempotencyKey  string

	// RefundDeposited
	refundResp            *seedream.CancelResponse
	refundErr             error
	refundCalls           int
	refundOrderNo         string
	refundTrxID           string
	refundAmount          int64
	refundReason          string
	refundBankCode        string
	refundAccountNo       string
	refundIdempotencyKey  string
}

func (m *mockCancelClient) GetVAccountByOrderNo(_ context.Context, orderNo, _ string) (*seedream.VAccountResult, error) {
	m.getCalls++
	m.getOrderNo = orderNo
	return m.getResult, m.getErr
}

func (m *mockCancelClient) CancelIssued(
	_ context.Context,
	orderNo, trxID string,
	amount int64,
	reason string,
	idempotencyKey, _ string,
) (*seedream.CancelResponse, error) {
	m.cancelCalls++
	m.cancelOrderNo = orderNo
	m.cancelTrxID = trxID
	m.cancelAmount = amount
	m.cancelReason = reason
	m.cancelIdempotencyKey = idempotencyKey
	return m.cancelResp, m.cancelErr
}

func (m *mockCancelClient) RefundDeposited(
	_ context.Context,
	orderNo, trxID string,
	amount int64,
	reason, bankCode, accountNo string,
	idempotencyKey, _ string,
) (*seedream.CancelResponse, error) {
	m.refundCalls++
	m.refundOrderNo = orderNo
	m.refundTrxID = trxID
	m.refundAmount = amount
	m.refundReason = reason
	m.refundBankCode = bankCode
	m.refundAccountNo = accountNo
	m.refundIdempotencyKey = idempotencyKey
	return m.refundResp, m.refundErr
}

// ─── seed helpers ──────────────────────────────────────────────────────────

// seedOrderWithPaymentCached 는 DaouTrx 가 이미 Payment 에 캐시된 기본 주문 케이스.
func seedOrderWithPaymentCached(t *testing.T, db *gorm.DB, daouTrx string) (*domain.Order, *domain.Payment) {
	t.Helper()
	code := "ORD-C-1"
	o := &domain.Order{
		UserID:      42,
		Status:      "ISSUED",
		Source:      "USER",
		TotalAmount: domain.NewNumericDecimal(decimal.NewFromInt(50000)),
		OrderCode:   &code,
	}
	require.NoError(t, db.Create(o).Error)

	phase := "awaiting_deposit"
	idem := "gift:vaccount:ORD-C-1"
	vaID := int64(102847)
	p := &domain.Payment{
		OrderID:                o.ID,
		Method:                 "VIRTUAL_ACCOUNT_SEEDREAM",
		Amount:                 o.TotalAmount,
		Status:                 "PENDING",
		SeedreamVAccountID:     &vaID,
		SeedreamPhase:          &phase,
		SeedreamIdempotencyKey: &idem,
		SeedreamDaouTrx:        &daouTrx,
	}
	require.NoError(t, db.Create(p).Error)
	return o, p
}

// seedOrderWithPaymentNoDaouTrx 는 DaouTrx 가 아직 캐시되지 않은 케이스 (fallback 경로).
func seedOrderWithPaymentNoDaouTrx(t *testing.T, db *gorm.DB) (*domain.Order, *domain.Payment) {
	t.Helper()
	code := "ORD-F-1"
	o := &domain.Order{
		UserID:      42,
		Status:      "ISSUED",
		Source:      "USER",
		TotalAmount: domain.NewNumericDecimal(decimal.NewFromInt(30000)),
		OrderCode:   &code,
	}
	require.NoError(t, db.Create(o).Error)

	phase := "awaiting_deposit"
	p := &domain.Payment{
		OrderID:       o.ID,
		Method:        "VIRTUAL_ACCOUNT_SEEDREAM",
		Amount:        o.TotalAmount,
		Status:        "PENDING",
		SeedreamPhase: &phase,
		// SeedreamDaouTrx 는 nil — fallback 경로 트리거
	}
	require.NoError(t, db.Create(p).Error)
	return o, p
}

// okCancelResp 는 편의용 정상 응답 빌더.
func okCancelResp(trxID, amount string) *seedream.CancelResponse {
	return &seedream.CancelResponse{
		Token:      "tok-1",
		ResultCode: "0000",
		TrxID:      trxID,
		Amount:     amount,
		CancelDate: time.Now().Format("20060102150405"),
	}
}

// ─── tests ─────────────────────────────────────────────────────────────────

func TestCancelService_CancelIssued_HappyPath_CachedDaouTrx(t *testing.T) {
	db := setupStateTestDB(t)
	_, _ = seedOrderWithPaymentCached(t, db, "DAOU-TRX-111")

	mock := &mockCancelClient{cancelResp: okCancelResp("DAOU-TRX-111", "50000")}
	svc := NewCancelService(db, mock, zap.NewNop())

	res, err := svc.CancelIssued(context.Background(), SeedreamCancelInput{
		OrderCode:    "ORD-C-1",
		CancelReason: "단순변심 테스트",
		UserID:       42,
	})
	require.NoError(t, err)
	require.NotNil(t, res)
	require.NotNil(t, res.Response)
	assert.False(t, res.AlreadyDone)
	assert.Equal(t, "0000", res.Response.ResultCode)

	// 캐시된 DaouTrx 가 사용되었는지 확인 — Fallback 조회는 없어야 함
	assert.Equal(t, 0, mock.getCalls, "cached DaouTrx should skip GetVAccountByOrderNo")
	assert.Equal(t, 1, mock.cancelCalls)
	assert.Equal(t, "DAOU-TRX-111", mock.cancelTrxID)
	assert.Equal(t, "ORD-C-1", mock.cancelOrderNo)
	assert.Equal(t, int64(50000), mock.cancelAmount)
	assert.Equal(t, "gift:cancel:ORD-C-1", mock.cancelIdempotencyKey)
}

func TestCancelService_CancelIssued_HappyPath_FallbackLookup(t *testing.T) {
	db := setupStateTestDB(t)
	_, p := seedOrderWithPaymentNoDaouTrx(t, db)

	lookedUp := "DAOU-LKP-222"
	mock := &mockCancelClient{
		getResult:  &seedream.VAccountResult{DaouTrx: &lookedUp},
		cancelResp: okCancelResp(lookedUp, "30000"),
	}
	svc := NewCancelService(db, mock, zap.NewNop())

	res, err := svc.CancelIssued(context.Background(), SeedreamCancelInput{
		OrderCode:    "ORD-F-1",
		CancelReason: "사유 테스트",
		UserID:       42,
	})
	require.NoError(t, err)
	require.NotNil(t, res.Response)

	// Fallback 호출 발생
	assert.Equal(t, 1, mock.getCalls)
	assert.Equal(t, "ORD-F-1", mock.getOrderNo)
	// CancelIssued 에 조회된 trxID 가 전달됨
	assert.Equal(t, 1, mock.cancelCalls)
	assert.Equal(t, lookedUp, mock.cancelTrxID)

	// Payment.SeedreamDaouTrx 가 DB 에 캐시됨
	var refreshed domain.Payment
	require.NoError(t, db.First(&refreshed, p.ID).Error)
	require.NotNil(t, refreshed.SeedreamDaouTrx)
	assert.Equal(t, lookedUp, *refreshed.SeedreamDaouTrx)
}

func TestCancelService_CancelIssued_DaouTrxUnresolvable(t *testing.T) {
	db := setupStateTestDB(t)
	_, _ = seedOrderWithPaymentNoDaouTrx(t, db)

	// case A: Seedream 에서도 단건을 못 찾음 — result=nil
	mock := &mockCancelClient{getResult: nil}
	svc := NewCancelService(db, mock, zap.NewNop())

	_, err := svc.CancelIssued(context.Background(), SeedreamCancelInput{
		OrderCode:    "ORD-F-1",
		CancelReason: "사유 테스트",
		UserID:       42,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "DaouTrx not yet available")
	// Seedream cancel 은 호출되면 안 됨
	assert.Equal(t, 0, mock.cancelCalls)
}

func TestCancelService_CancelIssued_OrderNotFound(t *testing.T) {
	db := setupStateTestDB(t)
	// 시드 없음

	mock := &mockCancelClient{}
	svc := NewCancelService(db, mock, zap.NewNop())

	_, err := svc.CancelIssued(context.Background(), SeedreamCancelInput{
		OrderCode:    "ORD-NOPE",
		CancelReason: "사유 테스트",
		UserID:       42,
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	assert.Equal(t, 0, mock.cancelCalls)
	assert.Equal(t, 0, mock.getCalls)
}

func TestCancelService_CancelIssued_Unauthorized(t *testing.T) {
	db := setupStateTestDB(t)
	_, _ = seedOrderWithPaymentCached(t, db, "DAOU-X")

	mock := &mockCancelClient{}
	svc := NewCancelService(db, mock, zap.NewNop())

	// 다른 유저 ID 로 시도 — 결합 쿼리가 NotFound 반환
	_, err := svc.CancelIssued(context.Background(), SeedreamCancelInput{
		OrderCode:    "ORD-C-1",
		CancelReason: "사유 테스트",
		UserID:       9999, // 시드 UserID(42) 와 불일치
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	assert.Equal(t, 0, mock.cancelCalls)
}

func TestCancelService_CancelIssued_CancelReasonTooShort(t *testing.T) {
	db := setupStateTestDB(t)
	_, _ = seedOrderWithPaymentCached(t, db, "DAOU-X")

	mock := &mockCancelClient{}
	svc := NewCancelService(db, mock, zap.NewNop())

	_, err := svc.CancelIssued(context.Background(), SeedreamCancelInput{
		OrderCode:    "ORD-C-1",
		CancelReason: "abc", // 3 runes < 5
		UserID:       42,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cancelReason")
	// 검증 실패 시 Seedream 호출 안 함
	assert.Equal(t, 0, mock.cancelCalls)
	assert.Equal(t, 0, mock.getCalls)
}

func TestCancelService_CancelIssued_AlreadyDone(t *testing.T) {
	db := setupStateTestDB(t)
	_, _ = seedOrderWithPaymentCached(t, db, "DAOU-AD")

	mock := &mockCancelClient{
		cancelErr: &seedream.APIError{
			Code:    "CANCEL_ALREADY_DONE",
			Message: "already canceled",
		},
	}
	// APIError.Unwrap 을 통해 errors.Is(err, ErrCancelAlreadyDone) 를 만족시키려면
	// sentinel 이 들어가야 함 — MapErrorCode 를 쓰는 것이 안전.
	mock.cancelErr = seedream.MapErrorCode("CANCEL_ALREADY_DONE", "already canceled", "ERR-1", "trace-1")

	svc := NewCancelService(db, mock, zap.NewNop())

	res, err := svc.CancelIssued(context.Background(), SeedreamCancelInput{
		OrderCode:    "ORD-C-1",
		CancelReason: "중복 요청",
		UserID:       42,
	})
	require.NoError(t, err)
	require.NotNil(t, res)
	assert.True(t, res.AlreadyDone)
	assert.Nil(t, res.Response)
	require.True(t, errors.Is(mock.cancelErr, seedream.ErrCancelAlreadyDone),
		"prereq: underlying error must wrap ErrCancelAlreadyDone")
}

func TestCancelService_Refund_HappyPath(t *testing.T) {
	db := setupStateTestDB(t)
	_, _ = seedOrderWithPaymentCached(t, db, "DAOU-RFD")

	mock := &mockCancelClient{refundResp: okCancelResp("DAOU-RFD", "50000")}
	svc := NewCancelService(db, mock, zap.NewNop())

	// deterministic clock
	fixed := time.Date(2026, 4, 23, 14, 30, 15, 0, time.UTC)
	svc.clock = func() time.Time { return fixed }

	res, err := svc.Refund(context.Background(), SeedreamRefundInput{
		OrderCode:    "ORD-C-1",
		CancelReason: "환불 요청 테스트",
		BankCode:     "088",
		AccountNo:    "110-123-456789",
		UserID:       42,
	})
	require.NoError(t, err)
	require.NotNil(t, res.Response)

	assert.Equal(t, 1, mock.refundCalls)
	assert.Equal(t, "DAOU-RFD", mock.refundTrxID)
	assert.Equal(t, int64(50000), mock.refundAmount)
	assert.Equal(t, "088", mock.refundBankCode)
	assert.Equal(t, "110-123-456789", mock.refundAccountNo)

	// Idempotency-Key 패턴: gift:refund:{orderCode}:{yyyymmddhhmmss}
	expectedKey := "gift:refund:ORD-C-1:20260423143015"
	assert.Equal(t, expectedKey, mock.refundIdempotencyKey)

	// 패턴 검증 (정규식으로도 확인 — 추후 clock drift 대비)
	keyRe := regexp.MustCompile(`^gift:refund:ORD-C-1:\d{14}$`)
	assert.True(t, keyRe.MatchString(mock.refundIdempotencyKey))
}

func TestCancelService_Refund_InvalidBankCode(t *testing.T) {
	db := setupStateTestDB(t)
	_, _ = seedOrderWithPaymentCached(t, db, "DAOU-X")

	mock := &mockCancelClient{}
	svc := NewCancelService(db, mock, zap.NewNop())

	_, err := svc.Refund(context.Background(), SeedreamRefundInput{
		OrderCode:    "ORD-C-1",
		CancelReason: "환불 요청 테스트",
		BankCode:     "999", // 화이트리스트에 없음
		AccountNo:    "110-123-456789",
		UserID:       42,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "bankCode")
	// 검증 실패 → Seedream 호출 안 함
	assert.Equal(t, 0, mock.refundCalls)
	assert.Equal(t, 0, mock.getCalls)
}

func TestCancelService_Refund_InvalidAccountNo(t *testing.T) {
	db := setupStateTestDB(t)
	_, _ = seedOrderWithPaymentCached(t, db, "DAOU-X")

	mock := &mockCancelClient{}
	svc := NewCancelService(db, mock, zap.NewNop())

	_, err := svc.Refund(context.Background(), SeedreamRefundInput{
		OrderCode:    "ORD-C-1",
		CancelReason: "환불 요청 테스트",
		BankCode:     "088",
		AccountNo:    "abc123", // 영문 포함 → 패턴 불일치
		UserID:       42,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "accountNo")
	assert.Equal(t, 0, mock.refundCalls)
	assert.Equal(t, 0, mock.getCalls)
}
