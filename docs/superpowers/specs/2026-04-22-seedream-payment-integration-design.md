---
title: Seedream API 결제 시스템 통합 설계
slug: seedream-payment-integration-design
version: 1.0.0
created: 2026-04-22
authors: [David Park]
status: DRAFT (구현 전 최종 확정 대기)
upstream_doc: docs/seedreamapi_docs/2026-04-21-giftcard-site-seedream-api-integration.md
upstream_commit: 1f8a58467b02d1ba58af5bfa683bc475a62026ff
scope:
  - LINK 모드 가상계좌 발급
  - 입금내역 조회
  - 발급 취소(입금 전) + 환불(입금 후) 통합
  - 웹훅 수신 (HMAC-SHA256)
  - Reconcile safety-net + 만료 타이머
out_of_scope:
  - WebView 모드 / 배치 발급 / 고정식 VA / 즉시발급(issueMode=api)
  - Seedream 신규 /api/v1/refunds 리소스 (CARD 9029 전용, IN_DEVELOPMENT)
---

# Seedream API 결제 시스템 통합 설계

## 0. 배경

상품권 사이트(Seedream Gift) 가 `go-server` 에서 현재 사용 중인 `IPaymentProvider` (MockPaymentProvider + 미연결 TossPaymentProvider) 를 전면 교체하여 Seedream Go REST API 를 통한 키움페이 LINK 가상계좌 결제 플로우를 도입한다. 본 문서는 상위 통합 가이드(`docs/seedreamapi_docs/2026-04-21-giftcard-site-seedream-api-integration.md`, 3100 줄) 의 요구사항을 본 프로젝트의 구조와 제약에 맞춰 구체화한 구현 설계서다.

## 1. 결정 사항 (Decisions Log)

| # | 결정 | 근거 |
|---|------|------|
| D1 | `reservedIndex2` 매핑: USER → `partner-default`, PARTNER → `partner-<partnerId>`, ADMIN → `partner-admin` | RESERVED 왕복 불변식은 발급 후 변경 불가. 감사/집계 버킷 분리 목적으로 ADMIN 전용 bucket. USER 는 단일 버킷으로 모음 (내부 DB `Order.Source` 로 재분리) |
| D2 | 기존 `IPaymentProvider` 인터페이스 · Mock/Toss Provider · `/payments/initiate`·`/payments/verify` · 범용 `/webhook/*` 전면 삭제 | Seedream 2단계 비동기 모델과 동기 verify 추상이 맞지 않음. Mock 은 pre-launch 단계라 사용자 노출 없음. Seedream TEST 환경(`test.seedreamapi.kr`) 으로 대체 가능 |
| D3 | Seedream `orderNo` = 기존 `Order.OrderCode` 재사용 (신규 컬럼 불필요) | 이미 전역 유일 · 사용자 노출용. 포맷 강제 없음 |
| D4 | 아키텍처: **계층 분리(infra/app/handlers/cron) + 경량 outbox** — 웹훅은 `workqueue` pool 에 enqueue 후 즉시 200 | §8.6.5 의 "10초 내 2xx" 요구. DB 커밋 ~ outbox enqueue 사이 창에서의 유실은 Reconcile 로 보완 |
| D5 | 프론트엔드: 발급 응답의 `targetUrl + formData` 를 HTML auto-submit 페이지로 렌더 후 브라우저 리다이렉트. `formData.TOKEN` 은 **절대 서버 DB/로그에 기록 금지** | Seedream §5.4.3 — 1회용 브라우저 세션 토큰. 응답 → 렌더 → 브라우저로만 흐름 |
| D6 | Reconcile 주기 10 분 / 만료 감지 1 분 | 지급형 상품권의 경우 5~10분 권장 (상위문서 §6.6). 만료는 UI 응답성 우선 |

## 2. 현재 상태 스냅샷

**go-server** 가 활성 백엔드. `server/` NestJS 는 레거시 참조용.

### 2.1. 교체 대상 (D2)
- `go-server/internal/app/interfaces/payment.go` (IPaymentProvider)
- `go-server/internal/infra/payment/mock_provider.go`, `toss_provider.go`
- `go-server/internal/app/services/payment_service.go` (334 줄 전체)
- `go-server/internal/api/handlers/payment_handler.go` 의 `InitiatePayment`, `VerifyPayment`, `Webhook` 메서드

### 2.2. 유지 대상 (읽기 전용, 이미 완성)
- `payment_query_svc.go` · `admin_payment_handler.go` · `partner_payment_handler.go` · `payment_mask.go`
- 프론트엔드 `PaymentsTab` (admin/partner) · `PaymentTimeline` 컴포넌트
- 하부 Payment 엔티티 쿼리는 Seedream 필드 반영되도록 조회 로직만 보정

### 2.3. 기존 `Order.Status` enum (`PENDING, PAID, DELIVERED, COMPLETED, CANCELLED, REFUNDED`)
Seedream 매핑 시 `ISSUED` · `EXPIRED` · `AMOUNT_MISMATCH` 추가 필요.

---

## 3. 아키텍처

### 3.1. 파일 구조 (신규 · 확장)

