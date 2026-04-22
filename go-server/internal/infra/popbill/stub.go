package popbill

import (
	"fmt"
	"time"
	"w-gift-server/internal/app/interfaces"
)

// StubCashReceiptProvider는 개발/테스트용 Stub 구현입니다.
type StubCashReceiptProvider struct{}

func NewStubCashReceiptProvider() *StubCashReceiptProvider {
	return &StubCashReceiptProvider{}
}

func (s *StubCashReceiptProvider) Issue(req interfaces.CashReceiptIssueRequest) (*interfaces.CashReceiptIssueResponse, error) {
	return &interfaces.CashReceiptIssueResponse{
		Success:    true,
		ConfirmNum: fmt.Sprintf("STUB-%s", time.Now().Format("20060102150405")),
		TradeDate:  time.Now().Format("20060102"),
	}, nil
}

func (s *StubCashReceiptProvider) Cancel(req interfaces.CashReceiptCancelRequest) (*interfaces.CashReceiptCancelResponse, error) {
	return &interfaces.CashReceiptCancelResponse{
		Success:    true,
		ConfirmNum: fmt.Sprintf("STUB-C-%s", time.Now().Format("20060102150405")),
		TradeDate:  time.Now().Format("20060102"),
	}, nil
}

func (s *StubCashReceiptProvider) GetInfo(mgtKey string) (*interfaces.CashReceiptInfo, error) {
	return &interfaces.CashReceiptInfo{
		MgtKey:     mgtKey,
		ConfirmNum: "STUB-CONFIRM",
		TradeDate:  time.Now().Format("20060102"),
		StateCode:  2,
		StateDT:    time.Now().Format("20060102150405"),
	}, nil
}

func (s *StubCashReceiptProvider) UpdateTransaction(mgtKey string, identityNum string, tradeUsage string) error {
	return nil
}
