package dto

// maskBankTxID는 PG 결제 키의 앞 8자만 남기고 나머지를 마스킹합니다.
// nil 포인터는 nil로 반환합니다.
func maskBankTxID(s *string) *string {
	if s == nil {
		return nil
	}
	if len(*s) <= 8 {
		r := "****"
		return &r
	}
	r := (*s)[:8] + "****"
	return &r
}

// maskDepositorName은 입금자명의 첫 글자(룬 기준)만 남기고 `*` 하나를 덧붙입니다.
// 한글/영문 모두 첫 문자만 보이도록 rune 단위로 처리합니다.
func maskDepositorName(s *string) *string {
	if s == nil {
		return nil
	}
	if *s == "" {
		empty := ""
		return &empty
	}
	runes := []rune(*s)
	r := string(runes[:1]) + "*"
	return &r
}

// maskAccountNumber는 계좌번호의 뒤 4자리만 남기고 앞을 `****`로 가립니다.
func maskAccountNumber(s *string) *string {
	if s == nil {
		return nil
	}
	if len(*s) <= 4 {
		r := "****"
		return &r
	}
	r := "****" + (*s)[len(*s)-4:]
	return &r
}

// MaskPaymentListItemForPartner는 리스트 응답 1건을 파트너용으로 변환합니다.
// 고객 개인정보와 실패 사유는 제거하고, 결제 금액/상태/일시는 그대로 유지합니다.
func MaskPaymentListItemForPartner(item PaymentListItem) PaymentListItem {
	item.CustomerName = nil
	item.CustomerEmail = nil
	item.FailReason = nil
	return item
}

// MaskPaymentDetailForPartner는 상세 드릴다운 1건을 파트너용으로 변환합니다.
// 민감 필드(BankTxID, DepositorName, AccountNumber)는 포맷 기반 마스킹을 적용하고,
// 식별 가능 개인정보(FailReason)는 제거합니다.
func MaskPaymentDetailForPartner(p PaymentDetail) PaymentDetail {
	p.BankTxID = maskBankTxID(p.BankTxID)
	p.DepositorName = maskDepositorName(p.DepositorName)
	p.AccountNumberMasked = maskAccountNumber(p.AccountNumberMasked)
	p.FailReason = nil
	return p
}
