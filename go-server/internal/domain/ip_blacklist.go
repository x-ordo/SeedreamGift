package domain

import "time"

// IPBlacklistEntry는 자동 또는 수동으로 차단된 IP 주소를 영속화합니다.
// 서버 재시작 후에도 차단이 유지됩니다.
type IPBlacklistEntry struct {
	ID        int       `gorm:"primaryKey;column:Id;autoIncrement" json:"id"`
	IpAddress string    `gorm:"column:IpAddress;size:45;not null;uniqueIndex" json:"ipAddress"`
	Reason    string    `gorm:"column:Reason;size:200" json:"reason"`
	Source    string    `gorm:"column:Source;size:20;default:'AUTO'" json:"source"` // AUTO, MANUAL, BRUTE_FORCE
	CreatedAt time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
}

func (IPBlacklistEntry) TableName() string { return "IpBlacklistEntries" }
