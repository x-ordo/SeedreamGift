package domain

import "time"

// WebAuthnCredential은 사용자의 FIDO2/Passkey 자격 증명 정보를 저장합니다.
// 각 사용자는 여러 개의 WebAuthn 자격 증명(예: 여러 기기)을 등록할 수 있습니다.
type WebAuthnCredential struct {
	ID              int        `gorm:"primaryKey;column:Id" json:"id"`
	UserID          int        `gorm:"column:UserId;index" json:"userId"`
	CredentialID    string     `gorm:"column:CredentialId;size:500;uniqueIndex" json:"credentialId"` // base64url encoded
	PublicKey       []byte     `gorm:"column:PublicKey;type:varbinary(max)" json:"-"`
	AttestationType string     `gorm:"column:AttestationType;size:30" json:"attestationType"`
	Transport       string     `gorm:"column:Transport;size:100" json:"transport"` // comma-separated: usb,nfc,ble,internal
	SignCount       uint32     `gorm:"column:SignCount" json:"signCount"`
	AAGUID          string     `gorm:"column:AAGUID;size:36" json:"aaguid"`     // authenticator GUID
	Name            string     `gorm:"column:Name;size:50" json:"name"`         // user-given name like "MacBook Pro"
	CreatedAt       time.Time  `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	LastUsedAt      *time.Time `gorm:"column:LastUsedAt" json:"lastUsedAt"`
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (WebAuthnCredential) TableName() string { return "WebAuthnCredentials" }
