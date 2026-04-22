// Package interfaces는 애플리케이션 전반에서 사용되는 핵심 인터페이스와 데이터 구조를 정의합니다.
package interfaces

// PaymentVerifyResult는 결제 검증 성공 후의 결과를 나타내는 구조체입니다.
type PaymentVerifyResult struct {
	Success    bool    `json:"success"`    // 성공 여부
	PaymentKey string  `json:"paymentKey"` // PG사 결제 키
	OrderID    int     `json:"orderId"`    // 주문 ID
	Amount     float64 `json:"amount"`     // 결제 금액
	Method     string  `json:"method"`     // 결제 수단 (카드, 가상계좌 등)
}

// PaymentRefundResult는 결제 환불 요청에 대한 결과를 나타내는 구조체입니다.
type PaymentRefundResult struct {
	Success        bool    `json:"success"`        // 성공 여부
	RefundedAmount float64 `json:"refundedAmount"` // 환불된 금액
}

// IPaymentProvider는 결제 제공자(PG사)가 구현해야 하는 표준 인터페이스입니다.
type IPaymentProvider interface {
	// VerifyPayment는 PG사를 통해 결제 정보를 확인하고 승인합니다.
	VerifyPayment(paymentKey string, orderID int, expectedAmount float64) (*PaymentVerifyResult, error)
	// RefundPayment는 기결제된 내역에 대해 환불을 요청합니다.
	RefundPayment(paymentKey string, reason string) (*PaymentRefundResult, error)
}
