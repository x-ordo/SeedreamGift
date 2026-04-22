package domain

import "time"

// PolicyConsent는 사용자의 약관 동의 기록을 추적합니다.
// 약관 버전 변경 시 재동의 여부 확인 및 규제 감사 목적으로 사용됩니다.
type PolicyConsent struct {
	// ID는 데이터베이스의 기본 키입니다.
	ID int `gorm:"primaryKey;column:Id" json:"id"`
	// UserID는 약관에 동의한 사용자의 ID입니다.
	UserID int `gorm:"index:IX_PolicyConsents_UserId;column:UserId;not null" json:"userId"`
	// PolicyID는 동의한 약관의 ID입니다.
	PolicyID int `gorm:"index:IX_PolicyConsents_PolicyId_Version;column:PolicyId;not null" json:"policyId"`
	// Version은 동의 시점의 약관 버전입니다. (예: "v1.0", "2024-01")
	Version string `gorm:"index:IX_PolicyConsents_PolicyId_Version;column:Version;size:20;not null" json:"version"`
	// ConsentAt은 사용자가 약관에 동의한 시각입니다.
	ConsentAt time.Time `gorm:"column:ConsentAt;autoCreateTime;not null" json:"consentAt"`
	// IPAddress는 동의 시점의 클라이언트 IP 주소입니다 (IPv4/IPv6 최대 45자).
	IPAddress string `gorm:"column:IpAddress;size:45" json:"ipAddress"`
}

func (PolicyConsent) TableName() string { return "PolicyConsents" }
