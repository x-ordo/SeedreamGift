package services

import (
	"testing"
	"time"

	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/crypto"
	"seedream-gift-server/pkg/pagination"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// stubFraudChecker는 FraudChecker 인터페이스의 테스트 스텁입니다.
type stubFraudChecker struct {
	result *interfaces.FraudCheckResult
	err    error
}

func (s *stubFraudChecker) Check(userID int, source string) (*interfaces.FraudCheckResult, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.result, nil
}

func (s *stubFraudChecker) CheckRealtime(userID int) (*interfaces.FraudCheckResult, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.result, nil
}

// tradeInTestEnv는 TradeIn 테스트에 필요한 공통 환경을 묶은 구조체입니다.
type tradeInTestEnv struct {
	db  *gorm.DB
	cfg *config.Config
	svc *TradeInService
}

// setupTradeInTestDB는 TradeIn 테스트용 인메모리 DB와 서비스를 준비합니다.
func setupTradeInTestDB() *tradeInTestEnv {
	db := setupTestDB()
	db.AutoMigrate(&domain.Brand{}, &domain.Product{}, &domain.TradeIn{})

	cfg := &config.Config{
		EncryptionKey: testEncKey,
	}

	svc := NewTradeInService(db, cfg)

	return &tradeInTestEnv{db: db, cfg: cfg, svc: svc}
}

// createTradeInTestProduct는 매입 가능한 테스트 상품을 생성합니다.
func createTradeInTestProduct(env *tradeInTestEnv, price int64, tradeInRate int64, allowTradeIn bool) *domain.Product {
	// Brand가 없으면 생성
	var brand domain.Brand
	if err := env.db.Where("Code = ?", "TEST").First(&brand).Error; err != nil {
		brand = domain.Brand{Code: "TEST", Name: "테스트 브랜드", IsActive: true}
		env.db.Create(&brand)
	}

	product := &domain.Product{
		BrandCode:    "TEST",
		Name:         "테스트 상품",
		Price:        domain.NewNumericDecimalFromInt(price),
		DiscountRate: domain.NewNumericDecimalFromInt(0),
		BuyPrice:     domain.NewNumericDecimalFromInt(price),
		TradeInRate:  domain.NewNumericDecimalFromInt(tradeInRate),
		AllowTradeIn: allowTradeIn,
		IsActive:     true,
		Type:         "PHYSICAL",
	}
	env.db.Create(product)
	return product
}

// createTradeInTestUser는 KYC 인증된 계좌를 가진 테스트 사용자를 생성합니다.
func createTradeInTestUser(env *tradeInTestEnv, email string) *domain.User {
	bankName := "국민은행"
	bankCode := "004"
	encryptedAccount, _ := crypto.Encrypt("1234567890123", testEncKey)
	accountHolder := "홍길동"
	now := time.Now()

	user := &domain.User{
		Email:          email,
		Password:       "hashedpassword",
		Role:           "USER",
		KycStatus:      "VERIFIED",
		BankName:       &bankName,
		BankCode:       &bankCode,
		AccountNumber:  &encryptedAccount,
		AccountHolder:  &accountHolder,
		BankVerifiedAt: &now,
	}
	env.db.Create(user)
	return user
}

// ── Tests ──

func TestSubmitTradeIn_Success_Shipping(t *testing.T) {
	env := setupTradeInTestDB()
	product := createTradeInTestProduct(env, 50000, 10, true) // 수수료율 10%
	user := createTradeInTestUser(env, "shipping@test.com")

	input := CreateTradeInInput{
		ProductID:      product.ID,
		Quantity:       2,
		SenderName:     "홍길동",
		SenderPhone:    "01012345678",
		SenderEmail:    "sender@test.com",
		ShippingMethod: "DELIVERY",
		ShippingDate:   "2026-04-01",
		ArrivalDate:    "2026-04-03",
		Message:        "잘 부탁드립니다",
	}

	result, err := env.svc.SubmitTradeIn(user.ID, input)
	require.NoError(t, err)
	require.NotNil(t, result)

	// Status 확인
	assert.Equal(t, "REQUESTED", result.Status)

	// PayoutAmount 확인: 50000 * (100-10)/100 * 2 = 90000
	expectedPayout := decimal.NewFromInt(90000)
	assert.True(t, expectedPayout.Equal(result.PayoutAmount.Decimal),
		"expected payout %s, got %s", expectedPayout, result.PayoutAmount.Decimal)

	// 배송 정보 확인
	require.NotNil(t, result.SenderName)
	assert.Equal(t, "홍길동", *result.SenderName)
	require.NotNil(t, result.SenderPhone)
	assert.Equal(t, "01012345678", *result.SenderPhone)
	require.NotNil(t, result.ShippingMethod)
	assert.Equal(t, "DELIVERY", *result.ShippingMethod)
	require.NotNil(t, result.Message)
	assert.Equal(t, "잘 부탁드립니다", *result.Message)

	// 상품 스냅샷 확인
	require.NotNil(t, result.ProductName)
	assert.Equal(t, product.Name, *result.ProductName)
	require.NotNil(t, result.ProductBrand)
	assert.Equal(t, product.BrandCode, *result.ProductBrand)

	// DB에 저장 확인
	var saved domain.TradeIn
	require.NoError(t, env.db.First(&saved, result.ID).Error)
	assert.Equal(t, user.ID, saved.UserID)
	assert.Equal(t, product.ID, saved.ProductID)
}

func TestSubmitTradeIn_Success_PIN(t *testing.T) {
	env := setupTradeInTestDB()
	product := createTradeInTestProduct(env, 100000, 85, true)
	user := createTradeInTestUser(env, "pin@test.com")

	pinCode := "1234-5678-9012-3456"
	securityCode := "9999"
	giftNumber := "GN-2026-001"

	input := CreateTradeInInput{
		ProductID:    product.ID,
		Quantity:     1,
		PinCode:      pinCode,
		SecurityCode: securityCode,
		GiftNumber:   giftNumber,
	}

	result, err := env.svc.SubmitTradeIn(user.ID, input)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, "REQUESTED", result.Status)

	// PIN이 암호화되어 저장되었는지 확인
	require.NotNil(t, result.PinCode)
	assert.NotEqual(t, pinCode, *result.PinCode, "PIN should be encrypted, not plain text")

	// PinHash가 생성되었는지 확인
	require.NotNil(t, result.PinHash)
	expectedHash := crypto.SHA256Hash(pinCode)
	assert.Equal(t, expectedHash, *result.PinHash)

	// 암호화된 PIN을 복호화하여 원본과 일치하는지 확인
	decryptedPin, err := crypto.Decrypt(*result.PinCode, testEncKey)
	require.NoError(t, err)
	assert.Equal(t, pinCode, decryptedPin)

	// SecurityCode도 암호화 확인
	require.NotNil(t, result.SecurityCode)
	decryptedSec, err := crypto.Decrypt(*result.SecurityCode, testEncKey)
	require.NoError(t, err)
	assert.Equal(t, securityCode, decryptedSec)

	// GiftNumber도 암호화 확인
	require.NotNil(t, result.GiftNumber)
	decryptedGift, err := crypto.Decrypt(*result.GiftNumber, testEncKey)
	require.NoError(t, err)
	assert.Equal(t, giftNumber, decryptedGift)
}

