# Seedream Payment Integration — Phase 4: Cancel + Refund + 4 Webhook Events

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /api/v1/payment/seedream/cancel` 통합 엔드포인트 + Seedream `payment.canceled` · `vaccount.deposit_canceled` · `vaccount.cancelled` · `deposit_cancel.deposited` 웹훅 4종 dispatch 구현. 주문을 `ISSUED → CANCELLED` (입금 전 취소), `PAID → REFUNDED` (입금 후 환불), `REFUNDED → REFUND_PAID` (환불 VA 입금 확인) 상태로 전이. Phase 3 followup 중 I-2/I-3 fix 포함.

**Architecture:** Phase 3 구조 확장. `infra/seedream/` 에 Cancel DTO + `CancelIssued`/`RefundDeposited` 메서드, `app/services/vaccount_state.go` 에 4개 Apply* 함수 추가, `app/services/cancel_svc.go` 신규(취소/환불 오케스트레이션), `api/handlers/seedream_cancel_handler.go` 신규(HTTP 진입). 웹훅 dispatch 확장은 기존 `vaccount_webhook_svc.go` 의 Phase 4 no-op 브랜치를 실제 dispatch 로 교체.

**Tech Stack:** Go (Gin · GORM · 기존 Seedream REST client · workqueue.WorkerPool) · MSSQL · Seedream TEST 환경

**Spec reference:**
- `docs/seedreamapi_docs/2026-04-21-giftcard-site-seedream-api-integration.md` §7 (취소·환불 통합) · §8.2.1 (spelling canceled vs cancelled) · §8.3.2 (webhook payload) · §9.3 (환불 경로)
- `docs/superpowers/specs/2026-04-22-seedream-payment-integration-design.md` §4.1 (상태 전이) · §6.2 (상태머신) · §6.3 (dispatch)
- `docs/seedreamapi_docs/phase3-followups.md` (I-2, I-3, I-4 항목)

**Precondition:**
- Phase 3 (`3d7c290..217eec4`) merge 완료 또는 같은 브랜치에서 작업.
- Phase 3 preconditions(Seedream Ops Partners 등록, WEBHOOK_SECRET, 웹훅 URL) 그대로 유효.

---

## Scope

**이 Phase 에서 다루는 이벤트 (4개)**:
- `payment.canceled` (미국식 L 하나) — 가맹점 요청으로 입금 전 취소 성공
- `vaccount.deposit_canceled` (미국식) — 가맹점 요청으로 입금 후 환불 성공
- `vaccount.cancelled` (영국식 L 두 개) — 키움/은행 장애로 자동 취소 (외부 사유)
- `deposit_cancel.deposited` — 환불 VA 에 실제 입금 확인 (환불 확정)

**이 Phase 에서 구현하는 HTTP 엔드포인트 (1개)**:
- `POST /api/v1/payment/seedream/cancel` — `payMethod` 필드로 VACCOUNT-ISSUECAN | BANK 분기

**상태 전이 추가**:
- `ISSUED → CANCELLED` (payment.canceled, vaccount.cancelled)
- `PAID → REFUNDED` (vaccount.deposit_canceled)
- `REFUNDED → REFUND_PAID` (deposit_cancel.deposited)

**Phase 3 followup 중 본 Phase 에서 처리**:
- **I-2**: `seedream_webhook_handler.go:113` sync fallback → `context.WithTimeout(context.Background(), 8s)`
- **I-3**: `vaccount_state.go:47-51` `ApplyIssued` 터미널 상태 분기 — CANCELLED/EXPIRED 시 `Warn` 로그 + no-op

**이 Phase 에서 다루지 않는 것**:
- I-4 (Phase 4 이벤트 replay): 이벤트 실제 자연 발생은 Phase 4 배포 후 시작이라 과거 no-op 마킹된 receipt 이 존재할 확률 ≈ 0. Phase 5 Reconcile 로 fallback.
- I-5 (MSSQL OnConflict 검증): 별도 트랙.
- Phase 2 잔여 (`POST /api/v1/payment/seedream/initiate` + HTML auto-submit 페이지): 별도 Phase.
- Reconcile cron / 만료 타이머 (Phase 5).

---

## File Structure

**신규 생성:**
- `go-server/internal/infra/seedream/cancel_types.go` — `CancelPayMethod` 상수 + `CancelPaymentRequest` + `CancelResponse` DTO
- `go-server/internal/infra/seedream/cancel_client.go` — `CancelIssued(ctx, orderNo, trxID, amount, reason)` + `RefundDeposited(ctx, orderNo, trxID, amount, reason, bankCode, accountNo)`
- `go-server/internal/infra/seedream/cancel_client_test.go` — httpmock 기반
- `go-server/internal/app/services/cancel_svc.go` — `CancelService` 오케스트레이션(주문 조회 → Seedream API → error 매핑 → 결과 반환)
- `go-server/internal/app/services/cancel_svc_test.go`
- `go-server/internal/api/handlers/seedream_cancel_handler.go` — `POST /api/v1/payment/seedream/cancel` 진입
- `go-server/internal/api/handlers/seedream_cancel_handler_test.go` — httptest integration

**수정:**
- `go-server/internal/infra/seedream/webhook_types.go` — Phase 4 payload struct 4개 추가
- `go-server/internal/app/services/vaccount_state.go` — 4개 Apply* 함수 추가 + I-3 fix
- `go-server/internal/app/services/vaccount_state_test.go` — 테스트 추가
- `go-server/internal/app/services/vaccount_webhook_svc.go` — Phase 4 이벤트 no-op → 실제 dispatch 로 교체
- `go-server/internal/app/services/vaccount_webhook_svc_test.go` — 4개 이벤트 케이스 추가
- `go-server/internal/api/handlers/seedream_webhook_handler.go` — I-2 fix
- `go-server/internal/routes/container.go` — CancelService + CancelHandler DI
- `go-server/main.go` — route 등록 (`/api/v1/payment/seedream/cancel`, 인증 JWT 필수)

---

## Task 1: Phase 4 웹훅 payload 타입

**Files:**
- Modify: `go-server/internal/infra/seedream/webhook_types.go`

### - [ ] Step 1: payload struct 추가

`webhook_types.go` 끝에 다음 타입 추가. 필드명은 통합 가이드 §8.3.2 와 일치.

```go
// ─────────────────────────────────────────────────────────
// Phase 4 에서 처리할 payload
// ─────────────────────────────────────────────────────────

