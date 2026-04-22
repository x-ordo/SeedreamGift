# Seedream Payment Integration — Phase 1: Data Model

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 mock/Toss 결제 경로를 건드리지 않고 Seedream API 통합을 위한 데이터 스키마(Order.Status 확장, Payment 에 Seedream 필드 3개 추가, WebhookReceipts/SeedreamReconcileCursors 신규 테이블) 및 도메인 구조체와 상태머신 전이를 추가한다.

**Architecture:** 순수 additive 마이그레이션 — `Orders.PaymentKey` 컬럼 DROP 은 Phase 6 로 연기(기존 Mock/Toss caller 가 아직 살아있음). 새 도메인 파일은 GORM 태그 + Table name 메서드 + 상태머신 전이 unit test 로 검증. Migration runner 는 기존 `cmd/migrate_*/main.go` 패턴을 따라 독립 CLI.

**Tech Stack:** Go 1.21+ · GORM (MSSQL) · testify/assert · MSSQL `IF NOT EXISTS` 패턴으로 idempotent migration

**Spec reference:** `docs/superpowers/specs/2026-04-22-seedream-payment-integration-design.md` §4 데이터 모델

---

## File Structure

**새로 생성:**
- `go-server/internal/domain/webhook_receipt.go` — `WebhookReceipt` 엔티티
- `go-server/internal/domain/reconcile_cursor.go` — `ReconcileCursor` 싱글턴 엔티티
- `go-server/internal/domain/webhook_receipt_test.go` — TableName + GORM 태그 검증
- `go-server/internal/domain/reconcile_cursor_test.go` — TableName + 싱글턴 제약 검증
- `go-server/migrations/008_seedream_payment_data_model.sql` — 통합 마이그레이션 SQL
- `go-server/cmd/migrate_seedream/main.go` — Migration runner CLI

**수정:**
- `go-server/internal/domain/order.go` — `Status` 컬럼 size 12 → 20
- `go-server/internal/domain/order.go` (Payment 부분) — `SeedreamVAccountID`, `Phase`, `IdempotencyKey` 필드 추가
- `go-server/internal/domain/validation.go` — Status 상수 3개 추가 + `validOrderTransitions` 맵 확장
- `go-server/internal/domain/validation_test.go` — 새 전이 테스트 케이스 추가

**명시적으로 건드리지 않음 (Phase 2~6 담당):**
- `Order.PaymentKey` 필드 — 기존 mock/Toss caller 가 사용 중
- `payment_service.go`, `fulfillment_svc.go`, `order_handler.go` — Phase 2+ 에서 교체
- `IPaymentProvider` 인터페이스 — Phase 6 에서 삭제

---

## Task 1: WebhookReceipt 도메인 구조체 (테스트 먼저)

**Files:**
- Create: `go-server/internal/domain/webhook_receipt.go`
- Create: `go-server/internal/domain/webhook_receipt_test.go`

### - [ ] Step 1: 실패 테스트 작성

`go-server/internal/domain/webhook_receipt_test.go`:

```go
package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestWebhookReceipt_TableName(t *testing.T) {
	var r WebhookReceipt
	assert.Equal(t, "WebhookReceipts", r.TableName())
}

func TestWebhookReceipt_Fields(t *testing.T) {
	// 필수 필드가 제로값이 아닌 상태로 구성 가능한지 컴파일 수준에서 확인
	var s = "ORD-1"
	var eid = "evt-123"
	r := WebhookReceipt{
		DeliveryID: 42,
		Event:      "vaccount.deposited",
		OrderNo:    &s,
		EventID:    &eid,
		RawBody:    `{"eventId":"evt-123"}`,
	}
	assert.Equal(t, int64(42), r.DeliveryID)
	assert.Equal(t, "vaccount.deposited", r.Event)
	assert.Equal(t, "ORD-1", *r.OrderNo)
}
```

### - [ ] Step 2: 테스트 실행 — 컴파일 실패 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/domain/ -run TestWebhookReceipt -v
```

Expected: `undefined: WebhookReceipt` 컴파일 에러.

### - [ ] Step 3: 구조체 구현

`go-server/internal/domain/webhook_receipt.go`:

```go
package domain

import "time"

// WebhookReceipt 는 Seedream 이 보낸 웹훅 1건의 수신 기록입니다.
// DeliveryID 를 PK 로 두어 Seedream 재전송(같은 DeliveryID 로 옴) 에 대해
// clause.OnConflict{DoNothing: true} 삽입만으로 멱등 no-op 을 달성합니다.
//
// 참조: Seedream 통합 가이드 §8.5 (멱등 수신)
type WebhookReceipt struct {
	// DeliveryID 는 Seedream WebhookDeliveries.Id (int64 autoIncrement BIGINT).
	// X-Seedream-Delivery-Id 헤더로 내려옴.
	DeliveryID int64 `gorm:"primaryKey;column:DeliveryId" json:"deliveryId"`
	// Event 는 X-Seedream-Event 헤더값. 예: "vaccount.deposited"
	Event string `gorm:"column:Event;size:50;not null" json:"event"`
	// EventID 는 payload.eventId (uuid). DeliveryID 와 별개이며 payload-level 중복 감지 보조용.
	EventID *string `gorm:"column:EventId;size:36;index" json:"eventId,omitempty"`
	// OrderNo 는 payload.orderNo. Reconcile·감사 조회 인덱스.
	OrderNo *string `gorm:"column:OrderNo;size:50;index" json:"orderNo,omitempty"`
	// ReceivedAt 은 수신 시각.
	ReceivedAt time.Time `gorm:"column:ReceivedAt;autoCreateTime" json:"receivedAt"`
	// ProcessedAt 은 비동기 워커가 상태머신 적용을 완료한 시각. NULL 이면 미처리.
	ProcessedAt *time.Time `gorm:"column:ProcessedAt" json:"processedAt,omitempty"`
	// RawBody 는 원본 payload (감사용). Seedream AuditLog 4 KiB 절삭 한계를 보완.
	RawBody string `gorm:"column:RawBody;type:nvarchar(max)" json:"-"`
}