func TestSubmitTradeIn_ProductNotFound(t *testing.T) {
	env := setupTradeInTestDB()
	user := createTradeInTestUser(env, "notfound@test.com")

	input := CreateTradeInInput{
		ProductID: 99999,
		Quantity:  1,
	}

	result, err := env.svc.SubmitTradeIn(user.ID, input)
	assert.Nil(t, result)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "찾을 수 없습니다")
}

func TestSubmitTradeIn_TradeInNotAllowed(t *testing.T) {
	env := setupTradeInTestDB()
	product := createTradeInTestProduct(env, 50000, 90, false) // AllowTradeIn=false
	user := createTradeInTestUser(env, "notallowed@test.com")

	input := CreateTradeInInput{
		ProductID: product.ID,
		Quantity:  1,
	}

	result, err := env.svc.SubmitTradeIn(user.ID, input)
	assert.Nil(t, result)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "매입을 진행하지 않습니다")
}

func TestSubmitTradeIn_PayoutCalculation(t *testing.T) {
	env := setupTradeInTestDB()

	// tradeInRate = 수수료율 (예: 10 = 10% 수수료 → 고객에게 90% 지급)
	// payout = price × (100 - tradeInRate) / 100 × quantity
	tests := []struct {
		name           string
		price          int64
		tradeInRate    int64 // 수수료율 (%)
		quantity       int
		expectedPayout int64
	}{
		{
			name:           "수수료 10%: 50000 × (100-10)/100 × 1 = 45000",
			price:          50000,
			tradeInRate:    10,
			quantity:       1,
			expectedPayout: 45000,
		},
		{
			name:           "수수료 15%, 수량 3: 100000 × 85/100 × 3 = 255000",
			price:          100000,
			tradeInRate:    15,
			quantity:       3,
			expectedPayout: 255000,
		},
		{
			name:           "수수료 5%, 수량 5: 10000 × 95/100 × 5 = 47500",
			price:          10000,
			tradeInRate:    5,
			quantity:       5,
			expectedPayout: 47500,
		},
		{
			name:           "수수료 0% (전액 지급): 50000 × 100/100 × 1 = 50000",
			price:          50000,
			tradeInRate:    0,
			quantity:       1,
			expectedPayout: 50000,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			product := createTradeInTestProduct(env, tc.price, tc.tradeInRate, true)
			user := createTradeInTestUser(env, tc.name+"@test.com")

			input := CreateTradeInInput{
				ProductID: product.ID,
				Quantity:  tc.quantity,
			}

			result, err := env.svc.SubmitTradeIn(user.ID, input)
			require.NoError(t, err)

			expected := decimal.NewFromInt(tc.expectedPayout)
			assert.True(t, expected.Equal(result.PayoutAmount.Decimal),
				"[%s] expected payout %s, got %s", tc.name, expected, result.PayoutAmount.Decimal)
		})
	}
}

