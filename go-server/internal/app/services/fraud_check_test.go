package services

import (
	"testing"
	"time"

	"w-gift-server/internal/app/interfaces"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/crypto"
	"w-gift-server/pkg/thecheat"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testEncKey는 테스트용 AES-256 암호화 키입니다 (64 hex chars = 32 bytes).
// auth_test.go에서도 동일한 값을 사용합니다.
const fraudTestEncKey = "6464646464646464646464646464646464646464646464646464646464646464"

// Compile-time interface satisfaction check
var _ interfaces.FraudChecker = (*FraudCheckService)(nil)

// stubTheCheatClient는 TheCheat API 클라이언트의 테스트용 스텁입니다.
type stubTheCheatClient struct {
	results   map[string]*thecheat.FraudResult
	err       error
	callCount int
}

func (s *stubTheCheatClient) Search(keyword, keywordType, bankCode string) (*thecheat.FraudResult, error) {
	s.callCount++
	if s.err != nil {
		return nil, s.err
	}
	if r, ok := s.results[keyword]; ok {
		return r, nil
	}
	return &thecheat.FraudResult{Keyword: keyword, KeywordType: keywordType, Caution: "N"}, nil
}

// setupFraudTestDB는 FraudCheckLog와 User 테이블을 포함하는 테스트 DB를 반환합니다.
func setupFraudTestDB() *fraudTestEnv {
	db := setupTestDB()
	db.AutoMigrate(&domain.FraudCheckLog{})

	cfg := &config.Config{
		TheCheatEnabled:  true,
		TheCheatCacheTTL: 24 * time.Hour,
		EncryptionKey:    fraudTestEncKey,
	}

	stub := &stubTheCheatClient{
		results: make(map[string]*thecheat.FraudResult),
	}

	svc := NewFraudCheckService(db, cfg, stub)

	return &fraudTestEnv{db: db, cfg: cfg, stub: stub, svc: svc}
}

type fraudTestEnv struct {
	db   interface{ AutoMigrate(...interface{}) error } // minimal interface, actually *gorm.DB
	cfg  *config.Config
	stub *stubTheCheatClient
	svc  *FraudCheckService
}

// createTestUser는 테스트용 사용자를 생성합니다.
func createTestUser(env *fraudTestEnv, phone *string, encryptedAccount *string, bankCode *string) *domain.User {
	db := env.svc.db
	user := &domain.User{
		Email:         "fraud-test@example.com",
		Password:      "hashed",
		Phone:         phone,
		AccountNumber: encryptedAccount,
		BankCode:      bankCode,
	}
	db.Create(user)
	return user
}

// ── Tests ──

func TestFraudCheck_DisabledReturnsNotFlagged(t *testing.T) {
	env := setupFraudTestDB()
	env.cfg.TheCheatEnabled = false

	phone := "01012345678"
	user := createTestUser(env, &phone, nil, nil)

	result, err := env.svc.Check(user.ID, "order")
	require.NoError(t, err)
	assert.False(t, result.IsFlagged)
	assert.Equal(t, 0, env.stub.callCount, "API should not be called when disabled")
}

func TestFraudCheck_PhoneFlagged(t *testing.T) {
	env := setupFraudTestDB()

	phone := "01099998888"
	user := createTestUser(env, &phone, nil, nil)

	env.stub.results["01099998888"] = &thecheat.FraudResult{
		Keyword:     "01099998888",
		KeywordType: "phone",
		Caution:     "Y",
		KeywordURL:  "https://thecheat.co.kr/report/12345",
	}

	result, err := env.svc.Check(user.ID, "order")
	require.NoError(t, err)
	assert.True(t, result.IsFlagged)
	assert.Equal(t, "Y", result.PhoneCaution)
	assert.NotEmpty(t, result.PhoneURL)
}

func TestFraudCheck_AccountFlagged(t *testing.T) {
	env := setupFraudTestDB()

	plainAccount := "1234567890123"
	encrypted, err := crypto.EncryptCBC(plainAccount, fraudTestEncKey)
	require.NoError(t, err)

	bankCode := "004"
	user := createTestUser(env, nil, &encrypted, &bankCode)

	env.stub.results[plainAccount] = &thecheat.FraudResult{
		Keyword:     plainAccount,
		KeywordType: "account",
		BankCode:    "004",
		Caution:     "Y",
		KeywordURL:  "https://thecheat.co.kr/report/67890",
	}

	result, err := env.svc.Check(user.ID, "order")
	require.NoError(t, err)
	assert.True(t, result.IsFlagged)
	assert.Equal(t, "Y", result.AccountCaution)
	assert.NotEmpty(t, result.AccountURL)
}

func TestFraudCheck_CacheHit(t *testing.T) {
	env := setupFraudTestDB()

	phone := "01011112222"
	user := createTestUser(env, &phone, nil, nil)

	env.stub.results["01011112222"] = &thecheat.FraudResult{
		Keyword:     "01011112222",
		KeywordType: "phone",
		Caution:     "N",
	}

	// First call — should hit the API
	_, err := env.svc.Check(user.ID, "order")
	require.NoError(t, err)
	assert.Equal(t, 1, env.stub.callCount)

	// Second call — should use cache, NOT the API
	_, err = env.svc.Check(user.ID, "order")
	require.NoError(t, err)
	assert.Equal(t, 1, env.stub.callCount, "second call should use cache, not API")
}

func TestFraudCheck_RealtimeIgnoresCache(t *testing.T) {
	env := setupFraudTestDB()

	phone := "01033334444"
	user := createTestUser(env, &phone, nil, nil)

	env.stub.results["01033334444"] = &thecheat.FraudResult{
		Keyword:     "01033334444",
		KeywordType: "phone",
		Caution:     "N",
	}

	// First call with cache
	_, err := env.svc.Check(user.ID, "order")
	require.NoError(t, err)
	assert.Equal(t, 1, env.stub.callCount)

	// Realtime call — should bypass cache
	_, err = env.svc.CheckRealtime(user.ID)
	require.NoError(t, err)
	assert.Equal(t, 2, env.stub.callCount, "realtime should bypass cache and call API again")
}

func TestFraudCheck_NoPhoneNoAccount(t *testing.T) {
	env := setupFraudTestDB()

	// User with no phone and no account
	user := createTestUser(env, nil, nil, nil)

	result, err := env.svc.Check(user.ID, "order")
	require.NoError(t, err)
	assert.False(t, result.IsFlagged)
	assert.Equal(t, "", result.PhoneCaution)
	assert.Equal(t, "", result.AccountCaution)
	assert.Equal(t, 0, env.stub.callCount, "no API calls for user without phone/account")
}

func TestFraudCheck_APIErrorFailOpen(t *testing.T) {
	env := setupFraudTestDB()

	phone := "01055556666"
	user := createTestUser(env, &phone, nil, nil)

	env.stub.err = assert.AnError // simulate API failure

	result, err := env.svc.Check(user.ID, "order")
	require.NoError(t, err, "should not return error on API failure (fail-open)")
	assert.False(t, result.IsFlagged, "should not flag user on API failure")
}

func TestMaskPhone(t *testing.T) {
	assert.Equal(t, "010****5678", maskPhone("01012345678"))
	assert.Equal(t, "021****5678", maskPhone("0212345678"))
	assert.Equal(t, "12", maskPhone("12")) // too short, returned as-is
}

func TestMaskAccount(t *testing.T) {
	assert.Equal(t, "1234****90", maskAccount("1234567890"))
	assert.Equal(t, "1234****90", maskAccount("12345690"))
	assert.Equal(t, "12", maskAccount("12")) // too short, returned as-is
}

// ── Phase 3: Additional tests ──

func TestFraudCheck_UserNotFound(t *testing.T) {
	env := setupFraudTestDB()
	_, err := env.svc.Check(99999, "ORDER")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "사용자 조회 실패")
}