// PaymentCanceledPayload — 가맹점 요청 입금 전 취소 성공 (미국식 L 하나).
type PaymentCanceledPayload struct {
	EventID    string    `json:"eventId"`
	CallerID   string    `json:"callerId"`
	OrderNo    string    `json:"orderNo"`
	Reason     string    `json:"reason"`
	CanceledAt time.Time `json:"canceledAt"`
}

// VAccountDepositCanceledPayload — 가맹점 요청 입금 후 환불 성공 (미국식 L 하나).
// PaymentCanceledPayload 와 동일 shape.
type VAccountDepositCanceledPayload = PaymentCanceledPayload

// VAccountCancelledPayload — 외부(키움/은행) 자동 취소 (영국식 L 두 개).
type VAccountCancelledPayload struct {
	EventID     string    `json:"eventId"`
	CallerID    string    `json:"callerId"`
	OrderNo     string    `json:"orderNo"`
	DaouTrx     string    `json:"daouTrx"`
	Reason      string    `json:"reason"`
	CancelledAt time.Time `json:"cancelledAt"`
}

// DepositCancelDepositedPayload — 환불 VA 에 실제 입금 확인.
type DepositCancelDepositedPayload struct {
	EventID       string `json:"eventId"`
	CallerID      string `json:"callerId"`
	OrderNo       string `json:"orderNo"`
	RefundDaouTrx string `json:"refundDaouTrx"`
	Amount        int64  `json:"amount"`
	CancelDate    string `json:"cancelDate"` // YYYYMMDDhhmmss 원본
}
```

### - [ ] Step 2: Build 확인

```bash
cd D:/dev/SeedreamGift/go-server && go build ./...
```

### - [ ] Step 3: Commit

```bash
git add go-server/internal/infra/seedream/webhook_types.go
git commit -m "feat(seedream): add Phase 4 webhook payload types (canceled/refunded/external)"
```

---

## Task 2: Cancel/Refund DTO + 공용 client infra

**Files:**
- Create: `go-server/internal/infra/seedream/cancel_types.go`
- Create: `go-server/internal/infra/seedream/cancel_client.go`
- Create: `go-server/internal/infra/seedream/cancel_client_test.go`

### - [ ] Step 1: Cancel DTO (`cancel_types.go`)

```go
package seedream