```
go-server/internal/
├─ infra/seedream/                          [신규 패키지]
│   ├─ client.go          # REST Client (4 기능)
│   ├─ webhook_verify.go  # HMAC-SHA256 검증
│   ├─ types.go           # DTO · ResultStatus · EventType · 은행 화이트리스트
│   ├─ reserved.go        # ReservedIndex2For + 상수
│   └─ errors.go          # errorCode → Go sentinel 매핑
├─ app/services/
│   ├─ vaccount_svc.go          # [신규] Issue/Cancel/Refund 오케스트레이션
│   ├─ vaccount_state.go        # [신규] 상태머신 전이 규칙
│   └─ vaccount_webhook_svc.go  # [신규] 웹훅 dispatch (상태머신 진입점)
├─ api/handlers/
│   ├─ vaccount_handler.go          # [신규] /payments/* HTTP 진입점
│   └─ seedream_webhook_handler.go  # [신규] /webhook/seedream
├─ cron/
│   ├─ seedream_reconcile_job.go # [신규] 10분 주기
│   └─ vaccount_expiry_job.go    # [신규] 1분 주기
├─ domain/
│   ├─ order.go           # [확장] Status 컬럼 12→20자, PaymentKey 제거
│   ├─ payment.go         # [확장] SeedreamVAccountID, Phase, IdempotencyKey 추가
│   ├─ webhook_receipt.go # [신규] WebhookReceipt 엔티티
│   └─ reconcile_cursor.go# [신규] ReconcileCursor 싱글턴
└─ infra/workqueue/jobs.go  # [확장] webhookJob 타입 추가
```

### 3.2. 데이터 흐름 (정상 결제)

```
[T+0]  client POST /api/v1/payments/initiate
        → VAccountService.Issue()
          · 권한 검증 + reservedIndex2 계산
          · seedream.Client.IssueVAccount() — X-API-Key + Idempotency-Key
          · 응답 검증 (RESERVED 왕복, phase)
          · Payment(PENDING, phase=awaiting_bank_selection) INSERT
        ← { targetUrl, formData, depositEndDateAt }
[T+0]  브라우저: HTML auto-submit form → 키움페이 은행선택 창
[T+?]  고객 은행 선택 → 키움 /notification/issue → Seedream → 웹훅 vaccount.issued
[T+?]  POST /webhook/seedream
        → HMAC 검증 (실패 시 500)
        → webhook_receipts INSERT (OnConflict DoNothing)
        → workqueue.Submit(webhookJob) → 200
[T+?]  Worker: vaccount_state.Apply("vaccount.issued", payload)
        · Payment.SeedreamPhase=awaiting_deposit, BankCode/AccountNumber/ExpiresAt UPDATE
[T+N]  고객 입금 → 키움 /notification/deposit → Seedream → 웹훅 vaccount.deposited
[T+N]  Worker: vaccount_state.Apply("vaccount.deposited", payload)
        · Order.Status=PAID (트랜잭션)
        · Voucher RESERVED→SOLD
        · Ledger.RecordPayment
        · OrderEvent 기록
```

### 3.3. 경계 책임

| 계층 | 책임 | 금지 |
|------|------|------|
| `infra/seedream` | HTTP wiring · 인증 헤더 · HMAC 검증 | 비즈니스 판단 (상태 전이 · 권한 체크) |
| `app/services/vaccount_*` | 상태 머신 · 권한 경계 · 트랜잭션 | HTTP 세부 · GIN 의존 |
| `api/handlers/*` | Request/Response 바인딩 · Caller Context 구성 | DB 직접 접근 · 상태 전이 로직 |
| `cron/*` | 주기 트리거 · 커서 관리 | 상태 전이 로직 (state service 호출만) |

---

## 4. 데이터 모델

### 4.1. `domain/order.go` 확장

```go
// 변경: Status size 12 → 20
Status string `gorm:"column:Status;default:'PENDING';size:20"`
// 삭제: PaymentKey (daouTrx 는 Payment.BankTxID 가 담당)
// 유지: IdempotencyKey, PaymentDeadlineAt, WithdrawalDeadlineAt
```

**Status enum 확장** (valid transitions 는 `validation.go` 의 `ValidateOrderTransition` 에 반영):

```
PENDING → ISSUED → PAID → DELIVERED → COMPLETED
                → CANCELLED
                → EXPIRED           (만료 타이머)
                → AMOUNT_MISMATCH   (Reconcile 감지 — 표준 경로)
PENDING → EXPIRED           (은행선택 전 만료)
PENDING → AMOUNT_MISMATCH   (ISSUED 웹훅 유실 시 Reconcile 엣지)
PAID    → REFUNDED
```

### 4.2. `domain/payment.go` 확장

기존 필드 + 아래 3개 추가 (2026-04-22 rename: `Phase`/`IdempotencyKey` 는 `Order.IdempotencyKey` / `Order.Status` 와의 의미 충돌로 vendor-prefix 적용):

```go
// Seedream 발급 응답 data.id (int64 — BIGINT)
SeedreamVAccountID     *int64  `gorm:"column:SeedreamVAccountId;index"`
// awaiting_bank_selection | awaiting_deposit | completed | cancelled | failed
SeedreamPhase          *string `gorm:"column:SeedreamPhase;size:30"`
// gift:vaccount:{OrderCode} | gift:cancel:* | gift:refund:*
SeedreamIdempotencyKey *string `gorm:"column:SeedreamIdempotencyKey;size:200"`
```

