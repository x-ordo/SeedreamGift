package domain

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
)

// ── IsLocked ──

func TestUser_IsLocked_FutureTime(t *testing.T) {
	future := time.Now().Add(10 * time.Minute)
	u := &User{LockedUntil: &future}
	assert.True(t, u.IsLocked(), "LockedUntil이 미래이면 잠금 상태여야 합니다")
}

func TestUser_IsLocked_PastTime(t *testing.T) {
	past := time.Now().Add(-10 * time.Minute)
	u := &User{LockedUntil: &past}
	assert.False(t, u.IsLocked(), "LockedUntil이 과거이면 잠금 해제 상태여야 합니다")
}

func TestUser_IsLocked_Nil(t *testing.T) {
	u := &User{LockedUntil: nil}
	assert.False(t, u.IsLocked(), "LockedUntil이 nil이면 잠금 해제 상태여야 합니다")
}

// ── RecordLoginFailure ──

func TestUser_RecordLoginFailure_BelowThreshold(t *testing.T) {
	u := &User{FailedLoginAttempts: 0}

	u.RecordLoginFailure(5, 15*time.Minute)

	assert.Equal(t, 1, u.FailedLoginAttempts, "실패 횟수가 1 증가해야 합니다")
	assert.Nil(t, u.LockedUntil, "임계치 미만이면 잠금되지 않아야 합니다")
}

func TestUser_RecordLoginFailure_AtThreshold(t *testing.T) {
	u := &User{FailedLoginAttempts: 4} // 한 번 더 실패하면 5(threshold)

	u.RecordLoginFailure(5, 15*time.Minute)

	assert.Equal(t, 5, u.FailedLoginAttempts)
	assert.NotNil(t, u.LockedUntil, "임계치 도달 시 잠금되어야 합니다")
	assert.True(t, u.LockedUntil.After(time.Now()), "잠금 시각은 현재보다 미래여야 합니다")
}

func TestUser_RecordLoginFailure_AboveThreshold(t *testing.T) {
	u := &User{FailedLoginAttempts: 10}

	u.RecordLoginFailure(5, 30*time.Minute)

	assert.Equal(t, 11, u.FailedLoginAttempts)
	assert.NotNil(t, u.LockedUntil, "임계치 초과 시에도 잠금되어야 합니다")
}

// ── ResetLoginFailures ──

func TestUser_ResetLoginFailures(t *testing.T) {
	future := time.Now().Add(10 * time.Minute)
	u := &User{
		FailedLoginAttempts: 5,
		LockedUntil:         &future,
	}

	u.ResetLoginFailures()

	assert.Equal(t, 0, u.FailedLoginAttempts, "실패 횟수가 0으로 초기화되어야 합니다")
	assert.Nil(t, u.LockedUntil, "잠금이 해제되어야 합니다")
}

// ── IsPartner ──

func TestUser_IsPartner(t *testing.T) {
	assert.True(t, (&User{Role: "PARTNER"}).IsPartner())
	assert.False(t, (&User{Role: "USER"}).IsPartner())
	assert.False(t, (&User{Role: "ADMIN"}).IsPartner())
}

// ── IsAdmin ──

func TestUser_IsAdmin(t *testing.T) {
	assert.True(t, (&User{Role: "ADMIN"}).IsAdmin())
	assert.False(t, (&User{Role: "USER"}).IsAdmin())
	assert.False(t, (&User{Role: "PARTNER"}).IsAdmin())
}

// ── HasVerifiedBank ──

func TestUser_HasVerifiedBank_AllFieldsSet(t *testing.T) {
	now := time.Now()
	bankName := "국민은행"
	accountNumber := "1234567890"
	u := &User{
		BankVerifiedAt: &now,
		BankName:       &bankName,
		AccountNumber:  &accountNumber,
	}
	assert.True(t, u.HasVerifiedBank(), "모든 계좌 필드가 설정되면 true여야 합니다")
}

func TestUser_HasVerifiedBank_NilFields(t *testing.T) {
	tests := []struct {
		name string
		user *User
	}{
		{"BankVerifiedAt nil", &User{BankVerifiedAt: nil, BankName: strPtr("KB"), AccountNumber: strPtr("123")}},
		{"BankName nil", &User{BankVerifiedAt: timePtr(time.Now()), BankName: nil, AccountNumber: strPtr("123")}},
		{"AccountNumber nil", &User{BankVerifiedAt: timePtr(time.Now()), BankName: strPtr("KB"), AccountNumber: nil}},
		{"All nil", &User{}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.False(t, tc.user.HasVerifiedBank(), "필수 필드가 nil이면 false여야 합니다")
		})
	}
}

// ── EffectiveCommissionRate ──

func TestUser_EffectiveCommissionRate_CustomRate(t *testing.T) {
	rate := NewNumericDecimal(decimal.NewFromFloat(3.5))
	u := &User{CommissionRate: &rate}

	result := u.EffectiveCommissionRate(5.0)
	assert.InDelta(t, 3.5, result, 0.01, "커스텀 수수료율이 반환되어야 합니다")
}

func TestUser_EffectiveCommissionRate_SystemDefault(t *testing.T) {
	u := &User{CommissionRate: nil}

	result := u.EffectiveCommissionRate(5.0)
	assert.InDelta(t, 5.0, result, 0.01, "커스텀 수수료율이 없으면 시스템 기본값이 반환되어야 합니다")
}

// ── helpers ──

func strPtr(s string) *string    { return &s }
func timePtr(t time.Time) *time.Time { return &t }
