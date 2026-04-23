package seedream

import "time"

// EventType 은 X-Seedream-Event 헤더 값.
// 오타 방지를 위해 상수로만 비교 (직접 리터럴 금지).
//
// 주의: 스펠링 차이는 의도적 (상위 가이드 §8.2.1).
//   - 미국식(L 한 개): 가맹점(상품권 사이트) 요청으로 발생한 취소
//   - 영국식(L 두 개): 외부(키움/은행) 자동 취소
type EventType string

const (
	// 가맹점(상품권 사이트) 이 직접 호출해서 발생한 이벤트.
	EventVAccountRequested       EventType = "vaccount.requested"
	EventVAccountIssued          EventType = "vaccount.issued"
	EventVAccountDeposited       EventType = "vaccount.deposited"
	EventPaymentCanceled         EventType = "payment.canceled"          // Phase 4
	EventVAccountDepositCanceled EventType = "vaccount.deposit_canceled" // Phase 4

	// 외부 자동 발생.
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
// PaymentCanceledPayload 와 동일 shape (type alias).
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