기존 `BankCode`(4) · `BankName`(15) · `AccountNumber` · `DepositorName`(15) · `BankTxID`(64 → `daouTrx` 저장) · `ExpiresAt` 재활용.

### 4.3. 신규 `domain/webhook_receipt.go`

```go
type WebhookReceipt struct {
    DeliveryID  int64      `gorm:"primaryKey;column:DeliveryId"`      // X-Seedream-Delivery-Id
    Event       string     `gorm:"column:Event;size:50;not null"`
    EventID     *string    `gorm:"column:EventId;size:36;index"`      // payload.eventId
    OrderNo     *string    `gorm:"column:OrderNo;size:50;index"`
    ReceivedAt  time.Time  `gorm:"column:ReceivedAt;autoCreateTime"`
    ProcessedAt *time.Time `gorm:"column:ProcessedAt"`
    RawBody     string     `gorm:"column:RawBody;type:nvarchar(max)"` // 감사용. 4 KiB 절삭 정책은 Seedream 측만 해당.
}
```

INSERT 시 `clause.OnConflict{DoNothing: true}` — PK 충돌이면 멱등 no-op.

### 4.4. 신규 `domain/reconcile_cursor.go`

```go
type ReconcileCursor struct {
    ID          int        `gorm:"primaryKey;default:1;check:Id = 1"` // 싱글턴 강제
    LastSyncAt  time.Time  `gorm:"column:LastSyncAt"`
    LastRunAt   time.Time  `gorm:"column:LastRunAt"`
    LastErrorAt *time.Time `gorm:"column:LastErrorAt"`
    LastError   *string    `gorm:"column:LastError;type:nvarchar(500)"`
}
```

### 4.5. Migration 파일

`go-server/migrations/` 경로 패턴 준수 (기존 `migrate_partner_doc.exe` 등과 동일한 경로). 새 마이그레이션 스크립트:

1. `Orders.Status` 컬럼 크기 12 → 20
2. `Orders.PaymentKey` 컬럼 DROP (데이터 백업은 migration 수행자 판단)
3. `Payments` 에 `SeedreamVAccountId BIGINT NULL`, `Phase NVARCHAR(30) NULL`, `IdempotencyKey NVARCHAR(200) NULL` 추가 + 인덱스
4. `WebhookReceipts` 테이블 CREATE
5. `SeedreamReconcileCursor` 테이블 CREATE + seed row (ID=1)

---

## 5. Seedream REST Client (`infra/seedream/`)

### 5.1. `client.go`

```go
type Client struct {
    baseURL    string
    apiKey     string
    httpClient *http.Client
    cb         *gobreaker.CircuitBreaker[[]byte]
    logger     *zap.Logger
}

func New(cfg ClientConfig, httpClient *http.Client, cb *gobreaker.CircuitBreaker[[]byte], logger *zap.Logger) *Client

// 타입 강제된 4 메서드 — Idempotency-Key 는 시그니처 인자로 강제
func (c *Client) IssueVAccount(ctx context.Context, req VAccountIssueRequest, idempotencyKey, traceID string) (*VAccountIssueResponse, error)
func (c *Client) QueryVAccounts(ctx context.Context, q VAccountQuery) (*ListPage[VAccountResult], error)
func (c *Client) CancelPayment(ctx context.Context, req CancelPaymentRequest, idempotencyKey, traceID string) (*CancelPaymentResponse, error)
func (c *Client) Health(ctx context.Context) error
```

### 5.2. 공통 요청 동작

- 모든 요청: `X-API-Key` · `Accept: application/json` 자동 부착
- mutating (Issue, Cancel): `Idempotency-Key` 헤더 + 멱등 키 길이 검증 (rawKey ≤ 50자 권장)
- `X-Trace-Id` 옵션 — 비면 UUID v4 자동 생성
- Keep-Alive pool 공유 (`resilience.HTTPPool.Register("seedream", ...)`)
- Timeout: connect 3 s / read 10 s / 환불은 15 s
- 429 수신 시 `Retry-After` 헤더 존중 · 3.6.1
- Response 파싱: `Envelope[T]` 로 파싱 → `success:false` 면 `errorCode` 기반 `apperror` 로 변환

### 5.3. 에러 매핑 (`errors.go`)

```go
var (
    ErrValidation          = errors.New("VALIDATION")
    ErrUnauthorized        = errors.New("UNAUTHORIZED")
    ErrForbidden           = errors.New("FORBIDDEN")
    ErrNotFound            = errors.New("NOT_FOUND")
    ErrConflict            = errors.New("CONFLICT")
    ErrInvalidState        = errors.New("INVALID_STATE_TRANSITION")
    ErrIdempotencyReuse    = errors.New("IDEMPOTENCY_KEY_REUSE")
    ErrTooManyRequests     = errors.New("TOO_MANY_REQUESTS")
    ErrInternal            = errors.New("INTERNAL")
    ErrExternalAPI         = errors.New("EXTERNAL_API_ERROR")
    ErrCircuitBreakerOpen  = errors.New("CIRCUIT_BREAKER_OPEN")
    ErrTimeout             = errors.New("TIMEOUT")
    ErrCancelInvalidState  = errors.New("CANCEL_INVALID_STATE")
    ErrCancelAlreadyDone   = errors.New("CANCEL_ALREADY_DONE")
    ErrCancelAPIFailed     = errors.New("CANCEL_API_FAILED")
    ErrCancelReasonEmpty   = errors.New("CANCEL_REASON_EMPTY")
)
```