func TestSubmitTradeIn_FraudHold(t *testing.T) {
	env := setupTradeInTestDB()
	product := createTradeInTestProduct(env, 50000, 90, true)
	user := createTradeInTestUser(env, "fraud@test.com")

	// FraudChecker가 IsFlagged=true를 반환하도록 설정
	env.svc.SetFraudChecker(&stubFraudChecker{
		result: &interfaces.FraudCheckResult{
			IsFlagged:      true,
			PhoneCaution:   "Y",
			AccountCaution: "N",
		},
	})

	input := CreateTradeInInput{
		ProductID: product.ID,
		Quantity:  1,
	}

	result, err := env.svc.SubmitTradeIn(user.ID, input)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, "FRAUD_HOLD", result.Status)

	// DB에서도 FRAUD_HOLD인지 확인
	var saved domain.TradeIn
	require.NoError(t, env.db.First(&saved, result.ID).Error)
	assert.Equal(t, "FRAUD_HOLD", saved.Status)
}

func TestSubmitTradeIn_UsesKYCAccount(t *testing.T) {
	env := setupTradeInTestDB()
	product := createTradeInTestProduct(env, 50000, 90, true)
	user := createTradeInTestUser(env, "kyc@test.com")

	// 계좌 정보를 입력하지 않으면 사용자의 KYC 인증 계좌를 사용해야 함
	input := CreateTradeInInput{
		ProductID: product.ID,
		Quantity:  1,
	}

	result, err := env.svc.SubmitTradeIn(user.ID, input)
	require.NoError(t, err)
	require.NotNil(t, result)

	// BankName은 사용자의 KYC 계좌에서 가져옴
	require.NotNil(t, result.BankName)
	assert.Equal(t, "국민은행", *result.BankName)

	// AccountHolder도 가져옴
	require.NotNil(t, result.AccountHolder)
	assert.Equal(t, "홍길동", *result.AccountHolder)

	// AccountNum은 사용자의 (이미 암호화된) 계좌 번호를 그대로 사용
	require.NotNil(t, result.AccountNum)
	// 이미 암호화된 값을 복호화하여 원본 확인
	decryptedAccount, err := crypto.Decrypt(*result.AccountNum, testEncKey)
	require.NoError(t, err)
	assert.Equal(t, "1234567890123", decryptedAccount)
}

