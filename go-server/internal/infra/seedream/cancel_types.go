package seedream

// CancelPayMethod 는 상품권 시나리오에서 허용되는 2개 값만 강제.
type CancelPayMethod string

const (
	CancelVAccountIssue CancelPayMethod = "VACCOUNT-ISSUECAN" // 입금 전 발급 취소
	CancelBank          CancelPayMethod = "BANK"              // 입금 후 환불
)

// CancelPaymentRequest 는 POST /api/v1/payment/cancel 요청 바디.
// 통합 가이드 §7.3 대칭. taxFreeAmt 필드는 상품권 시나리오 대상 payMethod 에서
// Seedream 이 VALIDATION 차단하므로 본 구조체에 포함하지 않는다.
type CancelPaymentRequest struct {
	PayMethod    CancelPayMethod `json:"payMethod"`
	TrxID        string          `json:"trxId"`
	Amount       int64           `json:"amount"`
	CancelReason string          `json:"cancelReason"`

	// BANK 전용. VACCOUNT-ISSUECAN 에서는 omitempty 로 빠짐.
	BankCode  string `json:"bankCode,omitempty"`
	AccountNo string `json:"accountNo,omitempty"`
}

// CancelResponse 는 /api/v1/payment/cancel 응답 Envelope 의 Data 필드.
// 키움 원본 대문자 필드 그대로. AMOUNT 는 string, CANCELDATE 는 YYYYMMDDhhmmss 원본.
// 통합 가이드 §7.4.3 / §7.5.3 참조.
type CancelResponse struct {
	Token        string `json:"TOKEN"`
	ResultCode   string `json:"RESULTCODE"`
	ErrorMessage string `json:"ERRORMESSAGE"`
	TrxID        string `json:"TRXID"`
	Amount       string `json:"AMOUNT"`
	CancelDate   string `json:"CANCELDATE"`
}
