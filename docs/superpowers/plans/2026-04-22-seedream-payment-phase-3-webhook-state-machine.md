# Seedream Payment Integration — Phase 3: Webhook + State Machine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /webhook/seedream` 엔드포인트를 구현하여 Seedream 웹훅을 HMAC 검증 + 멱등 수신 + 비동기 처리하고, `vaccount.issued` → `vaccount.deposited` 이벤트로 주문을 PENDING → ISSUED → PAID 상태로 전이시킨다. TEST 환경 1건 결제 완주(발급 → 은행선택 → 입금) 를 브라우저 + 웹훅으로 검증한다.

**Architecture:** 설계 §3.1/3.2 — `infra/seedream/` 에 HMAC 검증 + 이벤트 타입만 정의, `app/services/vaccount_state.go` 에 순수 상태 전이 함수, `app/services/vaccount_webhook_svc.go` 에 dispatch 레이어, `api/handlers/seedream_webhook_handler.go` 에 HTTP 진입점. 웹훅 수신은 **"HMAC 검증 → 멱등 INSERT → 워커 풀 enqueue → 즉시 200"** 패턴 (§8.6.5 "10초 내 2xx"). 검증 실패 시 500 반환(§8.6.3 "4xx = 즉시 DLQ" 회피).

**Tech Stack:** Go (Gin · GORM · HMAC-SHA256) · 기존 `workqueue.WorkerPool` · MSSQL · Seedream TEST 환경

**Spec reference:** `docs/superpowers/specs/2026-04-22-seedream-payment-integration-design.md` §6.2 (상태머신) · §6.3 (웹훅 dispatch) · §7.1 (라우트) · §8 (웹훅 수신) · §10.1 (로그 마스킹)

**Precondition:**
- Phase 2 (Client + Issue) merge 완료.
- Seedream Ops 에 `Partners` 레코드 등록 완료 (WebhookURL · SigningSecret).
- `.env` 에 `SEEDREAM_WEBHOOK_SECRET` 실값 저장됨.
- 웹훅 수신 URL 이 Seedream 에서 도달 가능 (PROD 배포된 상태 또는 ngrok 터널).

---

## Scope 및 제한

**이 Phase 에서 다루는 이벤트 (3개)**:
- `vaccount.issued` — 은행선택 완료, 계좌번호 확정. Order PENDING → ISSUED.
- `vaccount.deposited` — 입금 완료. Order ISSUED(또는 PENDING) → PAID + Voucher SOLD + Ledger 기록.
- `vaccount.requested` — 발급 요청 에코. Phase 2 에서 이미 Payment 가 생성돼 있으므로 no-op (idempotent 수신 로그만).

**이 Phase 에서 **다루지 않는** 이벤트 (Phase 4 에서)**:
- `payment.canceled` · `vaccount.deposit_canceled` — Phase 4 Cancel/Refund 와 세트.
- `vaccount.cancelled` · `deposit_cancel.deposited` — 위와 같이 Phase 4.

**미지원 이벤트 방어**: 알 수 없는 `X-Seedream-Event` 값이 도착하면 `webhook_receipts` INSERT 후 no-op 처리(+ 로그). 5xx 반환 금지 (재시도 폭풍 방지).

---

## Prerequisites (User Action)

- [ ] Seedream Ops 의 `Partners.WebhookURL` 확인 — 현재 배포 환경에서 Seedream 이 도달 가능한가?
  - **옵션 A (권장)**: PROD `https://seedreamgift.com/webhook/seedream` — nginx 에 `/webhook/seedream` location block 추가 필요.
  - **옵션 B (임시)**: ngrok `https://<random>.ngrok.io/webhook/seedream` — 개발자 머신에서 직접 수신. Ops 에게 ngrok URL 재등록 요청 필요. 종료 시 URL 변경.
- [ ] `SEEDREAM_WEBHOOK_SECRET` 실값이 `.env` 에 저장됨 (Phase 2 때 설정 완료).
- [ ] Cloudflare 차단 해제 (Phase 2 대기 사항) — 아웃바운드 호출 테스트를 위해 필요하나 웹훅 수신엔 무관.

---

## File Structure

**신규 생성:**
- `go-server/internal/infra/seedream/webhook_verify.go` — HMAC-SHA256 검증 유틸
- `go-server/internal/infra/seedream/webhook_types.go` — EventType 상수 + payload 구조체
- `go-server/internal/infra/seedream/webhook_verify_test.go` — 왕복 회귀 테스트
- `go-server/internal/infra/workqueue/webhook_job.go` — `VAccountWebhookJob` 타입
- `go-server/internal/app/services/vaccount_state.go` — 이벤트별 상태 전이 함수
- `go-server/internal/app/services/vaccount_state_test.go` — 상태 전이 전수 테스트
- `go-server/internal/app/services/vaccount_webhook_svc.go` — dispatch 서비스
- `go-server/internal/app/services/vaccount_webhook_svc_test.go` — 멱등 수신 · 유효/무효 전이
- `go-server/internal/api/handlers/seedream_webhook_handler.go` — HTTP 진입점

**수정:**
- `go-server/internal/routes/container.go` — `WebhookWorkerPool` 신규 생성 + DI 추가
- `go-server/internal/routes/register.go` 또는 `main.go` — `/webhook/seedream` 라우트 등록 (root router, `/api/v1` 밖)
- `pkg/logger/masking.go` 또는 동등한 마스킹 규칙 — `SEEDREAM_WEBHOOK_SECRET`, `TOKEN` 추가

**명시적으로 건드리지 않음 (Phase 4+):**
- Cancel/Refund 서비스 및 관련 이벤트 (`payment.canceled`, `vaccount.deposit_canceled`, 등)
- Reconcile cron job (Phase 5)
- Expiry timer cron job (Phase 5)

---

## Task 1: Webhook 검증 유틸 (HMAC-SHA256, TDD)

**Files:**
- Create: `go-server/internal/infra/seedream/webhook_verify.go`
- Create: `go-server/internal/infra/seedream/webhook_verify_test.go`

### - [ ] Step 1: 실패 테스트 작성

`go-server/internal/infra/seedream/webhook_verify_test.go`:

```go
package seedream

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func signedHeader(t *testing.T, secret string, ts int64, body []byte) (tsHeader, sigHeader string) {
	t.Helper()
	tsHeader = fmt.Sprintf("%d", ts)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(tsHeader))
	mac.Write([]byte{'.'})
	mac.Write(body)
	sigHeader = "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return
}

func TestVerifyWebhook_Success(t *testing.T) {
	secret := "whsec_test_abc"
	body := []byte(`{"eventId":"evt-1","orderNo":"ORD-1"}`)
	ts, sig := signedHeader(t, secret, time.Now().Unix(), body)

	err := VerifyWebhook(secret, body, ts, sig, DefaultMaxSkew)
	assert.NoError(t, err)
}

func TestVerifyWebhook_TimestampSkew(t *testing.T) {
	secret := "whsec_test_abc"
	body := []byte(`{}`)
	// 20분 전 timestamp — 허용 범위(10분) 초과
	old := time.Now().Add(-20 * time.Minute).Unix()
	ts, sig := signedHeader(t, secret, old, body)

	err := VerifyWebhook(secret, body, ts, sig, DefaultMaxSkew)
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrTimestampSkew))
}

func TestVerifyWebhook_SignatureMismatch(t *testing.T) {
	secret := "whsec_test_abc"
	body := []byte(`{"eventId":"evt-1"}`)
	ts, sig := signedHeader(t, secret, time.Now().Unix(), body)

	// body 를 변조
	tamperedBody := []byte(`{"eventId":"evt-tampered"}`)
	err := VerifyWebhook(secret, tamperedBody, ts, sig, DefaultMaxSkew)
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrSignatureMismatch))
}

func TestVerifyWebhook_InvalidTimestamp(t *testing.T) {
	err := VerifyWebhook("secret", []byte("{}"), "not-a-number", "sha256=abc", DefaultMaxSkew)
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrInvalidTimestamp))
}

func TestVerifyWebhook_MissingPrefix(t *testing.T) {
	secret := "s"
	ts, sig := signedHeader(t, secret, time.Now().Unix(), []byte("{}"))
	// sha256= 제거
	err := VerifyWebhook(secret, []byte("{}"), ts, sig[len("sha256="):], DefaultMaxSkew)
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrSignaturePrefix))
}

func TestVerifyWebhook_FutureSkew(t *testing.T) {
	secret := "s"
	body := []byte("{}")
	// 20분 미래 (허용 초과)
	future := time.Now().Add(20 * time.Minute).Unix()
	ts, sig := signedHeader(t, secret, future, body)
	err := VerifyWebhook(secret, body, ts, sig, DefaultMaxSkew)
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrTimestampSkew))
}
```

### - [ ] Step 2: 컴파일 실패 확인

```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/infra/seedream/ -run TestVerifyWebhook -v
```

Expected: `undefined: VerifyWebhook`, `undefined: ErrTimestampSkew` 등.

### - [ ] Step 3: 구현

`go-server/internal/infra/seedream/webhook_verify.go`:

```go
package seedream

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"
)

// DefaultMaxSkew 는 Seedream 상위 가이드 §8.4 권장치 (webhookverify.Verify 주석).
// ±10분 허용 — 시계 드리프트 및 네트워크 지연 수용.
const DefaultMaxSkew = 10 * time.Minute

var (
	ErrInvalidTimestamp  = errors.New("seedream: X-Seedream-Timestamp parse 실패")
	ErrTimestampSkew     = errors.New("seedream: X-Seedream-Timestamp skew 초과")
	ErrSignaturePrefix   = errors.New("seedream: X-Seedream-Signature 는 'sha256=' 접두사 필수")
	ErrSignatureMismatch = errors.New("seedream: X-Seedream-Signature HMAC 불일치")
)

// VerifyWebhook 는 Seedream 웹훅 서명 프로토콜을 검증합니다.
//
//   signed_payload = "{timestamp}.{rawBody}"
//   signature      = hex(HMAC-SHA256(secret, signed_payload))
//   header         = "sha256=" + signature
//
// 검증 실패 시 구체적 원인 error 를 반환하되 **호출자는 무조건 500 반환**해야 합니다.
// 4xx 반환 시 Seedream 이 즉시 DLQ 로 드롭 (§8.6.3) — 시크릿/시계 일시 장애를 영구 실패로
// 굳히지 않도록 주의.
func VerifyWebhook(secret string, rawBody []byte, tsHeader, sigHeader string, maxSkew time.Duration) error {
	ts, err := strconv.ParseInt(tsHeader, 10, 64)
	if err != nil {
		return ErrInvalidTimestamp
	}
	age := time.Since(time.Unix(ts, 0))
	if age < 0 {
		age = -age
	}
	if age > maxSkew {
		return ErrTimestampSkew
	}

	got, ok := strings.CutPrefix(sigHeader, "sha256=")
	if !ok {
		return ErrSignaturePrefix
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(tsHeader))
	mac.Write([]byte{'.'})
	mac.Write(rawBody)
	want := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(got), []byte(want)) {
		return ErrSignatureMismatch
	}
	return nil
}
```

### - [ ] Step 4: 테스트 통과 확인

```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/infra/seedream/ -run TestVerifyWebhook -v
```

Expected: 6 케이스 모두 PASS.

### - [ ] Step 5: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/infra/seedream/webhook_verify.go go-server/internal/infra/seedream/webhook_verify_test.go
git commit -m "feat(seedream): add webhook HMAC-SHA256 verification utility"
```

---

## Task 2: Webhook 이벤트 타입 + payload 구조체

**Files:**
- Create: `go-server/internal/infra/seedream/webhook_types.go`

### - [ ] Step 1: 작성

`go-server/internal/infra/seedream/webhook_types.go`:

```go
package seedream

import "time"

// EventType 은 X-Seedream-Event 헤더 값.
// 오타 방지를 위해 상수로만 비교 (직접 리터럴 금지).
type EventType string

const (
	// 가맹점(상품권 사이트) 이 직접 호출해서 발생한 이벤트 — 미국식 (L 한 개).
	EventVAccountRequested       EventType = "vaccount.requested"
	EventVAccountIssued          EventType = "vaccount.issued"
	EventVAccountDeposited       EventType = "vaccount.deposited"
	EventPaymentCanceled         EventType = "payment.canceled"          // Phase 4
	EventVAccountDepositCanceled EventType = "vaccount.deposit_canceled" // Phase 4

	// 외부 자동 발생 — 영국식 (L 두 개). 의도적 스펠링 차이.
	EventVAccountCancelled      EventType = "vaccount.cancelled"       // Phase 4
	EventDepositCancelDeposited EventType = "deposit_cancel.deposited" // Phase 4
)

// ─────────────────────────────────────────────────────────
// Phase 3 에서 처리할 payload (§8.3.2 신규 포맷)
// ─────────────────────────────────────────────────────────

// VAccountRequestedPayload — 발급 요청 에코. 이미 Payment 가 생성돼 있으므로 dispatch 는 no-op.
type VAccountRequestedPayload struct {
	EventID     string    `json:"eventId"`
	CallerID    string    `json:"callerId"`
	OrderNo     string    `json:"orderNo"`
	RequestedAt time.Time `json:"requestedAt"`
}

