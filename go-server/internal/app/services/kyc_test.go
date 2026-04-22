package services

import (
	"testing"
	"time"
	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/domain"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupKycTestDB() (*KycService, *config.Config) {
	db := setupTestDB()
	db.AutoMigrate(&domain.KycVerifySession{})

	cfg := &config.Config{
		EncryptionKey:    testEncKey,
		KYCSessionExpiry: 15 * time.Minute,
	}
	return NewKycService(db, cfg), cfg
}

// ── 1원 인증 요청 (RequestBankVerify) ──

func TestKyc_RequestBankVerify_Success(t *testing.T) {
	svc, _ := setupKycTestDB()

	session, err := svc.RequestBankVerify(BankVerifyRequest{
		BankCode:      "004",
		BankName:      "국민은행",
		AccountNumber: "1234567890123",
		AccountHolder: "홍길동",
	})

	require.NoError(t, err)
	assert.NotNil(t, session)
	assert.Len(t, session.VerifyTrNo, 9, "인증번호는 9자리")
	assert.NotEmpty(t, session.VerifyTrDt, "거래일자가 비어있지 않아야 함")
	assert.Equal(t, "004", session.BankCode)
	assert.Equal(t, "홍길동", session.AccountHolder)
	assert.NotEqual(t, "1234567890123", session.AccountNumber, "DB에 평문 계좌번호가 저장되면 안됨")
	assert.False(t, session.IsVerified)
	assert.True(t, session.ExpiresAt.After(time.Now()), "만료시간이 미래여야 함")
}

func TestKyc_RequestBankVerify_UniqueSession(t *testing.T) {
	svc, _ := setupKycTestDB()

	req := BankVerifyRequest{
		BankCode: "004", BankName: "국민은행",
		AccountNumber: "1234567890123", AccountHolder: "홍길동",
	}
	s1, err1 := svc.RequestBankVerify(req)
	s2, err2 := svc.RequestBankVerify(req)

	require.NoError(t, err1)
	require.NoError(t, err2)
	assert.NotEqual(t, s1.VerifyTrNo, s2.VerifyTrNo, "동일 요청이라도 인증번호는 매번 달라야 함")
}

// ── 1원 인증 확인 (ConfirmBankVerify) ──

func TestKyc_ConfirmBankVerify_Success_WithUser(t *testing.T) {
	svc, _ := setupKycTestDB()

	// 사용자 생성
	user := &domain.User{Email: "kyc@test.com", Password: "hashed", Role: "USER", KycStatus: "NONE"}
	svc.db.Create(user)

	// 인증 요청
	session, err := svc.RequestBankVerify(BankVerifyRequest{
		BankCode: "004", BankName: "국민은행",
		AccountNumber: "9876543210", AccountHolder: "김인증",
	})
	require.NoError(t, err)

	// 인증 확인 (올바른 인증번호)
	result, err := svc.ConfirmBankVerify(user.ID, BankVerifyConfirmRequest{
		VerifyTrDt:    session.VerifyTrDt,
		VerifyTrNo:    session.VerifyTrNo,
		VerifyVal:     session.VerifyTrNo, // 올바른 값
		BankCode:      "004",
		AccountNumber: "9876543210",
	})

	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, "국민은행", result.BankName)
	assert.Equal(t, "004", result.BankCode)
	assert.Equal(t, "9876543210", result.AccountNumber)
	assert.Equal(t, "김인증", result.AccountHolder)

	// DB에서 사용자 KYC 상태 확인
	var updatedUser domain.User
	svc.db.First(&updatedUser, user.ID)
	assert.Equal(t, "VERIFIED", updatedUser.KycStatus)
	assert.NotNil(t, updatedUser.BankVerifiedAt)
	assert.Equal(t, "국민은행", *updatedUser.BankName)
}

func TestKyc_ConfirmBankVerify_Success_NoUser(t *testing.T) {
	svc, _ := setupKycTestDB()

	session, _ := svc.RequestBankVerify(BankVerifyRequest{
		BankCode: "088", BankName: "신한은행",
		AccountNumber: "1111222233334444", AccountHolder: "박회원",
	})

	// userID=0 (회원가입 중, 아직 사용자 없음)
	result, err := svc.ConfirmBankVerify(0, BankVerifyConfirmRequest{
		VerifyTrDt:    session.VerifyTrDt,
		VerifyTrNo:    session.VerifyTrNo,
		VerifyVal:     session.VerifyTrNo,
		BankCode:      "088",
		AccountNumber: "1111222233334444",
	})

	require.NoError(t, err)
	assert.Equal(t, "신한은행", result.BankName)
}

