package services

import (
	"errors"
	"testing"
	"time"

	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/blacklistdb"
	"seedream-gift-server/pkg/crypto"
	"seedream-gift-server/pkg/thecheat"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// stubBlacklistClient는 BlacklistScreener 인터페이스의 테스트용 스텁입니다.
type stubBlacklistClient struct {
	result    *blacklistdb.ScreeningResult
	err       error
	callCount int
}

func (s *stubBlacklistClient) Screen(refID, candidateName, phone, account string) (*blacklistdb.ScreeningResult, error) {
	s.callCount++
	if s.err != nil {
		return nil, s.err
	}
	if s.result != nil {
		return s.result, nil
	}
	return &blacklistdb.ScreeningResult{
		RefID:     refID,
		Status:    "CLEARED",
		MatchCode: "00000",
	}, nil
}

// blacklistTestEnv는 블랙리스트 테스트 환경입니다.
type blacklistTestEnv struct {
	svc       *FraudCheckService
	cfg       *config.Config
	cheatStub *stubTheCheatClient
	blStub    *stubBlacklistClient
}

func setupBlacklistTestDB() *blacklistTestEnv {
	db := setupTestDB()
	db.AutoMigrate(&domain.FraudCheckLog{}, &domain.BlacklistCheckLog{})

	cfg := &config.Config{
		TheCheatEnabled:   true,
		TheCheatCacheTTL:  24 * time.Hour,
		BlacklistEnabled:  true,
		BlacklistCacheTTL: 24 * time.Hour,
		EncryptionKey:     fraudTestEncKey,
	}

	cheatStub := &stubTheCheatClient{
		results: make(map[string]*thecheat.FraudResult),
	}
	blStub := &stubBlacklistClient{}

	svc := NewFraudCheckService(db, cfg, cheatStub)
	svc.SetBlacklistClient(blStub)

	return &blacklistTestEnv{svc: svc, cfg: cfg, cheatStub: cheatStub, blStub: blStub}
}

func createBlacklistTestUser(env *blacklistTestEnv, name, phone *string, encryptedAccount *string, bankCode *string) *domain.User {
	user := &domain.User{
		Email:         "bl-test@example.com",
		Password:      "hashed",
		Name:          name,
		Phone:         phone,
		AccountNumber: encryptedAccount,
		BankCode:      bankCode,
	}
	env.svc.db.Create(user)
	return user
}

// ── 블랙리스트 스크리닝 테스트 ──

func TestBlacklist_NamePhoneBlocked(t *testing.T) {
	env := setupBlacklistTestDB()

	name := "홍길동"
	phone := "01012345678"
	user := createBlacklistTestUser(env, &name, &phone, nil, nil)

	env.blStub.result = &blacklistdb.ScreeningResult{
		RefID:         "user-1",
		Status:        "BLOCKED",
		MatchCode:     "11000", // 이름+전화
		IncidentCount: 3,
	}

	result, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.True(t, result.IsFlagged, "이름+전화 매칭이면 차단")
	assert.Equal(t, "BLOCKED", result.BlacklistStatus)
	assert.Equal(t, "11000", result.BlacklistMatchCode)
	assert.Equal(t, 3, result.BlacklistIncidentCount)
}

func TestBlacklist_NameAccountBlocked(t *testing.T) {
	env := setupBlacklistTestDB()

	name := "김철수"
	plainAccount := "9876543210"
	encrypted, _ := crypto.EncryptCBC(plainAccount, fraudTestEncKey)
	bankCode := "004"
	user := createBlacklistTestUser(env, &name, nil, &encrypted, &bankCode)

	env.blStub.result = &blacklistdb.ScreeningResult{
		RefID:         "user-2",
		Status:        "BLOCKED",
		MatchCode:     "10100", // 이름+계좌
		IncidentCount: 1,
	}

	result, err := env.svc.Check(user.ID, "TRADEIN")
	require.NoError(t, err)
	assert.True(t, result.IsFlagged, "이름+계좌 매칭이면 차단")
	assert.Equal(t, "10100", result.BlacklistMatchCode)
}

func TestBlacklist_NamePhoneAccountBlocked(t *testing.T) {
	env := setupBlacklistTestDB()

	name := "이영희"
	phone := "01099998888"
	plainAccount := "1111222233"
	encrypted, _ := crypto.EncryptCBC(plainAccount, fraudTestEncKey)
	user := createBlacklistTestUser(env, &name, &phone, &encrypted, nil)

	env.blStub.result = &blacklistdb.ScreeningResult{
		RefID:         "user-3",
		Status:        "BLOCKED",
		MatchCode:     "11100", // 이름+전화+계좌
		IncidentCount: 5,
	}

	result, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.True(t, result.IsFlagged, "이름+전화+계좌 모두 매칭이면 차단")
	assert.Equal(t, "11100", result.BlacklistMatchCode)
	assert.Equal(t, 5, result.BlacklistIncidentCount)
}

func TestBlacklist_AccountOnlyNotBlocked(t *testing.T) {
	env := setupBlacklistTestDB()

	name := "박민수"
	phone := "01033334444"
	user := createBlacklistTestUser(env, &name, &phone, nil, nil)

	// API는 BLOCKED를 반환하지만 matchCode가 "00100" (계좌만 일치)
	env.blStub.result = &blacklistdb.ScreeningResult{
		RefID:         "user-4",
		Status:        "BLOCKED",
		MatchCode:     "00100", // 계좌만 — 이름 기반이 아님
		IncidentCount: 1,
	}

	result, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.Equal(t, "BLOCKED", result.BlacklistStatus)
	// 이름 기반 매칭이 아니므로 IsFlagged는 false (더치트도 clean)
	assert.False(t, result.IsFlagged, "이름 없는 매칭은 차단하지 않음")
}

func TestBlacklist_Cleared(t *testing.T) {
	env := setupBlacklistTestDB()

	name := "정하나"
	phone := "01055556666"
	user := createBlacklistTestUser(env, &name, &phone, nil, nil)

	env.blStub.result = &blacklistdb.ScreeningResult{
		RefID:     "user-5",
		Status:    "CLEARED",
		MatchCode: "00000",
	}

	result, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.False(t, result.IsFlagged)
	assert.Equal(t, "CLEARED", result.BlacklistStatus)
}

func TestBlacklist_DisabledSkipsCheck(t *testing.T) {
	env := setupBlacklistTestDB()
	env.cfg.BlacklistEnabled = false

	name := "테스트"
	phone := "01099990000"
	user := createBlacklistTestUser(env, &name, &phone, nil, nil)

	result, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.Equal(t, "", result.BlacklistStatus)
	assert.Equal(t, 0, env.blStub.callCount, "비활성화 시 API 호출 없어야 함")
}

func TestBlacklist_NoNameSkipsCheck(t *testing.T) {
	env := setupBlacklistTestDB()

	phone := "01011110000"
	user := createBlacklistTestUser(env, nil, &phone, nil, nil) // 이름 없음

	result, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.Equal(t, "", result.BlacklistStatus)
	assert.Equal(t, 0, env.blStub.callCount, "이름 없으면 스크리닝 스킵")
}

func TestBlacklist_NoPhoneNoAccountSkipsCheck(t *testing.T) {
	env := setupBlacklistTestDB()

	name := "최테스트"
	user := createBlacklistTestUser(env, &name, nil, nil, nil) // 전화, 계좌 모두 없음

	result, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.Equal(t, "", result.BlacklistStatus)
	assert.Equal(t, 0, env.blStub.callCount, "전화/계좌 모두 없으면 스킵")
}

func TestBlacklist_APIErrorFailOpen(t *testing.T) {
	env := setupBlacklistTestDB()

	name := "에러테스트"
	phone := "01077778888"
	user := createBlacklistTestUser(env, &name, &phone, nil, nil)

	env.blStub.err = errors.New("connection refused")

	result, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err, "블랙리스트 API 실패 시 fail-open")
	assert.False(t, result.IsFlagged, "API 실패 시 차단하지 않음")
	assert.Equal(t, "", result.BlacklistStatus) // 결과 없음
}