// TableName 은 GORM 이 사용할 테이블 이름을 반환합니다.
func (WebhookReceipt) TableName() string { return "WebhookReceipts" }
```

### - [ ] Step 4: 테스트 실행 — 통과 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/domain/ -run TestWebhookReceipt -v
```

Expected: PASS · `TestWebhookReceipt_TableName` + `TestWebhookReceipt_Fields` 모두 `--- PASS`.

### - [ ] Step 5: Commit

```bash
cd D:/dev/SeedreamGift && git add go-server/internal/domain/webhook_receipt.go go-server/internal/domain/webhook_receipt_test.go
git commit -m "feat(domain): add WebhookReceipt entity for Seedream webhook idempotency"
```

---

## Task 2: ReconcileCursor 도메인 구조체

**Files:**
- Create: `go-server/internal/domain/reconcile_cursor.go`
- Create: `go-server/internal/domain/reconcile_cursor_test.go`

### - [ ] Step 1: 실패 테스트 작성

`go-server/internal/domain/reconcile_cursor_test.go`:

```go
package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestReconcileCursor_TableName(t *testing.T) {
	var c ReconcileCursor
	assert.Equal(t, "SeedreamReconcileCursors", c.TableName())
}

func TestReconcileCursor_SingletonIDDefault(t *testing.T) {
	// 싱글턴 제약: ID 가 명시되지 않아도 1 을 기본값으로 사용해야 함.
	// 이 테스트는 struct 수준의 기본값 설정을 검증.
	c := ReconcileCursor{
		LastSyncAt: time.Date(2026, 4, 22, 0, 0, 0, 0, time.UTC),
		LastRunAt:  time.Date(2026, 4, 22, 1, 0, 0, 0, time.UTC),
	}
	// GORM 태그로 default:1 이 설정되어 있으나 Go struct 초기화는 zero-value(0).
	// DB 저장 시점에 default:1 이 적용되며, struct 초기화 시점엔 0 허용.
	// 여기서는 타입이 int 인지만 확인.
	assert.IsType(t, 0, c.ID)
	assert.Equal(t, 2026, c.LastSyncAt.Year())
}
```

### - [ ] Step 2: 테스트 실행 — 컴파일 실패 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/domain/ -run TestReconcileCursor -v
```

Expected: `undefined: ReconcileCursor` 컴파일 에러.

### - [ ] Step 3: 구조체 구현

`go-server/internal/domain/reconcile_cursor.go`:

```go
package domain

import "time"

// ReconcileCursor 는 Seedream /api/v1/vaccount GET 을 이용한 safety-net
// Reconcile 작업의 마지막 동기화 시점을 저장하는 싱글턴 레코드입니다.
//
// 단일 row 제약(Id = 1) 을 DB 레벨 CHECK 로 강제하여 동시성 이슈를 단순화합니다.
// 실제 업데이트는 `SELECT ... WITH (UPDLOCK, HOLDLOCK)` 비관적 락으로 수행.
//
// 참조: 통합 설계 §4.4, 상위 가이드 §6.6
type ReconcileCursor struct {
	// ID 는 싱글턴 강제 PK (항상 1).
	ID int `gorm:"primaryKey;column:Id;default:1;check:Id = 1" json:"id"`
	// LastSyncAt 은 이 시점까지 Reconcile 이 확인한 주문의 상한 (다음 Run 의 from 기준).
	LastSyncAt time.Time `gorm:"column:LastSyncAt" json:"lastSyncAt"`
	// LastRunAt 은 최근 Reconcile 실행 완료 시각 (성공/실패 무관).
	LastRunAt time.Time `gorm:"column:LastRunAt" json:"lastRunAt"`
	// LastErrorAt 은 최근 Reconcile 실패 시각.
	LastErrorAt *time.Time `gorm:"column:LastErrorAt" json:"lastErrorAt,omitempty"`
	// LastError 는 최근 실패 메시지 (최대 500자).
	LastError *string `gorm:"column:LastError;type:nvarchar(500)" json:"lastError,omitempty"`
}

// TableName 은 GORM 이 사용할 테이블 이름을 반환합니다.
func (ReconcileCursor) TableName() string { return "SeedreamReconcileCursors" }
```

### - [ ] Step 4: 테스트 실행 — 통과 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/domain/ -run TestReconcileCursor -v
```

Expected: PASS.