// CancelPayMethod 는 상품권 시나리오에서 허용되는 2개 값만 강제.
type CancelPayMethod string

const (
	CancelVAccountIssue CancelPayMethod = "VACCOUNT-ISSUECAN" // 입금 전 발급 취소
	CancelBank          CancelPayMethod = "BANK"              // 입금 후 환불
)

// CancelPaymentRequest 는 POST /api/v1/payment/cancel 요청 바디.
type CancelPaymentRequest struct {
	PayMethod    CancelPayMethod `json:"payMethod"`
	TrxID        string          `json:"trxId"`
	Amount       int64           `json:"amount"`
	CancelReason string          `json:"cancelReason"`

	// BANK 전용
	BankCode  string `json:"bankCode,omitempty"`
	AccountNo string `json:"accountNo,omitempty"`
}

// CancelResponse 는 취소 API 응답의 data 필드.
// 키움 원본 대문자 필드 그대로. AMOUNT 는 string, CANCELDATE 는 YYYYMMDDhhmmss.
type CancelResponse struct {
	Token        string `json:"TOKEN"`
	ResultCode   string `json:"RESULTCODE"`
	ErrorMessage string `json:"ERRORMESSAGE"`
	TrxID        string `json:"TRXID"`
	Amount       string `json:"AMOUNT"`
	CancelDate   string `json:"CANCELDATE"`
}
```

### - [ ] Step 2: Client 메서드 (`cancel_client.go`)

기존 `client.go` 의 `IssueVAccount` 패턴을 따라 두 메서드 추가:

```go
package seedream

import (
	"context"
	"fmt"
	"net/http"
)

// CancelIssued 는 입금 전 취소 (VACCOUNT-ISSUECAN) 를 호출합니다.
// Idempotency-Key: "gift:cancel:{orderNo}"
func (c *Client) CancelIssued(ctx context.Context, orderNo, trxID string, amount int64, reason string) (*CancelResponse, error) {
	var out CancelResponse
	err := c.call(ctx, http.MethodPost, "/api/v1/payment/cancel", &out, callOpts{
		idempotencyKey: fmt.Sprintf("gift:cancel:%s", orderNo),
		body: CancelPaymentRequest{
			PayMethod:    CancelVAccountIssue,
			TrxID:        trxID,
			Amount:       amount,
			CancelReason: reason,
		},
	})
	return &out, err
}