func TestBlacklist_CacheHit(t *testing.T) {
	env := setupBlacklistTestDB()

	name := "캐시테스트"
	phone := "01022223333"
	user := createBlacklistTestUser(env, &name, &phone, nil, nil)

	env.blStub.result = &blacklistdb.ScreeningResult{
		RefID:         "user-cache",
		Status:        "BLOCKED",
		MatchCode:     "11000",
		IncidentCount: 2,
	}

	// 첫 번째 호출 — API 호출
	result1, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.True(t, result1.IsFlagged)
	assert.Equal(t, 1, env.blStub.callCount)

	// 두 번째 호출 — 캐시 사용
	result2, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.True(t, result2.IsFlagged)
	assert.Equal(t, "BLOCKED", result2.BlacklistStatus)
	assert.Equal(t, 1, env.blStub.callCount, "캐시 히트 시 API 재호출 없음")
}

func TestBlacklist_RealtimeIgnoresCache(t *testing.T) {
	env := setupBlacklistTestDB()

	name := "실시간"
	phone := "01044445555"
	user := createBlacklistTestUser(env, &name, &phone, nil, nil)

	env.blStub.result = &blacklistdb.ScreeningResult{
		RefID:     "user-rt",
		Status:    "CLEARED",
		MatchCode: "00000",
	}

	// 첫 번째 호출 (캐시 저장)
	_, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.Equal(t, 1, env.blStub.callCount)

	// CheckRealtime — 캐시 무시
	_, err = env.svc.CheckRealtime(user.ID)
	require.NoError(t, err)
	assert.Equal(t, 2, env.blStub.callCount, "실시간 조회는 캐시를 무시해야 함")
}