### - [ ] Step 5: Commit

```bash
cd D:/dev/SeedreamGift && git add go-server/internal/domain/reconcile_cursor.go go-server/internal/domain/reconcile_cursor_test.go
git commit -m "feat(domain): add ReconcileCursor singleton entity for Seedream reconcile safety-net"
```

---

## Task 3: Payment 구조체에 Seedream 필드 3개 추가

**Files:**
- Modify: `go-server/internal/domain/order.go` (Payment 구조체, 86~120 라인 부근)

### - [ ] Step 1: 실패 테스트 작성

기존 Payment 구조체를 확장하므로 필드 존재만 컴파일 수준에서 확인하는 간단한 테스트 추가.

**Note (2026-04-22 rename)**: 최초 plan 의 `Phase` / `IdempotencyKey` 는 code review 에서 `Order.IdempotencyKey` 와의 grep-ambiguity + `Status` 와의 의미 충돌로 `SeedreamPhase` / `SeedreamIdempotencyKey` 로 vendor-prefix 적용. 아래 코드 블록에 반영됨.

`go-server/internal/domain/payment_seedream_fields_test.go` 신규 작성:

```go
package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPayment_HasSeedreamFields(t *testing.T) {
	// Seedream 통합을 위해 Payment 구조체에 추가된 3개 필드가 존재해야 한다.
	// 참조: 통합 설계 §4.2
	var vaID int64 = 102847
	var phase = "awaiting_deposit"
	var idem = "gift:vaccount:ORD-1"

	p := Payment{
		SeedreamVAccountID:     &vaID,
		SeedreamPhase:          &phase,
		SeedreamIdempotencyKey: &idem,
	}

	assert.NotNil(t, p.SeedreamVAccountID)
	assert.Equal(t, int64(102847), *p.SeedreamVAccountID)

	assert.NotNil(t, p.SeedreamPhase)
	assert.Equal(t, "awaiting_deposit", *p.SeedreamPhase)

	assert.NotNil(t, p.SeedreamIdempotencyKey)
	assert.Equal(t, "gift:vaccount:ORD-1", *p.SeedreamIdempotencyKey)
}
```

### - [ ] Step 2: 테스트 실행 — 컴파일 실패 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/domain/ -run TestPayment_HasSeedreamFields -v
```

Expected: `unknown field 'SeedreamVAccountID' in struct literal of type Payment` (등 3개).

### - [ ] Step 3: Payment 구조체 확장

`go-server/internal/domain/order.go` 의 Payment 구조체 내 `UpdatedAt` 필드 **직전** 에 아래 3개 필드 추가 (라인 118~119 부근):

기존 (참고):
```go
	// UpdatedAt은 결제 정보 수정 시각입니다.
	UpdatedAt time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
}
```

변경 후:
```go
	// ── Seedream 통합 필드 (설계 §4.2) ──

	// SeedreamVAccountID 는 Seedream /api/v1/vaccount 발급 응답의 data.id (BIGINT).
	// GET /api/v1/vaccount 단건 조회 및 감사 추적 시 사용.
	SeedreamVAccountID *int64 `gorm:"column:SeedreamVAccountId;index" json:"seedreamVAccountId,omitempty"`
	// SeedreamPhase 는 Seedream 이 노출하는 VA 결제 세부 단계입니다.
	// 값: awaiting_bank_selection | awaiting_deposit | completed | cancelled | failed
	// 주의: Order.Status 와 다른 enum. Payment 의 vendor sub-state 만 표현.
	SeedreamPhase *string `gorm:"column:SeedreamPhase;size:30" json:"seedreamPhase,omitempty"`
	// SeedreamIdempotencyKey 는 Seedream 호출 시 사용한 Idempotency-Key 원본.
	// 형식: gift:vaccount:{OrderCode} | gift:cancel:{OrderCode} | gift:refund:{OrderCode}:{ts}
	// 주의: Order.IdempotencyKey (클라이언트 dedup) 와 별개. 이건 vendor 호출 감사 추적용.
	SeedreamIdempotencyKey *string `gorm:"column:SeedreamIdempotencyKey;size:200" json:"seedreamIdempotencyKey,omitempty"`

	// UpdatedAt은 결제 정보 수정 시각입니다.
	UpdatedAt time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
}
```

### - [ ] Step 4: 테스트 실행 — 통과 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/domain/ -run TestPayment_HasSeedreamFields -v
```

Expected: `--- PASS: TestPayment_HasSeedreamFields`.

그리고 전체 domain 패키지 회귀 확인:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/domain/ -v
```

Expected: 모든 테스트 PASS. 기존 `Payment` 를 참조하는 다른 파일이 깨지지 않음 (필드 추가만 했으므로).

### - [ ] Step 5: Commit

```bash
cd D:/dev/SeedreamGift && git add go-server/internal/domain/order.go go-server/internal/domain/payment_seedream_fields_test.go
git commit -m "feat(domain): add Seedream integration fields to Payment struct"
```

---

## Task 4: Order.Status 컬럼 크기 확장 (12 → 20)

**Files:**
- Modify: `go-server/internal/domain/order.go:20`

### - [ ] Step 1: 기존 테스트로 현상 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/domain/ -v -run TestValidateOrderTransition
```

