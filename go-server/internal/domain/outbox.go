package domain

import "time"

// OutboxMessage는 트랜잭셔널 아웃박스 패턴을 위한 메시지 저장 모델입니다.
// DB 트랜잭션 안에서 비즈니스 로직과 함께 저장되며, 별도 릴레이 프로세스가
// PENDING 상태의 메시지를 읽어 실제 발송합니다.
//
// 이 패턴은 "DB 저장 성공 + 알림 실패" 불일치를 완전히 제거합니다.
type OutboxMessage struct {
	ID        int        `gorm:"primaryKey;column:Id" json:"id"`
	Channel   string     `gorm:"column:Channel;size:20;index" json:"channel"`     // EMAIL, KAKAO, TELEGRAM
	EventType string     `gorm:"column:EventType;size:50;index" json:"eventType"` // ORDER_CREATED, FRAUD_HOLD, PIN_ISSUED, etc.
	Payload   string     `gorm:"column:Payload;type:nvarchar(max)" json:"payload"` // JSON 직렬화된 데이터
	Status    string     `gorm:"column:Status;size:10;default:'PENDING';index" json:"status"` // PENDING, SENT, FAILED
	Attempts  int        `gorm:"column:Attempts;default:0" json:"attempts"`
	MaxRetry  int        `gorm:"column:MaxRetry;default:5" json:"maxRetry"`
	Error     *string    `gorm:"column:Error;size:500" json:"error"`
	CreatedAt time.Time  `gorm:"column:CreatedAt;autoCreateTime;index" json:"createdAt"`
	SentAt    *time.Time `gorm:"column:SentAt" json:"sentAt"`
}

func (OutboxMessage) TableName() string { return "OutboxMessages" }
