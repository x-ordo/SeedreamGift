package services

import (
	"testing"
	"time"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/popbill"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupCashReceiptTestDB는 현금영수증 서비스 테스트용 인메모리 DB와 Stub Provider를 설정합니다.
func setupCashReceiptTestDB() (*CashReceiptService, *popbill.StubCashReceiptProvider) {
	db := setupTestDB()
	db.AutoMigrate(&domain.CashReceipt{}, &domain.Order{}, &domain.Payment{}, &domain.User{})
	stub := popbill.NewStubCashReceiptProvider()
	svc := NewCashReceiptService(db, stub, testEncKey)
	return svc, stub
}

// createTestOrder는 테스트용 주문을 생성합니다.
func createTestOrder(svc *CashReceiptService, userID int, paymentMethod string, status string, opts ...func(*domain.Order)) *domain.Order {
	pm := paymentMethod
	order := &domain.Order{
		UserID:        userID,
		TotalAmount:   domain.NewNumericDecimalFromInt(11000),
		Status:        status,
		PaymentMethod: &pm,
	}
	for _, opt := range opts {
		opt(order)
	}
	svc.db.Create(order)
	return order
}

// ── 헬퍼 함수 단위 테스트 ──

func TestCashReceipt_GenerateMgtKey(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	key := svc.generateMgtKey(42, 1)

	assert.NotEmpty(t, key)
	assert.LessOrEqual(t, len(key), 24, "관리번호는 24자 이하여야 합니다")
	assert.Contains(t, key, "CR-", "관리번호는 CR- 접두사로 시작해야 합니다")
	assert.Contains(t, key, "-00042-", "5자리 주문 ID가 포함되어야 합니다")
	assert.Contains(t, key, "-01", "2자리 시퀀스가 포함되어야 합니다")
}

func TestCashReceipt_SplitAmount(t *testing.T) {
	tests := []struct {
		name       string
		total      int64
		wantSupply int64
		wantTax    int64
	}{
		{
			name:       "11000원 (세금 포함 정확한 금액)",
			total:      11000,
			wantSupply: 10000,
			wantTax:    1000,
		},
		{
			name:       "10000원 (나머지 있음)",
			total:      10000,
			wantSupply: 9091,
			wantTax:    909,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			supply, tax := splitAmount(tt.total)
			assert.Equal(t, tt.wantSupply, supply, "공급가액이 일치해야 합니다")
			assert.Equal(t, tt.wantTax, tax, "부가세가 일치해야 합니다")
			assert.Equal(t, tt.total, supply+tax, "supply + tax = total이어야 합니다")
		})
	}
}

