// Package payment는 다양한 결제 게이트웨이(PG) 연동 구현체를 포함합니다.
package payment

import (
	"errors"

	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/pkg/logger"

	"go.uber.org/zap"
)

// ErrMockProviderInProduction 은 SafeMode 가 켜진 MockPaymentProvider 가 호출될 때
// 반환되는 sentinel 입니다. 호출자는 errors.Is 로 감지해 운영팀 알람·수동 처리
// 경로로 강제할 수 있습니다.
//
// 의도: 실제 PG/VA 연동이 안 된 상태에서 Mock 이 success 를 반환해 silent
// 데이터 정합성 사고가 나는 것을 차단. P0 검증(2026-04-25)에서 IssuanceLogs
// 환불 행이 0 이라 사고는 없었지만, 카드 직결제 경로가 본격 운영되기 전까진
// 이 가드를 켜둠.
var ErrMockProviderInProduction = errors.New("mock payment provider invoked in safe mode (real PG not configured)")

// MockPaymentProvider는 실제 PG사 연동 없이 결제 프로세스를 테스트하기 위한 모의 구현체입니다.
//
// SafeMode=false (기본): 모든 호출이 success 를 반환. 단위/통합 테스트용.
// SafeMode=true: VerifyPayment / RefundPayment 가 ERROR 로그를 남기고
//                ErrMockProviderInProduction 을 반환. 프로덕션 바이너리에서 카드 결제
//                경로가 우발적으로 호출돼도 silent success 가 안 되도록 차단.
type MockPaymentProvider struct {
	safeMode bool
}

// MockOption 은 MockPaymentProvider 의 functional option 패턴 구성자입니다.
type MockOption func(*MockPaymentProvider)

// WithSafeMode 는 SafeMode 를 활성화합니다.
// main.go 에서 release 빌드 시 적용해 silent success 사고를 차단합니다.
func WithSafeMode() MockOption {
	return func(m *MockPaymentProvider) { m.safeMode = true }
}

// NewMockPaymentProvider는 새로운 MockPaymentProvider 인스턴스를 생성합니다.
// 옵션 없이 호출하면 lenient mode (테스트 친화적) 로 동작합니다.
func NewMockPaymentProvider(opts ...MockOption) *MockPaymentProvider {
	m := &MockPaymentProvider{}
	for _, o := range opts {
		o(m)
	}
	return m
}

// VerifyPayment는 SafeMode=false 면 항상 결제 승인 성공을 반환합니다.
// SafeMode=true 면 ERROR 로그 + ErrMockProviderInProduction 반환 (운영 보호).
func (p *MockPaymentProvider) VerifyPayment(paymentKey string, orderID int, expectedAmount float64) (*interfaces.PaymentVerifyResult, error) {
	if p.safeMode {
		logger.Log.Error("MOCK PROVIDER MISUSE: VerifyPayment called with SafeMode=true — silent payment confirmation 차단",
			zap.String("paymentKey", paymentKey),
			zap.Int("orderId", orderID),
			zap.Float64("expectedAmount", expectedAmount),
		)
		return nil, ErrMockProviderInProduction
	}
	return &interfaces.PaymentVerifyResult{
		Success:    true,
		PaymentKey: paymentKey,
		OrderID:    orderID,
		Amount:     expectedAmount,
		Method:     "MOCK_CASH",
	}, nil
}

// RefundPayment는 SafeMode=false 면 항상 환불 성공을 반환합니다.
// SafeMode=true 면 ERROR 로그 + ErrMockProviderInProduction 반환 — 호출자가
// FAILED_REFUND_PENDING 으로 마킹하고 수동 환불 알람을 발송하도록 강제.
func (p *MockPaymentProvider) RefundPayment(paymentKey string, reason string) (*interfaces.PaymentRefundResult, error) {
	if p.safeMode {
		logger.Log.Error("MOCK PROVIDER MISUSE: RefundPayment called with SafeMode=true — silent refund 차단, 수동 처리 필요",
			zap.String("paymentKey", paymentKey),
			zap.String("reason", reason),
		)
		return nil, ErrMockProviderInProduction
	}
	return &interfaces.PaymentRefundResult{
		Success:        true,
		RefundedAmount: 0,
	}, nil
}