func TestFraudCheck_AccountDecryptFailOpen(t *testing.T) {
	env := setupFraudTestDB()
	corruptedAccount := "not-valid-encrypted-data"
	user := createTestUser(env, nil, &corruptedAccount, nil)

	result, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err, "decrypt failure should be fail-open")
	assert.False(t, result.IsFlagged)
}

func TestFraudCheck_BothPhoneAndAccountFlagged(t *testing.T) {
	env := setupFraudTestDB()

	phone := "01077778888"
	plainAccount := "9876543210"
	encrypted, _ := crypto.EncryptCBC(plainAccount, fraudTestEncKey)
	bankCode := "088"
	user := createTestUser(env, &phone, &encrypted, &bankCode)

	env.stub.results["01077778888"] = &thecheat.FraudResult{
		Keyword: "01077778888", KeywordType: "phone", Caution: "Y",
		KeywordURL: "https://thecheat.co.kr/phone/1",
	}
	env.stub.results["9876543210"] = &thecheat.FraudResult{
		Keyword: "9876543210", KeywordType: "account", BankCode: "088", Caution: "Y",
		KeywordURL: "https://thecheat.co.kr/account/2",
	}

	result, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.True(t, result.IsFlagged)
	assert.Equal(t, "Y", result.PhoneCaution)
	assert.Equal(t, "Y", result.AccountCaution)
	assert.NotEmpty(t, result.PhoneURL)
	assert.NotEmpty(t, result.AccountURL)
	assert.Equal(t, 2, env.stub.callCount, "should call API for both phone and account")
}

