package domain

import "time"

// IdempotencyRecord는 멱등성 키의 처리 결과를 저장합니다.
// 동일한 키로 재요청 시 DB에서 기존 응답을 즉시 반환합니다.
type IdempotencyRecord struct {
	Key        string    `gorm:"primaryKey;column:IdempotencyKey;size:64" json:"key"`
	UserID     int       `gorm:"column:UserId;index" json:"userId"`
	StatusCode int       `gorm:"column:StatusCode" json:"statusCode"`
	Response   string    `gorm:"column:Response;type:nvarchar(max)" json:"response"`
	ExpiresAt  time.Time `gorm:"column:ExpiresAt;index" json:"expiresAt"`
	CreatedAt  time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
}

func (IdempotencyRecord) TableName() string { return "IdempotencyRecords" }