상품권 사이트 내부 처리 의사결정 트리는 상위문서 §3.3 조치 분기 트리를 그대로 따름.

### 5.4. `webhook_verify.go`

`pkg/webhookverify` 참조 구현 포팅:
- `Verify(secret, rawBody, tsHeader, sigHeader, maxSkew) error`
- 기본 `DefaultMaxSkew = 10 * time.Minute`
- `hmac.Equal` 상수 시간 비교 필수
- 실패 시 sentinel error — caller 는 **500 반환** (§8.6.3 회피)

### 5.5. `reserved.go` — `reservedIndex2` 매핑 함수

```go
const (
    ReservedIndex1Fixed = "seedreamgift"
    ReservedStringFixed = "default"
)

// ReservedIndex2For 는 Order.Source 에 따라 reservedIndex2 값을 계산한다.
// 발급 후 영구 불변이므로 규칙 변경은 migration 을 요한다.
//
// 규칙 (D1):
//   USER    → "partner-default"
//   PARTNER → "partner-" + <partnerId>   (partnerId 는 max 12 자)
//   ADMIN   → "partner-admin"
//
// 제약: 결과는 max 20 자.
func ReservedIndex2For(order *domain.Order, partnerID *string) (string, error)
```

---

## 6. 비즈니스 로직 (`app/services/`)

### 6.1. `vaccount_svc.go` — 오케스트레이션

#### 6.1.1. Issue

```go
func (s *VAccountService) Issue(ctx context.Context, caller CallerContext, orderID int, clientType string) (*IssueResult, error)
```

순서:
1. `Order` 로드 + 소유권 검증 (§D.2)
2. 상태 검증: `Status == "PENDING"` + 기존 `Payment(PENDING)` 없음 확인 (중복 발급 방지)
3. `reservedIndex2 = ReservedIndex2For(order, partnerID)`
4. `depositEndDate = now + 30min (KST)` — `Asia/Seoul` 로 캐시
5. `Idempotency-Key = "gift:vaccount:" + order.OrderCode`
6. `seedream.Client.IssueVAccount(...)` 호출
7. `AssertReservedInvariant` — 위반 시 traceId 와 함께 Ops 에스컬레이션 로그 + 주문 격리
8. `Payment` INSERT — `Status=PENDING`, `Phase=awaiting_bank_selection`, `SeedreamVAccountID`, `IdempotencyKey`
9. `Order.PaymentDeadlineAt = depositEndDateAt` UPDATE (Status 는 PENDING 유지)
10. `OrderEventService.Record(tx, orderID, EventVAccountRequested, ...)`
11. `IssueResult{ targetUrl, formData, depositEndDateAt, seedreamVAccountId }` 반환
    - **`formData.TOKEN` 은 응답에만 실리고 DB/로그 절대 미저장** (D5)

#### 6.1.2. Cancel (입금 전)

```go
func (s *VAccountService) Cancel(ctx context.Context, caller CallerContext, orderID int, reason string) (*CancelResult, error)
```

순서:
1. 권한 검증
2. 상태 검증: `Order.Status == "PENDING"` + `Payment.SeedreamPhase == "awaiting_deposit"` (BankTxID 필수)
3. `cancelReason` 검증 (5~50자 rune, `^[]` 금지)
4. `Idempotency-Key = "gift:cancel:" + order.OrderCode`
5. `seedream.Client.CancelPayment({payMethod: "VACCOUNT-ISSUECAN", trxId: Payment.BankTxID, amount, cancelReason})`
6. `RESULTCODE == "0000"` 확인
7. 상태 전이는 **웹훅 `payment.canceled`** 도착 시 확정 (§7.9). 동기 응답은 "접수됨" 수준.
8. `CancelResult{ orderId, acceptedAt }` 반환

특수 케이스:
- `ErrCancelAlreadyDone` → 성공으로 간주 (이미 취소된 주문 == 멱등 성공)

#### 6.1.3. Refund (입금 후)

```go
func (s *VAccountService) Refund(ctx context.Context, caller CallerContext, orderID int, refundAccount RefundAccount, reason string) (*CancelResult, error)
```

순서:
1. 권한 검증
2. 상태 검증: `Order.Status == "PAID"` + `Payment.SeedreamPhase == "completed"`
3. `refundAccount.BankCode` in `BankCodesRefund` (9 개 화이트리스트)
4. `refundAccount.AccountNumber` regex `^[0-9-]{6,20}$`
5. `reason` 검증 (5~50자, `^[]` 금지)
6. `Idempotency-Key = "gift:refund:" + order.OrderCode + ":" + time.Now().UTC().Format("20060102150405")`
7. `seedream.Client.CancelPayment({payMethod: "BANK", trxId: Payment.BankTxID, amount, cancelReason, bankCode, accountNo})`
8. 확정은 **웹훅 `vaccount.deposit_canceled`** 기준