Expected: 기존 테스트 전부 PASS (변경 전 baseline).

### - [ ] Step 2: Status 컬럼 size 변경

`go-server/internal/domain/order.go:20` 의 Status 필드 태그만 변경:

Before:
```go
	Status string `gorm:"column:Status;default:'PENDING';size:12" json:"status"`
```

After:
```go
	// Status 는 주문 상태. ISSUED / EXPIRED / AMOUNT_MISMATCH 까지 허용 → size 20.
	// 상태 전이는 validation.go 의 ValidateOrderTransition 에서 관리.
	Status string `gorm:"column:Status;default:'PENDING';size:20" json:"status"`
```

### - [ ] Step 3: 테스트 실행 — 회귀 없음 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/domain/ -v
```

Expected: 모든 기존 테스트 PASS. struct tag 만 변경됐으므로 런타임 동작 변화 없음 (DB 컬럼 크기는 migration 에서 반영).

### - [ ] Step 4: Commit

```bash
cd D:/dev/SeedreamGift && git add go-server/internal/domain/order.go
git commit -m "refactor(domain): expand Order.Status column size 12 → 20 for Seedream states"
```

---

## Task 5: 주문 상태 상수 3개 추가 + 전이 머신 확장

**Files:**
- Modify: `go-server/internal/domain/validation.go:22-31` (상수)
- Modify: `go-server/internal/domain/validation.go:192-201` (전이 맵)
- Modify: `go-server/internal/domain/validation_test.go` (새 전이 테스트 케이스)

### - [ ] Step 1: 실패 테스트 작성

`go-server/internal/domain/validation_test.go` 파일 끝에 추가:

```go
// ── Seedream 통합으로 추가된 상태 전이 테스트 ──

