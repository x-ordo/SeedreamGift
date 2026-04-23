package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ─────────────────────────────────────────────────────────
// 통합 테스트 — Seedream Cancel/Refund 핸들러 전체 스택
//   HTTP → gin → SeedreamCancelHandler → CancelService → mock CancelClient → DB
// (Phase 4 Task 8 — Task 7 의 라우트 와이어링 후 E2E 검증)
// ─────────────────────────────────────────────────────────

// setupCancelIntegrationDB 는 in-memory SQLite 에 CancelService 가 요구하는 테이블을 준비합니다.
// (setupStateTestDB 는 services 패키지 내부 헬퍼라 여기서는 직접 사용 불가 — 동일 패턴 로컬 재선언.)
func setupCancelIntegrationDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// SQLite ":memory:" 는 연결별로 별도 인스턴스 → MaxOpenConns=1 로 고정해
	// 핸들러/서비스/쿼리가 같은 DB 를 보도록 강제.
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	require.NoError(t, db.AutoMigrate(
		&domain.Order{}, &domain.Payment{}, &domain.User{}, &domain.OrderItem{},
		&domain.VoucherCode{},
	))
	return db
}

// mockIntegrationCancelClient — cancel_svc_test.go 의 mockCancelClient 과 동일 구조이지만
// services 패키지 내부에 있어 import 불가 → handler 패키지 전용으로 재선언.
type mockIntegrationCancelClient struct {
	// GetVAccountByOrderNo
	getResult  *seedream.VAccountResult
	getErr     error
	getCalls   int
	getOrderNo string

	// CancelIssued
	cancelResp           *seedream.CancelResponse
	cancelErr            error
	cancelCalls          int
	cancelOrderNo        string
	cancelTrxID          string
	cancelAmount         int64
	cancelReason         string
	cancelIdempotencyKey string

	// RefundDeposited
	refundResp           *seedream.CancelResponse
	refundErr            error
	refundCalls          int
	refundOrderNo        string
	refundTrxID          string
	refundAmount         int64
	refundReason         string
	refundBankCode       string
	refundAccountNo      string
	refundIdempotencyKey string
}

func (m *mockIntegrationCancelClient) GetVAccountByOrderNo(
	_ context.Context, orderNo, _ string,
) (*seedream.VAccountResult, error) {
	m.getCalls++
	m.getOrderNo = orderNo
	return m.getResult, m.getErr
}

