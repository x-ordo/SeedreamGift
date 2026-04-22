package dto

import (
	"testing"
)

func TestMaskString_BankTxID(t *testing.T) {
	s := "PAY_abc123def456"
	got := maskBankTxID(&s)
	want := "PAY_abc1****"
	if got == nil || *got != want {
		t.Errorf("maskBankTxID(%q) = %v, want %q", s, got, want)
	}
}

func TestMaskString_BankTxID_Short(t *testing.T) {
	s := "PAY"
	got := maskBankTxID(&s)
	want := "****"
	if got == nil || *got != want {
		t.Errorf("maskBankTxID short = %v, want %q", got, want)
	}
}

func TestMaskString_BankTxID_Nil(t *testing.T) {
	if got := maskBankTxID(nil); got != nil {
		t.Errorf("maskBankTxID(nil) = %v, want nil", got)
	}
}

func TestMaskDepositorName(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"홍길동", "홍*"},
		{"John", "J*"},
		{"A", "A*"},
		{"", ""},
	}
	for _, c := range cases {
		in := c.in
		got := maskDepositorName(&in)
		if got == nil || *got != c.want {
			t.Errorf("maskDepositorName(%q) = %v, want %q", c.in, got, c.want)
		}
	}
}

func TestMaskDepositorName_Nil(t *testing.T) {
	if got := maskDepositorName(nil); got != nil {
		t.Errorf("maskDepositorName(nil) = %v, want nil", got)
	}
}

func TestMaskAccountNumber(t *testing.T) {
	s := "110-123-456789"
	got := maskAccountNumber(&s)
	want := "****6789"
	if got == nil || *got != want {
		t.Errorf("maskAccountNumber = %v, want %q", got, want)
	}
}

func TestMaskAccountNumber_Short(t *testing.T) {
	s := "12"
	got := maskAccountNumber(&s)
	want := "****"
	if got == nil || *got != want {
		t.Errorf("maskAccountNumber short = %v, want %q", got, want)
	}
}

func TestMaskPaymentListItem_Partner(t *testing.T) {
	email := "hong@example.com"
	name := "홍길동"
	reason := "잔액부족"
	item := PaymentListItem{
		PaymentID:     1,
		OrderID:       10,
		CustomerName:  &name,
		CustomerEmail: &email,
		FailReason:    &reason,
		Amount:        50000,
		Method:        "CARD",
		Status:        "FAILED",
	}
	masked := MaskPaymentListItemForPartner(item)
	if masked.CustomerName != nil {
		t.Errorf("Partner CustomerName should be nil, got %v", *masked.CustomerName)
	}
	if masked.CustomerEmail != nil {
		t.Errorf("Partner CustomerEmail should be nil, got %v", *masked.CustomerEmail)
	}
	if masked.FailReason != nil {
		t.Errorf("Partner FailReason should be nil, got %v", *masked.FailReason)
	}
	if masked.Amount != 50000 {
		t.Errorf("Partner Amount should be preserved (50000), got %v", masked.Amount)
	}
	if masked.Status != "FAILED" {
		t.Errorf("Partner Status should be preserved (FAILED), got %v", masked.Status)
	}
}

func TestMaskPaymentDetail_Partner(t *testing.T) {
	txID := "PAY_abc123def456"
	depositor := "홍길동"
	account := "110-123-456789"
	reason := "잔액부족"
	d := PaymentDetail{
		BankTxID:            &txID,
		DepositorName:       &depositor,
		AccountNumberMasked: &account,
		FailReason:          &reason,
		Amount:              100000,
	}
	masked := MaskPaymentDetailForPartner(d)
	if masked.BankTxID == nil || *masked.BankTxID != "PAY_abc1****" {
		t.Errorf("BankTxID not masked: %v", masked.BankTxID)
	}
	if masked.DepositorName == nil || *masked.DepositorName != "홍*" {
		t.Errorf("DepositorName not masked: %v", masked.DepositorName)
	}
	if masked.AccountNumberMasked == nil || *masked.AccountNumberMasked != "****6789" {
		t.Errorf("AccountNumber not masked: %v", masked.AccountNumberMasked)
	}
	if masked.FailReason != nil {
		t.Errorf("FailReason should be nil for Partner, got %v", *masked.FailReason)
	}
	if masked.Amount != 100000 {
		t.Errorf("Amount must be preserved")
	}
}