// RefundDeposited 는 입금 후 환불 (BANK) 을 호출합니다.
// Idempotency-Key: "gift:refund:{orderNo}:{yyyymmddhhmmss}" — 호출자가 timestamp 포함.
func (c *Client) RefundDeposited(ctx context.Context, orderNo, idempSuffix, trxID string, amount int64, reason, bankCode, accountNo string) (*CancelResponse, error) {
	var out CancelResponse
	err := c.call(ctx, http.MethodPost, "/api/v1/payment/cancel", &out, callOpts{
		idempotencyKey: fmt.Sprintf("gift:refund:%s:%s", orderNo, idempSuffix),
		body: CancelPaymentRequest{
			PayMethod:    CancelBank,
			TrxID:        trxID,
			Amount:       amount,
			CancelReason: reason,
			BankCode:     bankCode,
			AccountNo:    accountNo,
		},
	})
	return &out, err
}
```

**주의**: `c.call`, `callOpts`, `idempotencyKey` 필드는 **기존 `client.go` 의 private helper** 재사용. Grep 으로 구조 확인 후 동일 패턴 적용. 시그니처 다르면 spec BLOCKED 처리.

### - [ ] Step 3: TDD 테스트 (`cancel_client_test.go`)

httpmock(기존 패턴) 으로 3 케이스:
1. `CancelIssued` 성공 — RESULTCODE=0000 응답 → response 파싱 + 에러 nil
2. `RefundDeposited` 성공 — BANK 필드 bankCode/accountNo 포함 요청 바디 검증
3. `CancelIssued` Seedream error — errorCode `CANCEL_INVALID_STATE` 응답 → Go sentinel error 로 매핑

기존 `client_test.go` 파일의 httpmock setup 패턴을 복사해 사용.

### - [ ] Step 4: Build + 테스트

```bash
cd D:/dev/SeedreamGift/go-server && go build ./... && go test ./internal/infra/seedream/ -run "TestCancel|TestRefund" -count=1 -v
```

### - [ ] Step 5: Commit

```bash
git add go-server/internal/infra/seedream/cancel_types.go \
        go-server/internal/infra/seedream/cancel_client.go \
        go-server/internal/infra/seedream/cancel_client_test.go
git commit -m "feat(seedream): add Cancel/Refund client (VACCOUNT-ISSUECAN + BANK)"
```

---

## Task 3: 상태 전이 머신 확장 + I-3 fix

**Files:**
- Modify: `go-server/internal/app/services/vaccount_state.go`
- Modify: `go-server/internal/app/services/vaccount_state_test.go`

### - [ ] Step 1: I-3 fix — `ApplyIssued` 터미널 상태 분기

현재 (3d7c290):
```go
if order.Status != domain.OrderStatusPending {
    s.logger.Info("vaccount.issued 재수신 — idempotent no-op", ...)
    return nil
}
```

교체:
```go
switch order.Status {
case domain.OrderStatusPending:
    // fall through to transition
case domain.OrderStatusIssued, domain.OrderStatusPaid,
     domain.OrderStatusDelivered, domain.OrderStatusCompleted:
    s.logger.Info("vaccount.issued 재수신 — idempotent no-op",
        zap.String("orderCode", *orderCode), zap.String("status", order.Status))
    return nil
default: // CANCELLED, EXPIRED, AMOUNT_MISMATCH
    s.logger.Warn("vaccount.issued arrived after terminal state — possible cancel race",
        zap.String("orderCode", *orderCode), zap.String("status", order.Status))
    return nil
}
```

테스트 추가: `TestApplyIssued_TerminalState_Warns` (CANCELLED 주문에 ApplyIssued 호출 시 에러 없이 반환 + Order.Status 변함 없음).

### - [ ] Step 2: 4개 Apply* 함수 추가

**구현 원칙** (모두 동일):
1. Transactional (`db.WithContext(ctx).Transaction`)
2. Order 조회 by `OrderCode`. 못 찾으면 error 반환(`%w`).
3. Status 전이 가드:
   - `ApplyPaymentCanceled`: Order.Status == ISSUED → CANCELLED. 이미 CANCELLED 이면 idempotent no-op. 그 외(PAID/REFUNDED/etc) → Warn + no-op.
   - `ApplyVAccountDepositCanceled`: Order.Status == PAID → REFUNDED. 이미 REFUNDED/REFUND_PAID 이면 no-op. 그 외 → Warn.
   - `ApplyVAccountCancelled`: Order.Status == ISSUED → CANCELLED (+ `Payment.SeedreamPhase = cancelled` + `CancellationSource = external`). 이미 CANCELLED 이면 no-op.
   - `ApplyDepositCancelDeposited`: Order.Status == REFUNDED → REFUND_PAID. 이미 REFUND_PAID 이면 no-op. 그 외 → Warn.
4. Payment 업데이트 — 해당 이벤트가 주는 추가 필드만(cancel reason, canceled_at 등). 기존 Payment.Status 는 CONFIRMED 에서 REFUNDED 로 전이 (vaccount.deposit_canceled 경로에서).

**필요한 도메인 상수** — 없으면 Task 3 전에 추가 (BLOCKED 보고):
- `domain.OrderStatusRefunded = "REFUNDED"`
- `domain.OrderStatusRefundPaid = "REFUND_PAID"`
- `domain.PaymentStatusRefunded = "REFUNDED"`
- `domain.SeedreamPhaseCancelled = "cancelled"`
- `domain.SeedreamPhaseRefunded = "refunded"`
- `domain.SeedreamPhaseRefundPaid = "refund_paid"`

### - [ ] Step 3: 테스트 추가

각 Apply* 별로 4 케이스:
- 정상 전이
- 이미 종료 상태 → idempotent no-op
- 기대하지 않은 상태 → Warn + no-op
- Order not found → error

### - [ ] Step 4: Build + 테스트

```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/app/services/ -run "TestApply" -count=1 -v
```

Expected: 기존 5 + 신규 약 16 (= 4 Apply × 4 cases) 모두 PASS.

### - [ ] Step 5: Commit

```bash
git add go-server/internal/app/services/vaccount_state.go \
        go-server/internal/app/services/vaccount_state_test.go
