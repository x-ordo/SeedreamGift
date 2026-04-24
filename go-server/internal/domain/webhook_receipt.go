package domain

import "time"

// WebhookReceipt 는 Seedream 이 보낸 웹훅 1건의 수신 기록입니다.
// DeliveryID 를 PK 로 두어 Seedream 재전송(같은 DeliveryID 로 옴) 에 대해
// clause.OnConflict{DoNothing: true} 삽입만으로 멱등 no-op 을 달성합니다.
//
// 참조: Seedream 통합 가이드 §8.5 (멱등 수신)
type WebhookReceipt struct {
	// DeliveryID 는 Seedream WebhookDeliveries.Id (int64 BIGINT).
	// X-Seedream-Delivery-Id 헤더로 내려옴 — 외부 발급 ID 이므로 autoIncrement 아님.
	// GORM 기본 primaryKey+int64 는 autoIncrement 로 해석해 INSERT SQL 에서 컬럼을
	// 누락시키는데, MSSQL 의 DeliveryId 가 NOT NULL 로 정의돼 있어 이를 막으려면
	// autoIncrement:false 를 명시해야 함 (2026-04-24 production smoke 중 발견).
	DeliveryID int64 `gorm:"primaryKey;autoIncrement:false;column:DeliveryId" json:"deliveryId"`
	// Event 는 X-Seedream-Event 헤더값. 예: "vaccount.deposited"
	Event string `gorm:"column:Event;size:50;not null" json:"event"`
	// EventID 는 payload.eventId (uuid). DeliveryID 와 별개이며 payload-level 중복 감지 보조용.
	EventID *string `gorm:"column:EventId;size:36;index" json:"eventId,omitempty"`
	// OrderNo 는 payload.orderNo. Reconcile·감사 조회 인덱스.
	OrderNo *string `gorm:"column:OrderNo;size:50;index" json:"orderNo,omitempty"`
	// ReceivedAt 은 수신 시각.
	ReceivedAt time.Time `gorm:"column:ReceivedAt;autoCreateTime" json:"receivedAt"`
	// ProcessedAt 은 비동기 워커가 상태머신 적용을 완료한 시각. NULL 이면 미처리.
	ProcessedAt *time.Time `gorm:"column:ProcessedAt" json:"processedAt,omitempty"`
	// RawBody 는 원본 payload (감사용). Seedream AuditLog 4 KiB 절삭 한계를 보완.
	RawBody string `gorm:"column:RawBody;type:nvarchar(max)" json:"-"`
}

// TableName 은 GORM 이 사용할 테이블 이름을 반환합니다.
func (WebhookReceipt) TableName() string { return "WebhookReceipts" }
