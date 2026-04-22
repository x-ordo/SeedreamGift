package domain

import (
	"time"

	"gorm.io/gorm"
)

// User는 시스템을 이용하는 모든 회원(일반 사용자, 파트너사, 관리자)의 통합 엔티티입니다.
// 기본 인적 사항부터 보안 설정, 본인인증(KYC) 상태, 개별 구매 한도 등을 관리합니다.
type User struct {
	ID int `gorm:"primaryKey;column:Id" json:"id"`
	// Email은 사용자의 로그인 ID이며 시스템 내에서 유일해야 합니다.
	Email string `gorm:"unique;column:Email;size:100" json:"email"`
	// Password는 암호화(해싱)되어 저장되며 JSON 응답에서는 제외됩니다.
	Password string  `gorm:"column:Password;size:60" json:"-"`
	Name     *string `gorm:"column:Name;size:50" json:"name"`
	// Phone은 본인인증 시 사용되는 휴대폰 번호입니다.
	Phone *string `gorm:"unique;column:Phone;size:15" json:"phone"`
	// 배송 및 정산에 필요한 주소 정보입니다.
	ZipCode       string `gorm:"column:ZipCode;default:'';size:5" json:"zipCode"`
	Address       string `gorm:"column:Address;default:'';size:200" json:"address"`
	AddressDetail string `gorm:"column:AddressDetail;default:'';size:200" json:"addressDetail"`
	// Role은 사용자의 권한을 정의합니다. (USER, PARTNER, ADMIN)
	Role string `gorm:"column:Role;default:'USER';size:10" json:"role"`
	// KycStatus는 본인인증 상태입니다. (NONE, PENDING, VERIFIED)
	KycStatus string `gorm:"column:KycStatus;default:'NONE';size:10" json:"kycStatus"`
	// KycData는 본인인증 시 제출된 심사 서류 등에 대한 메타데이터입니다.
	KycData *string `gorm:"column:KycData;size:1000" json:"kycData"`
	// 아래 필드들은 특정 사용자에게 시스템 기본값과 다른 구매 한도를 부여할 때 사용합니다.
	CustomLimitPerTx    *NumericDecimal `gorm:"column:CustomLimitPerTx;type:decimal(12,0)" json:"customLimitPerTx"`
	CustomLimitPerDay   *NumericDecimal `gorm:"column:CustomLimitPerDay;type:decimal(12,0)" json:"customLimitPerDay"`
	CustomLimitPerMonth *NumericDecimal `gorm:"column:CustomLimitPerMonth;type:decimal(12,0)" json:"customLimitPerMonth,omitempty"`
	CustomLimitPerYear  *NumericDecimal `gorm:"column:CustomLimitPerYear;type:decimal(12,0)" json:"customLimitPerYear,omitempty"`
	// 알림 수신 동의 여부입니다.
	EmailNotification bool `gorm:"column:EmailNotification;default:true" json:"emailNotification"`
	PushNotification  bool `gorm:"column:PushNotification;default:true" json:"pushNotification"`
	// 파트너(입점사) 전용 필드들입니다.
	PartnerTier        *string         `gorm:"column:PartnerTier;size:10" json:"partnerTier"`
	TotalTradeInVolume *NumericDecimal `gorm:"column:TotalTradeInVolume;type:decimal(12,0)" json:"totalTradeInVolume"`
	PartnerSince       *time.Time      `gorm:"column:PartnerSince" json:"partnerSince"`
	CommissionRate     *NumericDecimal `gorm:"column:CommissionRate;type:decimal(5,2)" json:"commissionRate,omitempty"`
	PayoutFrequency    *string         `gorm:"column:PayoutFrequency;size:10" json:"payoutFrequency,omitempty"`
	DailyPinLimit      *int            `gorm:"column:DailyPinLimit" json:"dailyPinLimit,omitempty"`
	// 정산용 계좌 정보입니다. 보안을 위해 계좌번호는 JSON 응답에서 제외할 수 있습니다.
	BankName      *string `gorm:"column:BankName;size:15" json:"bankName"`
	BankCode      *string `gorm:"column:BankCode;size:4" json:"bankCode"`
	AccountNumber *string `json:"-" gorm:"column:AccountNumber;size:100"`
	AccountHolder *string `gorm:"column:AccountHolder;size:15" json:"accountHolder"`
	// 계좌 점유 인증 일시입니다.
	BankVerifiedAt     *time.Time `gorm:"column:BankVerifiedAt" json:"bankVerifiedAt"`
	VerifyAttemptCount int        `gorm:"column:VerifyAttemptCount;default:0" json:"verifyAttemptCount"`
	// 보안 및 잠금 정책용 필드들입니다.
	FailedLoginAttempts int        `gorm:"column:FailedLoginAttempts;default:0" json:"failedLoginAttempts"`
	LockedUntil         *time.Time `gorm:"column:LockedUntil" json:"lockedUntil"`
	PasswordResetToken  *string    `gorm:"column:PasswordResetToken;size:64" json:"-"`
	PasswordResetExpiry *time.Time `gorm:"column:PasswordResetExpiry" json:"-"`
	// KYC 심사 관리자 정보입니다.
	KycVerifiedBy        *string `gorm:"column:KycVerifiedBy;size:15" json:"kycVerifiedBy"`
	KycVerifiedByAdminId *int    `gorm:"column:KycVerifiedByAdminId" json:"kycVerifiedByAdminId"`
	// MFA(2차 인증) 설정 정보입니다.
	MfaEnabled      bool    `gorm:"column:MfaEnabled;default:false" json:"mfaEnabled"`
	TotpSecret      *string `gorm:"column:TotpSecret;size:200" json:"-"`
	WebAuthnEnabled    bool `gorm:"column:WebAuthnEnabled;default:false" json:"webAuthnEnabled"`
	IpWhitelistEnabled bool `gorm:"column:IpWhitelistEnabled;default:false" json:"ipWhitelistEnabled"`
	LastLoginAt *time.Time     `gorm:"column:LastLoginAt" json:"lastLoginAt"`
	// IsDeleted는 탈퇴 여부를 나타내는 명시적 플래그입니다.
	IsDeleted bool           `gorm:"column:IsDeleted;default:false;index" json:"isDeleted"`
	CreatedAt time.Time      `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index;column:DeletedAt" json:"-"`
}

