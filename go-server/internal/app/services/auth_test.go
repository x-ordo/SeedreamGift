// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// 이 테스트 파일은 Auth 서비스의 단위 및 통합 테스트를 제공합니다.
package services

import (
	"testing"
	"time"
	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/crypto"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestAuthService는 테스트용 AuthService와 DB를 생성합니다.
func newTestAuthService() (*AuthService, *config.Config) {
	db := setupTestDB()
	cfg := &config.Config{
		JWTSecret:       "test-secret",
		JWTAccessExpiry: time.Hour,
		EncryptionKey:   testEncKey,
	}
	mfaSvc := NewMfaService(db, cfg)
	return NewAuthService(db, cfg, mfaSvc), cfg
}

// TestAuthService_RegisterAndLogin은 사용자 등록 및 로그인의 기본 성공/실패 시나리오를 테스트합니다.
func TestAuthService_RegisterAndLogin(t *testing.T) {
	service, _ := newTestAuthService()

	// 1. Test Register
	user := &domain.User{
		Email:    "test@example.com",
		Password: "Password1!",
	}
	err := service.Register(user, nil)
	assert.NoError(t, err)

	// 2. Test Login Success (MFA disabled — returns *LoginResponse)
	raw, rawToken, err := service.Login("test@example.com", "Password1!", "", "")
	assert.NoError(t, err)
	res, ok := raw.(*LoginResponse)
	assert.True(t, ok, "expected *LoginResponse when MFA is disabled")
	assert.NotNil(t, res)
	assert.NotEmpty(t, res.AccessToken)
	assert.NotEmpty(t, rawToken)
	assert.Equal(t, "test@example.com", res.User.Email)

	// 3. Test Login Failure (Wrong password)
	raw, _, err = service.Login("test@example.com", "wrongpass", "", "")
	assert.Error(t, err)
	assert.Nil(t, raw)
}

// ── Register 검증 위임 테스트 ──

func TestRegister_RejectsInvalidEmail(t *testing.T) {
	service, _ := newTestAuthService()

	tests := []struct {
		name  string
		email string
	}{
		{"빈 이메일", ""},
		{"형식 오류", "not-an-email"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			user := &domain.User{Email: tc.email, Password: "Password1!"}
			err := service.Register(user, nil)
			assert.Error(t, err, "잘못된 이메일은 거부되어야 합니다")
		})
	}
}

func TestRegister_RejectsInvalidPassword(t *testing.T) {
	service, _ := newTestAuthService()

	tests := []struct {
		name string
		pwd  string
	}{
		{"7자 미달", "Aa1!xyz"},
		{"영문자 없음", "12345678!"},
		{"숫자 없음", "Abcdefgh!"},
		{"특수문자 없음", "Abcdefg1"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			user := &domain.User{Email: "valid@test.com", Password: tc.pwd}
			err := service.Register(user, nil)
			assert.Error(t, err, "잘못된 비밀번호는 거부되어야 합니다")
		})
	}
}

func TestRegister_RejectsInvalidPhone(t *testing.T) {
	service, _ := newTestAuthService()
	badPhone := "02-1234-5678"
	user := &domain.User{
		Email:    "phone@test.com",
		Password: "Password1!",
		Phone:    &badPhone,
	}
	err := service.Register(user, nil)
	assert.Error(t, err, "잘못된 전화번호는 거부되어야 합니다")
}

// ── Register 성공 시 기본값 할당 ──

func TestRegister_SetsDefaultRoleAndKycStatus(t *testing.T) {
	service, _ := newTestAuthService()

	user := &domain.User{
		Email:    "defaults@test.com",
		Password: "Password1!",
	}
	err := service.Register(user, nil)
	require.NoError(t, err)

	assert.Equal(t, "USER", user.Role, "기본 Role은 USER여야 합니다")
	assert.Equal(t, "NONE", user.KycStatus, "기본 KycStatus는 NONE이어야 합니다")
}

// ── Register 비밀번호 해싱 ──

func TestRegister_HashesPassword(t *testing.T) {
	service, _ := newTestAuthService()
	plainPassword := "Password1!"

	user := &domain.User{
		Email:    "hash@test.com",
		Password: plainPassword,
	}
	err := service.Register(user, nil)
	require.NoError(t, err)

	// 등록 후 user.Password는 bcrypt 해시여야 합니다
	assert.NotEqual(t, plainPassword, user.Password, "비밀번호가 평문으로 저장되면 안 됩니다")
	assert.True(t, crypto.CheckPasswordHash(plainPassword, user.Password), "원래 비밀번호로 해시 검증이 가능해야 합니다")
}

// ── Register 중복 이메일 ──

func TestRegister_RejectsDuplicateEmail(t *testing.T) {
	service, _ := newTestAuthService()

	// 첫 번째 등록
	user1 := &domain.User{Email: "dup@test.com", Password: "Password1!"}
	err := service.Register(user1, nil)
	require.NoError(t, err)

	// 같은 이메일로 두 번째 등록
	user2 := &domain.User{Email: "dup@test.com", Password: "Password2@"}
	err = service.Register(user2, nil)
	assert.Error(t, err, "중복 이메일은 거부되어야 합니다")
}

// ── Register with Name/Phone ──

func TestRegister_WithOptionalFields(t *testing.T) {
	service, _ := newTestAuthService()
	name := "홍길동"
	phone := "01012345678"

	user := &domain.User{
		Email:    "optional@test.com",
		Password: "Password1!",
		Name:     &name,
		Phone:    &phone,
	}
	err := service.Register(user, nil)
	require.NoError(t, err)

	assert.Equal(t, &name, user.Name)
	assert.Equal(t, &phone, user.Phone)
	assert.NotZero(t, user.ID, "등록 후 ID가 할당되어야 합니다")
}

// ── Register 후 Login 가능 여부 ──

func TestRegister_ThenLoginSucceeds(t *testing.T) {
	service, _ := newTestAuthService()

	user := &domain.User{
		Email:    "logintest@test.com",
		Password: "Password1!",
	}
	err := service.Register(user, nil)
	require.NoError(t, err)

	raw, refreshToken, err := service.Login("logintest@test.com", "Password1!", "test-agent", "127.0.0.1")
	require.NoError(t, err)

	res, ok := raw.(*LoginResponse)
	require.True(t, ok)
	assert.NotEmpty(t, res.AccessToken)
	assert.NotEmpty(t, refreshToken)
	assert.Equal(t, "logintest@test.com", res.User.Email)
	assert.Equal(t, "USER", res.User.Role)
	assert.Equal(t, "NONE", res.User.KycStatus)
}
