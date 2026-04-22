# Seedream Payment Integration — Phase 2: Client + Issue Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seedream REST Client 와 `POST /api/v1/payments/initiate` 엔드포인트를 구현하고 프론트엔드 `/checkout/redirect` auto-submit 페이지를 연결하여, TEST 환경(`test.seedreamapi.kr`)에 1건 VA 발급을 보내 브라우저가 키움페이 은행선택 창까지 도달하는 것을 확인한다.

**Architecture:** 설계 §3.1 의 계층 분리를 따름 — `infra/seedream/` 은 HTTP/인증/에러 매핑만, `app/services/vaccount_svc.go` 는 권한 검증·RESERVED 왕복 검증·DB 기록, `api/handlers/vaccount_handler.go` 는 Gin binding + caller context. 프론트엔드는 별도 `/checkout/redirect` 라우트로 auto-submit form 렌더. Webhook 수신/상태머신 적용은 Phase 3 범위 — 이번 Phase 는 "발급 요청 → 키움 은행선택 창 표시" 까지.

**Tech Stack:** Go (Gin · GORM · sony/gobreaker · resilience.HTTPClientPool) · React 18 + TypeScript (Vite · React Router · React Query) · MSSQL · Seedream TEST 환경

**Spec reference:** `docs/superpowers/specs/2026-04-22-seedream-payment-integration-design.md` §3.2 (데이터 흐름) · §5 (Seedream REST Client) · §6.1.1 (Issue) · §7.1 (라우트) · §10 (Config) · §11.1 (Frontend)

**Precondition:** Phase 1 data model migration 008 이 dev DB (Server C) 에 적용 완료된 상태. 본 plan 은 Phase 1 merge 후 실행.

---

## Prerequisites (User Action Required)

실행 전 Ops 로부터 받아야 할 값:

- [ ] **`SEEDREAM_API_BASE_TEST`** = `https://test.seedreamapi.kr` (상수)
- [ ] **`SEEDREAM_API_KEY`** (TEST 환경 키) — 32자+ 랜덤. `.env.local` 또는 시크릿 매니저에 저장.
- [ ] **`SEEDREAM_WEBHOOK_SECRET`** — Phase 3 에서 필요하지만 config 에 미리 넣어둠.
- [ ] Seedream Ops 에 상품권 사이트의 아웃바운드 IP 가 Seedream `IPWhitelistEntries` 에 등록되어 있거나 entries 가 비어 있음을 확인 (아니면 403).
- [ ] Partners 테이블 insert 요청 (Phase 3 까지 OK 이지만 미리 진행 권장): `WebhookURL=https://seedreamgift.com/webhook/seedream`, `SigningSecret=<위 값>`, `MaxRetries=6`.

이 값들이 없으면 Task 12 (TEST E2E) 는 실패. Task 1~11 은 진행 가능.

---

## File Structure

**신규 생성:**
- `go-server/internal/infra/seedream/types.go` — DTO · 상수 · Envelope · ListPage
- `go-server/internal/infra/seedream/reserved.go` — ReservedIndex2For + 고정 상수
- `go-server/internal/infra/seedream/errors.go` — errorCode → Go sentinel errors
- `go-server/internal/infra/seedream/client.go` — HTTP REST Client (Issue method)
- `go-server/internal/infra/seedream/reserved_test.go` — 3-tier 매핑 테스트
- `go-server/internal/infra/seedream/errors_test.go` — 에러 매핑 테스트
- `go-server/internal/infra/seedream/client_test.go` — httpmock 기반 클라이언트 테스트
- `go-server/internal/app/services/vaccount_svc.go` — VAccountService.Issue
- `go-server/internal/app/services/vaccount_svc_test.go` — Issue 권한·RESERVED·DB 테스트
- `go-server/internal/api/handlers/vaccount_handler.go` — POST /payments/initiate 핸들러
- `client/src/pages/CheckoutRedirect.tsx` — auto-submit form 렌더 페이지
- `client/src/hooks/mutations/useInitiatePayment.ts` — React Query mutation

**수정:**
- `go-server/internal/config/config.go` — Seedream 관련 env 필드 추가
- `go-server/internal/routes/container.go` — seedream.Client + VAccountService + handler DI
- `go-server/internal/routes/protected.go` — `/payments/initiate` 핸들러 swap
- `.env` + `.env.production` — SEEDREAM_* 키 추가 (dev 값은 placeholder)
- `client/src/App.tsx` — `/checkout/redirect` 라우트 추가
- `client/src/pages/CheckoutPage.hooks.ts` — order 생성 후 initiate 호출 + 리다이렉트
- `client/src/types/index.ts` (또는 관련) — 응답 타입 추가

**명시적으로 건드리지 않음 (Phase 3~6):**
- `POST /webhook/*` 및 관련 핸들러 (Phase 3)
- `VAccountService.Cancel`, `VAccountService.Refund` (Phase 4)
- Mock/Toss provider 삭제 (Phase 6)

---

## Task 1: Seedream 타입 정의 (DTO + Envelope)

**Files:**
- Create: `go-server/internal/infra/seedream/types.go`

### - [ ] Step 1: 작성

`go-server/internal/infra/seedream/types.go`:

```go
// Package seedream 은 Seedream Go REST API 의 클라이언트·타입·웹훅 검증을 제공합니다.
//
// 설계 참조: docs/superpowers/specs/2026-04-22-seedream-payment-integration-design.md §5
// 상위 가이드: docs/seedreamapi_docs/2026-04-21-giftcard-site-seedream-api-integration.md
package seedream

import "time"

// ─────────────────────────────────────────────────────────
// 공통 Envelope (§3.2)
// ─────────────────────────────────────────────────────────

// Envelope 는 모든 Seedream 응답의 표준 래퍼입니다.
type Envelope[T any] struct {
	Success          bool              `json:"success"`
	Data             T                 `json:"data,omitempty"`
	Error            string            `json:"error,omitempty"`
	ErrorCode        string            `json:"errorCode,omitempty"`
	ErrorID          string            `json:"errorId,omitempty"` // "ERR-{16 HEX}"
	ValidationErrors map[string]string `json:"validationErrors,omitempty"`
	Meta             *Meta             `json:"meta,omitempty"`
}

// Meta 는 응답 메타데이터 (traceId · timestamp · apiVersion).
type Meta struct {
	TraceID    string    `json:"traceId"`
	Timestamp  time.Time `json:"timestamp"`
	APIVersion string    `json:"apiVersion,omitempty"` // "v1"
}

// ─────────────────────────────────────────────────────────
// 발급 DTO (§5.2)
// ─────────────────────────────────────────────────────────

// VAccountIssueRequest 는 POST /api/v1/vaccount 요청 바디 (LINK 모드 고정).
type VAccountIssueRequest struct {
	// ── 필수 ──
	OrderNo     string `json:"orderNo"`     // max 50, '|' 금지
	Amount      int64  `json:"amount"`      // 1 ~ 9,999,999,999
	ProductName string `json:"productName"` // max 50

	// ── 고정값 (상품권 사이트) ──
	Type        string `json:"type"`        // "P" | "M"
	IssueMode   string `json:"issueMode"`   // "link"
	ProductType string `json:"productType"` // "2"
	BillType    string `json:"billType"`    // "1"

	// ── RESERVED 왕복 (§3.5) ──
	ReservedIndex1 string `json:"reservedIndex1"` // "seedreamgift"
	ReservedIndex2 string `json:"reservedIndex2"` // "partner-<id>" · "partner-default" · "partner-admin"
	ReservedString string `json:"reservedString"` // "default"

	// ── 입금만료 (30분 고정, KST) ──
	DepositEndDate string `json:"depositEndDate"` // YYYYMMDDhhmmss (14자리)

	// ── 고객 정보 (선택) ──
	UserName string `json:"userName,omitempty"` // max 50
	Email    string `json:"email,omitempty"`    // max 100
	UserID   string `json:"userId,omitempty"`   // max 30

	// ── 결제창 콜백 URL (선택) ──
	ReturnURL string `json:"returnUrl,omitempty"`
	HomeURL   string `json:"homeUrl,omitempty"`
}

// VAccountIssueResponse 는 LINK 모드 1차 응답 (은행선택 대기).
//
// phase == "awaiting_bank_selection" 이면 TargetURL/FormData 가 채워지고 AccountNumber 는 nil.
// 브라우저는 TargetURL + FormData 를 HTML auto-submit form 으로 렌더해 키움 결제창으로 이동.
//
// ★ FormData.TOKEN 은 1회용 브라우저 세션 토큰 — 서버 DB/로그에 저장 금지 (설계 D5).
type VAccountIssueResponse struct {
	ID             int64  `json:"id"`        // Seedream 내부 PK (→ Payment.SeedreamVAccountID)
	PartnerID      string `json:"partnerId"` // = CallerID
	ReservedIndex1 string `json:"reservedIndex1"`
	ReservedIndex2 string `json:"reservedIndex2"`
	ReservedString string `json:"reservedString"`

	OrderNo string `json:"orderNo"`
	Amount  int64  `json:"amount"`

	Status string `json:"status"` // "PENDING"
	Phase  string `json:"phase"`  // "awaiting_bank_selection"

	TargetURL string            `json:"targetUrl"`
	FormData  map[string]string `json:"formData"`

	DepositEndDate   string    `json:"depositEndDate"`   // YYYYMMDDhhmmss 원본
	DepositEndDateAt time.Time `json:"depositEndDateAt"` // RFC3339 편의 필드

	AccountNumber *string `json:"accountNumber"`
	BankCode      *string `json:"bankCode"`
	DaouTrx       *string `json:"daouTrx"`
	DepositorName *string `json:"depositorName"`

	ResultCode    string `json:"resultCode"`    // "0000"
	ResultMessage string `json:"resultMessage"` // "정상"

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ─────────────────────────────────────────────────────────
// 고정 상수 (§1.2.2 RESERVED 왕복 불변식)
// ─────────────────────────────────────────────────────────

const (
	// ReservedIndex1Fixed — 상품권 사이트 발급건 식별 태그. 변경 불가.
	ReservedIndex1Fixed = "seedreamgift"
	// ReservedStringFixed — 현 시점 고정 "default".
	ReservedStringFixed = "default"

	// IssueMode — LINK 모드만 사용 (키움 계약).
	IssueModeLink = "link"
	// ProductType — Portal 관례 "2".
	ProductTypeFixed = "2"
	// BillType — 일반결제 "1".
	BillTypeFixed = "1"

	// DeviceTypePC / DeviceTypeMobile — 고객 User-Agent 로 분기.
	DeviceTypePC     = "P"
	DeviceTypeMobile = "M"
)
```

