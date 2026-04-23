package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"
	"seedream-gift-server/internal/infra/workqueue"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// ─────────────────────────────────────────────────────────
// 통합 테스트 — Seedream 웹훅 핸들러의 전체 스택
//   HMAC 검증 → 멱등 INSERT → 워커 dispatch → ProcessedAt UPDATE
// (Task 8 의 curl 기반 수동 절차를 httptest 로 치환 — CI 재현 가능)
// ─────────────────────────────────────────────────────────

const testWebhookSecret = "test-secret-123"

// setupWebhookIntegrationDB 는 in-memory SQLite 에 필요한 테이블을 준비합니다.
// (OrderEvent 는 nvarchar(max) 컬럼 때문에 AutoMigrate 불가 — Task 3 패턴 재사용)
func setupWebhookIntegrationDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	// SQLite ":memory:" 은 연결별로 별도 DB 인스턴스를 갖기 때문에
	// GORM connection pool 이 새 연결을 만들면 "no such table" 이 발생할 수 있음.
	// MaxOpenConns=1 로 고정해 worker 풀의 동시 쿼리도 같은 in-memory DB 를 보도록 함.
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	require.NoError(t, db.AutoMigrate(
		&domain.Order{}, &domain.Payment{}, &domain.User{}, &domain.OrderItem{},
		&domain.VoucherCode{},
	))
	// WebhookReceipts: nvarchar(max) 때문에 AutoMigrate 실패 → 수동 CREATE
	require.NoError(t, db.Exec(`CREATE TABLE "WebhookReceipts" (
		"DeliveryId" INTEGER PRIMARY KEY,
		"Event" TEXT NOT NULL,
		"EventId" TEXT,
		"OrderNo" TEXT,
		"ReceivedAt" DATETIME,
		"ProcessedAt" DATETIME,
		"RawBody" TEXT
	)`).Error)
	return db
}

// seedIntegrationPendingOrder 는 PENDING Order + PENDING Payment 를 생성합니다.
// (services/vaccount_state_test.go 의 seedPendingOrderWithPayment 와 동일 패턴)
func seedIntegrationPendingOrder(t *testing.T, db *gorm.DB, orderCode string) (*domain.Order, *domain.Payment) {
	t.Helper()
	code := orderCode
	o := &domain.Order{
		UserID: 42, Status: "PENDING", Source: "USER",
		TotalAmount: domain.NewNumericDecimal(decimal.NewFromInt(50000)),
		OrderCode:   &code,
	}
	require.NoError(t, db.Create(o).Error)

	phase := "awaiting_bank_selection"
	idem := "gift:vaccount:" + orderCode
	vaID := int64(102847)
	p := &domain.Payment{
		OrderID: o.ID, Method: "VIRTUAL_ACCOUNT_SEEDREAM",
		Amount: o.TotalAmount, Status: "PENDING",
		SeedreamVAccountID: &vaID, SeedreamPhase: &phase, SeedreamIdempotencyKey: &idem,
	}
	require.NoError(t, db.Create(p).Error)
	return o, p
}

// setupIntegrationServer 는 handler + gin + httptest + real worker pool 을 조립합니다.
// 호출자는 cleanup 에서 pool.Shutdown + server.Close 를 책임집니다.
func setupIntegrationServer(t *testing.T, db *gorm.DB) (*httptest.Server, *workqueue.WorkerPool) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	stateSvc := services.NewVAccountStateService(db, nil)           // nil → NOP logger
	webhookSvc := services.NewVAccountWebhookService(db, stateSvc, nil)

	pool := workqueue.NewWorkerPool(workqueue.WorkerPoolConfig{
		Name: "seedream_webhook_test", Workers: 2, QueueSize: 16,
	})
	pool.Start()

	h := NewSeedreamWebhookHandler(db, webhookSvc, pool, testWebhookSecret)

	engine := gin.New()
	engine.POST("/webhook/seedream", h.Receive)

	srv := httptest.NewServer(engine)
	return srv, pool
}