func TestBlacklist_LogStoresMaskedName(t *testing.T) {
	env := setupBlacklistTestDB()

	name := "홍길동"
	phone := "01066667777"
	user := createBlacklistTestUser(env, &name, &phone, nil, nil)

	env.blStub.result = &blacklistdb.ScreeningResult{
		RefID:     "user-log",
		Status:    "CLEARED",
		MatchCode: "00000",
	}

	_, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)

	var log domain.BlacklistCheckLog
	env.svc.db.Where("UserId = ?", user.ID).First(&log)
	assert.Equal(t, "홍*동", log.CandidateName, "이름이 마스킹 저장되어야 함")
	assert.Equal(t, "ORDER", log.Source)
}

func TestBlacklist_TheCheatAndBlacklistBothFlag(t *testing.T) {
	env := setupBlacklistTestDB()

	name := "위험인물"
	phone := "01088889999"
	user := createBlacklistTestUser(env, &name, &phone, nil, nil)

	// 더치트: 전화번호 위험
	env.cheatStub.results["01088889999"] = &thecheat.FraudResult{
		Keyword: "01088889999", KeywordType: "phone", Caution: "Y",
		KeywordURL: "https://thecheat.co.kr/report/1",
	}
	// 블랙리스트: 이름+전화 매칭
	env.blStub.result = &blacklistdb.ScreeningResult{
		RefID: "user-both", Status: "BLOCKED", MatchCode: "11000", IncidentCount: 2,
	}

	result, err := env.svc.Check(user.ID, "ORDER")
	require.NoError(t, err)
	assert.True(t, result.IsFlagged)
	assert.Equal(t, "Y", result.PhoneCaution)
	assert.Equal(t, "BLOCKED", result.BlacklistStatus)
}

// ── maskName 테스트 ──

func TestMaskName(t *testing.T) {
	assert.Equal(t, "홍*동", maskName("홍길동"))
	assert.Equal(t, "김*수", maskName("김철수"))
	assert.Equal(t, "이*", maskName("이삼"))       // 2글자
	assert.Equal(t, "A", maskName("A"))         // 1글자
	assert.Equal(t, "사***오", maskName("사공세라오")) // 5글자
}