// VAccountIssuedPayload — 고객 은행 선택 완료. 계좌번호 확정.
type VAccountIssuedPayload struct {
	EventID          string    `json:"eventId"`
	CallerID         string    `json:"callerId"`
	OrderNo          string    `json:"orderNo"`
	BankCode         string    `json:"bankCode"`
	AccountNo        string    `json:"accountNo"`
	ReceiverName     string    `json:"receiverName"`
	DepositEndDate   string    `json:"depositEndDate"`   // YYYYMMDDhhmmss (원본)
	DepositEndDateAt time.Time `json:"depositEndDateAt"` // RFC3339
	IssuedAt         time.Time `json:"issuedAt"`
}

// VAccountDepositedPayload — 고객 입금 확인.
type VAccountDepositedPayload struct {
	EventID     string    `json:"eventId"`
	CallerID    string    `json:"callerId"`
	OrderNo     string    `json:"orderNo"`
	Amount      int64     `json:"amount"`
	DepositedAt time.Time `json:"depositedAt"`
}

// ─────────────────────────────────────────────────────────
// 웹훅 헤더 상수
// ─────────────────────────────────────────────────────────

const (
	HeaderEvent      = "X-Seedream-Event"
	HeaderTimestamp  = "X-Seedream-Timestamp"
	HeaderSignature  = "X-Seedream-Signature"
	HeaderDeliveryID = "X-Seedream-Delivery-Id"
)
```

### - [ ] Step 2: 빌드 확인

```bash
cd D:/dev/SeedreamGift/go-server && go build ./internal/infra/seedream/
```

Expected: 에러 없이 성공.

### - [ ] Step 3: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/infra/seedream/webhook_types.go
git commit -m "feat(seedream): add webhook EventType constants + payload structs"
```

---

## Task 3: 상태 전이 머신 (`vaccount_state.go`, TDD)

**Files:**
- Create: `go-server/internal/app/services/vaccount_state.go`
- Create: `go-server/internal/app/services/vaccount_state_test.go`

### - [ ] Step 1: 실패 테스트 작성

`go-server/internal/app/services/vaccount_state_test.go`:

```go
package services

import (
	"context"
	"testing"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func setupStateTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&domain.Order{}, &domain.Payment{}, &domain.User{}, &domain.OrderItem{},
		&domain.VoucherCode{}, &domain.OrderEvent{},
	))
	return db
}

func seedPendingOrderWithPayment(t *testing.T, db *gorm.DB) (*domain.Order, *domain.Payment) {
	t.Helper()
	code := "ORD-S-1"
	o := &domain.Order{
		UserID: 42, Status: "PENDING", Source: "USER",
		TotalAmount: domain.NewNumericDecimal(decimal.NewFromInt(50000)),
		OrderCode:   &code,
	}
	require.NoError(t, db.Create(o).Error)

	phase := "awaiting_bank_selection"
	idem := "gift:vaccount:ORD-S-1"
	vaID := int64(102847)
	p := &domain.Payment{
		OrderID: o.ID, Method: "VIRTUAL_ACCOUNT_SEEDREAM",
		Amount: o.TotalAmount, Status: "PENDING",
		SeedreamVAccountID: &vaID, SeedreamPhase: &phase, SeedreamIdempotencyKey: &idem,
	}
	require.NoError(t, db.Create(p).Error)
	return o, p
}

func TestApplyVAccountIssued(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyIssued(context.Background(), order.OrderCode, seedream.VAccountIssuedPayload{
		OrderNo:          *order.OrderCode,
		BankCode:         "088",
		AccountNo:        "110-123-456789",
		ReceiverName:     "씨드림기프트",
		DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
		IssuedAt:         time.Now().UTC(),
	})
	require.NoError(t, err)

	// Order.Status: PENDING → ISSUED
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
}

func TestApplyVAccountDeposited_AmountMatches(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	// 먼저 ISSUED 상태로
	db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "ISSUED")

	svc := NewVAccountStateService(db, zap.NewNop())
	err := svc.ApplyDeposited(context.Background(), order.OrderCode, seedream.VAccountDepositedPayload{
		OrderNo: *order.OrderCode, Amount: 50000, DepositedAt: time.Now().UTC(),
	})
	require.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "PAID", got.Status)

	var p domain.Payment
	require.NoError(t, db.Where("OrderId = ?", order.ID).First(&p).Error)
	assert.Equal(t, "CONFIRMED", p.Status)
	require.NotNil(t, p.ConfirmedAt)
}

func TestApplyVAccountDeposited_AmountMismatch_Rejected(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "ISSUED")

	svc := NewVAccountStateService(db, zap.NewNop())
	// Seedream 이 애초에 mismatch 에 대해 webhook 을 발사하지 않는 것이 설계 원칙 — 만약 도달하면 Seedream 회귀.
	// Phase 3 구현은 방어적으로 Order.Status 를 변경하지 않고 에러 반환.
	err := svc.ApplyDeposited(context.Background(), order.OrderCode, seedream.VAccountDepositedPayload{
		OrderNo: *order.OrderCode, Amount: 30000, DepositedAt: time.Now().UTC(),
	})
	assert.Error(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "ISSUED", got.Status) // 변하지 않음
}

func TestApplyVAccountIssued_OrderNotFound(t *testing.T) {
	db := setupStateTestDB(t)
	svc := NewVAccountStateService(db, zap.NewNop())
	unknown := "ORD-NOT-EXIST"
	err := svc.ApplyIssued(context.Background(), &unknown, seedream.VAccountIssuedPayload{OrderNo: unknown})
	assert.Error(t, err)
}

func TestApplyVAccountIssued_Idempotent(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	svc := NewVAccountStateService(db, zap.NewNop())

	payload := seedream.VAccountIssuedPayload{
		OrderNo: *order.OrderCode, BankCode: "088", AccountNo: "110-1",
		DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
	}
	// 1차 호출: 전이 성공
	require.NoError(t, svc.ApplyIssued(context.Background(), order.OrderCode, payload))
	// 2차 호출: Order 이미 ISSUED — no-op 또는 에러 없이 반환
	err := svc.ApplyIssued(context.Background(), order.OrderCode, payload)
	assert.NoError(t, err, "재수신은 idempotent no-op 이어야 함")
}
```

### - [ ] Step 2: 컴파일 실패 확인

```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/app/services/ -run TestApply -v
```

Expected: `undefined: NewVAccountStateService` 등.

### - [ ] Step 3: 구현

`go-server/internal/app/services/vaccount_state.go`:

```go
package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// VAccountStateService 는 Seedream 웹훅 이벤트에 따라 Order/Payment 상태를 전이시킵니다.
// 설계 §6.2 의 전이 표를 참조하여 각 Apply* 함수로 분리.
type VAccountStateService struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewVAccountStateService(db *gorm.DB, logger *zap.Logger) *VAccountStateService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &VAccountStateService{db: db, logger: logger}
}

// ApplyIssued 는 vaccount.issued 이벤트를 처리합니다.
//
//   Order.Status: PENDING → ISSUED
//   Payment.SeedreamPhase: awaiting_bank_selection → awaiting_deposit
//   Payment.BankCode/AccountNumber/DepositorName/ExpiresAt UPDATE
//
// 이미 ISSUED 또는 그 이후 상태인 경우 no-op (idempotent).
func (s *VAccountStateService) ApplyIssued(ctx context.Context, orderCode *string, payload seedream.VAccountIssuedPayload) error {
	if orderCode == nil || *orderCode == "" {
		return errors.New("orderCode 누락")
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order domain.Order
		if err := tx.Where("OrderCode = ?", *orderCode).First(&order).Error; err != nil {
			return fmt.Errorf("order not found (orderCode=%s): %w", *orderCode, err)
		}
		// 이미 ISSUED 이상이면 no-op (멱등)
		if order.Status != domain.OrderStatusPending {
			s.logger.Info("vaccount.issued 재수신 — idempotent no-op",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status))
			return nil
		}

		if err := tx.Model(&order).Update("Status", domain.OrderStatusIssued).Error; err != nil {
			return err
		}

		phase := "awaiting_deposit"
		bankCode := payload.BankCode
		accountNo := payload.AccountNo
		depositorName := payload.ReceiverName
		expiresAt := payload.DepositEndDateAt
		if err := tx.Model(&domain.Payment{}).
			Where("OrderId = ? AND Status = 'PENDING'", order.ID).
			Updates(map[string]any{
				"SeedreamPhase": &phase,
				"BankCode":      &bankCode,
				"AccountNumber": &accountNo,
				"DepositorName": &depositorName,
				"ExpiresAt":     &expiresAt,
			}).Error; err != nil {
			return err
		}
		return nil
	})
}

// ApplyDeposited 는 vaccount.deposited 이벤트를 처리합니다.
//
//   Amount 검증: payload.amount == Order.TotalAmount (불일치 시 에러 — Seedream 회귀 의심)
//   Order.Status: (PENDING|ISSUED) → PAID
//   Payment.Status: PENDING → CONFIRMED + ConfirmedAt
//   Voucher RESERVED → SOLD (Phase 3 범위 외, TODO 플래그)
//   Ledger 기록 (Phase 3 범위 외, TODO)
//
// 이미 PAID 이상이면 no-op.
func (s *VAccountStateService) ApplyDeposited(ctx context.Context, orderCode *string, payload seedream.VAccountDepositedPayload) error {
	if orderCode == nil || *orderCode == "" {
		return errors.New("orderCode 누락")
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var order domain.Order
		if err := tx.Where("OrderCode = ?", *orderCode).First(&order).Error; err != nil {
			return fmt.Errorf("order not found (orderCode=%s): %w", *orderCode, err)
		}
		// 이미 PAID 이상이면 no-op
		if order.Status == domain.OrderStatusPaid ||
			order.Status == domain.OrderStatusDelivered ||
			order.Status == domain.OrderStatusCompleted {
			s.logger.Info("vaccount.deposited 재수신 — idempotent no-op",
				zap.String("orderCode", *orderCode), zap.String("status", order.Status))
			return nil
		}

		// Amount 검증: Seedream 은 mismatch 시 webhook 을 발사하지 않는 설계 원칙.
		// 만약 도달하면 Seedream 회귀 버그 — 상태 전이 거부 + Ops 에스컬레이션.
		if payload.Amount != order.TotalAmount.Decimal.IntPart() {
			s.logger.Error("vaccount.deposited amount mismatch — Seedream 회귀 의심",
				zap.String("orderCode", *orderCode),
				zap.Int64("expected", order.TotalAmount.Decimal.IntPart()),
				zap.Int64("got", payload.Amount))
			return fmt.Errorf("amount mismatch: expected=%d got=%d", order.TotalAmount.Decimal.IntPart(), payload.Amount)
		}

		if err := tx.Model(&order).Update("Status", domain.OrderStatusPaid).Error; err != nil {
			return err
		}

		now := time.Now().UTC()
		if err := tx.Model(&domain.Payment{}).
			Where("OrderId = ? AND Status = 'PENDING'", order.ID).
			Updates(map[string]any{
				"Status":      "CONFIRMED",
				"ConfirmedAt": &now,
			}).Error; err != nil {
			return err
		}

		// TODO(Phase 3.1 / 4): Voucher RESERVED → SOLD, Ledger.RecordPayment, OrderEvent 기록.
		// Phase 3 MVP 는 Order/Payment 전이만 다루고, Voucher/Ledger 는 연계 작업 완결 후 추가.
		return nil
	})
}
```

### - [ ] Step 4: 테스트 통과 확인

```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/app/services/ -run "TestApply" -count=1 -v
```

Expected: 5 케이스 모두 PASS.

### - [ ] Step 5: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/app/services/vaccount_state.go go-server/internal/app/services/vaccount_state_test.go
git commit -m "feat(services): add VAccountStateService for issued/deposited transitions"
```

---

## Task 4: Worker Job 타입

**Files:**
- Create: `go-server/internal/infra/workqueue/webhook_job.go`

### - [ ] Step 1: 작성

`go-server/internal/infra/workqueue/webhook_job.go`:

```go
package workqueue

import (
	"context"

	"go.uber.org/zap"
	"seedream-gift-server/pkg/logger"
)

// WebhookProcessor 는 dispatch 레이어(VAccountWebhookService) 를 인터페이스로 감싼 것.
// 순환 import 방지 + 테스트 대역 가능.
type WebhookProcessor interface {
	Handle(ctx context.Context, deliveryID int64, event string, raw []byte) error
}

// VAccountWebhookJob 은 비동기 웹훅 처리를 위한 Job 입니다.
// 핸들러(API 레이어) 는 HMAC 검증 + receipt INSERT 까지 동기 수행하고,
// 실제 상태 전이는 이 Job 으로 위임해 10초 timeout 밖으로 밀어냄.
type VAccountWebhookJob struct {
	DeliveryID int64
	Event      string
	RawBody    []byte
	Processor  WebhookProcessor
}