### - [ ] Step 2: 컴파일 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go build ./internal/infra/seedream/
```

Expected: 에러 없이 컴파일 성공.

### - [ ] Step 3: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/infra/seedream/types.go
git commit -m "feat(seedream): add types for VAccount issue DTOs and Envelope"
```

---

## Task 2: ReservedIndex2 매핑 함수 (TDD)

**Files:**
- Create: `go-server/internal/infra/seedream/reserved.go`
- Create: `go-server/internal/infra/seedream/reserved_test.go`

### - [ ] Step 1: 실패 테스트 작성

`go-server/internal/infra/seedream/reserved_test.go`:

```go
package seedream

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestReservedIndex2For(t *testing.T) {
	pid := "A7"

	tests := []struct {
		name      string
		source    string
		partnerID *string
		want      string
		wantErr   bool
		errSub    string
	}{
		// USER (일반 고객)
		{"USER → partner-default", "USER", nil, "partner-default", false, ""},
		{"USER, partnerID 무시", "USER", &pid, "partner-default", false, ""},

		// PARTNER
		{"PARTNER + id=A7", "PARTNER", &pid, "partner-A7", false, ""},

		// ADMIN 대리
		{"ADMIN → partner-admin", "ADMIN", nil, "partner-admin", false, ""},
		{"ADMIN, partnerID 무시", "ADMIN", &pid, "partner-admin", false, ""},

		// 에러 케이스
		{"PARTNER 누락 partnerID", "PARTNER", nil, "", true, "partnerID"},
		{"PARTNER 빈 partnerID", "PARTNER", ptr(""), "", true, "partnerID"},
		{"PARTNER 12자 초과", "PARTNER", ptr(strings.Repeat("x", 13)), "", true, "20자"},
		{"알 수 없는 Source", "GUEST", nil, "", true, "Source"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ReservedIndex2For(tc.source, tc.partnerID)
			if tc.wantErr {
				if assert.Error(t, err) {
					assert.Contains(t, err.Error(), tc.errSub)
				}
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tc.want, got)
			assert.LessOrEqual(t, len(got), 20, "reservedIndex2 max 20자")
		})
	}
}

func ptr(s string) *string { return &s }
```

### - [ ] Step 2: 컴파일 실패 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/infra/seedream/ -run TestReservedIndex2For -v
```

Expected: `undefined: ReservedIndex2For` 컴파일 에러.

### - [ ] Step 3: 구현

`go-server/internal/infra/seedream/reserved.go`:

```go
package seedream

import (
	"errors"
	"fmt"
	"strings"
)

// ErrReservedRoundTripViolation 은 RESERVED 왕복 불변식 위반 시 반환됩니다.
// 발급/조회/웹훅 응답에서 클라이언트가 보낸 값과 달라진 경우 sentinel.
var ErrReservedRoundTripViolation = errors.New("RESERVED roundtrip violated")

// ReservedIndex2For 는 주문 소스(USER/PARTNER/ADMIN)에서 reservedIndex2 문자열을 계산합니다.
//
// 규칙 (Phase 1 설계 결정 D1):
//   - Source "USER"    → "partner-default"
//   - Source "PARTNER" → "partner-<partnerID>" (partnerID max 12자)
//   - Source "ADMIN"   → "partner-admin"
//
// 제약: 결과 max 20자. Seedream 발급 후 영구 불변.
func ReservedIndex2For(source string, partnerID *string) (string, error) {
	switch strings.ToUpper(source) {
	case "USER":
		return "partner-default", nil
	case "ADMIN":
		return "partner-admin", nil
	case "PARTNER":
		if partnerID == nil || *partnerID == "" {
			return "", fmt.Errorf("PARTNER source 는 partnerID 가 필수입니다")
		}
		if len(*partnerID) > 12 {
			return "", fmt.Errorf("partnerID 가 12자를 초과합니다 (20자 제한)")
		}
		return "partner-" + *partnerID, nil
	default:
		return "", fmt.Errorf("알 수 없는 Source: %q (USER|PARTNER|ADMIN)", source)
	}
}

// ReservedFields 는 왕복 검증에 쓰이는 3 필드의 스냅샷입니다.
type ReservedFields struct {
	ReservedIndex1 string
	ReservedIndex2 string
	ReservedString string
}

// AssertReservedInvariant 는 응답/이벤트 페이로드의 RESERVED 3필드가 요청 시
// 기대값과 일치하는지 검증합니다. 위반 시 ErrReservedRoundTripViolation 을 %w 로 감싸
// 반환하여 호출자가 errors.Is 로 식별 가능.
func AssertReservedInvariant(expectedReservedIndex2 string, got ReservedFields) error {
	if got.ReservedIndex1 != ReservedIndex1Fixed {
		return fmt.Errorf("%w: reservedIndex1=%q", ErrReservedRoundTripViolation, got.ReservedIndex1)
	}
	if got.ReservedIndex2 != expectedReservedIndex2 {
		return fmt.Errorf("%w: reservedIndex2 기대=%q 실제=%q",
			ErrReservedRoundTripViolation, expectedReservedIndex2, got.ReservedIndex2)
	}
	if got.ReservedString != ReservedStringFixed {
		return fmt.Errorf("%w: reservedString=%q", ErrReservedRoundTripViolation, got.ReservedString)
	}
	return nil
}
```

### - [ ] Step 4: 테스트 통과 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/infra/seedream/ -run TestReservedIndex2For -v
```

Expected: 모든 sub-test PASS (9 케이스).