func TestCashReceipt_MapTradeOpt(t *testing.T) {
	tests := []struct {
		identityType string
		want         string
	}{
		{"PHONE", "01"},
		{"BUSINESS_NO", "02"},
		{"CARD_NO", "03"},
		{"UNKNOWN", "01"},
		{"", "01"},
	}

	for _, tt := range tests {
		t.Run(tt.identityType, func(t *testing.T) {
			got := mapTradeOpt(tt.identityType)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestCashReceipt_IsCashEquivalent(t *testing.T) {
	tests := []struct {
		method string
		want   bool
	}{
		{"VIRTUAL_ACCOUNT", true},
		{"BANK_TRANSFER", true},
		{"CASH_CARD", true},
		{"CARD", false},
		{"", false},
		{"KAKAO_PAY", false},
	}

	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			got := isCashEquivalent(tt.method)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestCashReceipt_MaskIdentity(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"01012345678", "010****5678"},
		{"1234", "1234"},
		{"12345", "123**"},
		{"1234567", "123****"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := maskIdentity(tt.input)
			assert.Equal(t, tt.want, got)
		})
	}
}

// ── AutoIssue 테스트 ──

func TestCashReceipt_AutoIssue_WithCustomerInfo(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	user := &domain.User{Email: "cr1@test.com", Password: "hashed", Role: "USER"}
	svc.db.Create(user)

	crType := "PERSONAL"
	crNum := "01012345678"
	pm := "VIRTUAL_ACCOUNT"
	order := &domain.Order{
		UserID:            user.ID,
		TotalAmount:       domain.NewNumericDecimalFromInt(11000),
		Status:            "PAID",
		PaymentMethod:     &pm,
		CashReceiptType:   &crType,
		CashReceiptNumber: &crNum,
	}
	svc.db.Create(order)

	err := svc.AutoIssue(order.ID)
	require.NoError(t, err)

	var receipt domain.CashReceipt
	svc.db.Where("OrderId = ?", order.ID).First(&receipt)

	assert.Equal(t, "ISSUED", receipt.Status)
	assert.False(t, receipt.IsAutoIssued, "고객 정보 제공 시 자진발급이 아니어야 합니다")
	assert.NotNil(t, receipt.ConfirmNum)
	assert.NotNil(t, receipt.IssuedAt)
	assert.Equal(t, "INCOME_DEDUCTION", receipt.Type)
	// 식별번호는 마스킹되어 있어야 함
	assert.Equal(t, "010****5678", receipt.MaskedIdentity)
}

func TestCashReceipt_AutoIssue_SelfIssue(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	user := &domain.User{Email: "cr2@test.com", Password: "hashed", Role: "USER"}
	svc.db.Create(user)

	pm := "BANK_TRANSFER"
	order := &domain.Order{
		UserID:        user.ID,
		TotalAmount:   domain.NewNumericDecimalFromInt(22000),
		Status:        "PAID",
		PaymentMethod: &pm,
		// CashReceiptType, CashReceiptNumber 없음 → 자진발급
	}
	svc.db.Create(order)

	err := svc.AutoIssue(order.ID)
	require.NoError(t, err)

	var receipt domain.CashReceipt
	svc.db.Where("OrderId = ?", order.ID).First(&receipt)

	assert.Equal(t, "ISSUED", receipt.Status)
	assert.True(t, receipt.IsAutoIssued, "자진발급 여부가 true여야 합니다")
	assert.NotNil(t, receipt.ConfirmNum)
	// selfIssueIdentity = "0100001234" (10자리) → 010 + ***+ 1234 = "010***1234"
	assert.Equal(t, "010***1234", receipt.MaskedIdentity)
}

func TestCashReceipt_AutoIssue_SkipNonCashPayment(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	user := &domain.User{Email: "cr3@test.com", Password: "hashed", Role: "USER"}
	svc.db.Create(user)

	pm := "CARD"
	order := &domain.Order{
		UserID:        user.ID,
		TotalAmount:   domain.NewNumericDecimalFromInt(11000),
		Status:        "PAID",
		PaymentMethod: &pm,
	}
	svc.db.Create(order)

	err := svc.AutoIssue(order.ID)
	require.NoError(t, err)

	var count int64
	svc.db.Model(&domain.CashReceipt{}).Where("OrderId = ?", order.ID).Count(&count)
	assert.Equal(t, int64(0), count, "카드 결제는 현금영수증을 생성하지 않아야 합니다")
}

// ── RequestAfterPurchase 테스트 ──

func TestCashReceipt_RequestAfterPurchase_SelfIssuedToReal(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	user := &domain.User{Email: "cr4@test.com", Password: "hashed", Role: "USER"}
	svc.db.Create(user)

	pm := "VIRTUAL_ACCOUNT"
	order := &domain.Order{
		UserID:        user.ID,
		TotalAmount:   domain.NewNumericDecimalFromInt(11000),
		Status:        "PAID",
		PaymentMethod: &pm,
	}
	svc.db.Create(order)

	// 먼저 자진발급 진행
	err := svc.AutoIssue(order.ID)
	require.NoError(t, err)

	var selfReceipt domain.CashReceipt
	svc.db.Where("OrderId = ?", order.ID).First(&selfReceipt)
	assert.True(t, selfReceipt.IsAutoIssued)

	// 사후 신청으로 변경 요청
	result, err := svc.RequestAfterPurchase(user.ID, RequestCashReceiptInput{
		OrderID:        order.ID,
		Type:           "INCOME_DEDUCTION",
		IdentityType:   "PHONE",
		IdentityNumber: "01099998888",
	})

	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.False(t, result.IsAutoIssued, "UpdateTransaction 후 자진발급이 아닌 상태가 되어야 합니다")
	assert.Equal(t, "010****8888", result.MaskedIdentity)
}

func TestCashReceipt_RequestAfterPurchase_Expired(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	user := &domain.User{Email: "cr5@test.com", Password: "hashed", Role: "USER"}
	svc.db.Create(user)

	pm := "VIRTUAL_ACCOUNT"
	// 91일 전 주문으로 설정
	oldTime := time.Now().AddDate(0, 0, -91)
	order := &domain.Order{
		UserID:        user.ID,
		TotalAmount:   domain.NewNumericDecimalFromInt(11000),
		Status:        "PAID",
		PaymentMethod: &pm,
	}
	svc.db.Create(order)
	// 생성 시간을 91일 전으로 강제 업데이트
	svc.db.Model(order).UpdateColumn("CreatedAt", oldTime)

	_, err := svc.RequestAfterPurchase(user.ID, RequestCashReceiptInput{
		OrderID:        order.ID,
		Type:           "INCOME_DEDUCTION",
		IdentityType:   "PHONE",
		IdentityNumber: "01011112222",
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "90일", "90일 초과 오류 메시지가 포함되어야 합니다")
}

func TestCashReceipt_RequestAfterPurchase_NonOwner(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	user := &domain.User{Email: "cr6@test.com", Password: "hashed", Role: "USER"}
	svc.db.Create(user)

	pm := "VIRTUAL_ACCOUNT"
	order := &domain.Order{
		UserID:        user.ID,
		TotalAmount:   domain.NewNumericDecimalFromInt(11000),
		Status:        "PAID",
		PaymentMethod: &pm,
	}
	svc.db.Create(order)

	_, err := svc.RequestAfterPurchase(9999, RequestCashReceiptInput{
		OrderID:        order.ID,
		Type:           "INCOME_DEDUCTION",
		IdentityType:   "PHONE",
		IdentityNumber: "01011112222",
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "권한")
}

func TestCashReceipt_RequestAfterPurchase_NonCashPayment(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	user := &domain.User{Email: "cr7@test.com", Password: "hashed", Role: "USER"}
	svc.db.Create(user)

	pm := "CARD"
	order := &domain.Order{
		UserID:        user.ID,
		TotalAmount:   domain.NewNumericDecimalFromInt(11000),
		Status:        "PAID",
		PaymentMethod: &pm,
	}
	svc.db.Create(order)

	_, err := svc.RequestAfterPurchase(user.ID, RequestCashReceiptInput{
		OrderID:        order.ID,
		Type:           "INCOME_DEDUCTION",
		IdentityType:   "PHONE",
		IdentityNumber: "01011112222",
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "가상계좌")
}
