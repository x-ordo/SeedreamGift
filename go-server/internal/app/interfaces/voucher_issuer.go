package interfaces

import (
	"context"
	"time"
)

// IssuedVoucher는 외부 API에서 발급된 상품권 정보입니다.
type IssuedVoucher struct {
	PinCode        string     // 인증코드 (고객이 사용 시 필요한 비밀 코드)
	SecurityCode   string     // 보안코드 (추가 인증용, 선택)
	GiftNumber     string     // 카드번호 (고객에게 보이는 식별 번호)
	ExpiresAt      *time.Time
	TransactionRef string     // 외부 거래 참조 ID
}

// IssueRequest는 외부 API 발급 요청에 필요한 정보입니다.
type IssueRequest struct {
	ProductCode string // Product.ProviderProductCode 값
	Quantity    int
	OrderCode   string // 우리 주문번호 (멱등성 키)
}

// VoucherIssuer는 외부 상품권 발급 API의 어댑터 인터페이스입니다.
// 새로운 제공업체를 추가할 때 이 인터페이스를 구현합니다.
type VoucherIssuer interface {
	// Issue는 외부 API를 호출하여 상품권을 발급합니다.
	Issue(ctx context.Context, req IssueRequest) ([]IssuedVoucher, error)
	// ProviderCode는 이 발급자의 고유 코드를 반환합니다.
	ProviderCode() string
}