func TestFraudCheck_PhoneCleanAccountFlagged(t *testing.T) {
	env := setupFraudTestDB()

	phone := "01011110000"
	plainAccount := "1111222233"
	encrypted, _ := crypto.EncryptCBC(plainAccount, fraudTestEncKey)
	user := createTestUser(env, &phone, &encrypted, nil)

	// phone is clean (default N from stub), account is flagged
	env.stub.results["1111222233"] = &thecheat.FraudResult{
		Keyword: "1111222233", KeywordType: "account", Caution: "Y",
	}

	result, err := env.svc.Check(user.ID, "TRADEIN")
	require.NoError(t, err)
	assert.True(t, result.IsFlagged)
	assert.Equal(t, "N", result.PhoneCaution)
	assert.Equal(t, "Y", result.AccountCaution)
}

func TestFraudCheck_CacheExpired(t *testing.T) {
	env := setupFraudTestDB()

	phone := "01044445555"
	user := createTestUser(env, &phone, nil, nil)

	// Insert expired cache entry
	env.svc.db.Create(&domain.FraudCheckLog{
		UserID:      user.ID,
		Keyword:     maskPhone(phone),
		KeywordType: "phone",
		Caution:     "Y",
		Source:      "ORDER",
		ExpiresAt:   time.Now().Add(-1 * time.Hour), // expired
	})

	env.stub.results["01044445555"] = &thecheat.FraudResult{
		Keyword: "01044445555", KeywordType: "phone", Caution: "N",
	}

	result, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.False(t, result.IsFlagged, "expired cache should be ignored, new API result is N")
	assert.Equal(t, 1, env.stub.callCount, "should call API when cache is expired")
}

func TestFraudCheck_LogStoresMaskedKeyword(t *testing.T) {
	env := setupFraudTestDB()

	phone := "01012349999"
	user := createTestUser(env, &phone, nil, nil)

	env.stub.results["01012349999"] = &thecheat.FraudResult{
		Keyword: "01012349999", KeywordType: "phone", Caution: "N",
	}

	_, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)

	// Verify the log stores masked keyword
	var log domain.FraudCheckLog
	env.svc.db.Where("UserId = ?", user.ID).First(&log)
	assert.Equal(t, "010****9999", log.Keyword, "should store masked phone, not plain")
	assert.Equal(t, "ORDER", log.Source)
	assert.Equal(t, "phone", log.KeywordType)
}

func TestFraudCheck_LogStoresBankCode(t *testing.T) {
	env := setupFraudTestDB()

	plainAccount := "5555666677"
	encrypted, _ := crypto.EncryptCBC(plainAccount, fraudTestEncKey)
	bankCode := "004"
	user := createTestUser(env, nil, &encrypted, &bankCode)

	_, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)

	var log domain.FraudCheckLog
	env.svc.db.Where("UserId = ? AND KeywordType = ?", user.ID, "account").First(&log)
	require.NotNil(t, log.BankCode)
	assert.Equal(t, "004", *log.BankCode)
	assert.Equal(t, "5555****77", log.Keyword, "should store masked account")
}