git commit -m "feat(services): Phase 4 state transitions + I-3 terminal state WARN branch"
```

---

## Task 4: Webhook dispatch 확장

**Files:**
- Modify: `go-server/internal/app/services/vaccount_webhook_svc.go`
- Modify: `go-server/internal/app/services/vaccount_webhook_svc_test.go`

### - [ ] Step 1: Handle 함수에서 Phase 4 no-op 브랜치를 실제 dispatch 로 교체

현재 (50698b1):
```go
case seedream.EventPaymentCanceled,
    seedream.EventVAccountDepositCanceled,
    seedream.EventVAccountCancelled,
    seedream.EventDepositCancelDeposited:
    s.log.Info("Phase 4 이벤트 수신 — 현재는 no-op", ...)
```

교체:
```go
case seedream.EventPaymentCanceled:
    var p seedream.PaymentCanceledPayload
    if err := json.Unmarshal(raw, &p); err != nil {
        return fmt.Errorf("parse PaymentCanceledPayload: %w", err)
    }
    handlerErr = s.state.ApplyPaymentCanceled(ctx, &p.OrderNo, p)

case seedream.EventVAccountDepositCanceled:
    var p seedream.VAccountDepositCanceledPayload
    if err := json.Unmarshal(raw, &p); err != nil {
        return fmt.Errorf("parse VAccountDepositCanceledPayload: %w", err)
    }
    handlerErr = s.state.ApplyVAccountDepositCanceled(ctx, &p.OrderNo, p)

case seedream.EventVAccountCancelled:
    var p seedream.VAccountCancelledPayload
    if err := json.Unmarshal(raw, &p); err != nil {
        return fmt.Errorf("parse VAccountCancelledPayload: %w", err)
    }
    handlerErr = s.state.ApplyVAccountCancelled(ctx, &p.OrderNo, p)

case seedream.EventDepositCancelDeposited:
    var p seedream.DepositCancelDepositedPayload
    if err := json.Unmarshal(raw, &p); err != nil {
        return fmt.Errorf("parse DepositCancelDepositedPayload: %w", err)
    }
    handlerErr = s.state.ApplyDepositCancelDeposited(ctx, &p.OrderNo, p)
```

### - [ ] Step 2: 테스트 4 케이스 추가

`vaccount_webhook_svc_test.go` 에:
- `TestVAccountWebhookService_Handle_PaymentCanceled` — ISSUED 주문 → CANCELLED
- `TestVAccountWebhookService_Handle_VAccountDepositCanceled` — PAID 주문 → REFUNDED
- `TestVAccountWebhookService_Handle_VAccountCancelled` — ISSUED 주문 → CANCELLED (external source)
- `TestVAccountWebhookService_Handle_DepositCancelDeposited` — REFUNDED 주문 → REFUND_PAID

각 테스트는 Task 5 기존 패턴 복사.

### - [ ] Step 3: Build + 테스트

```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/app/services/ -run "TestVAccountWebhookService" -count=1 -v
```

Expected: 기존 3 + 신규 4 = 7 PASS.

### - [ ] Step 4: Commit

```bash
git add go-server/internal/app/services/vaccount_webhook_svc.go \
        go-server/internal/app/services/vaccount_webhook_svc_test.go
