package domain

import "time"

// FraudCheckLog는 더치트 API를 통한 사기 피해사례 조회 기록을 저장합니다.
// 캐시(24시간)와 감사 로그를 겸합니다.
type FraudCheckLog struct {
	ID          int       `gorm:"primaryKey;column:Id" json:"id"`
	UserID      int       `gorm:"column:UserId;index" json:"userId"`
	Keyword     string    `gorm:"column:Keyword;size:100" json:"keyword"`
	KeywordType string    `gorm:"column:KeywordType;size:10" json:"keywordType"`
	BankCode    *string   `gorm:"column:BankCode;size:4" json:"bankCode"`
	Caution     string    `gorm:"column:Caution;size:1" json:"caution"`
	KeywordURL  *string   `gorm:"column:KeywordUrl;size:500" json:"keywordUrl"`
	Source      string    `gorm:"column:Source;size:15" json:"source"`
	SourceID    *int      `gorm:"column:SourceId" json:"sourceId"`
	ExpiresAt   time.Time `gorm:"column:ExpiresAt;index" json:"expiresAt"`
	CreatedAt   time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
}

func (FraudCheckLog) TableName() string { return "FraudCheckLogs" }