// signWebhookBody 는 §8.4 의 signed_payload = "{ts}.{body}" + HMAC-SHA256 를 계산.
func signWebhookBody(ts string, body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts))
	mac.Write([]byte{'.'})
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// postWebhook 는 4 개 필수 헤더를 실어 POST — 반환값 (status, body) 로 검증 편의.
func postWebhook(t *testing.T, url, event, tsHeader, signature, deliveryID string, body []byte) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(seedream.HeaderEvent, event)
	req.Header.Set(seedream.HeaderTimestamp, tsHeader)
	req.Header.Set(seedream.HeaderSignature, signature)
	req.Header.Set(seedream.HeaderDeliveryID, deliveryID)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	// Drain — net/http 는 Close 시 남은 body 를 버리지만, 연결 재사용을 위해 명시 drain.
	_, _ = io.Copy(io.Discard, resp.Body)
	require.NoError(t, resp.Body.Close())
	return resp
}

// waitForProcessed 는 worker pool 이 비동기로 ProcessedAt 을 세팅할 때까지 폴링 — 2 초 한도.
func waitForProcessed(t *testing.T, db *gorm.DB, deliveryID int64) {
	t.Helper()
	require.Eventually(t, func() bool {
		var r domain.WebhookReceipt
		if err := db.Where("DeliveryId = ?", deliveryID).First(&r).Error; err != nil {
			return false
		}
		return r.ProcessedAt != nil
	}, 2*time.Second, 50*time.Millisecond, "receipt.ProcessedAt 이 2초 내에 세팅되지 않음")
}

// ─────────────────────────────────────────────────────────
// Test 1: 정상 서명 → 200, 전이, ProcessedAt 세팅
// ─────────────────────────────────────────────────────────

func TestSeedreamWebhookHandler_ValidSignedRequest_Returns200AndTransitionsOrder(t *testing.T) {
	db := setupWebhookIntegrationDB(t)
	order, _ := seedIntegrationPendingOrder(t, db, "ORD-WEBHOOK-OK")

	srv, pool := setupIntegrationServer(t, db)
	t.Cleanup(func() {
		srv.Close()
		pool.Shutdown(5 * time.Second)
	})

	// 페이로드 조립 — 시드된 주문과 정확히 매칭
	payload := seedream.VAccountIssuedPayload{
		EventID:          "evt-integration-1",
		OrderNo:          *order.OrderCode,
		BankCode:         "088",
		AccountNo:        "110-123-456789",
		ReceiverName:     "씨드림기프트",
		DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
		IssuedAt:         time.Now().UTC(),
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	ts := strconv.FormatInt(time.Now().Unix(), 10)
	sig := signWebhookBody(ts, body, testWebhookSecret)
	deliveryID := int64(100001)

	resp := postWebhook(t, srv.URL+"/webhook/seedream",
		string(seedream.EventVAccountIssued), ts, sig, strconv.FormatInt(deliveryID, 10), body)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// ProcessedAt 은 worker pool 이 비동기로 세팅 — 폴링 대기
	waitForProcessed(t, db, deliveryID)

	// receipt 검증
	var r domain.WebhookReceipt
	require.NoError(t, db.Where("DeliveryId = ?", deliveryID).First(&r).Error)
	require.NotNil(t, r.ProcessedAt, "ProcessedAt must be set by worker")
	assert.Equal(t, string(seedream.EventVAccountIssued), r.Event)

	// Order 상태: PENDING → ISSUED
	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "ISSUED", got.Status)

	// Payment 필드 업데이트
	var p domain.Payment
	require.NoError(t, db.Where("OrderId = ?", order.ID).First(&p).Error)
	require.NotNil(t, p.SeedreamPhase)
	assert.Equal(t, "awaiting_deposit", *p.SeedreamPhase)
	require.NotNil(t, p.BankCode)
	assert.Equal(t, "088", *p.BankCode)
	require.NotNil(t, p.AccountNumber)
	assert.Equal(t, "110-123-456789", *p.AccountNumber)
	require.NotNil(t, p.DepositorName)
	assert.Equal(t, "씨드림기프트", *p.DepositorName)
}

// ─────────────────────────────────────────────────────────
// Test 2: 서명 불일치 → 500, 상태 불변, receipt 미생성
// ─────────────────────────────────────────────────────────