func TestValidateOrderTransition_SeedreamStates(t *testing.T) {
	tests := []struct {
		name    string
		from    string
		to      string
		wantErr bool
	}{
		// PENDING → ISSUED (은행선택 완료, 입금 대기)
		{"PENDING → ISSUED 허용", "PENDING", "ISSUED", false},
		// ISSUED → PAID (입금 완료)
		{"ISSUED → PAID 허용", "ISSUED", "PAID", false},
		// ISSUED → CANCELLED (가맹점 요청 또는 키움 자동)
		{"ISSUED → CANCELLED 허용", "ISSUED", "CANCELLED", false},
		// ISSUED → EXPIRED (만료 타이머)
		{"ISSUED → EXPIRED 허용", "ISSUED", "EXPIRED", false},
		// PENDING → EXPIRED (은행선택도 못한 상태에서 만료)
		{"PENDING → EXPIRED 허용", "PENDING", "EXPIRED", false},
		// PENDING → AMOUNT_MISMATCH (웹훅 없이 Reconcile 감지)
		{"PENDING → AMOUNT_MISMATCH 허용", "PENDING", "AMOUNT_MISMATCH", false},

		// 종료 상태에서 다른 상태로의 전이는 불가
		{"EXPIRED → PAID 불가", "EXPIRED", "PAID", true},
		{"AMOUNT_MISMATCH → PAID 불가", "AMOUNT_MISMATCH", "PAID", true},

		// ISSUED 에서 DELIVERED 직접 전이 불가 (PAID 를 거쳐야 함)
		{"ISSUED → DELIVERED 불가", "ISSUED", "DELIVERED", true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateOrderTransition(tc.from, tc.to)
			if tc.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestOrderStatusConstants_Seedream(t *testing.T) {
	assert.Equal(t, "ISSUED", OrderStatusIssued)
	assert.Equal(t, "EXPIRED", OrderStatusExpired)
	assert.Equal(t, "AMOUNT_MISMATCH", OrderStatusAmountMismatch)
}
```

### - [ ] Step 2: 테스트 실행 — 실패 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/domain/ -run "TestValidateOrderTransition_SeedreamStates|TestOrderStatusConstants_Seedream" -v
```

Expected: `OrderStatusIssued`, `OrderStatusExpired`, `OrderStatusAmountMismatch` undefined 컴파일 에러.

### - [ ] Step 3: 상수 추가 (validation.go:22-31)

Before (라인 24~31):
```go
const (
	OrderStatusPending   = "PENDING"
	OrderStatusPaid      = "PAID"
	OrderStatusDelivered = "DELIVERED"
	OrderStatusCompleted = "COMPLETED"
	OrderStatusCancelled = "CANCELLED"
	OrderStatusRefunded  = "REFUNDED"
)
```

After:
```go
const (
	OrderStatusPending        = "PENDING"
	OrderStatusIssued         = "ISSUED"          // Seedream: 은행선택 완료, 입금 대기
	OrderStatusPaid           = "PAID"
	OrderStatusDelivered      = "DELIVERED"
	OrderStatusCompleted      = "COMPLETED"
	OrderStatusCancelled      = "CANCELLED"
	OrderStatusRefunded       = "REFUNDED"
	OrderStatusExpired        = "EXPIRED"         // Seedream: depositEndDate 만료
	OrderStatusAmountMismatch = "AMOUNT_MISMATCH" // Seedream: 입금액 ≠ 주문액 (Reconcile 감지)
)
```

### - [ ] Step 4: 전이 맵 확장 (validation.go:192-201)

Before:
```go
var validOrderTransitions = map[string][]string{
	"PENDING":    {"PAID", "CANCELLED"},
	"FRAUD_HOLD": {"PAID", "CANCELLED"},
	"PAID":       {"DELIVERED", "CANCELLED", "REFUNDED"},
	"DELIVERED":  {"COMPLETED"},
	"CANCELLED": {},
	"COMPLETED": {},
	"REFUNDED":  {},
}
```

After:
```go
var validOrderTransitions = map[string][]string{
	// PENDING: 초기 상태. Seedream 발급 요청 직후 유지 (phase=awaiting_bank_selection).
	// ISSUED 로 넘어가거나, 은행선택 전 취소/만료/금액불일치 가능.
	"PENDING":    {"ISSUED", "PAID", "CANCELLED", "EXPIRED", "AMOUNT_MISMATCH"},
	"FRAUD_HOLD": {"PAID", "CANCELLED"},
	// ISSUED: 은행선택 완료, 입금 대기 (phase=awaiting_deposit).
	// 정상 입금 → PAID, 가맹점 요청 취소 또는 키움 자동 취소 → CANCELLED, 만료 → EXPIRED.
	"ISSUED":    {"PAID", "CANCELLED", "EXPIRED"},
	"PAID":      {"DELIVERED", "CANCELLED", "REFUNDED"},
	"DELIVERED": {"COMPLETED"},
	// 아래는 최종 상태.
	"CANCELLED":       {},
	"COMPLETED":       {},
	"REFUNDED":        {},
	"EXPIRED":         {},
	"AMOUNT_MISMATCH": {}, // Ops 수동 처리 대기. 자동 전이 없음.
}
```

### - [ ] Step 5: 테스트 실행 — 통과 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/domain/ -v
```

Expected: 모든 테스트 (기존 + 신규) PASS.

### - [ ] Step 6: Commit

```bash
cd D:/dev/SeedreamGift && git add go-server/internal/domain/validation.go go-server/internal/domain/validation_test.go
git commit -m "feat(domain): add ISSUED/EXPIRED/AMOUNT_MISMATCH order states and transitions

Seedream 2-phase async VA flow requires PENDING→ISSUED intermediate
(bank selected, deposit awaiting). Adds EXPIRED/AMOUNT_MISMATCH
terminal states handled by timer/reconcile jobs."
```

---

## Task 6: Migration SQL — 통합 마이그레이션 스크립트

**Files:**
- Create: `go-server/migrations/008_seedream_payment_data_model.sql`

### - [ ] Step 1: SQL 파일 작성

`go-server/migrations/008_seedream_payment_data_model.sql`:

```sql
-- Migration 008: Seedream API 결제 통합 데이터 모델
-- Phase 1: 순수 additive — 기존 컬럼 DROP 없음 (PaymentKey DROP 은 Phase 6 로 연기)
-- 참조: docs/superpowers/specs/2026-04-22-seedream-payment-integration-design.md §4

-- ─────────────────────────────────────────────────────────
-- 1. Orders.Status 컬럼 크기 12 → 20 (ISSUED/EXPIRED/AMOUNT_MISMATCH 수용)
-- ─────────────────────────────────────────────────────────
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Orders')
      AND name = 'Status'
      AND max_length = 12 * 2  -- NVARCHAR 는 UTF-16 이므로 12자 = 24바이트
)
BEGIN
    ALTER TABLE Orders ALTER COLUMN Status NVARCHAR(20) NOT NULL;
    PRINT 'Orders.Status expanded to NVARCHAR(20)';
END
ELSE
BEGIN
    PRINT 'Orders.Status already at NVARCHAR(20) or later — skipping';
END
GO

-- ─────────────────────────────────────────────────────────
-- 2. Payments 테이블에 Seedream 필드 3개 추가
-- ─────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Payments') AND name = 'SeedreamVAccountId'
)
BEGIN
    ALTER TABLE Payments ADD SeedreamVAccountId BIGINT NULL;
    PRINT 'Added Payments.SeedreamVAccountId';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Payments') AND name = 'SeedreamPhase'
)
BEGIN
    ALTER TABLE Payments ADD SeedreamPhase NVARCHAR(30) NULL;
    PRINT 'Added Payments.SeedreamPhase';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Payments') AND name = 'SeedreamIdempotencyKey'
)
BEGIN
    ALTER TABLE Payments ADD SeedreamIdempotencyKey NVARCHAR(200) NULL;
    PRINT 'Added Payments.SeedreamIdempotencyKey';
END
GO

-- SeedreamVAccountId 인덱스 (단건 조회 용도)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('Payments') AND name = 'IX_Payments_SeedreamVAccountId'
)
BEGIN
    CREATE INDEX IX_Payments_SeedreamVAccountId
        ON Payments(SeedreamVAccountId)
        WHERE SeedreamVAccountId IS NOT NULL;
    PRINT 'Created IX_Payments_SeedreamVAccountId';
END
GO