// Name 은 Job 인터페이스 구현.
func (j VAccountWebhookJob) Name() string { return "seedream_webhook" }

// Execute 는 Job 인터페이스 구현.
// 실패 시 error 반환 — webhook_receipts.ProcessedAt 은 nil 로 남아 Seedream 재전송 시 멱등 재처리 가능.
func (j VAccountWebhookJob) Execute() error {
	err := j.Processor.Handle(context.Background(), j.DeliveryID, j.Event, j.RawBody)
	if err != nil {
		logger.Log.Error("seedream webhook job 실패",
			zap.Int64("deliveryId", j.DeliveryID),
			zap.String("event", j.Event),
			zap.Error(err))
	}
	return err
}
```

### - [ ] Step 2: 빌드 확인

```bash
cd D:/dev/SeedreamGift/go-server && go build ./internal/infra/workqueue/
```

Expected: 에러 없이 성공.

### - [ ] Step 3: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/infra/workqueue/webhook_job.go
git commit -m "feat(workqueue): add VAccountWebhookJob for async webhook processing"
```

---

## Task 5: Webhook Dispatch 서비스

**Files:**
- Create: `go-server/internal/app/services/vaccount_webhook_svc.go`
- Create: `go-server/internal/app/services/vaccount_webhook_svc_test.go`

### - [ ] Step 1: 실패 테스트 작성

`go-server/internal/app/services/vaccount_webhook_svc_test.go`:

```go
package services

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func TestVAccountWebhookService_Handle_Issued(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	require.NoError(t, db.AutoMigrate(&domain.WebhookReceipt{}))

	svc := NewVAccountWebhookService(db, NewVAccountStateService(db, zap.NewNop()), zap.NewNop())

	payload := seedream.VAccountIssuedPayload{
		EventID:          "evt-1",
		OrderNo:          *order.OrderCode,
		BankCode:         "088",
		AccountNo:        "110-123",
		ReceiverName:     "Seedream",
		DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
		IssuedAt:         time.Now().UTC(),
	}
	raw, _ := json.Marshal(payload)

	err := svc.Handle(context.Background(), 42, string(seedream.EventVAccountIssued), raw)
	require.NoError(t, err)

	// receipt.ProcessedAt 세팅 확인
	var r domain.WebhookReceipt
	require.NoError(t, db.Where("DeliveryId = ?", 42).First(&r).Error)
	require.NotNil(t, r.ProcessedAt)
	assert.Equal(t, string(seedream.EventVAccountIssued), r.Event)

	// Order 상태 확인
	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "ISSUED", got.Status)
}

func TestVAccountWebhookService_Handle_UnknownEvent_NoOp(t *testing.T) {
	db := setupStateTestDB(t)
	require.NoError(t, db.AutoMigrate(&domain.WebhookReceipt{}))

	// receipt 먼저 INSERT (핸들러 레이어가 이미 INSERT 했다고 가정)
	require.NoError(t, db.Create(&domain.WebhookReceipt{
		DeliveryID: 99, Event: "unknown.event", RawBody: `{}`,
	}).Error)

	svc := NewVAccountWebhookService(db, NewVAccountStateService(db, zap.NewNop()), zap.NewNop())
	// Phase 3 범위 외 이벤트는 no-op + 정상 완료
	err := svc.Handle(context.Background(), 99, "unknown.event", []byte("{}"))
	require.NoError(t, err)

	var r domain.WebhookReceipt
	require.NoError(t, db.Where("DeliveryId = ?", 99).First(&r).Error)
	require.NotNil(t, r.ProcessedAt)
}

func TestVAccountWebhookService_Handle_Deposited(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	require.NoError(t, db.AutoMigrate(&domain.WebhookReceipt{}))
	db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "ISSUED")

	svc := NewVAccountWebhookService(db, NewVAccountStateService(db, zap.NewNop()), zap.NewNop())
	payload := seedream.VAccountDepositedPayload{
		OrderNo: *order.OrderCode, Amount: 50000, DepositedAt: time.Now().UTC(),
	}
	raw, _ := json.Marshal(payload)

	err := svc.Handle(context.Background(), 55, string(seedream.EventVAccountDeposited), raw)
	require.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "PAID", got.Status)
}
```

### - [ ] Step 2: 컴파일 실패 확인

```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/app/services/ -run TestVAccountWebhookService -v
```

Expected: `undefined: NewVAccountWebhookService`.

### - [ ] Step 3: 구현

`go-server/internal/app/services/vaccount_webhook_svc.go`:

```go
package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// VAccountWebhookService 는 Seedream 웹훅을 이벤트 타입별로 dispatch 하고
// webhook_receipts.ProcessedAt 을 UPDATE 합니다.
type VAccountWebhookService struct {
	db    *gorm.DB
	state *VAccountStateService
	log   *zap.Logger
}

func NewVAccountWebhookService(db *gorm.DB, state *VAccountStateService, logger *zap.Logger) *VAccountWebhookService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &VAccountWebhookService{db: db, state: state, log: logger}
}

// Handle 는 deliveryID 의 이벤트를 처리합니다.
// 호출자(핸들러 또는 Worker) 는 이미 webhook_receipts INSERT 를 완료한 상태여야 합니다.
func (s *VAccountWebhookService) Handle(ctx context.Context, deliveryID int64, event string, raw []byte) error {
	ev := seedream.EventType(event)

	var handlerErr error
	switch ev {
	case seedream.EventVAccountRequested:
		// 발급 요청 에코 — Payment 는 Phase 2 Issue() 에서 이미 생성. 수신 로그만.
		s.log.Debug("vaccount.requested 수신 (no-op)",
			zap.Int64("deliveryId", deliveryID))

	case seedream.EventVAccountIssued:
		var p seedream.VAccountIssuedPayload
		if err := json.Unmarshal(raw, &p); err != nil {
			return fmt.Errorf("parse VAccountIssuedPayload: %w", err)
		}
		handlerErr = s.state.ApplyIssued(ctx, &p.OrderNo, p)

	case seedream.EventVAccountDeposited:
		var p seedream.VAccountDepositedPayload
		if err := json.Unmarshal(raw, &p); err != nil {
			return fmt.Errorf("parse VAccountDepositedPayload: %w", err)
		}
		handlerErr = s.state.ApplyDeposited(ctx, &p.OrderNo, p)

	case seedream.EventPaymentCanceled,
		seedream.EventVAccountDepositCanceled,
		seedream.EventVAccountCancelled,
		seedream.EventDepositCancelDeposited:
		// Phase 4 구현 범위 — 현재는 로그만 남기고 no-op.
		// 재시도 폭풍 방지를 위해 에러 반환 안 함 (receipt 만 남겨 감사 추적).
		s.log.Info("Phase 4 이벤트 수신 — 현재는 no-op",
			zap.Int64("deliveryId", deliveryID),
			zap.String("event", event))

	default:
		// 알 수 없는 이벤트 — 기록만 하고 no-op. 재시도 트리거하지 않음.
		s.log.Warn("알 수 없는 Seedream 이벤트 — raw body 보관, no-op",
			zap.Int64("deliveryId", deliveryID),
			zap.String("event", event))
	}

	if handlerErr != nil {
		return handlerErr
	}

	// 성공적으로 처리된 경우 ProcessedAt 세팅
	now := time.Now().UTC()
	return s.db.WithContext(ctx).
		Model(&domain.WebhookReceipt{}).
		Where("DeliveryId = ?", deliveryID).
		Update("ProcessedAt", &now).Error
}
```