### 6.2. `vaccount_state.go` — 상태 머신

상태 전이 표 (§8.2 이벤트 기반):

| From (Order.Status) | Event | To | 부가 작업 |
|---|---|---|---|
| `PENDING` | `vaccount.requested` | (no-op) | 이미 Issue() 에서 INSERT 완료 |
| `PENDING` | `vaccount.issued` | `PENDING` (phase=awaiting_deposit) | Payment.BankCode/AccountNumber/DepositorName/ExpiresAt UPDATE |
| `PENDING` | `vaccount.deposited` | **PAID** | Voucher RESERVED→SOLD, Ledger.RecordPayment, Amount 검증 |
| `PENDING` | `payment.canceled` | **CANCELLED** | Payment.CancelledAt, Voucher RESERVED→AVAILABLE |
| `PENDING` | `vaccount.cancelled` | **CANCELLED** | 외부 자동. 동일 처리 |
| `PAID` | `vaccount.deposit_canceled` | **REFUNDED** | Refund INSERT/UPDATE, Ledger 환불 기록 |
| `REFUNDED` | `deposit_cancel.deposited` | (no-op) | 로깅만 (실입금 확인) |
| 종료 상태 (`CANCELLED`, `REFUNDED`, `EXPIRED`, `COMPLETED`) | anything | (no-op) | 로깅만 (§8.7 무효 전이) |

타이머/Reconcile 트리거:

| 트리거 | From | To | 부가 작업 |
|---|---|---|---|
| `VAccountExpiryJob` | `PENDING` + `PaymentDeadlineAt < now - 60s` | `EXPIRED` | Voucher 해제, (옵션) Seedream `/payment/cancel` 정합 호출 |
| `ReconcileJob` | `PENDING` + 원격 `SUCCESS` (DLQ 유실) | `PAID` | 웹훅 경로와 동일 |
| `ReconcileJob` | `ISSUED` + 원격 `AMOUNT_MISMATCH` | `AMOUNT_MISMATCH` | Voucher 해제 ❌ (Ops 판단), 알림 (표준 경로) |
| `ReconcileJob` | `PENDING` + 원격 `AMOUNT_MISMATCH` | `AMOUNT_MISMATCH` | ISSUED 웹훅 유실 엣지 — 위와 동일 처리 |

**금액 검증** (vaccount.deposited 처리 시):
- `payload.amount == Order.TotalAmount` → 정상 PAID
- `payload.amount != Order.TotalAmount` → Seedream 이 애초에 `vaccount.deposited` 를 발사하지 않음 (§9.5). 도착했다면 Seedream 회귀 버그 → traceId 로 Ops 에스컬레이션

### 6.3. `vaccount_webhook_svc.go` — 웹훅 dispatch

```go
func (s *WebhookService) Handle(ctx context.Context, deliveryID int64, event EventType, raw []byte) error
```

순서:
1. 이벤트별 payload 파싱
2. `Order` 로드 (orderNo 기준)
3. `vaccount_state.Apply(tx, order, event, payload)` — 전이 규칙 하나 함수
4. 트랜잭션 커밋
5. `webhook_receipts.ProcessedAt = now()` UPDATE

---

## 7. API 계층

### 7.1. 라우트 변경

**삭제**:
```
POST /api/v1/payments/initiate        (구 mock)
GET  /api/v1/payments/verify          (구 mock)
POST /api/v1/orders/payment/confirm   (구 flow — checkout 에서 initiate 로 흡수)
POST /api/v1/webhook/*                (범용 → 전용 /webhook/seedream)
```

**신규**:
```
[JWT required]  POST /api/v1/payments/initiate
    body: { orderId: int, clientType: "P" | "M" }
    200 : { targetUrl, formData: object, depositEndDateAt, seedreamVAccountId }

[JWT required]  POST /api/v1/payments/{orderId}/cancel
    body: { reason: string }
    200 : { orderId, acceptedAt }

[JWT required]  POST /api/v1/payments/{orderId}/refund
    body: { bankCode: string, accountNumber: string, accountHolder: string, reason: string }
    200 : { orderId, refundDaouTrx, acceptedAt }

[NO auth — HMAC only]
POST /webhook/seedream
    headers: X-Seedream-Event, X-Seedream-Timestamp, X-Seedream-Signature, X-Seedream-Delivery-Id
    200 : {} (body empty, 항상)
    500 : HMAC 검증 실패 · 일시 에러 (재시도 유도)
```

### 7.2. Rate Limit

- `/payments/initiate`: 기존 `EndpointRateLimit(10, time.Minute)` 재사용
- `/payments/{id}/cancel` · `/refund`: 5/min/caller (금전 이동 보호)
- `/webhook/seedream`: rate limit 없음 (Seedream 이 이미 backoff)

### 7.3. 3 계층 RBAC 경계 (§7.11)

`CallerContext` 를 handler 에서 구성 후 service 전달:

```go
type CallerContext struct {
    UserID    int
    Role      string  // "USER" | "PARTNER" | "ADMIN"
    PartnerID *string // Role == "PARTNER" 시만
    TraceID   string  // 양측 로그 조인용
}
```

소유권 검증:

| Role | Cancel/Refund 허용 조건 | 감사 로그 필드 |
|------|-------------------------|----------------|
| USER | `Order.UserID == caller.UserID` | `callerRole`, `callerUserId` |
| PARTNER | `Order.Source == "PARTNER" AND Order.PartnerID == *caller.PartnerID` | 위 + `partnerId` |
| ADMIN | 전수 허용 | 위 + 수행 운영자 ID, 수집한 환불 계좌 출처 |

Seedream 은 CallerID 스코프만 막아주므로 **같은 CallerID 내 유저-파트너 교차 조작은 Seedream 이 통과시킴** — 내부 검증 없이 호출하면 권한 누수.

### 7.4. 감사 로깅

기존 `audit_log` 테이블 재사용. 각 Issue/Cancel/Refund 호출 직전/직후:

```json
{
  "traceId": "...",
  "callerRole": "user|partner|admin",
  "callerUserId": 123,
  "partnerId": "partner-A7",
  "orderNo": "...",
  "action": "issue|cancel|refund",
  "payMethod": "VACCOUNT-ISSUECAN|BANK|null",
  "amount": 50000,
  "idempotencyKey": "gift:...",
  "seedreamErrorCode": "...",
  "seedreamErrorId": "ERR-..."
}
```

---

## 8. 웹훅 수신

### 8.1. 핸들러 시퀀스

`api/handlers/seedream_webhook_handler.go` — 상위문서 §8.4.2 구현 패턴을 따름:

```go
func (h *Handler) SeedreamWebhook(c *gin.Context) {
    // 1) MaxBytesReader 1 MiB
    raw, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20))
    // 2) HMAC verify — 실패 시 500 (4xx 금지)
    if err := seedream.Verify(secret, raw, tsHdr, sigHdr, 10*time.Minute); err != nil {
        c.String(500, ""); return
    }
    // 3) deliveryID 파싱 + 기본 검증
    // 4) webhook_receipts INSERT (OnConflict DoNothing)
    //    RowsAffected == 0 → 이미 처리 → 200 즉시
    // 5) workqueue.Submit(webhookJob{deliveryID, event, raw})
    //    (Non-blocking; 큐 포화 시 monitor 카운터 증가 + 동기 fallback)
    // 6) c.Status(200)
}
```

### 8.2. Worker

`infra/workqueue/jobs.go` 에 `webhookJob` 타입 추가:

```go
type webhookJob struct {
    deliveryID int64
    event      EventType
    raw        []byte
    svc        *services.WebhookService
}

func (j webhookJob) Execute(ctx context.Context) error {
    return j.svc.Handle(ctx, j.deliveryID, j.event, j.raw)
    // 실패 시 receipts row 는 남고 ProcessedAt = nil → 재시도는 Seedream 재전송으로 멱등 no-op
}
```

### 8.3. 반환 코드 정책 (상위문서 §8.6.3)

| 상황 | 상태 | 이유 |
|------|------|------|
| 멱등 재수신 (이미 처리) | 200 | Seedream 재시도 중지 |
| 내부 처리 성공 | 200 | 정상 |
| 내부 처리 일시 실패 (DB lock 등) | 500 | Seedream 재시도 유도 |
| HMAC 검증 실패 | 500 | 시크릿 회전·시계 skew 같은 일시 장애가 영구 DLQ 로 가지 않도록 |
| **Body 포맷 확정적 오류** | 500 (로그 + Ops) | 무작정 400/422 반환 금지 |

---

## 9. Reconcile + 만료 타이머

### 9.1. `cron/seedream_reconcile_job.go`

```
주기: SEEDREAM_RECONCILE_INTERVAL (기본 10m)
흐름:
  cursor.Read() → from = cursor.LastSyncAt - 5m (overlap)
  for page := 1; ; page++
      list = client.QueryVAccounts({from, pageSize:100, page})
      for item in list.items
          upsertFromReconcile(item)   // 상태머신과 같은 함수
      if !list.hasMore break
  cursor.Write(now)
```

`upsertFromReconcile`:
- 원격 `SUCCESS` + 내부 `PENDING` → PAID 전이 (웹훅 누락)
- 원격 `AMOUNT_MISMATCH` + 내부 `ISSUED`/`PENDING` → AMOUNT_MISMATCH 전이 + 알림
- 원격 `CANCELLED` + 내부 `PENDING` → CANCELLED
- 그 외 정합 상태는 no-op

### 9.2. `cron/vaccount_expiry_job.go`

```
주기: SEEDREAM_VACCOUNT_EXPIRY_CHECK_INTERVAL (기본 1m)
쿼리:
  UPDATE Orders SET Status = 'EXPIRED'
  FROM Orders o
  INNER JOIN Payments p ON p.OrderId = o.Id AND p.SeedreamPhase = 'awaiting_deposit'
  WHERE o.Status = 'PENDING'
    AND o.PaymentDeadlineAt IS NOT NULL
    AND o.PaymentDeadlineAt < DATEADD(SECOND, -60, SYSUTCDATETIME())
각 행에 대해:
  Voucher RESERVED → AVAILABLE
  (옵션) Seedream /payment/cancel VACCOUNT-ISSUECAN 호출 — 환경변수 SEEDREAM_EXPIRY_CLEANUP=true 일 때만
```