func TestSeedreamWebhookHandler_InvalidSignature_Returns500(t *testing.T) {
	db := setupWebhookIntegrationDB(t)
	order, _ := seedIntegrationPendingOrder(t, db, "ORD-WEBHOOK-BAD")

	srv, pool := setupIntegrationServer(t, db)
	t.Cleanup(func() {
		srv.Close()
		pool.Shutdown(5 * time.Second)
	})

	payload := seedream.VAccountIssuedPayload{
		EventID: "evt-bad-sig", OrderNo: *order.OrderCode,
		BankCode: "088", AccountNo: "110-1", ReceiverName: "Seedream",
		DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
		IssuedAt:         time.Now().UTC(),
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	ts := strconv.FormatInt(time.Now().Unix(), 10)
	badSig := "sha256=0000000000000000000000000000000000000000000000000000000000000000"
	deliveryID := int64(200002)

	resp := postWebhook(t, srv.URL+"/webhook/seedream",
		string(seedream.EventVAccountIssued), ts, badSig, strconv.FormatInt(deliveryID, 10), body)

	// §8.6.3: 검증 실패는 500 — 4xx 는 즉시 DLQ 드롭이라 금지.
	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)

	// Order 는 PENDING 그대로 — 어떤 상태 변이도 없어야 함
	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "PENDING", got.Status)

	// receipt 는 서명 검증보다 뒤에 INSERT → 생성되지 않았어야 함
	var count int64
	require.NoError(t, db.Model(&domain.WebhookReceipt{}).
		Where("DeliveryId = ?", deliveryID).Count(&count).Error)
	assert.Equal(t, int64(0), count, "서명 실패 시 receipt 는 INSERT 되지 않아야 함")
}

// ─────────────────────────────────────────────────────────
// Test 3: 동일 DeliveryID 재수신 → 200 no-op, receipt 1건 유지
// ─────────────────────────────────────────────────────────

func TestSeedreamWebhookHandler_DuplicateDeliveryID_Returns200NoOp(t *testing.T) {
	db := setupWebhookIntegrationDB(t)
	order, _ := seedIntegrationPendingOrder(t, db, "ORD-WEBHOOK-DUP")

	srv, pool := setupIntegrationServer(t, db)
	t.Cleanup(func() {
		srv.Close()
		pool.Shutdown(5 * time.Second)
	})

	payload := seedream.VAccountIssuedPayload{
		EventID: "evt-dup-1", OrderNo: *order.OrderCode,
		BankCode: "088", AccountNo: "110-321", ReceiverName: "Seedream",
		DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
		IssuedAt:         time.Now().UTC(),
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	ts := strconv.FormatInt(time.Now().Unix(), 10)
	sig := signWebhookBody(ts, body, testWebhookSecret)
	deliveryID := int64(300003)
	deliveryIDStr := strconv.FormatInt(deliveryID, 10)
	url := srv.URL + "/webhook/seedream"

	// 1차 POST — 정상 처리
	resp1 := postWebhook(t, url, string(seedream.EventVAccountIssued), ts, sig, deliveryIDStr, body)
	require.Equal(t, http.StatusOK, resp1.StatusCode)

	// 1차 비동기 완료 대기 (ProcessedAt 세팅)
	waitForProcessed(t, db, deliveryID)

	// Order 가 ISSUED 로 전이된 것도 확인 — 1차 dispatch 효과
	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "ISSUED", got.Status)

	// 2차 POST — 같은 DeliveryID 재수신
	resp2 := postWebhook(t, url, string(seedream.EventVAccountIssued), ts, sig, deliveryIDStr, body)
	// 멱등 no-op 은 200 반환 (handler.Receive: RowsAffected==0 path)
	assert.Equal(t, http.StatusOK, resp2.StatusCode)

	// receipt 는 정확히 1건
	var count int64
	require.NoError(t, db.Model(&domain.WebhookReceipt{}).
		Where("DeliveryId = ?", deliveryID).Count(&count).Error)
	assert.Equal(t, int64(1), count,
		fmt.Sprintf("DeliveryID=%d 에 대해 receipt 는 1건만 있어야 함", deliveryID))
}