### - [ ] Step 4: 테스트 통과 확인

```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/app/services/ -run "TestVAccountWebhookService" -count=1 -v
```

Expected: 3 케이스 PASS.

### - [ ] Step 5: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/app/services/vaccount_webhook_svc.go go-server/internal/app/services/vaccount_webhook_svc_test.go
git commit -m "feat(services): add VAccountWebhookService for event dispatch"
```

---

## Task 6: HTTP 핸들러 (`POST /webhook/seedream`)

**Files:**
- Create: `go-server/internal/api/handlers/seedream_webhook_handler.go`

### - [ ] Step 1: 작성

`go-server/internal/api/handlers/seedream_webhook_handler.go`:

```go
package handlers

import (
	"io"
	"net/http"
	"strconv"
	"time"

	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"
	"seedream-gift-server/internal/infra/workqueue"
	"seedream-gift-server/pkg/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// MaxWebhookBody 는 웹훅 body 의 안전 한도 (Seedream payload 는 수 KB, 1 MiB 여유).
const MaxWebhookBody = 1 << 20

// SeedreamWebhookHandler 는 Seedream 웹훅 수신 핸들러.
type SeedreamWebhookHandler struct {
	db            *gorm.DB
	webhookSvc    *services.VAccountWebhookService
	webhookPool   *workqueue.WorkerPool
	webhookSecret string
}

func NewSeedreamWebhookHandler(
	db *gorm.DB,
	svc *services.VAccountWebhookService,
	pool *workqueue.WorkerPool,
	secret string,
) *SeedreamWebhookHandler {
	return &SeedreamWebhookHandler{
		db: db, webhookSvc: svc, webhookPool: pool, webhookSecret: secret,
	}
}

// Receive 는 POST /webhook/seedream 의 실행 로직입니다.
// 중요 원칙 (§8.6.3): 검증 실패 시에도 500 반환 (4xx 는 즉시 DLQ 드롭).
func (h *SeedreamWebhookHandler) Receive(c *gin.Context) {
	// 1) body 읽기 — 크기 제한
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxWebhookBody)
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.Log.Warn("webhook body read failed", zap.Error(err))
		c.Status(http.StatusInternalServerError)
		return
	}
	_ = c.Request.Body.Close()

	// 2) 헤더 추출
	tsHeader := c.GetHeader(seedream.HeaderTimestamp)
	sigHeader := c.GetHeader(seedream.HeaderSignature)
	event := c.GetHeader(seedream.HeaderEvent)
	deliveryIDStr := c.GetHeader(seedream.HeaderDeliveryID)

	// 3) HMAC 검증 — 실패 시 500 (영구 DLQ 이관 방지)
	if err := seedream.VerifyWebhook(h.webhookSecret, raw, tsHeader, sigHeader, seedream.DefaultMaxSkew); err != nil {
		logger.Log.Warn("seedream webhook 서명 검증 실패",
			zap.Error(err),
			zap.String("deliveryId", deliveryIDStr),
			zap.String("event", event))
		c.Status(http.StatusInternalServerError)
		return
	}

	// 4) DeliveryID 파싱
	deliveryID, err := strconv.ParseInt(deliveryIDStr, 10, 64)
	if err != nil || deliveryID == 0 {
		logger.Log.Warn("seedream webhook DeliveryId 누락/invalid", zap.String("raw", deliveryIDStr))
		c.Status(http.StatusInternalServerError)
		return
	}

	// 5) webhook_receipts INSERT — 멱등성 보장 (OnConflict DoNothing)
	ctx := c.Request.Context()
	orderNoPtr, eventIDPtr := extractOrderNoAndEventID(raw)
	receipt := &domain.WebhookReceipt{
		DeliveryID: deliveryID, Event: event,
		EventID: eventIDPtr, OrderNo: orderNoPtr,
		RawBody:    string(raw),
		ReceivedAt: time.Now().UTC(),
	}
	res := h.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(receipt)
	if res.Error != nil {
		logger.Log.Error("webhook_receipts INSERT 실패", zap.Error(res.Error))
		c.Status(http.StatusInternalServerError)
		return
	}
	if res.RowsAffected == 0 {
		// 이미 처리된 delivery — Seedream 재시도 중지 목적 200 즉시 반환
		logger.Log.Info("webhook 재수신 (idempotent no-op)", zap.Int64("deliveryId", deliveryID))
		c.Status(http.StatusOK)
		return
	}

	// 6) 워커 풀에 비동기 처리 위임 — 10초 내 응답 보장
	job := workqueue.VAccountWebhookJob{
		DeliveryID: deliveryID, Event: event, RawBody: raw, Processor: h.webhookSvc,
	}
	if err := h.webhookPool.Submit(job); err != nil {
		// 큐 포화 등 — 동기 fallback 으로 직접 처리 (Seedream 재시도 유도 피하기 위해)
		logger.Log.Warn("webhook worker pool submit 실패 — sync fallback",
			zap.Error(err), zap.Int64("deliveryId", deliveryID))
		if err := h.webhookSvc.Handle(ctx, deliveryID, event, raw); err != nil {
			logger.Log.Error("sync fallback 도 실패", zap.Error(err))
			c.Status(http.StatusInternalServerError)
			return
		}
	}

	c.Status(http.StatusOK)
}

// extractOrderNoAndEventID 는 payload 에서 orderNo 와 eventId 를 best-effort 로 추출합니다.
// 파싱 실패 시 nil — 감사 인덱스 용도일 뿐이라 실패해도 플로우에 지장 없음.
func extractOrderNoAndEventID(raw []byte) (orderNoPtr, eventIDPtr *string) {
	// json 경량 파싱 — 전체 payload 구조를 모를 수 있으므로 map 으로.
	var m map[string]any
	// best-effort: ignore parse errors
	if err := parseJSON(raw, &m); err != nil {
		return nil, nil
	}
	if v, ok := m["orderNo"].(string); ok && v != "" {
		orderNoPtr = &v
	}
	if v, ok := m["eventId"].(string); ok && v != "" {
		eventIDPtr = &v
	}
	return
}