---

## 10. 설정 & 시크릿

`.env` 추가:

```bash
SEEDREAM_API_BASE=https://test.seedreamapi.kr     # prod: https://api.seedreamapi.kr
SEEDREAM_API_KEY=sk_test_...                      # 시크릿 매니저. 로그 마스킹 필수
SEEDREAM_WEBHOOK_SECRET=whsec_...                 # HMAC 키
SEEDREAM_CALLER_ID=seedreamgift-test              # 참고용 (실호출엔 불필요)
SEEDREAM_WEBHOOK_MAX_RETRIES=6                    # Partners.MaxRetries 와 동기화
SEEDREAM_RECONCILE_INTERVAL=10m
SEEDREAM_VACCOUNT_EXPIRY_CHECK_INTERVAL=1m
SEEDREAM_EXPIRY_CLEANUP=false                     # true 시 만료 주문에 /payment/cancel 정합 호출
```

### 10.1. 로그 마스킹

`pkg/logger/masking.go` 에 패턴 추가:
- `X-API-Key: sk_[a-zA-Z0-9_]+` → `sk_***`
- `"TOKEN":"[^"]+"` → `"TOKEN":"***"`
- `"formData":{...}` → `"formData":"***"`
- `"accountNo":"[0-9-]+"` → `"accountNo":"**-***-****"`
- `"SigningSecret":"[^"]+"` → masking

### 10.2. 온보딩 체크리스트 (Ops 협의)

- [ ] TEST/PROD 각 `X-API-Key` 수령
- [ ] Permissions: `["POST:/api/v1/vaccount", "GET:/api/v1/vaccount", "POST:/api/v1/payment/cancel"]`
- [ ] `Partners.WebhookURL` = `https://seedreamgift.com/webhook/seedream` (또는 TEST 대응)
- [ ] `Partners.SigningSecret` 수령 → `SEEDREAM_WEBHOOK_SECRET` 설정
- [ ] `Partners.MaxRetries` = 6 합의
- [ ] `PORTAL_CLIENT_ID` non-zero 확인 (Seedream 측) — 0 이면 웹훅 전무
- [ ] IP 화이트리스트 상태 확인 — 등록되어 있으면 go-server 아웃바운드 IP 등록 요청
- [ ] 키움페이 CPID 에 4 개 통지 URL (issue/deposit/cancel/deposit-cancel) 등록 상태 확인

---

## 11. 프론트엔드 영향

### 11.1. client

- **`CheckoutPage.tsx`**: 기존 mock redirect 제거. `POST /payments/initiate` 성공 시 `targetUrl + formData` 를 받아 HTML auto-submit form 렌더 페이지(`/checkout/redirect`)로 이동. 해당 페이지는 hidden input + `document.forms[0].submit()` 로 구성. `formData` 는 **서버가 반환한 값 그대로**, 변환·트리밍 금지 (§5.4.3).
- **`MyPage.tsx`** 주문 상세: 상태별 액션 버튼 — `PENDING + Phase=awaiting_deposit` 에서 "결제 취소" · `PAID` 에서 "환불 신청" · `EXPIRED` 에서 "재주문".
- **환불 모달**: 은행 9 개 드롭다운 + 계좌번호 입력 + 사유(5자 이상) + 동의 체크.

### 11.2. admin

- `OrdersTab` 상태 필터 enum 확장: `ISSUED`, `EXPIRED`, `AMOUNT_MISMATCH`, `REFUNDED` 추가
- `AdminDetailModal`: ADMIN 대리 환불 버튼 · 환불 계좌 수집 입력 · 감사 기록용 운영자 ID 자동 기록

### 11.3. partner

- 이미 완성된 `PaymentsTab` · `PaymentTimeline` 그대로. 하부 데이터(`Payment.SeedreamPhase`, `Payment.SeedreamVAccountID`) 가 채워지면 자동 반영.

### 11.4. OpenAPI client 재생성

- `pnpm api:generate` 실행해 `client/src/api/generated/api/payments-api.ts` 갱신
- admin 도 동일

---

## 12. 관찰가능성

### 12.1. 로깅 필수 필드

모든 Seedream 호출/웹훅 수신/Reconcile 실행 라인에:

```
traceId, orderNo, idempotencyKey, event (webhook), errorCode, errorId, seedreamHTTPStatus, latencyMs
```

### 12.2. 메트릭

- `seedream.request.count{endpoint, status}`
- `seedream.request.latency{endpoint, p50|p95|p99}`
- `seedream.error.count{errorCode}`
- `webhook.received.count{event}`
- `webhook.signature.invalid.count` (보안)
- `webhook.processing.duration{event, p50|p95}`
- `reconcile.discrepancy.count{type}` — 유실/불일치 건수

### 12.3. 알림 임계