### - [ ] Step 5: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/infra/seedream/reserved.go go-server/internal/infra/seedream/reserved_test.go
git commit -m "feat(seedream): add ReservedIndex2For mapping and invariant assertion"
```

---

## Task 3: 에러 코드 → Go sentinel 매핑 (TDD)

**Files:**
- Create: `go-server/internal/infra/seedream/errors.go`
- Create: `go-server/internal/infra/seedream/errors_test.go`

### - [ ] Step 1: 실패 테스트 작성

`go-server/internal/infra/seedream/errors_test.go`:

```go
package seedream

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMapErrorCode(t *testing.T) {
	tests := []struct {
		code     string
		sentinel error
	}{
		{"VALIDATION", ErrValidation},
		{"UNAUTHORIZED", ErrUnauthorized},
		{"FORBIDDEN", ErrForbidden},
		{"NOT_FOUND", ErrNotFound},
		{"CONFLICT", ErrConflict},
		{"INVALID_STATE_TRANSITION", ErrInvalidState},
		{"IDEMPOTENCY_KEY_REUSE", ErrIdempotencyReuse},
		{"TOO_MANY_REQUESTS", ErrTooManyRequests},
		{"INTERNAL", ErrInternal},
		{"EXTERNAL_API_ERROR", ErrExternalAPI},
		{"CIRCUIT_BREAKER_OPEN", ErrCircuitBreakerOpen},
		{"TIMEOUT", ErrTimeout},
		{"CANCEL_INVALID_STATE", ErrCancelInvalidState},
		{"CANCEL_ALREADY_DONE", ErrCancelAlreadyDone},
		{"CANCEL_API_FAILED", ErrCancelAPIFailed},
		{"CANCEL_REASON_EMPTY", ErrCancelReasonEmpty},
	}
	for _, tc := range tests {
		t.Run(tc.code, func(t *testing.T) {
			err := MapErrorCode(tc.code, "msg", "ERR-ABC", "trace-1")
			assert.True(t, errors.Is(err, tc.sentinel),
				"errorCode %s should wrap %v, got %v", tc.code, tc.sentinel, err)
			// 컨텍스트 정보가 보존되는지 확인
			var apiErr *APIError
			assert.True(t, errors.As(err, &apiErr))
			assert.Equal(t, tc.code, apiErr.Code)
			assert.Equal(t, "ERR-ABC", apiErr.ErrorID)
			assert.Equal(t, "trace-1", apiErr.TraceID)
		})
	}
}

func TestMapErrorCode_Unknown(t *testing.T) {
	err := MapErrorCode("WEIRD_NEW_CODE", "msg", "ERR-X", "trace-2")
	assert.True(t, errors.Is(err, ErrUnknown))
}

func TestAPIError_Message(t *testing.T) {
	err := MapErrorCode("VALIDATION", "필드 오류", "ERR-1", "trace-a")
	assert.Contains(t, err.Error(), "VALIDATION")
	assert.Contains(t, err.Error(), "필드 오류")
}
```

### - [ ] Step 2: 컴파일 실패 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/infra/seedream/ -run "TestMapErrorCode|TestAPIError" -v
```

Expected: undefined symbols 컴파일 에러.

### - [ ] Step 3: 구현

`go-server/internal/infra/seedream/errors.go`:

```go
package seedream

import (
	"errors"
	"fmt"
)

// Sentinel error 정의 (§3.3 에러 코드 매트릭스).
// errors.Is 로 매칭하고, APIError 로 컨텍스트 접근.
var (
	ErrValidation         = errors.New("seedream: VALIDATION")
	ErrUnauthorized       = errors.New("seedream: UNAUTHORIZED")
	ErrForbidden          = errors.New("seedream: FORBIDDEN")
	ErrNotFound           = errors.New("seedream: NOT_FOUND")
	ErrConflict           = errors.New("seedream: CONFLICT")
	ErrInvalidState       = errors.New("seedream: INVALID_STATE_TRANSITION")
	ErrIdempotencyReuse   = errors.New("seedream: IDEMPOTENCY_KEY_REUSE")
	ErrTooManyRequests    = errors.New("seedream: TOO_MANY_REQUESTS")
	ErrInternal           = errors.New("seedream: INTERNAL")
	ErrExternalAPI        = errors.New("seedream: EXTERNAL_API_ERROR")
	ErrCircuitBreakerOpen = errors.New("seedream: CIRCUIT_BREAKER_OPEN")
	ErrTimeout            = errors.New("seedream: TIMEOUT")
	ErrCancelInvalidState = errors.New("seedream: CANCEL_INVALID_STATE")
	ErrCancelAlreadyDone  = errors.New("seedream: CANCEL_ALREADY_DONE")
	ErrCancelAPIFailed    = errors.New("seedream: CANCEL_API_FAILED")
	ErrCancelReasonEmpty  = errors.New("seedream: CANCEL_REASON_EMPTY")
	ErrUnknown            = errors.New("seedream: UNKNOWN_ERROR_CODE")
)

// APIError 는 Seedream 이 반환한 에러의 구조화된 정보를 담습니다.
// Go sentinel 과 errors.Is 로 매칭 가능하며, ErrorID·TraceID 로 Ops 추적 지원.
type APIError struct {
	Code    string // Seedream errorCode (예: "VALIDATION")
	Message string // 사람이 읽는 한국어 메시지
	ErrorID string // "ERR-{16 HEX}"
	TraceID string // meta.traceId
	sentinel error // errors.Is 판정용
}

func (e *APIError) Error() string {
	return fmt.Sprintf("seedream: %s (%s) errorId=%s traceId=%s",
		e.Code, e.Message, e.ErrorID, e.TraceID)
}

// Unwrap 은 errors.Is/As 가 sentinel 을 찾을 수 있도록 연결합니다.
func (e *APIError) Unwrap() error { return e.sentinel }

// errorCodeSentinels 는 Seedream errorCode 문자열을 Go sentinel 로 매핑합니다.
var errorCodeSentinels = map[string]error{
	"VALIDATION":               ErrValidation,
	"UNAUTHORIZED":             ErrUnauthorized,
	"FORBIDDEN":                ErrForbidden,
	"NOT_FOUND":                ErrNotFound,
	"CONFLICT":                 ErrConflict,
	"INVALID_STATE_TRANSITION": ErrInvalidState,
	"IDEMPOTENCY_KEY_REUSE":    ErrIdempotencyReuse,
	"TOO_MANY_REQUESTS":        ErrTooManyRequests,
	"INTERNAL":                 ErrInternal,
	"EXTERNAL_API_ERROR":       ErrExternalAPI,
	"CIRCUIT_BREAKER_OPEN":     ErrCircuitBreakerOpen,
	"TIMEOUT":                  ErrTimeout,
	"CANCEL_INVALID_STATE":     ErrCancelInvalidState,
	"CANCEL_ALREADY_DONE":      ErrCancelAlreadyDone,
	"CANCEL_API_FAILED":        ErrCancelAPIFailed,
	"CANCEL_REASON_EMPTY":      ErrCancelReasonEmpty,
}

// MapErrorCode 는 Seedream errorCode 문자열을 APIError 로 래핑합니다.
// 알 수 없는 code 는 ErrUnknown 으로 처리.
func MapErrorCode(code, message, errorID, traceID string) error {
	sentinel, ok := errorCodeSentinels[code]
	if !ok {
		sentinel = ErrUnknown
	}
	return &APIError{
		Code:     code,
		Message:  message,
		ErrorID:  errorID,
		TraceID:  traceID,
		sentinel: sentinel,
	}
}
```

### - [ ] Step 4: 테스트 통과 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/infra/seedream/ -run "TestMapErrorCode|TestAPIError" -v
```

Expected: 모든 케이스 PASS.

### - [ ] Step 5: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/infra/seedream/errors.go go-server/internal/infra/seedream/errors_test.go
git commit -m "feat(seedream): add errorCode → Go sentinel mapping with APIError wrapper"
```

---

## Task 4: Seedream REST Client 구현 — `IssueVAccount`

**Files:**
- Create: `go-server/internal/infra/seedream/client.go`
- Create: `go-server/internal/infra/seedream/client_test.go`

### - [ ] Step 1: 실패 테스트 작성

`go-server/internal/infra/seedream/client_test.go`:

```go
package seedream

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

// newTestServer 는 Seedream API 를 흉내내는 httptest 서버를 반환합니다.
func newTestServer(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	return httptest.NewServer(handler)
}

func TestClient_IssueVAccount_Success(t *testing.T) {
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		// 요청 검증
		assert.Equal(t, "sk_test_abc", r.Header.Get("X-API-Key"))
		assert.Equal(t, "gift:vaccount:ORD-1", r.Header.Get("Idempotency-Key"))
		assert.Equal(t, "trace-xyz", r.Header.Get("X-Trace-Id"))
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/api/v1/vaccount", r.URL.Path)

		// 응답
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Trace-Id", "trace-xyz")
		_ = json.NewEncoder(w).Encode(Envelope[VAccountIssueResponse]{
			Success: true,
			Data: VAccountIssueResponse{
				ID:               102847,
				OrderNo:          "ORD-1",
				Amount:           50000,
				Status:           "PENDING",
				Phase:            "awaiting_bank_selection",
				TargetURL:        "https://testpg.kiwoompay.co.kr/pay/xyz",
				FormData:         map[string]string{"PAYMETHOD": "VACCT", "TOKEN": "tok-123"},
				ReservedIndex1:   "seedreamgift",
				ReservedIndex2:   "partner-default",
				ReservedString:   "default",
				DepositEndDate:   "20260422180000",
				DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
				CreatedAt:        time.Now().UTC(),
				UpdatedAt:        time.Now().UTC(),
			},
			Meta: &Meta{TraceID: "trace-xyz", Timestamp: time.Now().UTC(), APIVersion: "v1"},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk_test_abc"}, nil, nil, zap.NewNop())
	res, err := c.IssueVAccount(context.Background(), VAccountIssueRequest{
		OrderNo: "ORD-1", Amount: 50000, ProductName: "Test",
		Type: "P", IssueMode: "link", ProductType: "2", BillType: "1",
		ReservedIndex1: "seedreamgift", ReservedIndex2: "partner-default", ReservedString: "default",
		DepositEndDate: "20260422180000",
	}, "gift:vaccount:ORD-1", "trace-xyz")

	require.NoError(t, err)
	assert.Equal(t, int64(102847), res.ID)
	assert.Equal(t, "awaiting_bank_selection", res.Phase)
	assert.Equal(t, "tok-123", res.FormData["TOKEN"])
}

func TestClient_IssueVAccount_ErrorMapping(t *testing.T) {
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(w).Encode(Envelope[any]{
			Success: false, ErrorCode: "IDEMPOTENCY_KEY_REUSE",
			Error: "같은 키로 다른 바디", ErrorID: "ERR-DEADBEEF12345678",
			Meta: &Meta{TraceID: "t-9"},
		})
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk"}, nil, nil, zap.NewNop())
	_, err := c.IssueVAccount(context.Background(), VAccountIssueRequest{OrderNo: "X"}, "k", "")
	assert.True(t, errors.Is(err, ErrIdempotencyReuse))

	var apiErr *APIError
	require.True(t, errors.As(err, &apiErr))
	assert.Equal(t, "ERR-DEADBEEF12345678", apiErr.ErrorID)
	assert.Equal(t, "t-9", apiErr.TraceID)
}

func TestClient_IssueVAccount_Timeout(t *testing.T) {
	srv := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	c := New(ClientConfig{BaseURL: srv.URL, APIKey: "sk", Timeout: 100 * time.Millisecond}, nil, nil, zap.NewNop())
	_, err := c.IssueVAccount(context.Background(), VAccountIssueRequest{OrderNo: "X"}, "k", "")
	assert.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "deadline") || strings.Contains(err.Error(), "timeout"))
}

func TestClient_IssueVAccount_RequiresIdempotencyKey(t *testing.T) {
	c := New(ClientConfig{BaseURL: "http://example.com", APIKey: "sk"}, nil, nil, zap.NewNop())
	_, err := c.IssueVAccount(context.Background(), VAccountIssueRequest{OrderNo: "X"}, "", "trace")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Idempotency-Key")
}
```

### - [ ] Step 2: 컴파일 실패 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/infra/seedream/ -run TestClient -v
```

Expected: `undefined: New`, `undefined: ClientConfig` 등 컴파일 에러.

### - [ ] Step 3: 구현

`go-server/internal/infra/seedream/client.go`:

```go
package seedream

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
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
```

### - [ ] Step 4: uuid 의존성 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go mod download github.com/google/uuid 2>&1 | head -3
```

Expected: 이미 있으면 no-op, 없으면 download. `go.mod` 에 이미 존재할 가능성 높음 (기존 코드에서 uuid 쓸 것).

만약 없으면:
```bash
go get github.com/google/uuid@latest
```

### - [ ] Step 5: 테스트 통과 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/infra/seedream/ -count=1 -v
```

Expected: 모든 seedream 패키지 테스트 PASS (Reserved + Errors + Client 합쳐 ~20+ 케이스).

### - [ ] Step 6: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/infra/seedream/client.go go-server/internal/infra/seedream/client_test.go go-server/go.mod go-server/go.sum
git commit -m "feat(seedream): add REST client with IssueVAccount method + httpmock tests"
```

---

## Task 5: Config 필드 추가

**Files:**
- Modify: `go-server/internal/config/config.go`
- Modify: `go-server/.env` (add Seedream keys with placeholder/test values)
- Modify: `go-server/.env.production` (add production keys — values will be filled by Ops)

### - [ ] Step 1: config 구조체 확장

Add to `go-server/internal/config/config.go` after the existing last field (또는 비슷한 grouping). Find a good spot after existing `JWTSecret` etc.

```go
// ─── Seedream API 통합 ───

// SeedreamAPIBase 는 Seedream REST API 의 base URL 입니다.
// TEST: https://test.seedreamapi.kr · PROD: https://api.seedreamapi.kr
SeedreamAPIBase string `mapstructure:"SEEDREAM_API_BASE"`
// SeedreamAPIKey 는 Seedream 이 발급한 X-API-Key 입니다. 시크릿 매니저에만 보관.
SeedreamAPIKey string `mapstructure:"SEEDREAM_API_KEY"`
// SeedreamWebhookSecret 은 웹훅 HMAC-SHA256 서명 검증용 시크릿입니다 (Phase 3 에서 사용).
SeedreamWebhookSecret string `mapstructure:"SEEDREAM_WEBHOOK_SECRET"`
// SeedreamCallerID 는 참고용 CallerID (Seedream 내부 식별자). 호출엔 불필요, 로그 매칭용.
SeedreamCallerID string `mapstructure:"SEEDREAM_CALLER_ID"`
// SeedreamReconcileInterval 은 safety-net Reconcile cron 주기입니다 (Phase 5 에서 사용, 기본 10m).
SeedreamReconcileInterval time.Duration `mapstructure:"SEEDREAM_RECONCILE_INTERVAL"`
// SeedreamVAccountExpiryCheckInterval 은 만료 타이머 cron 주기입니다 (Phase 5 에서 사용, 기본 1m).
SeedreamVAccountExpiryCheckInterval time.Duration `mapstructure:"SEEDREAM_VACCOUNT_EXPIRY_CHECK_INTERVAL"`
```

Add defaults in the `LoadConfig` function where other `viper.SetDefault` calls are:

```go
viper.SetDefault("SEEDREAM_API_BASE", "https://test.seedreamapi.kr")
viper.SetDefault("SEEDREAM_API_KEY", "")
viper.SetDefault("SEEDREAM_WEBHOOK_SECRET", "")
viper.SetDefault("SEEDREAM_CALLER_ID", "seedreamgift-test")
viper.SetDefault("SEEDREAM_RECONCILE_INTERVAL", "10m")
viper.SetDefault("SEEDREAM_VACCOUNT_EXPIRY_CHECK_INTERVAL", "1m")
```

### - [ ] Step 2: .env 에 placeholder 추가

Append to `go-server/.env`:

```
# ─── Seedream API (Phase 2+) ───
SEEDREAM_API_BASE="https://test.seedreamapi.kr"
SEEDREAM_API_KEY=""
SEEDREAM_WEBHOOK_SECRET=""
SEEDREAM_CALLER_ID="seedreamgift-test"
SEEDREAM_RECONCILE_INTERVAL="10m"
SEEDREAM_VACCOUNT_EXPIRY_CHECK_INTERVAL="1m"
```

Append to `go-server/.env.production` with same keys but production base URL:

```
# ─── Seedream API (Phase 2+) ───
SEEDREAM_API_BASE="https://api.seedreamapi.kr"
SEEDREAM_API_KEY=""
SEEDREAM_WEBHOOK_SECRET=""
SEEDREAM_CALLER_ID="seedreamgift-prod"
SEEDREAM_RECONCILE_INTERVAL="10m"
SEEDREAM_VACCOUNT_EXPIRY_CHECK_INTERVAL="1m"
```

### - [ ] Step 3: 빌드 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go build ./...
```

Expected: 에러 없이 성공.

### - [ ] Step 4: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/config/config.go go-server/.env go-server/.env.production
git commit -m "feat(config): add Seedream API env fields (key, base, webhook secret, cron intervals)"
```

---

## Task 6: VAccountService.Issue 오케스트레이션

**Files:**
- Create: `go-server/internal/app/services/vaccount_svc.go`
- Create: `go-server/internal/app/services/vaccount_svc_test.go`

### - [ ] Step 1: 테스트 작성

`go-server/internal/app/services/vaccount_svc_test.go`:

```go
package services

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// seedreamClientStub 는 테스트용 Seedream Client 대역입니다.
type seedreamClientStub struct {
	issueFn func(context.Context, seedream.VAccountIssueRequest, string, string) (*seedream.VAccountIssueResponse, error)
}

func (s *seedreamClientStub) IssueVAccount(
	ctx context.Context,
	req seedream.VAccountIssueRequest,
	idem, trace string,
) (*seedream.VAccountIssueResponse, error) {
	return s.issueFn(ctx, req, idem, trace)
}

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&domain.Order{}, &domain.Payment{}, &domain.User{}, &domain.OrderItem{}))
	return db
}

func seedOrder(t *testing.T, db *gorm.DB, status string) *domain.Order {
	t.Helper()
	code := "ORD-TEST-1"
	o := &domain.Order{
		UserID: 42, Status: status, Source: "USER",
		TotalAmount: domain.NewNumericDecimal(decimal.NewFromInt(50000)),
		OrderCode:   &code,
	}
	require.NoError(t, db.Create(o).Error)
	return o
}

func TestVAccountService_Issue_Success(t *testing.T) {
	db := setupTestDB(t)
	order := seedOrder(t, db, "PENDING")

	stub := &seedreamClientStub{
		issueFn: func(ctx context.Context, req seedream.VAccountIssueRequest, idem, trace string) (*seedream.VAccountIssueResponse, error) {
			// RESERVED 왕복은 호출자가 검증하므로 stub 도 올바른 값을 반환
			return &seedream.VAccountIssueResponse{
				ID: 102847, OrderNo: req.OrderNo, Amount: req.Amount,
				Status: "PENDING", Phase: "awaiting_bank_selection",
				TargetURL: "https://testpg.kiwoompay.co.kr/x",
				FormData:  map[string]string{"TOKEN": "t-1"},
				ReservedIndex1: req.ReservedIndex1, ReservedIndex2: req.ReservedIndex2, ReservedString: req.ReservedString,
				DepositEndDate:   req.DepositEndDate,
				DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
			}, nil
		},
	}

	svc := NewVAccountService(db, stub, zap.NewNop())
	caller := CallerContext{UserID: 42, Role: "USER", TraceID: "trace-t1"}

	result, err := svc.Issue(context.Background(), caller, order.ID, "P")
	require.NoError(t, err)
	assert.Equal(t, "https://testpg.kiwoompay.co.kr/x", result.TargetURL)
	assert.Equal(t, "t-1", result.FormData["TOKEN"])
	assert.Equal(t, int64(102847), result.SeedreamVAccountID)

	// Payment 레코드 생성 확인
	var payments []domain.Payment
	require.NoError(t, db.Where("OrderId = ?", order.ID).Find(&payments).Error)
	require.Len(t, payments, 1)
	assert.Equal(t, "PENDING", payments[0].Status)
	require.NotNil(t, payments[0].SeedreamPhase)
	assert.Equal(t, "awaiting_bank_selection", *payments[0].SeedreamPhase)
	require.NotNil(t, payments[0].SeedreamVAccountID)
	assert.Equal(t, int64(102847), *payments[0].SeedreamVAccountID)
	require.NotNil(t, payments[0].SeedreamIdempotencyKey)
	assert.Equal(t, "gift:vaccount:ORD-TEST-1", *payments[0].SeedreamIdempotencyKey)

	// TOKEN 이 DB 에 저장되지 않았는지 확인 (설계 D5)
	// (Payment 엔티티에 FormData 저장 칼럼이 없으므로 구조적으로 불가능)
}

func TestVAccountService_Issue_OwnershipUser(t *testing.T) {
	db := setupTestDB(t)
	order := seedOrder(t, db, "PENDING")

	stub := &seedreamClientStub{issueFn: func(context.Context, seedream.VAccountIssueRequest, string, string) (*seedream.VAccountIssueResponse, error) {
		t.Fatal("should not be called on ownership failure")
		return nil, nil
	}}

	svc := NewVAccountService(db, stub, zap.NewNop())
	// UserID 불일치
	caller := CallerContext{UserID: 99, Role: "USER"}
	_, err := svc.Issue(context.Background(), caller, order.ID, "P")
	assert.Error(t, err)
	assert.Contains(t, strings.ToLower(err.Error()), "권한")
}

func TestVAccountService_Issue_WrongOrderStatus(t *testing.T) {
	db := setupTestDB(t)
	order := seedOrder(t, db, "PAID")

	stub := &seedreamClientStub{issueFn: func(context.Context, seedream.VAccountIssueRequest, string, string) (*seedream.VAccountIssueResponse, error) {
		t.Fatal("should not be called")
		return nil, nil
	}}

	svc := NewVAccountService(db, stub, zap.NewNop())
	caller := CallerContext{UserID: 42, Role: "USER"}
	_, err := svc.Issue(context.Background(), caller, order.ID, "P")
	assert.Error(t, err)
}

func TestVAccountService_Issue_ReservedRoundTripViolation(t *testing.T) {
	db := setupTestDB(t)
	order := seedOrder(t, db, "PENDING")

	stub := &seedreamClientStub{
		issueFn: func(ctx context.Context, req seedream.VAccountIssueRequest, idem, trace string) (*seedream.VAccountIssueResponse, error) {
			// Seedream 회귀 버그 시나리오: 잘못된 reservedIndex1 반환
			return &seedream.VAccountIssueResponse{
				ID: 1, OrderNo: req.OrderNo, Status: "PENDING", Phase: "awaiting_bank_selection",
				TargetURL:      "https://x",
				ReservedIndex1: "WRONG_VALUE", // ← 위반
				ReservedIndex2: req.ReservedIndex2,
				ReservedString: req.ReservedString,
				DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
			}, nil
		},
	}

	svc := NewVAccountService(db, stub, zap.NewNop())
	caller := CallerContext{UserID: 42, Role: "USER"}
	_, err := svc.Issue(context.Background(), caller, order.ID, "P")

	require.Error(t, err)
	assert.True(t, errors.Is(err, seedream.ErrReservedRoundTripViolation))
}
```

### - [ ] Step 2: 컴파일 실패 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/app/services/ -run TestVAccountService -v
```

Expected: `NewVAccountService`, `CallerContext` undefined 컴파일 에러.

### - [ ] Step 3: 구현

`go-server/internal/app/services/vaccount_svc.go`:

```go
package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"
	"seedream-gift-server/pkg/apperror"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// kstLoc 는 Asia/Seoul 로케이션 캐시 (OS tzdata 부재 시 fixed offset fallback).
var kstLoc = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Seoul")
	if err != nil {
		return time.FixedZone("KST", 9*60*60)
	}
	return loc
}()

// CallerContext 는 3계층 권한 경계 강제용 호출자 정보입니다.
// handler 에서 구성해 service 에 전달.
type CallerContext struct {
	UserID    int     // 로그인된 유저 ID
	Role      string  // "USER" | "PARTNER" | "ADMIN"
	PartnerID *string // Role=="PARTNER" 일 때만 세팅
	TraceID   string  // 양측 로그 조인용
}

// seedreamIssuer 는 테스트 대역 가능성을 위한 최소 인터페이스입니다.
type seedreamIssuer interface {
	IssueVAccount(ctx context.Context, req seedream.VAccountIssueRequest, idempotencyKey, traceID string) (*seedream.VAccountIssueResponse, error)
}

// VAccountService 는 Seedream VA 발급/취소/환불 오케스트레이션을 담당합니다.
// Phase 2 에서는 Issue 만 구현 — Cancel/Refund 는 Phase 4.
type VAccountService struct {
	db     *gorm.DB
	client seedreamIssuer
	logger *zap.Logger
}

// NewVAccountService 는 VAccountService 를 생성합니다.
func NewVAccountService(db *gorm.DB, client seedreamIssuer, logger *zap.Logger) *VAccountService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &VAccountService{db: db, client: client, logger: logger}
}

// IssueResult 는 Issue 성공 시 handler 에 반환되는 구조입니다.
type IssueResult struct {
	SeedreamVAccountID int64             `json:"seedreamVAccountId"`
	TargetURL          string            `json:"targetUrl"`
	FormData           map[string]string `json:"formData"`
	DepositEndDateAt   time.Time         `json:"depositEndDateAt"`
	OrderCode          string            `json:"orderCode"`
}