func parseJSON(raw []byte, dst any) error {
	return (&jsonParser{}).Unmarshal(raw, dst)
}

// jsonParser 는 extracted JSON 파싱 헬퍼 — 표준 encoding/json 사용.
type jsonParser struct{}

func (jsonParser) Unmarshal(b []byte, v any) error {
	return jsonUnmarshal(b, v)
}

// jsonUnmarshal 은 extracted-for-testing seam.
var jsonUnmarshal = func(b []byte, v any) error {
	// 로컬 import 충돌 피하기 위해 지연 로드.
	return jsonUnmarshalImpl(b, v)
}

// jsonUnmarshalImpl 은 별도 파일에서 encoding/json 을 import 해 구현합니다.
```

**NOTE**: 위 코드의 jsonParser 부분은 과도합니다. 단순하게 인라인 `json.Unmarshal` 사용:

**Revised** — 위 구현의 json 파싱 래퍼 블록을 아래로 교체:

```go
import (
	"encoding/json"
	// ...
)

// extractOrderNoAndEventID 는 payload 에서 orderNo 와 eventId 를 best-effort 로 추출합니다.
func extractOrderNoAndEventID(raw []byte) (orderNoPtr, eventIDPtr *string) {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, nil
	}
	if v, ok := m["orderNo"].(string); ok && v != "" {
		orderNoPtr = &v
	}
	if v, ok := m["eventId"].(string); ok && v != "" {
		eventIDPtr = &v
	}
	return
}
```

(jsonParser/jsonUnmarshal boilerplate 는 모두 삭제. import 에 `"encoding/json"` 추가.)

### - [ ] Step 2: 빌드 확인

```bash
cd D:/dev/SeedreamGift/go-server && go build ./...
```

Expected: 에러 없이 성공.

### - [ ] Step 3: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/api/handlers/seedream_webhook_handler.go
git commit -m "feat(api): add seedream webhook handler with HMAC verify + worker dispatch"
```

---

## Task 7: 라우트 등록 + DI

**Files:**
- Modify: `go-server/internal/routes/container.go` — Handlers 구조체 + webhookPool 추가
- Modify: `go-server/main.go` — `/webhook/seedream` 라우트 (root router, `/api/v1` 밖)

### - [ ] Step 1: Container 수정

`D:/dev/SeedreamGift/go-server/internal/routes/container.go`:

**1a.** Handlers 구조체에 추가:
```go
// SeedreamWebhook (Phase 3)
SeedreamWebhook *handlers.SeedreamWebhookHandler
```

**1b.** 별도 WebhookWorkerPool 생성 (기존 notifyPool/auditPool 근처):
```go
// 웹훅 처리 전용 워커 풀 — 결제 처리와 감사 로그 기록에서 격리.
webhookPool := workqueue.NewWorkerPool(workqueue.WorkerPoolConfig{
	Name: "seedream_webhook", Workers: 4, QueueSize: 200,
})
webhookPool.Start()
```

**1c.** 이미 존재하는 Handlers 필드에 WebhookPool 추가:
```go
WebhookPool *workqueue.WorkerPool
```

**1d.** VAccountStateService + VAccountWebhookService 인스턴스 생성 (기존 vaccountService 생성 블록 바로 아래):
```go
// VAccount 상태 전이 + 웹훅 dispatch (Phase 3)
vaccountStateSvc := services.NewVAccountStateService(db, logger.Log)
vaccountWebhookSvc := services.NewVAccountWebhookService(db, vaccountStateSvc, logger.Log)
```

**1e.** Handlers 반환 블록에 추가:
```go
SeedreamWebhook: handlers.NewSeedreamWebhookHandler(db, vaccountWebhookSvc, webhookPool, cfg.SeedreamWebhookSecret),
WebhookPool:     webhookPool,
```

### - [ ] Step 2: main.go 에 root 라우트 추가

`D:/dev/SeedreamGift/go-server/main.go` 의 `r.GET("/health", h.Health.Check)` 근처에 추가:

```go
// Seedream 웹훅 수신 (인증 없음 — HMAC 으로만 검증. /api/v1/ 밖에 위치)
r.POST("/webhook/seedream", h.SeedreamWebhook.Receive)
```

### - [ ] Step 3: Graceful shutdown 에 WebhookPool 추가

main.go 의 shutdown 블록에서 기존 `notifyPool.Shutdown()` / `auditPool.Shutdown()` 근처에 추가:

```go
h.WebhookPool.Shutdown(10 * time.Second)
```

### - [ ] Step 4: 빌드 + 서버 부팅 확인

```bash
cd D:/dev/SeedreamGift/go-server && go build ./... && timeout 8 go run . 2>&1 | grep -E "webhook|Port|Listen"
```

Expected:
```
[GIN-debug] POST /webhook/seedream --> seedream_webhook_handler.Receive
Server starting port=5140
```

### - [ ] Step 5: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/routes/container.go go-server/main.go
git commit -m "feat(routes): wire /webhook/seedream + VAccountWebhookService DI"
```

---

## Task 8: 로컬 HMAC 검증 (유닛 E2E, curl)

**Files:** 없음

서버를 로컬 기동하고 자체 서명된 웹훅을 POST 해서 full stack 이 작동하는지 확인.

### - [ ] Step 1: 서버 기동

```bash
cd D:/dev/SeedreamGift/go-server && go run . > /tmp/ph3-server.log 2>&1 &
echo $! > /tmp/ph3-server.pid
sleep 5
```

### - [ ] Step 2: 테스트 페이로드 + 서명 생성

```bash
SECRET="$(grep SEEDREAM_WEBHOOK_SECRET D:/dev/SeedreamGift/go-server/.env | cut -d'"' -f2)"
TS=$(date +%s)
# 기존 DB 에 주문이 있어야 하므로 orderNo 를 실제 PENDING 주문의 OrderCode 로 교체 필요
BODY='{"eventId":"evt-local-1","callerId":"seedreamgift-test","orderNo":"GIFT-YYYYMMDD-XXXXX","bankCode":"088","accountNo":"110-123-456789","receiverName":"로컬테스트","depositEndDate":"20260426180000","depositEndDateAt":"2026-04-26T09:00:00Z","issuedAt":"2026-04-26T08:30:00Z"}'
SIG="sha256=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