git commit -m "feat(services): dispatch Phase 4 webhook events to state machine"
```

---

## Task 5: Cancel Service 오케스트레이션

**Files:**
- Create: `go-server/internal/app/services/cancel_svc.go`
- Create: `go-server/internal/app/services/cancel_svc_test.go`

### - [ ] Step 1: 설계

`CancelService` 는 HTTP 핸들러와 `seedream.Client` 사이 비즈니스 로직 레이어:
- 주문/Payment 조회 (OrderCode → DaouTrx)
- 권한/상태 검증
- `cancelReason` 검증 (5~50자, `^[]` 금지 — 통합 가이드 §7.3.1)
- `seedream.Client.CancelIssued` 또는 `RefundDeposited` 호출
- Seedream error code → 도메인 의미로 매핑 (특히 `CANCEL_ALREADY_DONE` = 성공 처리)
- 동기 응답 반환 (상태 전이는 웹훅 기준 — 이 서비스는 DB 건드리지 않음)

```go
type CancelService struct {
	db        *gorm.DB
	seedream  *seedream.Client
	logger    *zap.Logger
}

type CancelIssuedInput struct {
	OrderCode    string
	CancelReason string
	UserID       int64 // 권한 확인용
}

type RefundInput struct {
	OrderCode    string
	CancelReason string
	BankCode     string // 9개 화이트리스트
	AccountNo    string // 숫자/하이픈 6~20자
	UserID       int64
}

func (s *CancelService) CancelIssued(ctx context.Context, in CancelIssuedInput) (*seedream.CancelResponse, error)
func (s *CancelService) Refund(ctx context.Context, in RefundInput) (*seedream.CancelResponse, error)
```

### - [ ] Step 2: 검증 규칙 (common 헬퍼 `validateCancelReason`)

```go
func validateCancelReason(reason string) error {
	r := []rune(reason)
	if len(r) < 5 || len(r) > 50 {
		return fmt.Errorf("cancelReason 길이는 5~50자")
	}
	if strings.ContainsAny(reason, "^[]") {
		return fmt.Errorf("cancelReason 에 ^[] 사용 금지")
	}
	return nil
}
```

### - [ ] Step 3: 은행코드 화이트리스트 (통합 가이드 §4.1)

```go
var validBankCodes = map[string]bool{
	"088": true, // 신한
	"004": true, // KB국민
	"020": true, // 우리
	"081": true, // 하나
	"011": true, // 농협
	"003": true, // IBK기업
	"023": true, // SC제일
	"027": true, // 한국씨티
	"032": true, // BNK부산
	// §4.1 의 9개 — 실제 값은 domain.go 또는 seedream.BankCodesCancel 에서 import
}
```

(가능하면 별도 상수 모듈에 정의)

### - [ ] Step 4: TDD 테스트 5~7 케이스

- `CancelIssued` 정상: PENDING(Issued) 주문 + valid reason → Seedream 호출 + 응답 반환
- `CancelIssued` 길이 짧은 reason → validation error (Seedream 호출 안 함)
- `CancelIssued` Order not found → error
- `Refund` 정상: PAID 주문 + bankCode + accountNo → Seedream 호출
- `Refund` bankCode 화이트리스트 외 → validation error
- `Refund` accountNo 형식 위반 → validation error
- Seedream 응답이 `CANCEL_ALREADY_DONE` → 성공으로 간주 (error 없이 반환)

httpmock 으로 Seedream 응답 시뮬레이션.

### - [ ] Step 5: Build + 테스트 + Commit

```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/app/services/ -run "TestCancelService|TestRefund" -count=1 -v
git add go-server/internal/app/services/cancel_svc.go \
        go-server/internal/app/services/cancel_svc_test.go
