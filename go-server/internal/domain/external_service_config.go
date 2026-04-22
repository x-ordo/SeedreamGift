package domain

import "time"

// ExternalServiceConfig는 외부 서비스(이메일, 카카오, 텔레그램, 팝빌) 설정을 DB에 저장합니다.
// 채널 × 필드(key-value) 구조로, 시크릿 필드는 AES-256 암호화 저장됩니다.
type ExternalServiceConfig struct {
	ID         int       `gorm:"primaryKey;column:Id" json:"id"`
	Channel    string    `gorm:"column:Channel;size:20;uniqueIndex:UQ_ExtSvcCfg" json:"channel"`
	FieldName  string    `gorm:"column:FieldName;size:50;uniqueIndex:UQ_ExtSvcCfg" json:"fieldName"`
	FieldValue string    `gorm:"column:FieldValue;type:nvarchar(max)" json:"-"`
	IsSecret   bool      `gorm:"column:IsSecret;default:false" json:"isSecret"`
	UpdatedAt  time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
	UpdatedBy  *string   `gorm:"column:UpdatedBy;size:100" json:"updatedBy,omitempty"`
}

func (ExternalServiceConfig) TableName() string { return "ExternalServiceConfigs" }