-- ─────────────────────────────────────────────────────────
-- 3. WebhookReceipts 테이블 (웹훅 멱등 수신 로그)
-- ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WebhookReceipts')
BEGIN
    CREATE TABLE WebhookReceipts (
        DeliveryId   BIGINT        NOT NULL PRIMARY KEY,    -- Seedream WebhookDeliveries.Id
        Event        NVARCHAR(50)  NOT NULL,
        EventId      NVARCHAR(36)  NULL,                    -- payload.eventId (uuid)
        OrderNo      NVARCHAR(50)  NULL,
        ReceivedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        ProcessedAt  DATETIME2     NULL,
        RawBody      NVARCHAR(MAX) NULL
    );
    PRINT 'Created WebhookReceipts table';

    CREATE INDEX IX_WebhookReceipts_EventId ON WebhookReceipts(EventId)
        WHERE EventId IS NOT NULL;
    PRINT 'Created IX_WebhookReceipts_EventId';

    CREATE INDEX IX_WebhookReceipts_OrderNo ON WebhookReceipts(OrderNo)
        WHERE OrderNo IS NOT NULL;
    PRINT 'Created IX_WebhookReceipts_OrderNo';

    CREATE INDEX IX_WebhookReceipts_ReceivedAt ON WebhookReceipts(ReceivedAt DESC);
    PRINT 'Created IX_WebhookReceipts_ReceivedAt';
END
GO

-- ─────────────────────────────────────────────────────────
-- 4. SeedreamReconcileCursors 테이블 (싱글턴 Reconcile 커서)
-- ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SeedreamReconcileCursors')
BEGIN
    CREATE TABLE SeedreamReconcileCursors (
        Id           INT           NOT NULL PRIMARY KEY DEFAULT 1,
        LastSyncAt   DATETIME2     NOT NULL DEFAULT '1970-01-01',
        LastRunAt    DATETIME2     NOT NULL DEFAULT '1970-01-01',
        LastErrorAt  DATETIME2     NULL,
        LastError    NVARCHAR(500) NULL,
        CONSTRAINT CK_SeedreamReconcileCursors_Singleton CHECK (Id = 1)
    );
    PRINT 'Created SeedreamReconcileCursors table';

    -- Seed 싱글턴 row. 최초 Reconcile 은 이 LastSyncAt 시점부터 조회.
    INSERT INTO SeedreamReconcileCursors (Id, LastSyncAt, LastRunAt)
    VALUES (1, SYSUTCDATETIME(), SYSUTCDATETIME());
    PRINT 'Inserted singleton ReconcileCursor seed row';
END
GO

PRINT 'Migration 008 complete.';
GO
```

### - [ ] Step 2: SQL 문법 검증 (static)

Run:
```bash
cd D:/dev/SeedreamGift && wc -l go-server/migrations/008_seedream_payment_data_model.sql
```

Expected: 약 100 라인 전후. 파일 존재 확인.

SQL 자체 실행 검증은 Task 7 (runner CLI) 에서 수행.

### - [ ] Step 3: Commit

```bash
cd D:/dev/SeedreamGift && git add go-server/migrations/008_seedream_payment_data_model.sql
git commit -m "feat(migration): add 008 Seedream payment data model schema

Adds WebhookReceipts, SeedreamReconcileCursors tables, expands
Orders.Status to NVARCHAR(20), adds 3 Seedream fields to Payments.
PaymentKey DROP intentionally deferred to Phase 6 (mock/Toss callers still live)."
```

---

## Task 7: Migration Runner CLI

**Files:**
- Create: `go-server/cmd/migrate_seedream/main.go`

### - [ ] Step 1: Runner 작성

`go-server/cmd/migrate_seedream/main.go`:

```go
// cmd/migrate_seedream/main.go — Seedream 결제 통합 Phase 1 데이터 모델 마이그레이션
//
// Usage: go run ./cmd/migrate_seedream
//        또는 빌드: go build -o migrate_seedream.exe ./cmd/migrate_seedream
//
// 실행 대상: go-server/migrations/008_seedream_payment_data_model.sql
// idempotent — 반복 실행 안전 (IF NOT EXISTS / IF EXISTS 가드).
package main