// Issue 는 주문에 대해 Seedream LINK 모드 VA 발급을 요청합니다.
func (s *VAccountService) Issue(
	ctx context.Context,
	caller CallerContext,
	orderID int,
	deviceType string, // "P" | "M"
) (*IssueResult, error) {
	// 1) 주문 로드 + 소유권 검증
	var order domain.Order
	if err := s.db.WithContext(ctx).First(&order, orderID).Error; err != nil {
		return nil, apperror.NotFound("주문을 찾을 수 없습니다")
	}
	if err := checkOrderOwnership(caller, &order); err != nil {
		return nil, err
	}

	// 2) 상태 검증
	if order.Status != domain.OrderStatusPending {
		return nil, apperror.Validation(fmt.Sprintf("현재 주문 상태(%s)에서는 결제를 시작할 수 없습니다", order.Status))
	}
	if order.OrderCode == nil || *order.OrderCode == "" {
		return nil, apperror.Internal("주문 코드가 비어있습니다", nil)
	}

	// 3) 중복 발급 방지 — 같은 주문에 PENDING Payment 이미 있으면 재발급 안 함
	var existing domain.Payment
	err := s.db.WithContext(ctx).Where("OrderId = ? AND Status = 'PENDING'", orderID).First(&existing).Error
	if err == nil {
		return nil, apperror.Conflict("이미 결제가 진행 중입니다")
	}

	// 4) reservedIndex2 계산
	reservedIndex2, err := seedream.ReservedIndex2For(caller.Role, caller.PartnerID)
	if err != nil {
		return nil, apperror.Validation(err.Error())
	}

	// 5) depositEndDate = now + 30min (KST, YYYYMMDDhhmmss)
	depositEndDate := time.Now().In(kstLoc).Add(30 * time.Minute).Format("20060102150405")

	// 6) Idempotency-Key = "gift:vaccount:{OrderCode}"
	idempotencyKey := fmt.Sprintf("gift:vaccount:%s", *order.OrderCode)

	// 7) Seedream 호출
	req := seedream.VAccountIssueRequest{
		OrderNo:        *order.OrderCode,
		Amount:         order.TotalAmount.Decimal.IntPart(),
		ProductName:    "상품권 주문 " + *order.OrderCode, // 추후 상품별 맞춤 네임 (Phase 4+)
		Type:           deviceType,
		IssueMode:      seedream.IssueModeLink,
		ProductType:    seedream.ProductTypeFixed,
		BillType:       seedream.BillTypeFixed,
		ReservedIndex1: seedream.ReservedIndex1Fixed,
		ReservedIndex2: reservedIndex2,
		ReservedString: seedream.ReservedStringFixed,
		DepositEndDate: depositEndDate,
	}
	resp, err := s.client.IssueVAccount(ctx, req, idempotencyKey, caller.TraceID)
	if err != nil {
		return nil, err
	}

	// 8) RESERVED 왕복 검증 — 위반 시 Seedream 회귀 버그, Ops 에스컬레이션
	if err := seedream.AssertReservedInvariant(reservedIndex2, seedream.ReservedFields{
		ReservedIndex1: resp.ReservedIndex1,
		ReservedIndex2: resp.ReservedIndex2,
		ReservedString: resp.ReservedString,
	}); err != nil {
		s.logger.Error("seedream RESERVED 왕복 위반",
			zap.String("orderCode", *order.OrderCode),
			zap.String("traceId", caller.TraceID),
			zap.Error(err))
		return nil, err // sentinel 포함
	}

	// 9) Payment 레코드 생성 — 트랜잭션 안에서 Order.PaymentDeadlineAt 도 업데이트
	phase := resp.Phase
	vaID := resp.ID
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		p := &domain.Payment{
			OrderID:                orderID,
			Method:                 "VIRTUAL_ACCOUNT_SEEDREAM",
			Amount:                 order.TotalAmount,
			Status:                 "PENDING",
			SeedreamVAccountID:     &vaID,
			SeedreamPhase:          &phase,
			SeedreamIdempotencyKey: &idempotencyKey,
			ExpiresAt:              &resp.DepositEndDateAt,
		}
		if err := tx.Create(p).Error; err != nil {
			return err
		}
		// Order.PaymentDeadlineAt 업데이트 (Status 는 PENDING 유지)
		return tx.Model(&order).Update("PaymentDeadlineAt", resp.DepositEndDateAt).Error
	})
	if err != nil {
		return nil, fmt.Errorf("payment insert: %w", err)
	}

	return &IssueResult{
		SeedreamVAccountID: resp.ID,
		TargetURL:          resp.TargetURL,
		FormData:           resp.FormData,
		DepositEndDateAt:   resp.DepositEndDateAt,
		OrderCode:          *order.OrderCode,
	}, nil
}

// checkOrderOwnership 은 3계층 소유권 경계를 강제합니다.
func checkOrderOwnership(caller CallerContext, order *domain.Order) error {
	switch caller.Role {
	case "ADMIN":
		return nil // 전수 허용
	case "PARTNER":
		if caller.PartnerID == nil {
			return apperror.Forbidden("파트너 ID가 필요합니다")
		}
		// TODO(Phase 4): Order 에 PartnerID 필드가 없는 경우 reservedIndex2 기반 조회 필요.
		// 현 시점엔 PARTNER 발급 경로 사용 여부 미확정 — 안전하게 거부.
		return apperror.Forbidden("PARTNER 발급은 Phase 4 에서 지원합니다")
	case "USER":
		if order.UserID != caller.UserID {
			return apperror.Forbidden("주문에 대한 접근 권한이 없습니다")
		}
		return nil
	default:
		return apperror.Forbidden("알 수 없는 호출자 권한: " + caller.Role)
	}
}

// _ 는 errors.Is 링크를 유지하기 위한 placeholder (현재 사용 없음)
var _ = errors.New
```

### - [ ] Step 4: sqlite 테스트 드라이버 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && grep "gorm.io/driver/sqlite" go.mod
```

만약 없으면:
```bash
cd D:/dev/SeedreamGift/go-server && go get gorm.io/driver/sqlite
```

### - [ ] Step 5: 테스트 통과 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/app/services/ -run TestVAccountService -count=1 -v
```

Expected: 4 케이스 모두 PASS.

### - [ ] Step 6: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/app/services/vaccount_svc.go go-server/internal/app/services/vaccount_svc_test.go go-server/go.mod go-server/go.sum
git commit -m "feat(services): add VAccountService.Issue orchestration with ownership + RESERVED check"
```

---

## Task 7: HTTP 핸들러 + 라우트 등록

**Files:**
- Create: `go-server/internal/api/handlers/vaccount_handler.go`
- Modify: `go-server/internal/routes/container.go` (DI 추가)
- Modify: `go-server/internal/routes/protected.go` (핸들러 swap)

### - [ ] Step 1: 핸들러 작성

`go-server/internal/api/handlers/vaccount_handler.go`:

```go
package handlers

import (
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/response"
	"strings"

	"github.com/gin-gonic/gin"
)

// VAccountHandler 는 Seedream VA 결제 관련 HTTP 요청을 처리합니다.
type VAccountHandler struct {
	service *services.VAccountService
}

func NewVAccountHandler(svc *services.VAccountService) *VAccountHandler {
	return &VAccountHandler{service: svc}
}

// InitiateRequest 는 POST /payments/initiate 요청 바디.
type InitiateRequest struct {
	OrderID    int    `json:"orderId" binding:"required"`
	ClientType string `json:"clientType" binding:"required,oneof=P M"` // P=PC, M=Mobile
}

// Initiate 은 주문 ID 로 Seedream VA 발급을 시작합니다.
//
// POST /api/v1/payments/initiate
func (h *VAccountHandler) Initiate(c *gin.Context) {
	var req InitiateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	caller := callerContextFromGin(c)
	res, err := h.service.Issue(c.Request.Context(), caller, req.OrderID, req.ClientType)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// callerContextFromGin 은 Gin context 에서 CallerContext 를 추출합니다.
// JWT middleware 가 userId, userRole 을 세팅해 둠.
func callerContextFromGin(c *gin.Context) services.CallerContext {
	caller := services.CallerContext{
		UserID:  c.GetInt("userId"),
		Role:    strings.ToUpper(c.GetString("userRole")),
		TraceID: c.GetHeader("X-Trace-Id"),
	}
	if pid := c.GetString("partnerId"); pid != "" {
		caller.PartnerID = &pid
	}
	if caller.TraceID == "" {
		// 없으면 요청 ID 로 대체 (X-Request-ID 미들웨어가 생성한 값)
		caller.TraceID = c.GetString("requestId")
	}
	return caller
}
```

### - [ ] Step 2: 컨테이너 DI 추가

Modify `go-server/internal/routes/container.go`. Find the Handlers struct, add:

```go
// VAccount (Seedream LINK 모드 결제)
VAccount *handlers.VAccountHandler
```

In `NewHandlers`, after `paymentService := services.NewPaymentService(...)`, add Seedream Client + VAccountService construction:

```go
// Seedream REST Client (Phase 2)
seedreamClient := seedream.New(seedream.ClientConfig{
	BaseURL: cfg.SeedreamAPIBase,
	APIKey:  cfg.SeedreamAPIKey,
	Timeout: 10 * time.Second,
}, httpPool.Register(resilience.HTTPClientConfig{
	Name: "seedream", MaxConnsPerHost: 10, Timeout: 10 * time.Second,
}), nil, logger.Log)

vaccountService := services.NewVAccountService(db, seedreamClient, logger.Log)
```

Import `seedream-gift-server/internal/infra/seedream` at top of container.go.