func TestGetMyTradeIns_Pagination(t *testing.T) {
	env := setupTradeInTestDB()
	user := createTradeInTestUser(env, "pagination@test.com")

	// 5개의 매입 신청 생성
	for i := 0; i < 5; i++ {
		product := createTradeInTestProduct(env, int64((i+1)*10000), 90, true)
		input := CreateTradeInInput{
			ProductID: product.ID,
			Quantity:  1,
		}
		_, err := env.svc.SubmitTradeIn(user.ID, input)
		require.NoError(t, err)
	}

	// 페이지 1 (2개씩)
	params := pagination.QueryParams{Page: 1, Limit: 2}
	resp, err := env.svc.GetMyTradeIns(user.ID, params)
	require.NoError(t, err)
	assert.Equal(t, 2, len(resp.Items))
	assert.Equal(t, int64(5), resp.Meta.Total)
	assert.Equal(t, 3, resp.Meta.TotalPages)
	assert.True(t, resp.Meta.HasNextPage)
	assert.False(t, resp.Meta.HasPrevPage)

	// 페이지 2
	params2 := pagination.QueryParams{Page: 2, Limit: 2}
	resp2, err := env.svc.GetMyTradeIns(user.ID, params2)
	require.NoError(t, err)
	assert.Equal(t, 2, len(resp2.Items))
	assert.True(t, resp2.Meta.HasNextPage)
	assert.True(t, resp2.Meta.HasPrevPage)

	// 페이지 3 (마지막, 1개)
	params3 := pagination.QueryParams{Page: 3, Limit: 2}
	resp3, err := env.svc.GetMyTradeIns(user.ID, params3)
	require.NoError(t, err)
	assert.Equal(t, 1, len(resp3.Items))
	assert.False(t, resp3.Meta.HasNextPage)
	assert.True(t, resp3.Meta.HasPrevPage)

	// ID DESC 정렬 확인 — 가장 최근이 첫 번째
	assert.True(t, resp.Items[0].ID > resp.Items[1].ID, "items should be ordered by ID DESC")
}

func TestGetTradeInByID_Success(t *testing.T) {
	env := setupTradeInTestDB()
	product := createTradeInTestProduct(env, 50000, 90, true)
	user := createTradeInTestUser(env, "getbyid@test.com")

	input := CreateTradeInInput{
		ProductID: product.ID,
		Quantity:  1,
	}

	created, err := env.svc.SubmitTradeIn(user.ID, input)
	require.NoError(t, err)

	// ID로 조회
	result, err := env.svc.GetTradeInByID(user.ID, created.ID)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, created.ID, result.ID)
	assert.Equal(t, user.ID, result.UserID)
	assert.Equal(t, product.ID, result.ProductID)
	assert.Equal(t, "REQUESTED", result.Status)
}

func TestGetTradeInByID_NotOwner(t *testing.T) {
	env := setupTradeInTestDB()
	product := createTradeInTestProduct(env, 50000, 90, true)
	owner := createTradeInTestUser(env, "owner@test.com")
	otherUser := createTradeInTestUser(env, "other@test.com")

	input := CreateTradeInInput{
		ProductID: product.ID,
		Quantity:  1,
	}

	created, err := env.svc.SubmitTradeIn(owner.ID, input)
	require.NoError(t, err)

	// 다른 사용자가 조회 시도 → 에러
	result, err := env.svc.GetTradeInByID(otherUser.ID, created.ID)
	assert.Nil(t, result)
	require.Error(t, err, "should return error when non-owner tries to access trade-in")
}
