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
