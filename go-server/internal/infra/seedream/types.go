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

	// ── 발급 옵션 (선택) ──
	// BankCode 는 발급 가능한 은행을 콤마구분으로 제한합니다 (예: "088" 또는 "088,004").
	// 빈 문자열이면 키움이 모든 은행에서 발급 가능. (API_QUICKSTART §가상계좌 추가 §229 참조)
	BankCode string `json:"bankCode,omitempty"`

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
// 조회 DTO (§6 GET /api/v1/vaccount)
// ─────────────────────────────────────────────────────────

// VAccountResult 는 GET /api/v1/vaccount 응답 data.items 의 개별 요소.
// 통합 가이드 §6.4 ListPage.Items 와 대응하며, POST /api/v1/vaccount 응답과도
// 구조가 (거의) 동일한 합동 스키마.
//
// Phase/Status 는 string 유지 — 설계 doc 은 named type (Phase/ResultStatus) 을
// 제안하지만 현 코드베이스는 VAccountIssueResponse 도 string 으로 통일. 일관성
// 유지를 위해 동일 방식. 값 검증/전이 규칙은 app/services 레이어 책임.
type VAccountResult struct {
	ID             int64  `json:"id"`
	PartnerID      string `json:"partnerId"`
	ReservedIndex1 string `json:"reservedIndex1,omitempty"`
	ReservedIndex2 string `json:"reservedIndex2,omitempty"`
	ReservedString string `json:"reservedString,omitempty"`

	OrderNo string `json:"orderNo"`
	Amount  int64  `json:"amount"`

	Status string `json:"status"` // PENDING | SUCCESS | FAILED | CANCELLED | AMOUNT_MISMATCH | DEAD_LETTER
	Phase  string `json:"phase"`  // awaiting_bank_selection | awaiting_deposit | completed | cancelled | failed

	TargetURL string            `json:"targetUrl,omitempty"`
	FormData  map[string]string `json:"formData,omitempty"`

	AccountNumber     *string    `json:"accountNumber,omitempty"`
	AccountHolder     *string    `json:"accountHolder,omitempty"`
	BankCode          *string    `json:"bankCode,omitempty"`
	DepositBankCode   *string    `json:"depositBankCode,omitempty"`
	DaouTrx           *string    `json:"daouTrx,omitempty"` // Phase 4 Cancel/Refund trxId 원천
	DepositEndDate    *string    `json:"depositEndDate,omitempty"`
	DepositEndDateAt  *time.Time `json:"depositEndDateAt,omitempty"`
	DepositorName     *string    `json:"depositorName,omitempty"`
	WillDepositorName *string    `json:"willDepositorName,omitempty"`

	ResultCode    *string `json:"resultCode,omitempty"`
	ResultMessage *string `json:"resultMessage,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// VAccountListPage 는 GET /api/v1/vaccount 응답 Envelope 의 Data 필드.
// 통합 가이드 §6.4 ListPage 와 대응.
//
// ★ 필드명 비대칭 주의: 요청 쿼리는 pageSize 지만 응답은 limit.
type VAccountListPage struct {
	Items   []VAccountResult `json:"items"`
	Total   int64            `json:"total"`
	Page    int              `json:"page"`
	Limit   int              `json:"limit"`
	HasMore bool             `json:"hasMore"`
}

// ─────────────────────────────────────────────────────────
// 고정 상수 (§1.2.2 RESERVED 왕복 불변식)
// ─────────────────────────────────────────────────────────

const (
	// ReservedIndex1Fixed — 상품권 사이트 발급건 식별 태그. 변경 불가.
	ReservedIndex1Fixed = "seedreamgift"
	// ReservedStringFixed — 현 시점 고정 "default".
	ReservedStringFixed = "default"

	// IssueModeLink — LINK 모드만 사용 (키움 계약).
	IssueModeLink = "link"
	// ProductTypeFixed — Portal 관례 "2".
	ProductTypeFixed = "2"
	// BillTypeFixed — 일반결제 "1".
	BillTypeFixed = "1"

	// DeviceTypePC / DeviceTypeMobile — 고객 User-Agent 로 분기.
	DeviceTypePC     = "P"
	DeviceTypeMobile = "M"
)