Add to the returned Handlers struct:
```go
VAccount: handlers.NewVAccountHandler(vaccountService),
```

### - [ ] Step 3: 라우트 swap

Modify `go-server/internal/routes/protected.go`. Find the `/payments` group and replace:

Before:
```go
payments := consumer.Group("/payments")
{
    payments.POST("/initiate", middleware.EndpointRateLimit(10, time.Minute), h.Payment.InitiatePayment)
    payments.GET("/verify", h.Payment.VerifyPayment)
}
```

After:
```go
payments := consumer.Group("/payments")
{
    // Seedream LINK 모드 VA 발급 (Phase 2).
    // 구 /verify 엔드포인트는 Seedream 2단계 비동기 모델에 맞지 않아 Phase 2 에서 제거.
    payments.POST("/initiate", middleware.EndpointRateLimit(10, time.Minute), h.VAccount.Initiate)
}
```

### - [ ] Step 4: 빌드 확인

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go build ./...
```

Expected: 성공.

### - [ ] Step 5: 전체 go test

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go test ./internal/infra/seedream/... ./internal/app/services/... -count=1
```

Expected: 모든 seedream + VAccountService 테스트 PASS. (기존 사전 존재 KYC 관련 실패는 Phase 1 때와 동일하게 무관.)

### - [ ] Step 6: Commit

```bash
cd D:/dev/SeedreamGift
git add go-server/internal/api/handlers/vaccount_handler.go go-server/internal/routes/container.go go-server/internal/routes/protected.go
git commit -m "feat(api): add POST /payments/initiate handler + DI wiring (Seedream VA)

Replaces legacy mock /payments/initiate and removes /payments/verify
(Seedream's 2-stage async model has no post-redirect verify step)."
```

---

## Task 8: Generated API Client 재생성