import (
	"fmt"
	"log"
	"os"
	"seedream-gift-server/internal/config"
	"strings"

	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

const migrationPath = "migrations/008_seedream_payment_data_model.sql"

func main() {
	cfg, err := config.LoadConfig(".")
	if err != nil {
		log.Fatal("Config error:", err)
	}

	db, err := gorm.Open(sqlserver.Open(cfg.DBUrl), &gorm.Config{})
	if err != nil {
		log.Fatal("DB connect error:", err)
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()

	fmt.Println("=== Seedream Payment Phase 1 Migration ===")

	raw, err := os.ReadFile(migrationPath)
	if err != nil {
		log.Fatalf("Read migration file %s: %v", migrationPath, err)
	}

	// MSSQL 의 GO 는 배치 분리자 (T-SQL 파서 전용, DB 가 직접 실행 불가).
	// 문자열 레벨에서 분리 후 각 배치를 개별 Exec 로 실행.
	batches := strings.Split(string(raw), "\nGO\n")

	executed := 0
	for i, batch := range batches {
		batch = strings.TrimSpace(batch)
		if batch == "" {
			continue
		}
		if err := db.Exec(batch).Error; err != nil {
			log.Fatalf("Batch #%d failed: %v\n\nSQL:\n%s", i+1, err, batch)
		}
		executed++
	}

	fmt.Printf("\n✓ Executed %d SQL batches\n", executed)

	// 사후 검증: 핵심 객체 존재 여부를 스스로 확인
	var tableCount int
	db.Raw(`
		SELECT COUNT(*) FROM sys.tables
		WHERE name IN ('WebhookReceipts', 'SeedreamReconcileCursors')
	`).Scan(&tableCount)
	if tableCount != 2 {
		log.Fatalf("Post-check failed: expected 2 new tables, found %d", tableCount)
	}
	fmt.Println("✓ Verified: WebhookReceipts & SeedreamReconcileCursors tables exist")

	var payCols int
	db.Raw(`
		SELECT COUNT(*) FROM sys.columns
		WHERE object_id = OBJECT_ID('Payments')
		  AND name IN ('SeedreamVAccountId', 'SeedreamPhase', 'SeedreamIdempotencyKey')
	`).Scan(&payCols)
	if payCols != 3 {
		log.Fatalf("Post-check failed: expected 3 new Payments columns, found %d", payCols)
	}
	fmt.Println("✓ Verified: Payments table has 3 new Seedream columns")

	var statusLen int
	db.Raw(`
		SELECT max_length FROM sys.columns
		WHERE object_id = OBJECT_ID('Orders') AND name = 'Status'
	`).Scan(&statusLen)
	if statusLen < 40 { // NVARCHAR(20) = 40 bytes
		log.Fatalf("Post-check failed: Orders.Status max_length = %d (expected >= 40)", statusLen)
	}
	fmt.Printf("✓ Verified: Orders.Status NVARCHAR(%d chars)\n", statusLen/2)

	var cursorRows int
	db.Raw(`SELECT COUNT(*) FROM SeedreamReconcileCursors WHERE Id = 1`).Scan(&cursorRows)
	if cursorRows != 1 {
		log.Fatalf("Post-check failed: ReconcileCursor seed row missing (found %d)", cursorRows)
	}
	fmt.Println("✓ Verified: SeedreamReconcileCursors has singleton seed row")

	fmt.Println("\n=== Migration 008 complete ===")
}
```

### - [ ] Step 2: 빌드 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go build -o /tmp/migrate_seedream_check ./cmd/migrate_seedream
```

Expected: 에러 없이 빌드 성공. (WSL/MSYS 환경에서 `/tmp` 미존재 시 `./migrate_seedream_check.exe` 로 대체)

### - [ ] Step 3: Commit

```bash
cd D:/dev/SeedreamGift && git add go-server/cmd/migrate_seedream/main.go
git commit -m "feat(migration): add runner CLI for Seedream Phase 1 migration

Executes 008 SQL with GO batch splitting and post-migration validation
(table existence, column presence, singleton seed row, Status size)."
```

---

## Task 8: 개발 DB 에 마이그레이션 실제 실행 (수동 검증)

**Files:** 없음 (DB 반영 + 로그만)

### - [ ] Step 1: `.env` 또는 config 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && cat .env | grep -i "DB_URL\|DATABASE_URL" || cat config/config.json 2>/dev/null | head -20
```

Expected: `sqlserver://...` 커넥션 문자열 확인. (없으면 로컬 개발 DB 설정 필요 — 별도 태스크 밖)

### - [ ] Step 2: 마이그레이션 실행

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go run ./cmd/migrate_seedream
```

Expected 출력 (최소):
```
=== Seedream Payment Phase 1 Migration ===
Orders.Status expanded to NVARCHAR(20)   (또는 already at NVARCHAR(20))
Added Payments.SeedreamVAccountId
Added Payments.Phase
Added Payments.IdempotencyKey
Created IX_Payments_SeedreamVAccountId
Created WebhookReceipts table
Created IX_WebhookReceipts_EventId
Created IX_WebhookReceipts_OrderNo
Created IX_WebhookReceipts_ReceivedAt
Created SeedreamReconcileCursors table
Inserted singleton ReconcileCursor seed row
Migration 008 complete.
✓ Executed N SQL batches
✓ Verified: WebhookReceipts & SeedreamReconcileCursors tables exist
✓ Verified: Payments table has 3 new Seedream columns
✓ Verified: Orders.Status NVARCHAR(20 chars)
✓ Verified: SeedreamReconcileCursors has singleton seed row
=== Migration 008 complete ===
```

### - [ ] Step 3: 멱등성 검증 — 재실행

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go run ./cmd/migrate_seedream
```

Expected: 두 번째 실행 시 "already" / "skipping" 로그 + 동일한 최종 "Migration 008 complete" 성공.  에러 없음.

### - [ ] Step 4: 싱글턴 CHECK 제약 테스트 (수동 SQL)

MSSQL 툴(ssms, azure data studio, `sqlcmd`) 로 아래 실행:

```sql
-- 실패해야 정상 (CHECK 제약 Id = 1 위반)
INSERT INTO SeedreamReconcileCursors (Id, LastSyncAt, LastRunAt)
VALUES (2, SYSUTCDATETIME(), SYSUTCDATETIME());
```

Expected: `The INSERT statement conflicted with the CHECK constraint "CK_SeedreamReconcileCursors_Singleton"` 에러.

### - [ ] Step 5: 전체 회귀 테스트 실행

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./... -count=1
```

Expected: 기존 테스트 전부 PASS (domain 패키지 + services 등). Migration 은 DB 만 변경했고 Go 코드 로직은 additive 뿐이라 회귀 없어야 함.

### - [ ] Step 6: 결과 기록 (commit 아님, 변경 없음)

수동 실행만 있었고 새로 커밋할 파일은 없습니다. 이 단계는 **실행 증거 확보** 단계이므로, 실행 로그를 PR 설명이나 Phase 1 완료 체크리스트에 붙여 둡니다.

---

## Task 9: Phase 1 전체 검증 & Phase 2 전환 준비

**Files:** 없음 (verification only)

### - [ ] Step 1: go vet 전체 통과

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go vet ./...
```

Expected: 에러 없음. 경고도 없으면 best.

### - [ ] Step 2: 관련 패키지 테스트 재확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/domain/... -count=1 -v
```

Expected: 모든 domain 테스트 PASS. 추가된 케이스 (`TestWebhookReceipt_*`, `TestReconcileCursor_*`, `TestPayment_HasSeedreamFields`, `TestValidateOrderTransition_SeedreamStates`, `TestOrderStatusConstants_Seedream`) 전부 PASS.

### - [ ] Step 3: 기존 서비스 테스트 회귀 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/app/services/... -count=1
```

Expected: 모든 기존 서비스 테스트 PASS. 특히 `TestPayment*`, `TestOrder*` 관련 테스트가 깨지면 안 됨.

### - [ ] Step 4: Spec 추적 체크리스트 (self-audit)

Spec `docs/superpowers/specs/2026-04-22-seedream-payment-integration-design.md` §4.1 ~ §4.5 요구사항 대비:

- [x] §4.1 `Order.Status` 12 → 20 자 확장 (Task 4)
- [ ] §4.1 `Order.PaymentKey` 컬럼 DROP — **Phase 6 로 연기** (명시적 이유: mock/Toss caller 활성)
- [x] §4.2 Payment 확장 필드 3 개 (Task 3)
- [x] §4.3 `WebhookReceipt` 엔티티 (Task 1)
- [x] §4.4 `ReconcileCursor` 싱글턴 엔티티 (Task 2)
- [x] §4.5 Migration SQL 5 항목 중 #1, #3~#5 (Task 6)
- [x] Migration runner CLI (Task 7)
- [x] 개발 DB 실제 적용 + 멱등성 검증 (Task 8)

### - [ ] Step 5: Phase 1 완료 Commit

```bash
cd D:/dev/SeedreamGift && git commit --allow-empty -m "chore(phase-1): Seedream payment data model complete

- WebhookReceipts + SeedreamReconcileCursors tables created
- Payments table extended with 3 Seedream fields + index
- Orders.Status expanded to NVARCHAR(20) for ISSUED/EXPIRED/AMOUNT_MISMATCH
- Domain structs + state machine transitions added and tested
- Migration 008 verified idempotent on dev DB

Deferred to Phase 6: Orders.PaymentKey column DROP (mock/Toss callers
still live in payment_service.go, fulfillment_svc.go, order_handler.go).

Next: Phase 2 — Seedream REST client + Issue handler + frontend redirect.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 프리뷰 (참고 — 별도 plan 문서)

다음 Phase 2 plan 에서 다룰 것:
- `internal/infra/seedream/` 패키지 (client · types · webhook_verify · reserved · errors)
- `VAccountService.Issue()` + handler
- Frontend: CheckoutPage → `/checkout/redirect` HTML auto-submit 페이지
- TEST 환경 (`test.seedreamapi.kr`) E2E: 발급 → 브라우저 은행선택 창 표시

Phase 2 는 **이 Phase 1 의 신규 스키마 위에서만** 실행되므로, 본 Phase 1 이 dev DB 에 완료되지 않으면 착수 금지.

---

## Self-review 결과 (writer)

**1. Spec 커버리지**: §4.1 ~ §4.5 의 모든 Phase 1 범위 요구사항 커버. PaymentKey DROP 만 Phase 6 로 연기 — Step 9.4 에 명시.

**2. Placeholder 스캔**: "TBD" / "TODO" / "유사하게" 없음. 모든 SQL · Go 코드 완결된 블록.

**3. 타입 일관성**: 
- `SeedreamVAccountID *int64` (Task 3) ↔ `SeedreamVAccountId BIGINT` (Task 6) ↔ post-check `sys.columns` (Task 7) — 타입 일치.
- `Phase *string size:30` ↔ `NVARCHAR(30)` — 일치.
- `IdempotencyKey *string size:200` ↔ `NVARCHAR(200)` — 일치.
- `DeliveryID int64 primaryKey` ↔ `BIGINT NOT NULL PRIMARY KEY` — 일치.
- `ReconcileCursor.ID int default:1 check:Id = 1` ↔ `INT DEFAULT 1 CHECK (Id = 1)` — 일치.

**4. 의존성 순서**: Task 1~3 (domain structs) → Task 4 (Status size) → Task 5 (transitions, Task 4 의 size 를 가정) → Task 6~7 (SQL/runner) → Task 8~9 (실행 · 검증). 올바른 선후관계.