- `CIRCUIT_BREAKER_OPEN` ≥ 1 건 → 즉시
- `IDEMPOTENCY_KEY_REUSE` ≥ 1 → 즉시 (코드 버그)
- `webhook.signature.invalid.count > 0 in 5m` → 보안
- `reconcile.discrepancy.count > 0` → Ops
- 5xx 응답률 > 1% in 5m → 운영

---

## 13. 테스트 전략

### 13.1. 단위 테스트 (Go)

- `seedream.Client` 각 메서드: httpmock 으로 Seedream 응답 stub
- `seedream.Verify`: 상위문서 §D 의 왕복 회귀 테스트 포팅
- `vaccount_state.Apply`: 7 개 이벤트 × 유효/무효 전이 전수 케이스
- `ReservedIndex2For`: USER/PARTNER/ADMIN 각 케이스 + 20자 초과 에러
- `cancelReason` 검증: 5자 미만·50자 초과·`^[]` 포함 각 reject

### 13.2. 통합 테스트 (E2E)

Seedream TEST 환경(`test.seedreamapi.kr`) 을 이용한 실제 E2E:

- **발급 → 은행선택 → 입금**: TEST 환경 키움 DEV (`KIWOOM_ENV=dev`) — 돈 이동 없음
- **발급 → 취소**: `payment.canceled` 웹훅 수신 확인
- **발급 → 입금 → 환불**: `vaccount.deposit_canceled` 웹훅 수신 + Refund 레코드 확인
- **만료**: `depositEndDate` 짧게 설정 후 expiry job 로 `EXPIRED` 전이 확인
- **웹훅 재시도**: 엔드포인트가 5xx 반환할 때 Seedream 이 backoff 재시도 + 멱등 처리 확인
- **Reconcile**: 웹훅 endpoint 일시 중단 후 Reconcile 로 복구 확인

### 13.3. 불변식 회귀 테스트

상위문서 **부록 D** (RESERVED 왕복 불변식 회귀 테스트) 을 Go 테스트로 포팅. CI 에서 매 PR 실행.

### 13.4. 프론트엔드 E2E (Playwright)

- Checkout → 결제 initiate → targetUrl 리다이렉트 페이지 렌더 검증
- 결제 취소 버튼 (PENDING 상태) → API 호출 + 상태 반영
- 환불 신청 모달 (PAID 상태) → 은행 선택 · 계좌 입력 검증 · API 호출

---

## 14. 롤아웃

### 14.1. Phase 정의

| Phase | 범위 | 검증 Gate |
|-------|------|----------|
| **P1** Data Model | DB migration · domain 구조체 확장 · 엔티티 CRUD 테스트 | 기존 기능 회귀 없음 (관련 go test 통과) |
| **P2** Client + Issue | Seedream Client · Issue handler · 프론트 auto-submit · TEST 발급 | TEST 환경 1건 발급 → 브라우저 은행선택 창 표시 |
| **P3** Webhook + 상태머신 | Webhook handler · worker · `vaccount.issued`/`deposited` 처리 | TEST 환경 1건 결제 완주 (PENDING → ISSUED → PAID) |
| **P4** Cancel + Refund | 취소·환불 handler · RBAC 검증 · `payment.canceled`/`deposit_canceled` | 3 계층 각 권한 케이스 테스트 · Refund 실 계좌 확인 |
| **P5** Reconcile + Expiry | Cron job · 만료 타이머 · 알림 임계 | 웹훅 차단 후 Reconcile 로 복구 검증 |
| **P6** 구 코드 정리 + PROD | Mock/Toss 삭제 · PROD 시크릿 cutover · 모니터링 확인 | PROD 1건 발급 → 결제 완주 |

### 14.2. 롤백 기준

각 Phase 별 **백아웃 조건**:
- Phase 2~3: TEST 발급/결제 실패율 > 10% in 1h → 차상위 Phase 중단
- Phase 6: PROD 전환 후 최초 1 시간 5xx 비율 > 2% → `SEEDREAM_API_BASE` 를 TEST 로 되돌리고 Seedream Ops 합동 조사

---

## 15. 오픈 이슈 / 후속

- [ ] Seedream 신규 `/api/v1/refunds` 리소스가 VACCOUNT 로도 확장될 경우 `Cancel`/`Refund` 엔드포인트 교체 시점 재검토
- [ ] `SigningSecret` 90일 회전 프로세스 자동화 (현재 Ops 수동)
- [ ] `PORTAL_CLIENT_ID` 환경 값 확정 — Seedream 측 운영 상수
- [ ] 가맹점별 `Clients.MaxRetries` 최종 값 Ops 확정 후 `SEEDREAM_WEBHOOK_MAX_RETRIES` 와 동기화
- [ ] 복합과세 CPID 필요 여부 (현재 미사용) — 향후 tax-free 분리 환불 필요 시 Seedream Ops 협의

---

## 16. 참조

- 상위 통합 가이드: `docs/seedreamapi_docs/2026-04-21-giftcard-site-seedream-api-integration.md`
- 프로젝트 CLAUDE.md: `/CLAUDE.md` (Tech Stack · Build Rules · Deployment)
- 결제 상태 조회 사전 설계: `docs/superpowers/specs/` (이미 완성된 읽기 전용 레이어)