func (User) TableName() string { return "Users" }

// ========================================
// Domain Methods
// ========================================

// IsLocked는 사용자 계정이 현재 잠금 상태인지 확인합니다.
func (u *User) IsLocked() bool {
	return u.LockedUntil != nil && u.LockedUntil.After(time.Now())
}

// IsPartner는 사용자가 파트너 역할인지 확인합니다.
func (u *User) IsPartner() bool {
	return u.Role == "PARTNER"
}

// IsAdmin은 사용자가 관리자 역할인지 확인합니다.
func (u *User) IsAdmin() bool {
	return u.Role == "ADMIN"
}

// HasVerifiedBank는 계좌가 인증된 상태인지 확인합니다.
func (u *User) HasVerifiedBank() bool {
	return u.BankVerifiedAt != nil && u.BankName != nil && u.AccountNumber != nil
}

// RecordLoginFailure는 로그인 실패를 기록하고, 임계치 초과 시 계정을 잠급니다.
func (u *User) RecordLoginFailure(threshold int, lockDuration time.Duration) {
	u.FailedLoginAttempts++
	if u.FailedLoginAttempts >= threshold {
		lockUntil := time.Now().Add(lockDuration)
		u.LockedUntil = &lockUntil
	}
}

// ResetLoginFailures는 로그인 실패 횟수와 잠금 상태를 초기화합니다.
func (u *User) ResetLoginFailures() {
	u.FailedLoginAttempts = 0
	u.LockedUntil = nil
}

// EffectiveCommissionRate는 파트너의 유효 수수료율을 반환합니다.
// 개별 수수료율이 설정되어 있으면 그 값을, 아니면 시스템 기본값을 반환합니다.
func (u *User) EffectiveCommissionRate(systemDefault float64) float64 {
	if u.CommissionRate != nil {
		return u.CommissionRate.InexactFloat64()
	}
	return systemDefault
}

// RefreshToken은 세션 유지를 위한 JWT 리프레시 토큰 정보를 담습니다.
// 보안을 위해 실제 토큰값은 DB에 해싱되어 저장됩니다.
type RefreshToken struct {
	ID int `gorm:"primaryKey;column:Id" json:"id"`
	// Token은 리프레시 토큰의 해시값입니다.
	Token  string `json:"-" gorm:"column:Token;uniqueIndex;size:250"`
	UserID int    `gorm:"column:UserId" json:"userId"`
	User   User   `gorm:"foreignKey:UserID" json:"-"`
	// ExpiresAt이 지나면 토큰을 사용한 갱신이 불가능합니다.
	ExpiresAt time.Time `gorm:"column:ExpiresAt" json:"expiresAt"`
	// 보안 감사용 메타데이터입니다.
	UserAgent *string   `gorm:"column:UserAgent;size:256" json:"userAgent"`
	IPAddress *string   `gorm:"column:IpAddress;size:45" json:"ipAddress"`
	CreatedAt time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
}

func (RefreshToken) TableName() string { return "RefreshTokens" }