**Files:** (auto-generated — don't hand-edit)
- `client/src/api/generated/*` (re-generated from Swagger)
- `admin/src/api/generated/*`

### - [ ] Step 1: Go 서버 swagger spec 재생성 여부 확인

`go-server` 의 Swagger 스펙 생성 설정 확인:
```bash
cd D:/dev/SeedreamGift/go-server && ls docs/swagger* 2>/dev/null && grep -n "swag\|swagger" main.go | head -5
```

Swagger docs 가 `docs/` 에 있는 경우 regenerate:
```bash
cd D:/dev/SeedreamGift/go-server && swag init -g main.go -o docs 2>&1 | head -10
```

(swag CLI 필요: `go install github.com/swaggo/swag/cmd/swag@latest`)

### - [ ] Step 2: 클라이언트 generate

Run:
```bash
cd D:/dev/SeedreamGift && pnpm api:generate 2>&1 | tail -20
```

Expected: 성공 메시지 + `client/src/api/generated/api/payments-api.ts` 업데이트.

### - [ ] Step 3: 변경 확인

```bash
cd D:/dev/SeedreamGift && git diff --stat client/src/api/generated/ admin/src/api/generated/ 2>&1 | head -15
```

Expected: `payments-api.ts` 가 새 InitiateRequest / IssueResult 스키마 반영.

### - [ ] Step 4: Commit

```bash
cd D:/dev/SeedreamGift
git add client/src/api/generated/ admin/src/api/generated/ go-server/docs/
git commit -m "chore(api): regenerate OpenAPI clients for Seedream payments/initiate"
```

---

## Task 9: useInitiatePayment React Query mutation

**Files:**
- Create: `client/src/hooks/mutations/useInitiatePayment.ts`
- Modify: `client/src/hooks/index.ts` (export)

### - [ ] Step 1: Hook 작성

`client/src/hooks/mutations/useInitiatePayment.ts`:

```typescript
import { useMutation } from '@tanstack/react-query';
import { paymentsApi } from '../../api';

export interface InitiatePaymentParams {
  orderId: number;
  clientType: 'P' | 'M';
}

export interface InitiatePaymentResult {
  seedreamVAccountId: number;
  targetUrl: string;
  formData: Record<string, string>;
  depositEndDateAt: string;
  orderCode: string;
}

/**
 * Seedream VA 발급을 시작하는 mutation.
 *
 * 성공 시 반환되는 targetUrl + formData 를 HTML auto-submit form 으로 렌더하여
 * 고객 브라우저를 키움페이 은행선택 창으로 이동시켜야 합니다.
 * formData.TOKEN 은 1회용 세션 토큰이므로 UI 상태나 로컬 스토리지에 저장 금지.
 */
export const useInitiatePayment = () => {
  return useMutation<InitiatePaymentResult, Error, InitiatePaymentParams>({
    mutationFn: async (params) => {
      const response = await paymentsApi.paymentsInitiatePost({
        body: { orderId: params.orderId, clientType: params.clientType } as any,
      });
      return response.data as unknown as InitiatePaymentResult;
    },
  });
};
```

### - [ ] Step 2: export 추가

Add to `client/src/hooks/index.ts`:
```typescript
export * from './mutations/useInitiatePayment';
```

### - [ ] Step 3: 타입 체크

```bash
cd D:/dev/SeedreamGift/client && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음 (generated API 에 method 존재 가정).

### - [ ] Step 4: Commit

```bash
cd D:/dev/SeedreamGift
git add client/src/hooks/mutations/useInitiatePayment.ts client/src/hooks/index.ts
git commit -m "feat(client): add useInitiatePayment React Query mutation"
```

---

## Task 10: `/checkout/redirect` auto-submit 페이지

**Files:**
- Create: `client/src/pages/CheckoutRedirect.tsx`
- Modify: `client/src/App.tsx` (라우트 등록)

### - [ ] Step 1: 페이지 컴포넌트 작성

`client/src/pages/CheckoutRedirect.tsx`:

```typescript
import React, { useEffect, useRef } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import SEO from '../components/common/SEO';

/**
 * @page CheckoutRedirect
 * @description Seedream 발급 응답의 targetUrl + formData 를 HTML form 으로 렌더하여
 *              고객 브라우저를 키움페이 은행선택 창으로 자동 submit 합니다.
 *
 * 전제: CheckoutPage 에서 navigate('/checkout/redirect', { state: { targetUrl, formData, orderCode } }) 로 진입.
 *
 * ★ 보안:
 *  - formData.TOKEN 은 절대 localStorage / sessionStorage / URL query 에 저장 금지.
 *  - 페이지 리로드 시 state 가 사라지므로 주문 상세 페이지로 fallback.
 *  - form submit 후 뒤로가기 방지를 위해 history.replace 로 이동.
 */
const CheckoutRedirect: React.FC = () => {
  const location = useLocation();
  const formRef = useRef<HTMLFormElement>(null);
  const state = location.state as {
    targetUrl?: string;
    formData?: Record<string, string>;
    orderCode?: string;
  } | null;

  useEffect(() => {
    if (formRef.current && state?.targetUrl) {
      // 살짝 지연시켜 렌더링 완료 후 submit.
      const t = setTimeout(() => formRef.current?.submit(), 50);
      return () => clearTimeout(t);
    }
  }, [state]);

  // state 없이 직접 진입하면 홈으로 fallback.
  if (!state?.targetUrl || !state?.formData) {
    return <Navigate to="/" replace />;
  }

  const { targetUrl, formData, orderCode } = state;

  return (
    <>
      <SEO title="결제 진행 중" />
      <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <div role="status" aria-live="polite">
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>결제창으로 이동 중입니다</h1>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            주문번호 {orderCode}
            <br />
            자동으로 전환되지 않으면 아래 버튼을 눌러주세요.
          </p>
        </div>
        <form ref={formRef} method="POST" action={targetUrl} style={{ marginTop: '1.5rem' }}>
          {Object.entries(formData).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <button
            type="submit"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            결제창 열기
          </button>
        </form>
      </div>
    </>
  );
};

export default CheckoutRedirect;
```

### - [ ] Step 2: 라우트 등록

Modify `client/src/App.tsx`. Find the `<Routes>` block and add (after the existing checkout route):

```typescript
const CheckoutRedirect = lazy(() => import('./pages/CheckoutRedirect'));

// ... inside <Routes>:
<Route path="/checkout/redirect" element={
  <ProtectedRoute>
    <Suspense fallback={<LoadingSpinner />}>
      <CheckoutRedirect />
    </Suspense>
  </ProtectedRoute>
} />
```

(Preserve exact ProtectedRoute / Suspense pattern from surrounding routes.)

### - [ ] Step 3: 타입 체크

```bash
cd D:/dev/SeedreamGift/client && pnpm tsc --noEmit 2>&1 | head -10
```

Expected: 에러 없음.

### - [ ] Step 4: Commit

```bash
cd D:/dev/SeedreamGift
git add client/src/pages/CheckoutRedirect.tsx client/src/App.tsx
git commit -m "feat(client): add /checkout/redirect auto-submit page for Seedream"
```

---

## Task 11: CheckoutPage 통합 — VA 주문 생성 후 initiate 호출

**Files:**
- Modify: `client/src/pages/CheckoutPage.hooks.ts`

### - [ ] Step 1: checkout hook 수정

`client/src/pages/CheckoutPage.hooks.ts` 의 `createOrderMutation.mutate` 성공 콜백을 수정. 주문 `paymentMethod === 'VIRTUAL_ACCOUNT'` 인 경우 initiate 후 redirect 페이지로 이동.

Find the `onSuccess` block (around line 183~205 based on prior grep) and augment. Exact surrounding code will be provided once reader opens the file — use the following pattern:

Pattern (인라인에서 정확한 위치는 각자 확인):

```typescript
import { useNavigate } from 'react-router-dom';
import { useCart, useCreateOrder, useBankInfo, useInitiatePayment } from '../hooks';

// inside component
const navigate = useNavigate();
const initiatePaymentMutation = useInitiatePayment();

// in createOrderMutation.mutate success callback:
createOrderMutation.mutate(
  { /* ... existing params */ },
  {
    onSuccess: (orderResult) => {
      if (paymentMethod === 'VIRTUAL_ACCOUNT') {
        // Seedream VA 경로: initiate 호출 후 /checkout/redirect 로 auto-submit.
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        initiatePaymentMutation.mutate(
          { orderId: orderResult.order.id, clientType: isMobile ? 'M' : 'P' },
          {
            onSuccess: (ip) => {
              navigate('/checkout/redirect', {
                state: {
                  targetUrl: ip.targetUrl,
                  formData: ip.formData,
                  orderCode: ip.orderCode,
                },
                replace: true,
              });
            },
            onError: (err) => {
              showToast('결제창 연결에 실패했습니다: ' + (err as Error).message, 'error');
              submitLockRef.current = false;
            },
          }
        );
        return;
      }
      // 기존 비-VA 플로우 그대로 유지 (CASH 등)
      /* ... existing onSuccess body */
    },
    /* ... existing onError */
  }
);
```

**IMPORTANT**: Preserve all non-VA flow logic untouched. Only add the VA branch.

### - [ ] Step 2: 타입 체크

```bash
cd D:/dev/SeedreamGift/client && pnpm tsc --noEmit 2>&1 | head -15
```

Expected: 에러 없음.

### - [ ] Step 3: Commit

```bash
cd D:/dev/SeedreamGift
git add client/src/pages/CheckoutPage.hooks.ts
git commit -m "feat(client): integrate Seedream VA redirect into CheckoutPage flow"
```

---

## Task 12: TEST 환경 E2E 검증 (사용자 수동 단계)

**Files:** 없음 — 운영/검증 단계

### - [ ] Step 1: 사전 준비 확인

- [ ] `go-server/.env` 의 `SEEDREAM_API_KEY` 가 TEST 용 실 값으로 채워져 있는지 확인 (Ops 로부터 받아 저장)
- [ ] Seedream Ops 에 상품권 사이트 아웃바운드 IP 가 whitelist 되어 있는지 확인 (또는 whitelist 비어있음 확인)

### - [ ] Step 2: 서버 기동

Run:
```bash
cd D:/dev/SeedreamGift/go-server && go run . 2>&1 | tee /tmp/seedream-phase2-server.log
```

Expected: Gin 서버 로그 `Listening on :5140` 또는 설정된 포트.

### - [ ] Step 3: 클라이언트 기동

새 터미널:
```bash
cd D:/dev/SeedreamGift && pnpm dev:client
```

Expected: Vite `Local: http://localhost:5173`.

### - [ ] Step 4: 수동 E2E 플로우

브라우저에서:
1. `http://localhost:5173` 접속 후 로그인
2. 아무 상품 장바구니 추가 → `/checkout`
3. 결제수단 `가상계좌` 선택
4. `주문하기` 클릭
5. **기대 결과**:
   - `/checkout/redirect` 로 자동 이동
   - "결제창으로 이동 중입니다" 표시 후 수백 ms 내 form auto-submit
   - 브라우저가 `https://testpg.kiwoompay.co.kr/...` 로 이동
   - 키움페이 은행선택 창이 표시됨 (9개 은행 리스트)

### - [ ] Step 5: 서버 로그 검증

서버 로그 (`/tmp/seedream-phase2-server.log`) 에서 확인:
- `seedream issue` 로그 엔트리 존재
- `status=200 success=true`
- `errorCode` 비어있음
- `traceId` 값 기록됨
- 응답 시간 (latencyMs) 10000ms 미만

DB 확인 (Server C):
```sql
SELECT TOP 1 * FROM Payments ORDER BY Id DESC;
```
- `SeedreamVAccountId` 채워져 있음
- `SeedreamPhase` = `'awaiting_bank_selection'`
- `SeedreamIdempotencyKey` 형식 `gift:vaccount:{OrderCode}`
- `Method` = `'VIRTUAL_ACCOUNT_SEEDREAM'`

### - [ ] Step 6: 실패 시나리오 문서화

- API Key 누락 → 401 UNAUTHORIZED — handler 가 `response.HandleError` 로 적절히 래핑
- RESERVED 왕복 위반 (테스트 서버가 잘못 반환) → 로그에 `RESERVED 왕복 위반` 엔트리 + Ops 에스컬레이션
- Rate limit 429 → 클라이언트가 재시도 안내

### - [ ] Step 7: Phase 2 완료 empty commit

```bash
cd D:/dev/SeedreamGift
git commit --allow-empty -m "chore(phase-2): Seedream client + issue flow complete

Verified:
- seedream.Client.IssueVAccount with httpmock (success, error mapping,
  timeout, missing idem key)
- ReservedIndex2For mapping for USER/PARTNER/ADMIN with 20-char cap
- errorCode → Go sentinel mapping for 16 error codes
- VAccountService.Issue: ownership check, status guard, RESERVED
  invariant, Payment insert + Order.PaymentDeadlineAt update
- POST /api/v1/payments/initiate handler + JWT-based CallerContext
- Config + .env placeholders for SEEDREAM_* vars
- React Query useInitiatePayment mutation
- /checkout/redirect auto-submit page (form POST to targetUrl)
- CheckoutPage VIRTUAL_ACCOUNT branch → initiate → navigate redirect
- TEST environment E2E: 1건 발급 → 키움페이 은행선택 창 표시 확인

Deferred to Phase 3:
- Webhook receive + HMAC verify + state machine apply
- Bank selection complete → ISSUED transition
- Deposit → PAID transition

Next: Phase 3 — Webhook handler + state machine + Worker dispatch."
```

---

## Self-Review (writer)

**1. Spec 커버리지**: §3.2 데이터 흐름 [T+0] 구간 (Issue → 1차 응답 → 브라우저 리다이렉트), §5 REST Client (IssueVAccount + X-API-Key + Idempotency + Error mapping), §6.1.1 Issue 오케스트레이션, §7.1 /payments/initiate 라우트, §10 Config, §11.1 Frontend 전부 커버. §11.2~11.3 admin/partner UI 변경은 Phase 4 이상으로 연기 (데이터 필드만 Phase 1 에서 추가 완료).

**2. Placeholder 스캔**: "TBD", "TODO" 없음. Task 6 의 `TODO(Phase 4): PARTNER 발급 경로...` 는 의도된 Phase 4 마커.

**3. 타입 일관성**:
- `CallerContext` (services/vaccount_svc.go) ↔ `callerContextFromGin` (vaccount_handler.go) — 필드 이름·타입 일치.
- `IssueResult` 구조 ↔ `InitiatePaymentResult` TypeScript — camelCase JSON 태그 일치.
- `seedream.VAccountIssueResponse.ID int64` ↔ `Payment.SeedreamVAccountID *int64` ↔ DB `SeedreamVAccountId BIGINT` — Phase 1 정렬 유지.

**4. 의존성 순서**: Task 1 types → 2 reserved → 3 errors → 4 client (1·2·3 의존) → 5 config → 6 service (4·5 의존) → 7 handler + routes → 8 API gen → 9 React hook → 10 redirect page → 11 CheckoutPage wiring → 12 TEST E2E. 올바른 선후관계.

**5. Scope check**: 12 task, 모두 하나의 논리적 단위(issue flow)에 수렴. 대안 — Task 9~11 을 "frontend" 로 묶어 1 task 로 할 수도 있으나 각자 독립 파일이라 분리가 리뷰 측면에서 낫다.
