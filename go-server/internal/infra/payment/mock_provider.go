// Package payment는 다양한 결제 게이트웨이(PG) 연동 구현체를 포함합니다.
package payment

import (
	"seedream-gift-server/internal/app/interfaces"
)

// MockPaymentProvider는 실제 PG사 연동 없이 결제 프로세스를 테스트하기 위한 모의 구현체입니다.
type MockPaymentProvider struct{}

// NewMockPaymentProvider는 새로운 MockPaymentProvider 인스턴스를 생성합니다.
func NewMockPaymentProvider() *MockPaymentProvider {
	return &MockPaymentProvider{}
}

// VerifyPayment는 실제 외부 API 호출 없이 항상 결제 승인 성공 결과를 즉시 반환합니다.
// 로컬 개발 및 통합 테스트 환경에서 결제 흐름을 검증하기 위해 사용됩니다.
func (p *MockPaymentProvider) VerifyPayment(paymentKey string, orderID int, expectedAmount float64) (*interfaces.PaymentVerifyResult, error) {
	// 모의 환경에서는 항상 성공 반환
	return &interfaces.PaymentVerifyResult{
		Success:    true,
		PaymentKey: paymentKey,
		OrderID:    orderID,
		Amount:     expectedAmount,
		Method:     "MOCK_CASH", // 모의 결제 수단 표시
	}, nil
}

// RefundPayment는 실제 환불 처리 없이 항상 환불 성공 결과를 반환합니다.
// 테스트 시 주문 취소 로직의 동작 여부를 확인하는 용도로 사용됩니다.
func (p *MockPaymentProvider) RefundPayment(paymentKey string, reason string) (*interfaces.PaymentRefundResult, error) {
	return &interfaces.PaymentRefundResult{
		Success:        true,
		RefundedAmount: 0, // 실제 구현 시 원본 주문에서 금액을 가져와 기록할 수 있음
	}, nil
}