git commit -m "feat(services): CancelService orchestrates Seedream cancel + refund"
```

---

## Task 6: HTTP 핸들러

**Files:**
- Create: `go-server/internal/api/handlers/seedream_cancel_handler.go`
- Create: `go-server/internal/api/handlers/seedream_cancel_handler_test.go`

### - [ ] Step 1: Handler 구조 — 통합 엔드포인트

`POST /api/v1/payment/seedream/cancel` 하나로 `payMethod` 필드에 따라 분기.

**요청 DTO** (handler 레이어 전용 — `seedream.CancelPaymentRequest` 과 **다름**. 이건 사용자 노출용):

```go
type CancelHTTPRequest struct {
	OrderCode    string `json:"orderCode" binding:"required"`
	PayMethod    string `json:"payMethod" binding:"required,oneof=VACCOUNT-ISSUECAN BANK"`
	CancelReason string `json:"cancelReason" binding:"required,min=5,max=50"`

	// BANK 전용
	BankCode  string `json:"bankCode,omitempty"`
	AccountNo string `json:"accountNo,omitempty"`
}
```

**핸들러 로직**:
1. JWT 인증 확인 (미들웨어 기본 적용)
2. Request bind
3. payMethod 분기:
   - `VACCOUNT-ISSUECAN` → `CancelService.CancelIssued`
   - `BANK` → `CancelService.Refund` (bankCode/accountNo 필수 확인)
4. 성공: `200` + Seedream 원본 응답 포장
5. 실패: Seedream sentinel error → 적절한 HTTP status + errorCode 반환

**에러 매핑**:
- `seedream.ErrCancelAlreadyDone` → `200` + 메시지 "이미 취소 완료" (성공 처리)
- `seedream.ErrValidation` → `400` + errorCode 전달
- `seedream.ErrCancelInvalidState` → `409`
- `seedream.ErrExternalAPI` → `502`
- 기타 → `500`

### - [ ] Step 2: 테스트 3~5 케이스 (httptest)

- 정상 VACCOUNT-ISSUECAN: 200 + response body 포함 RESULTCODE=0000
- 정상 BANK: 200 + bankCode/accountNo 검증
- 잘못된 payMethod: 400
- Seedream `CANCEL_ALREADY_DONE`: 200 + "이미 취소" 메시지
- Seedream 502 래핑

### - [ ] Step 3: Commit

```bash
git add go-server/internal/api/handlers/seedream_cancel_handler.go \
        go-server/internal/api/handlers/seedream_cancel_handler_test.go
