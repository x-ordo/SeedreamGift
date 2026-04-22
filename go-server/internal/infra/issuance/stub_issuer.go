package issuance

import (
	"context"
	"fmt"
	"time"
	"w-gift-server/internal/app/interfaces"
)

// StubIssuer는 개발 및 테스트용 발급자입니다.
// 실제 외부 API를 호출하지 않고 더미 PIN을 생성합니다.
type StubIssuer struct{}

func NewStubIssuer() *StubIssuer {
	return &StubIssuer{}
}

func (s *StubIssuer) Issue(_ context.Context, req interfaces.IssueRequest) ([]interfaces.IssuedVoucher, error) {
	vouchers := make([]interfaces.IssuedVoucher, 0, req.Quantity)
	for i := 0; i < req.Quantity; i++ {
		vouchers = append(vouchers, interfaces.IssuedVoucher{
			PinCode:        fmt.Sprintf("STUB-%s-%04d", req.OrderCode, i+1),
			TransactionRef: fmt.Sprintf("STUB-TX-%d-%d", time.Now().UnixMilli(), i),
		})
	}
	return vouchers, nil
}

func (s *StubIssuer) ProviderCode() string { return "STUB" }