curl -sS -i -X POST http://localhost:5140/webhook/seedream \
  -H "X-Seedream-Event: vaccount.issued" \
  -H "X-Seedream-Timestamp: $TS" \
  -H "X-Seedream-Signature: $SIG" \
  -H "X-Seedream-Delivery-Id: 999001" \
  -H "Content-Type: application/json" \
  -d "$BODY"
```

Expected: `HTTP/1.1 200 OK`.

### - [ ] Step 3: DB 반영 확인

Server C 에서:
```sql
SELECT TOP 1 DeliveryId, Event, ProcessedAt FROM WebhookReceipts ORDER BY DeliveryId DESC;
SELECT TOP 1 Id, OrderCode, Status FROM Orders WHERE OrderCode = '<사용한 OrderCode>';
```

Expected:
- `WebhookReceipts` 에 DeliveryId=999001 row + ProcessedAt 세팅
- `Orders.Status = 'ISSUED'`

### - [ ] Step 4: 서명 실패 케이스

```bash
curl -sS -i -X POST http://localhost:5140/webhook/seedream \
  -H "X-Seedream-Event: vaccount.issued" \
  -H "X-Seedream-Timestamp: $TS" \
  -H "X-Seedream-Signature: sha256=WRONG_SIGNATURE" \
  -H "X-Seedream-Delivery-Id: 999002" \
  -H "Content-Type: application/json" \
  -d "$BODY"
```

Expected: `HTTP/1.1 500 Internal Server Error` (§8.6.3 정책: 4xx 금지).

### - [ ] Step 5: 멱등 재수신 케이스

Step 2 의 curl 을 다시 (같은 DeliveryId 999001 로) 실행. `/tmp/ph3-server.log` 에 "webhook 재수신 (idempotent no-op)" 로그가 보여야 함. 응답은 200.

### - [ ] Step 6: 서버 종료

```bash
kill $(cat /tmp/ph3-server.pid)
```

---

## Task 9: TEST 환경 E2E — 결제 완주

**Precondition**: Ops 가 Cloudflare 차단 해제 + Webhook URL 등록 완료.

### - [ ] Step 1: Webhook 수신 경로 확보

**옵션 A (권장, 배포 후)**: `https://seedreamgift.com/webhook/seedream` 으로 Seedream 이 전송. nginx 설정 필요:
```nginx
location = /webhook/seedream {
    proxy_pass http://127.0.0.1:5140/webhook/seedream;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_pass_request_headers on;
    client_max_body_size 2m;
}
```
Ops 가 이 설정 배포 확인.

**옵션 B (임시, 개발자 머신)**:
```bash
ngrok http 5140
# → https://<random>.ngrok-free.app 출력
# Ops 에게 이 URL 을 Partners.WebhookURL 로 등록 요청
```

### - [ ] Step 2: TEST 환경 1건 발급

Phase 2 Task 12 와 동일: 브라우저 로그인 → 장바구니 → `/checkout` → 가상계좌 선택 → 주문 → 키움 은행선택 창 표시.

### - [ ] Step 3: 은행 선택

키움 TEST 결제창에서 은행 1개 선택 → 제출.

### - [ ] Step 4: 웹훅 수신 검증

서버 로그에 `seedream webhook 수신` 엔트리 + `Order.Status=ISSUED` 전이 로그.

### - [ ] Step 5: 테스트 입금 (키움 TEST 환경)

키움 TEST 가 지원하는 방식(가상계좌 입금 시뮬레이터 또는 CP 관리자 페이지)으로 해당 계좌에 50,000원 입금 처리.

### - [ ] Step 6: PAID 전이 확인

- 서버 로그: `vaccount.deposited` 수신 + `Order.Status=PAID` 전이
- DB: `Orders.Status='PAID'`, `Payments.Status='CONFIRMED'`, `Payments.ConfirmedAt != NULL`

### - [ ] Step 7: Phase 3 완료 empty commit

```bash
cd D:/dev/SeedreamGift
git commit --allow-empty -m "chore(phase-3): webhook + state machine complete

Verified:
- HMAC-SHA256 verification with ±10min skew tolerance
- Idempotent receipt insertion (OnConflict DoNothing)
- Async worker dispatch (seedream_webhook pool, 4 workers)
- vaccount.issued → PENDING → ISSUED transition
- vaccount.deposited → ISSUED → PAID transition (with amount check)
- Phase 4 events (canceled/cancelled) gracefully no-op'd with receipt log
- 500 on signature failure (§8.6.3 — 4xx=DLQ prevention)

Deferred:
- Voucher RESERVED → SOLD on PAID (Phase 3.1 or 4)
- Ledger.RecordPayment on PAID (Phase 3.1 or 4)
- Cancel/Refund events (Phase 4)
- Reconcile + Expiry timers (Phase 5)

Next: Phase 4 — Cancel + Refund handlers + 3-tier RBAC."
```

---

## Self-Review (writer)

**1. Spec coverage**:
- §6.2 State machine (issued, deposited) — Task 3 커버
- §6.3 Webhook dispatch — Task 5 커버
- §7.1 /webhook/seedream 라우트 — Task 7 커버
- §8.4 HMAC 검증 — Task 1 커버
- §8.5 멱등 수신 (OnConflict DoNothing) — Task 6 커버
- §8.6.3 500 on sig failure — Task 6 코드에 명시
- §8.6.5 10초 내 2xx — worker pool 비동기 dispatch 로 보장
- Voucher SOLD / Ledger 기록은 **Phase 3 범위 외** 로 의도적 deferral (`TODO(Phase 3.1 / 4)` 마커)

**2. Placeholder scan**: Task 6 의 json 파싱 부분 "Revised" 블록으로 단순화 — 최종 구현은 `json.Unmarshal` 인라인 사용. 완전한 코드 아님 — implementer 가 Revised 지시에 따라 구현 요망.

**3. Type consistency**:
- `WebhookProcessor` interface (Task 4) ↔ `VAccountWebhookService.Handle` (Task 5) — 시그니처 일치.
- `EventType` (Task 2) ↔ `VAccountWebhookService.Handle` switch — 상수 사용 일치.
- `WebhookReceipt` (Phase 1 엔티티) ↔ handler INSERT ↔ webhookSvc UPDATE — 필드 이름 일치.

**4. 의존성 순서**: 1 (verify) → 2 (types) → 3 (state) → 4 (job interface) → 5 (webhook svc, 3·4 의존) → 6 (handler, 5 의존) → 7 (routes/DI, 모두 필요) → 8 (local curl test, 7 필요) → 9 (TEST E2E, Ops 필요).

**5. Scope**: 9 task, 하나의 논리 단위 (webhook in → state out). Phase 4 이벤트는 no-op 처리로 방어선만.