git commit -m "feat(api): POST /api/v1/payment/seedream/cancel (VACCOUNT-ISSUECAN + BANK)"
```

---

## Task 7: 라우트 등록 + DI + I-2 fix

**Files:**
- Modify: `go-server/internal/routes/container.go`
- Modify: `go-server/main.go`
- Modify: `go-server/internal/api/handlers/seedream_webhook_handler.go` (I-2 fix)

### - [ ] Step 1: Container

- `CancelService` 생성 (기존 `vaccountWebhookSvc` 생성 블록 근처)
- `Handlers.SeedreamCancel *handlers.SeedreamCancelHandler` 필드 추가
- 생성자 호출에 service 주입

### - [ ] Step 2: Main — 라우트 등록

**중요**: 이 엔드포인트는 **`/api/v1/` 안**에 위치 (인증 필요 경로). 웹훅처럼 root 에 두면 안 됨.

```go
// /api/v1/payment/seedream/cancel — 인증 필수 (JWT)
api.POST("/payment/seedream/cancel", h.SeedreamCancel.Handle)
```

기존 `/api/v1/` 그룹 블록 안에 추가. 그룹에 이미 Auth middleware 적용돼 있는지 확인.

### - [ ] Step 3: I-2 fix — Sync fallback context

`seedream_webhook_handler.go:113` 주변:

현재:
```go
if err := h.webhookSvc.Handle(ctx, deliveryID, event, raw); err != nil {
```

교체:
```go
syncCtx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
defer cancel()
if err := h.webhookSvc.Handle(syncCtx, deliveryID, event, raw); err != nil {
```

`"context"` import 확인.

### - [ ] Step 4: Build + 부팅 verification

```bash
cd D:/dev/SeedreamGift/go-server && go build ./...
# route log 확인 — `POST /api/v1/payment/seedream/cancel` 가 등록되는지
```

### - [ ] Step 5: Commit

```bash
git add go-server/internal/routes/container.go \
        go-server/main.go \
        go-server/internal/api/handlers/seedream_webhook_handler.go
git commit -m "feat(routes): wire cancel/refund endpoint + I-2 sync fallback ctx fix"
```

---

## Task 8: End-to-end Integration Test

**Files:**
- Create: `go-server/internal/api/handlers/seedream_cancel_handler_integration_test.go`

cancel + refund 풀스택 httptest + Seedream httpmock. Phase 3 integration 테스트 패턴 그대로 복사.

### 시나리오
1. **Cancel happy path**: PENDING(awaiting_deposit) 주문 → `POST /api/v1/payment/seedream/cancel` (VACCOUNT-ISSUECAN) → Seedream 성공 응답 → 200. (상태 전이는 웹훅 경로 — 별도 검증 필요 없음.)
2. **Refund happy path**: PAID 주문 → `POST` (BANK + bankCode + accountNo) → 200.
3. **Already done**: Seedream 이 `CANCEL_ALREADY_DONE` 반환 → 200 (성공 처리).
4. **Validation rejection**: cancelReason 4자 → 400.
5. **Unauthorized**: JWT 없이 → 401.

### - [ ] Step 1~3 (생략 — Phase 3 테스트와 동일 구조)

### - [ ] Step 4: Commit

```bash
git add go-server/internal/api/handlers/seedream_cancel_handler_integration_test.go
git commit -m "test(api): Phase 4 cancel/refund handler integration tests"
```

---

## Post-implementation Checklist

- [ ] 모든 테스트 PASS (기존 + 신규)
- [ ] `go build ./...` clean
- [ ] `go vet ./...` clean
- [ ] 배포 순서 문서 업데이트 (`docs/seedreamapi_docs/api-modifications.md` §5 — cancel 엔드포인트 추가)
- [ ] `docs/seedreamapi_docs/phase3-followups.md` 에서 I-2, I-3 체크 완료 표시

---

## Risks

| 리스크 | 완화 |
|--------|------|
| Seedream `seedream.Client` 의 `call` helper / `callOpts` 가 예상과 다른 시그니처 | Task 2 Step 1 전 `client.go` 읽고 확인. 다르면 BLOCKED 보고 → controller 가 결정 |
| 도메인 상태 상수 (REFUND_PAID 등) 미정의 | Task 3 Step 2 전 확인. 미정의 시 별도 커밋 "domain: add Phase 4 order/payment status constants" 로 선행 |
| Phase 2 (Issue 플로우) 가 merge 안 돼 있으면 `trxId` (DaouTrx) 필드 Payment 에 없을 수 있음 | 이미 ae0a671 에서 추가 확인됨 (`Payment.SeedreamDaouTrx *string`). 재검증 필수 |
| MSSQL `OnConflict{DoNothing}` — Phase 4 이벤트에서도 MERGE deadlock 가능 | I-5 tracking. Phase 4 는 Phase 3 패턴 그대로 — 별도 검증 track |

---

## Estimated Effort

| Task | LOC (추정) | 시간 (집중) |
|------|-----------|------------|
| 1. payload types | +60 | 10분 |
| 2. Cancel client + DTO + TDD | +250 | 45분 |
| 3. State machine + I-3 fix + tests | +500 | 90분 |
| 4. Dispatch extension + tests | +200 | 40분 |
| 5. CancelService + tests | +400 | 75분 |
| 6. HTTP handler + tests | +300 | 60분 |
| 7. Wiring + I-2 fix | +50 | 20분 |
| 8. Integration test | +350 | 60분 |
| **Total** | **~2,100** | **~7 시간** |

실제 subagent 기반 실행 시 리뷰 루프 포함 ~10 시간 예상. Phase 3 보다 ~30% 크지만 패턴은 동일.