func TestKyc_ConfirmBankVerify_WrongCode(t *testing.T) {
	svc, _ := setupKycTestDB()

	session, _ := svc.RequestBankVerify(BankVerifyRequest{
		BankCode: "004", BankName: "국민은행",
		AccountNumber: "9876543210", AccountHolder: "김인증",
	})

	_, err := svc.ConfirmBankVerify(0, BankVerifyConfirmRequest{
		VerifyTrDt:    session.VerifyTrDt,
		VerifyTrNo:    session.VerifyTrNo,
		VerifyVal:     "000000000", // 틀린 인증번호
		BankCode:      "004",
		AccountNumber: "9876543210",
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "인증 번호가 일치하지 않습니다")
}

func TestKyc_ConfirmBankVerify_WrongAccount(t *testing.T) {
	svc, _ := setupKycTestDB()

	session, _ := svc.RequestBankVerify(BankVerifyRequest{
		BankCode: "004", BankName: "국민은행",
		AccountNumber: "9876543210", AccountHolder: "김인증",
	})

	_, err := svc.ConfirmBankVerify(0, BankVerifyConfirmRequest{
		VerifyTrDt:    session.VerifyTrDt,
		VerifyTrNo:    session.VerifyTrNo,
		VerifyVal:     session.VerifyTrNo,
		BankCode:      "004",
		AccountNumber: "1111111111", // 다른 계좌번호
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "계좌번호와 일치하지 않습니다")
}

func TestKyc_ConfirmBankVerify_SessionNotFound(t *testing.T) {
	svc, _ := setupKycTestDB()

	_, err := svc.ConfirmBankVerify(0, BankVerifyConfirmRequest{
		VerifyTrDt:    "20260325",
		VerifyTrNo:    "999999999",
		VerifyVal:     "999999999",
		BankCode:      "004",
		AccountNumber: "1234567890",
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "유효한 인증 세션을 찾을 수 없습니다")
}

func TestKyc_ConfirmBankVerify_SessionExpired(t *testing.T) {
	svc, cfg := setupKycTestDB()

	// 만료시간을 과거로 설정
	cfg.KYCSessionExpiry = -1 * time.Minute
	session, _ := svc.RequestBankVerify(BankVerifyRequest{
		BankCode: "004", BankName: "국민은행",
		AccountNumber: "9876543210", AccountHolder: "김인증",
	})

	_, err := svc.ConfirmBankVerify(0, BankVerifyConfirmRequest{
		VerifyTrDt:    session.VerifyTrDt,
		VerifyTrNo:    session.VerifyTrNo,
		VerifyVal:     session.VerifyTrNo,
		BankCode:      "004",
		AccountNumber: "9876543210",
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "만료")
	cfg.KYCSessionExpiry = 15 * time.Minute // 복원
}

func TestKyc_ConfirmBankVerify_AlreadyVerified(t *testing.T) {
	svc, _ := setupKycTestDB()

	session, _ := svc.RequestBankVerify(BankVerifyRequest{
		BankCode: "004", BankName: "국민은행",
		AccountNumber: "9876543210", AccountHolder: "김인증",
	})

	confirmReq := BankVerifyConfirmRequest{
		VerifyTrDt:    session.VerifyTrDt,
		VerifyTrNo:    session.VerifyTrNo,
		VerifyVal:     session.VerifyTrNo,
		BankCode:      "004",
		AccountNumber: "9876543210",
	}

	// 1차 인증 성공
	_, err := svc.ConfirmBankVerify(0, confirmReq)
	require.NoError(t, err)

	// 2차 인증 시도 — 이미 사용된 세션
	_, err = svc.ConfirmBankVerify(0, confirmReq)
	require.Error(t, err, "이미 인증된 세션은 재사용 불가")
	assert.Contains(t, err.Error(), "유효한 인증 세션을 찾을 수 없습니다")
}

// ── 계좌 변경 (ChangeBankAccount) ──

func TestKyc_ChangeBankAccount_Success(t *testing.T) {
	svc, _ := setupKycTestDB()

	// 기존 사용자 (이미 인증 완료)
	user := &domain.User{Email: "change@test.com", Password: "hashed", Role: "USER", KycStatus: "VERIFIED"}
	svc.db.Create(user)

	// 새 인증 세션 생성
	session, _ := svc.RequestBankVerify(BankVerifyRequest{
		BankCode: "088", BankName: "신한은행",
		AccountNumber: "5555666677778888", AccountHolder: "이계좌",
	})

	// 계좌 변경 — verifyWord는 인증 시 session.VerifyTrNo와 일치해야 함
	result, err := svc.ChangeBankAccount(user.ID, session.VerifyTrNo, session.VerifyTrNo)
	require.NoError(t, err)
	assert.Equal(t, "신한은행", result["bankName"])
	assert.Equal(t, "이계좌", result["accountHolder"])
	assert.Equal(t, "VERIFIED", result["kycStatus"])

	// 마스킹 확인
	masked := result["accountNumber"].(string)
	assert.Contains(t, masked, "***", "계좌번호가 마스킹되어야 함")

	// 세션이 삭제되었는지 확인
	var count int64
	svc.db.Model(&domain.KycVerifySession{}).Where("VerifyTrNo = ?", session.VerifyTrNo).Count(&count)
	assert.Equal(t, int64(0), count, "사용 완료된 세션은 삭제되어야 함")
}

func TestKyc_ChangeBankAccount_ExpiredSession(t *testing.T) {
	svc, cfg := setupKycTestDB()

	user := &domain.User{Email: "exp@test.com", Password: "hashed", Role: "USER"}
	svc.db.Create(user)

	cfg.KYCSessionExpiry = -1 * time.Minute
	session, _ := svc.RequestBankVerify(BankVerifyRequest{
		BankCode: "004", BankName: "국민은행",
		AccountNumber: "1234567890", AccountHolder: "박만료",
	})
	cfg.KYCSessionExpiry = 15 * time.Minute

	_, err := svc.ChangeBankAccount(user.ID, session.VerifyTrNo, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "만료")
}

// ── 계좌 조회 (GetBankAccount) ──

func TestKyc_GetBankAccount_Success(t *testing.T) {
	svc, _ := setupKycTestDB()

	bankName := "우리은행"
	user := &domain.User{
		Email: "bank@test.com", Password: "hashed", Role: "USER",
		BankName: &bankName,
	}
	svc.db.Create(user)

	result, err := svc.GetBankAccount(user.ID)
	require.NoError(t, err)
	assert.Equal(t, "우리은행", *result.BankName)
}

func TestKyc_GetBankAccount_NotFound(t *testing.T) {
	svc, _ := setupKycTestDB()

	_, err := svc.GetBankAccount(99999)
	require.Error(t, err)
}

// ── KCB 인증 ──

func TestKyc_StartKcbAuth(t *testing.T) {
	svc, _ := setupKycTestDB()

	result, err := svc.StartKcbAuth()
	require.NoError(t, err)
	assert.NotEmpty(t, result["kcbAuthId"])
	assert.Contains(t, result["popupUrl"], "kcbAuthId=")
}

func TestKyc_CompleteKcbAuth_Success(t *testing.T) {
	svc, _ := setupKycTestDB()
	svc.db.AutoMigrate(&domain.SmsVerification{})

	result, err := svc.CompleteKcbAuth("auth-123", "홍길동", "01012345678", "CI_VALUE", "19900101", "M", "KR", "SKT")
	require.NoError(t, err)
	assert.True(t, result["verified"].(bool))
	assert.Equal(t, "홍길동", result["name"])
}

func TestKyc_CompleteKcbAuth_EmptyName(t *testing.T) {
	svc, _ := setupKycTestDB()

	result, err := svc.CompleteKcbAuth("auth-123", "", "01012345678", "", "", "", "", "")
	require.NoError(t, err)
	assert.False(t, result["verified"].(bool), "이름이 비어있으면 인증 실패")
}

// ── 통합 시나리오: 회원가입 → 1원 인증 → 로그인 ──

func TestKyc_FullRegistrationFlow(t *testing.T) {
	db := setupTestDB()
	db.AutoMigrate(&domain.KycVerifySession{})

	cfg := &config.Config{
		JWTSecret:        "test-secret",
		JWTAccessExpiry:  time.Hour,
		EncryptionKey:    testEncKey,
		KYCSessionExpiry: 15 * time.Minute,
	}

	kycSvc := NewKycService(db, cfg)
	mfaSvc := NewMfaService(db, cfg)
	authSvc := NewAuthService(db, cfg, mfaSvc)

	// 1. 회원가입
	user := &domain.User{Email: "full@test.com", Password: "Password1!"}
	err := authSvc.Register(user, nil)
	require.NoError(t, err)

	var registeredUser domain.User
	db.First(&registeredUser, user.ID)
	assert.Equal(t, "NONE", registeredUser.KycStatus, "가입 직후 KYC 상태는 NONE")

	// 2. 1원 인증 요청
	session, err := kycSvc.RequestBankVerify(BankVerifyRequest{
		BankCode: "004", BankName: "국민은행",
		AccountNumber: "1234567890", AccountHolder: "홍길동",
	})
	require.NoError(t, err)

	// 3. 1원 인증 확인
	result, err := kycSvc.ConfirmBankVerify(user.ID, BankVerifyConfirmRequest{
		VerifyTrDt:    session.VerifyTrDt,
		VerifyTrNo:    session.VerifyTrNo,
		VerifyVal:     session.VerifyTrNo,
		BankCode:      "004",
		AccountNumber: "1234567890",
	})
	require.NoError(t, err)
	assert.Equal(t, "국민은행", result.BankName)

	// 4. KYC 상태 최종 확인
	db.First(&registeredUser, user.ID)
	assert.Equal(t, "VERIFIED", registeredUser.KycStatus, "인증 후 KYC 상태는 VERIFIED")
	assert.NotNil(t, registeredUser.BankVerifiedAt)

	// 5. 로그인하여 KYC 상태 확인
	raw, _, err := authSvc.Login("full@test.com", "Password1!", "", "")
	require.NoError(t, err)
	loginRes := raw.(*LoginResponse)
	assert.Equal(t, "VERIFIED", loginRes.User.KycStatus)
}

// ── 전화번호 변경 (ChangePhone) ──

// setupKycWithSms는 ChangePhone, UpdateUserKycFromSms 테스트에 필요한
// SmsVerification 테이블까지 마이그레이션하는 헬퍼입니다.
func setupKycWithSms() (*KycService, *config.Config) {
	svc, cfg := setupKycTestDB()
	svc.db.AutoMigrate(&domain.SmsVerification{})
	return svc, cfg
}

func TestKyc_ChangePhone_Success(t *testing.T) {
	svc, _ := setupKycWithSms()

	// 사용자 생성
	user := &domain.User{Email: "chphone@test.com", Password: "hashed", Role: "USER", KycStatus: "NONE"}
	svc.db.Create(user)

	// KCB 인증 완료 기록 시딩
	phone := "01099998888"
	svc.db.Create(&domain.SmsVerification{Phone: &phone, BankUser: strPtr("홍길동")})

	// 전화번호 변경
	err := svc.ChangePhone(user.ID, phone)
	require.NoError(t, err)

	// DB 확인
	var updated domain.User
	svc.db.First(&updated, user.ID)
	assert.Equal(t, phone, *updated.Phone)
	assert.Equal(t, "VERIFIED", updated.KycStatus)
}

func TestKyc_ChangePhone_NotVerified(t *testing.T) {
	svc, _ := setupKycWithSms()

	user := &domain.User{Email: "noverify@test.com", Password: "hashed", Role: "USER"}
	svc.db.Create(user)

	// SMS_VERIFICATION에 기록 없는 번호로 변경 시도
	err := svc.ChangePhone(user.ID, "01011112222")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "본인인증 기록이 없습니다")
}

func TestKyc_ChangePhone_DuplicatePhone(t *testing.T) {
	svc, _ := setupKycWithSms()

	phone := "01055556666"

	// 첫 번째 사용자 — 이미 이 번호를 사용 중
	user1 := &domain.User{Email: "dup1@test.com", Password: "hashed", Role: "USER", Phone: &phone}
	svc.db.Create(user1)

	// 두 번째 사용자 — 같은 번호로 변경 시도
	user2 := &domain.User{Email: "dup2@test.com", Password: "hashed", Role: "USER"}
	svc.db.Create(user2)

	// KCB 인증 기록 시딩
	svc.db.Create(&domain.SmsVerification{Phone: &phone, BankUser: strPtr("김중복")})

	err := svc.ChangePhone(user2.ID, phone)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "이미 다른 계정에서 사용 중")
}

func TestKyc_ChangePhone_InvalidRequest(t *testing.T) {
	svc, _ := setupKycWithSms()

	tests := []struct {
		name   string
		userID int
		phone  string
	}{
		{"userID 0", 0, "01012345678"},
		{"userID 음수", -1, "01012345678"},
		{"빈 전화번호", 1, ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := svc.ChangePhone(tc.userID, tc.phone)
			assert.Error(t, err, "유효하지 않은 요청은 거부되어야 합니다")
		})
	}
}

// ── SMS 인증 후 KYC 업데이트 (UpdateUserKycFromSms) ──

func TestKyc_UpdateUserKycFromSms_Success(t *testing.T) {
	svc, _ := setupKycWithSms()

	user := &domain.User{Email: "smskyc@test.com", Password: "hashed", Role: "USER", KycStatus: "NONE"}
	svc.db.Create(user)

	phone := "01077776666"
	svc.db.Create(&domain.SmsVerification{Phone: &phone, BankUser: strPtr("이인증")})

	err := svc.UpdateUserKycFromSms(user.ID, phone)
	require.NoError(t, err)

	var updated domain.User
	svc.db.First(&updated, user.ID)
	assert.Equal(t, "VERIFIED", updated.KycStatus)
	assert.Equal(t, phone, *updated.Phone)
}

func TestKyc_UpdateUserKycFromSms_PhoneNotVerified(t *testing.T) {
	svc, _ := setupKycWithSms()

	// SMS_VERIFICATION에 기록 없는 번호
	err := svc.UpdateUserKycFromSms(1, "01000000000")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "인증 내역이 없습니다")
}

