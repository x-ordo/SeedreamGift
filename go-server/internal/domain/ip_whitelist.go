package domain

import "time"

// IPWhitelistEntry는 특정 사용자(ADMIN/PARTNER)가 허용하는 접속 IP 주소입니다.
// IpWhitelistEnabled가 true인 사용자는 이 테이블에 등록된 IP에서만 접근 가능합니다.
type IPWhitelistEntry struct {
	ID          int       `gorm:"primaryKey;column:Id;autoIncrement" json:"id"`
	UserID      int       `gorm:"column:UserId;index" json:"userId"`
	IpAddress   string    `gorm:"column:IpAddress;size:45;not null" json:"ipAddress"`
	Description string    `gorm:"column:Description;size:100" json:"description"`
	CreatedAt   time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
}

func (IPWhitelistEntry) TableName() string { return "IpWhitelistEntries" }