func (m *mockIntegrationCancelClient) CancelIssued(
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

func (m *mockIntegrationCancelClient) RefundDeposited(
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

// 컴파일 타임 guard — 시그니처 drift 시 빌드 실패.
var _ services.CancelClient = (*mockIntegrationCancelClient)(nil)

// seedCancelIntegrationOrder 는 DaouTrx 캐시 여부를 파라미터로 받아 Order+Payment 를 시드합니다.
// daouTrx == nil  → fallback 경로 테스트 (Service 가 GetVAccountByOrderNo 호출)
// daouTrx != nil  → 캐시 히트 경로 (GetVAccountByOrderNo 호출 없음)
func seedCancelIntegrationOrder(
	t *testing.T, db *gorm.DB, orderCode string, userID int, daouTrx *string,
) (*domain.Order, *domain.Payment) {
	t.Helper()
	code := orderCode
	o := &domain.Order{
		UserID:      userID,
		Status:      "ISSUED",
		Source:      "USER",
		TotalAmount: domain.NewNumericDecimal(decimal.NewFromInt(50000)),
		OrderCode:   &code,
	}
	require.NoError(t, db.Create(o).Error)

	phase := "awaiting_deposit"
	idem := "gift:vaccount:" + orderCode
	vaID := int64(102847)
	p := &domain.Payment{
		OrderID:                o.ID,
		Method:                 "VIRTUAL_ACCOUNT_SEEDREAM",
		Amount:                 o.TotalAmount,
		Status:                 "PENDING",
		SeedreamVAccountID:     &vaID,
		SeedreamPhase:          &phase,
		SeedreamIdempotencyKey: &idem,
		SeedreamDaouTrx:        daouTrx,
	}
	require.NoError(t, db.Create(p).Error)
	return o, p
}

// testAuthMiddleware 는 실제 JWT 검증 대신 userID 를 gin context 에 주입하는 테스트 전용 미들웨어.
// userID <= 0 이면 아무것도 세팅하지 않음 → 핸들러의 401 경로 테스트.
func testAuthMiddleware(userID int) gin.HandlerFunc {
	return func(c *gin.Context) {
		if userID > 0 {
			c.Set("userId", userID)
		}
		c.Next()
	}
}

// setupCancelIntegrationServer 는 gin + 핸들러 + 실제 CancelService + mock client 를 조립합니다.
// authUserID == 0 이면 인증 미들웨어가 userId 를 세팅하지 않습니다 (401 테스트용).
func setupCancelIntegrationServer(
	t *testing.T, db *gorm.DB, mock *mockIntegrationCancelClient, authUserID int,
) *httptest.Server {
	t.Helper()
	gin.SetMode(gin.TestMode)

	// 실제 CancelService 를 mock client 로 래핑 — 핸들러→서비스→mock 까지 실제 흐름 재현.
	svc := services.NewCancelService(db, mock, zap.NewNop())
	h := NewSeedreamCancelHandler(svc)

	engine := gin.New()
	engine.POST("/api/v1/payment/seedream/cancel", testAuthMiddleware(authUserID), h.Handle)

	srv := httptest.NewServer(engine)
	t.Cleanup(srv.Close)
	return srv
}

// postCancel 는 JSON body 를 POST 하고 (status, parsed body) 를 돌려줍니다.
func postCancel(t *testing.T, url string, body any) (int, map[string]any) {
	t.Helper()
	b, err := json.Marshal(body)
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(b))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()

	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	var parsed map[string]any
	if len(raw) > 0 {
		require.NoError(t, json.Unmarshal(raw, &parsed))
	}
	return resp.StatusCode, parsed
}

// ─────────────────────────────────────────────────────────
// Test 1: VACCOUNT-ISSUECAN 성공 (DaouTrx 캐시 히트)
// ─────────────────────────────────────────────────────────

func TestSeedreamCancelHandler_Integration_CancelIssued_HappyPath(t *testing.T) {
	db := setupCancelIntegrationDB(t)
	cachedTrx := "T202604231100001234"
	seedCancelIntegrationOrder(t, db, "ORD-CANCEL-OK", 42, &cachedTrx)

	mock := &mockIntegrationCancelClient{
		cancelResp: &seedream.CancelResponse{
			Token:      "TOK-OK",
			ResultCode: "0000",
			TrxID:      cachedTrx,
			Amount:     "50000",
			CancelDate: "20260423120000",
		},
	}

	srv := setupCancelIntegrationServer(t, db, mock, 42)

	status, body := postCancel(t, srv.URL+"/api/v1/payment/seedream/cancel", map[string]any{
		"orderCode":    "ORD-CANCEL-OK",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "고객 단순변심 테스트",
	})

	assert.Equal(t, http.StatusOK, status)
	assert.Equal(t, true, body["success"])

	// data.RESULTCODE == "0000"
	data, ok := body["data"].(map[string]any)
	require.True(t, ok, "response.data must be an object")
	assert.Equal(t, "0000", data["RESULTCODE"])

	// 캐시된 DaouTrx 가 사용되어 GetVAccountByOrderNo 는 호출되지 않아야 함
	assert.Equal(t, 0, mock.getCalls, "cached DaouTrx should skip GetVAccountByOrderNo")
	assert.Equal(t, 1, mock.cancelCalls)
	assert.Equal(t, cachedTrx, mock.cancelTrxID)
	assert.Equal(t, "ORD-CANCEL-OK", mock.cancelOrderNo)
	assert.Equal(t, int64(50000), mock.cancelAmount)
	assert.Equal(t, "gift:cancel:ORD-CANCEL-OK", mock.cancelIdempotencyKey)
}

// ─────────────────────────────────────────────────────────
// Test 2: BANK (Refund) 성공
// ─────────────────────────────────────────────────────────

func TestSeedreamCancelHandler_Integration_Refund_HappyPath(t *testing.T) {
	db := setupCancelIntegrationDB(t)
	cachedTrx := "T202604231100005678"
	seedCancelIntegrationOrder(t, db, "ORD-REFUND-OK", 42, &cachedTrx)

	mock := &mockIntegrationCancelClient{
		refundResp: &seedream.CancelResponse{
			Token:      "TOK-REF",
			ResultCode: "0000",
			TrxID:      cachedTrx,
			Amount:     "50000",
			CancelDate: "20260423120100",
		},
	}

	srv := setupCancelIntegrationServer(t, db, mock, 42)

	status, body := postCancel(t, srv.URL+"/api/v1/payment/seedream/cancel", map[string]any{
		"orderCode":    "ORD-REFUND-OK",
		"payMethod":    "BANK",
		"cancelReason": "배송 지연으로 환불 요청",
		"bankCode":     "088",
		"accountNo":    "110-123-456789",
	})

	assert.Equal(t, http.StatusOK, status)
	assert.Equal(t, true, body["success"])

	data, ok := body["data"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "0000", data["RESULTCODE"])

	// mock 의 lastInput 이 전달된 필드와 일치해야 함
	assert.Equal(t, 1, mock.refundCalls)
	assert.Equal(t, 0, mock.cancelCalls, "BANK path must not call CancelIssued")
	assert.Equal(t, cachedTrx, mock.refundTrxID)
	assert.Equal(t, "ORD-REFUND-OK", mock.refundOrderNo)
	assert.Equal(t, int64(50000), mock.refundAmount)
	assert.Equal(t, "088", mock.refundBankCode)
	assert.Equal(t, "110-123-456789", mock.refundAccountNo)
}

// ─────────────────────────────────────────────────────────
// Test 3: AlreadyDone — Seedream 이 CANCEL_ALREADY_DONE 반환 → 200 + alreadyDone:true
// ─────────────────────────────────────────────────────────

func TestSeedreamCancelHandler_Integration_AlreadyDone(t *testing.T) {
	db := setupCancelIntegrationDB(t)
	cachedTrx := "T202604231100009999"
	seedCancelIntegrationOrder(t, db, "ORD-ALREADY", 42, &cachedTrx)

	// MapErrorCode 로 APIError 를 만들면 ErrCancelAlreadyDone sentinel 을 wrap 하여
	// errors.Is(err, ErrCancelAlreadyDone) 이 true 가 되도록 보장.
	mock := &mockIntegrationCancelClient{
		cancelErr: seedream.MapErrorCode("CANCEL_ALREADY_DONE", "already canceled", "ERR-1", "trace-1"),
	}

	srv := setupCancelIntegrationServer(t, db, mock, 42)

	status, body := postCancel(t, srv.URL+"/api/v1/payment/seedream/cancel", map[string]any{
		"orderCode":    "ORD-ALREADY",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "중복 요청 테스트",
	})

	assert.Equal(t, http.StatusOK, status)
	assert.Equal(t, true, body["success"])
	assert.Equal(t, true, body["alreadyDone"])
	assert.NotEmpty(t, body["message"], "alreadyDone path should include a message")
	assert.Nil(t, body["data"], "alreadyDone path should not include data")
}

// ─────────────────────────────────────────────────────────
// Test 4: Validation — cancelReason 이 min=5 위반 → 400 + errorCode=VALIDATION
//                      + Seedream 호출 없음
// ─────────────────────────────────────────────────────────

func TestSeedreamCancelHandler_Integration_ValidationRejection(t *testing.T) {
	db := setupCancelIntegrationDB(t)
	cachedTrx := "T202604231100001111"
	seedCancelIntegrationOrder(t, db, "ORD-VAL", 42, &cachedTrx)

	mock := &mockIntegrationCancelClient{}
	srv := setupCancelIntegrationServer(t, db, mock, 42)

	status, body := postCancel(t, srv.URL+"/api/v1/payment/seedream/cancel", map[string]any{
		"orderCode":    "ORD-VAL",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "abc", // 3 runes < 5 → binding validator 차단
	})

	assert.Equal(t, http.StatusBadRequest, status)
	assert.Equal(t, "VALIDATION", body["errorCode"])

	// validator 단계에서 차단되어 Seedream 은 호출되지 않아야 함
	assert.Equal(t, 0, mock.cancelCalls)
	assert.Equal(t, 0, mock.refundCalls)
	assert.Equal(t, 0, mock.getCalls)
}

// ─────────────────────────────────────────────────────────
// Test 5: Unauthorized — 인증 미들웨어가 userId 를 주입하지 않음 → 401
// ─────────────────────────────────────────────────────────

func TestSeedreamCancelHandler_Integration_Unauthorized(t *testing.T) {
	db := setupCancelIntegrationDB(t)
	cachedTrx := "T202604231100002222"
	seedCancelIntegrationOrder(t, db, "ORD-UNAUTH", 42, &cachedTrx)

	mock := &mockIntegrationCancelClient{}
	// authUserID = 0 → testAuthMiddleware 가 userId 를 세팅하지 않음
	srv := setupCancelIntegrationServer(t, db, mock, 0)

	status, body := postCancel(t, srv.URL+"/api/v1/payment/seedream/cancel", map[string]any{
		"orderCode":    "ORD-UNAUTH",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "인증 없이 호출 테스트",
	})

	assert.Equal(t, http.StatusUnauthorized, status)
	assert.Equal(t, "UNAUTHORIZED", body["errorCode"])

	// 인증 실패 시 서비스/Seedream 호출 없음
	assert.Equal(t, 0, mock.cancelCalls)
	assert.Equal(t, 0, mock.getCalls)
}

// ─────────────────────────────────────────────────────────
// Test 6: DaouTrx fallback lookup — Payment.SeedreamDaouTrx == nil
//   Seedream.GetVAccountByOrderNo 가 DaouTrx 를 돌려주면
//   Seedream.CancelIssued 호출에 해당 trxID 가 전달되고,
//   Payment.SeedreamDaouTrx 가 DB 에 캐시됨.
// ─────────────────────────────────────────────────────────

func TestSeedreamCancelHandler_Integration_DaouTrxFallback(t *testing.T) {
	db := setupCancelIntegrationDB(t)
	_, payment := seedCancelIntegrationOrder(t, db, "ORD-FALLBACK", 42, nil)

	lookedUp := "T202604231200009998"
	mock := &mockIntegrationCancelClient{
		getResult:  &seedream.VAccountResult{DaouTrx: &lookedUp},
		cancelResp: &seedream.CancelResponse{
			Token:      "TOK-FB",
			ResultCode: "0000",
			TrxID:      lookedUp,
			Amount:     "50000",
			CancelDate: "20260423120200",
		},
	}

	srv := setupCancelIntegrationServer(t, db, mock, 42)

	status, body := postCancel(t, srv.URL+"/api/v1/payment/seedream/cancel", map[string]any{
		"orderCode":    "ORD-FALLBACK",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "Fallback 경로 테스트",
	})

	assert.Equal(t, http.StatusOK, status)
	assert.Equal(t, true, body["success"])

	// Seedream fallback 조회 + CancelIssued 모두 호출
	assert.Equal(t, 1, mock.getCalls, "fallback must call GetVAccountByOrderNo")
	assert.Equal(t, "ORD-FALLBACK", mock.getOrderNo)
	assert.Equal(t, 1, mock.cancelCalls)
	assert.Equal(t, lookedUp, mock.cancelTrxID, "CancelIssued must receive the fetched trxID")

	// DB 에 Payment.SeedreamDaouTrx 가 캐시됐는지 확인
	var refreshed domain.Payment
	require.NoError(t, db.First(&refreshed, payment.ID).Error)
	require.NotNil(t, refreshed.SeedreamDaouTrx, "SeedreamDaouTrx should be cached after fallback")
	assert.Equal(t, lookedUp, *refreshed.SeedreamDaouTrx)
}

// ─────────────────────────────────────────────────────────
// Test 7: Order not found — 알 수 없는 orderCode → 404 + errorCode=NOT_FOUND
// ─────────────────────────────────────────────────────────

func TestSeedreamCancelHandler_Integration_OrderNotFound(t *testing.T) {
	db := setupCancelIntegrationDB(t)
	// 주문 시드 없음

	mock := &mockIntegrationCancelClient{}
	srv := setupCancelIntegrationServer(t, db, mock, 42)

	status, body := postCancel(t, srv.URL+"/api/v1/payment/seedream/cancel", map[string]any{
		"orderCode":    "ORD-DOES-NOT-EXIST",
		"payMethod":    "VACCOUNT-ISSUECAN",
		"cancelReason": "미존재 주문 테스트",
	})

	assert.Equal(t, http.StatusNotFound, status)
	assert.Equal(t, "NOT_FOUND", body["errorCode"])

	// loadOrderAndPayment 에서 gorm.ErrRecordNotFound 로 조기 종료 → Seedream 호출 없음
	assert.Equal(t, 0, mock.cancelCalls)
	assert.Equal(t, 0, mock.refundCalls)
	assert.Equal(t, 0, mock.getCalls)
}