func TestKyc_UpdateUserKycFromSms_NoUser(t *testing.T) {
	svc, _ := setupKycWithSms()

	phone := "01033334444"
	svc.db.Create(&domain.SmsVerification{Phone: &phone, BankUser: strPtr("박비회원")})

	// userID=0 — 아직 회원가입 전
	err := svc.UpdateUserKycFromSms(0, phone)
	assert.NoError(t, err, "userID=0이면 에러 없이 반환")
}

// ── ChangeBankAccount 잘못된 인증어 ──

func TestKyc_ChangeBankAccount_WrongVerifyWord(t *testing.T) {
	svc, _ := setupKycTestDB()

	user := &domain.User{Email: "wrongword@test.com", Password: "hashed", Role: "USER"}
	svc.db.Create(user)

	session, err := svc.RequestBankVerify(BankVerifyRequest{
		BankCode: "004", BankName: "국민은행",
		AccountNumber: "1234567890", AccountHolder: "김인증",
	})
	require.NoError(t, err)

	_, err = svc.ChangeBankAccount(user.ID, session.VerifyTrNo, "999999999")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "인증 번호가 일치하지 않습니다")
}

// ── CompleteKcbAuth 빈 전화번호 ──

func TestKyc_CompleteKcbAuth_EmptyPhone(t *testing.T) {
	svc, _ := setupKycTestDB()

	result, err := svc.CompleteKcbAuth("auth-456", "홍길동", "", "", "", "", "", "")
	require.NoError(t, err)
	assert.False(t, result["verified"].(bool), "전화번호가 비어있으면 인증 실패")
}

// ── GetSmsVerification 직접 테스트 ──

func TestKyc_GetSmsVerification_Success(t *testing.T) {
	svc, _ := setupKycWithSms()

	phone := "01044445555"
	name := "조회성공"
	svc.db.Create(&domain.SmsVerification{Phone: &phone, BankUser: &name})

	result, err := svc.GetSmsVerification(phone)
	require.NoError(t, err)
	assert.Equal(t, phone, *result.Phone)
	assert.Equal(t, "조회성공", *result.BankUser)
}

func TestKyc_GetSmsVerification_NotFound(t *testing.T) {
	svc, _ := setupKycWithSms()

	_, err := svc.GetSmsVerification("01099999999")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "인증 내역이 없습니다")
}
