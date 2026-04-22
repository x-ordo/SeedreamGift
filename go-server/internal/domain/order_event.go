package domain

import "time"

// OrderEvent는 주문에 발생한 모든 상태 변경 이벤트를 기록합니다.
// Event Sourcing의 부분 적용으로, 기존 Order 상태와 함께 이벤트 이력을 추적합니다.
type OrderEvent struct {
	ID        int       `gorm:"primaryKey;column:Id;autoIncrement" json:"id"`
	OrderID   int       `gorm:"column:OrderId;index" json:"orderId"`
	EventType string    `gorm:"column:EventType;size:40" json:"eventType"`
	Payload   string    `gorm:"column:Payload;type:nvarchar(max)" json:"payload"`
	ActorID   *int      `gorm:"column:ActorId" json:"actorId,omitempty"`
	ActorType string    `gorm:"column:ActorType;size:10" json:"actorType"` // USER, ADMIN, SYSTEM
	CreatedAt time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
}

func (OrderEvent) TableName() string { return "OrderEvents" }

// 이벤트 타입 상수
const (
	EventOrderCreated         = "ORDER_CREATED"
	EventOrderFraudHeld       = "ORDER_FRAUD_HELD"
	EventOrderPaid            = "ORDER_PAID"
	EventOrderDelivered       = "ORDER_DELIVERED"
	EventOrderCancelled       = "ORDER_CANCELLED"
	EventOrderRefunded        = "ORDER_REFUNDED"
	EventVoucherReserved      = "VOUCHER_RESERVED"
	EventVoucherSold          = "VOUCHER_SOLD"
	EventVoucherReleased      = "VOUCHER_RELEASED"
	EventFulfillmentStarted   = "FULFILLMENT_STARTED"
	EventFulfillmentCompleted = "FULFILLMENT_COMPLETED"
	EventFulfillmentFailed    = "FULFILLMENT_FAILED"
)
