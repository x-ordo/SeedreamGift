package domain

import "time"

// BlacklistCheckLog는 Blacklist-DB 스크리닝 결과를 저장합니다.
// 캐시(설정 가능 TTL)와 감사 로그를 겸합니다.
type BlacklistCheckLog struct {
	ID            int       `gorm:"primaryKey;column:Id" json:"id"`
	UserID        int       `gorm:"column:UserId;index" json:"userId"`
	CandidateName string    `gorm:"column:CandidateName;size:50" json:"candidateName"` // 마스킹 저장
	Status        string    `gorm:"column:Status;size:10" json:"status"`               // BLOCKED / CLEARED
	MatchCode     string    `gorm:"column:MatchCode;size:5" json:"matchCode"`          // 비트맵
	IncidentCount int       `gorm:"column:IncidentCount" json:"incidentCount"`
	Source        string    `gorm:"column:Source;size:15" json:"source"`   // ORDER / TRADEIN / realtime
	SourceID      *int      `gorm:"column:SourceId" json:"sourceId"`
	ExpiresAt     time.Time `gorm:"column:ExpiresAt;index" json:"expiresAt"`
	CreatedAt     time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
}

func (BlacklistCheckLog) TableName() string { return "BlacklistCheckLogs" }
