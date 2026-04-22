package domain

import "time"

// Gift는 사용자 간의 선물하기 정보를 나타냅니다.
// 구매자가 상품을 결제한 후 다른 사용자(수신자)에게 선물 메시지와 함께 보낼 때 생성됩니다.
type Gift struct {
	ID         int        `gorm:"primaryKey;column:Id" json:"id"`
	SenderID   int        `gorm:"index;column:SenderId" json:"senderId"`              // 선물 보낸 사람 ID
	ReceiverID int        `gorm:"index;column:ReceiverId" json:"receiverId"`          // 선물 받는 사람 ID
	OrderID    int        `gorm:"unique;column:OrderId" json:"orderId"`               // 연관된 주문 ID
	Status     string     `gorm:"column:Status;default:'SENT';size:10" json:"status"` // 상태: SENT(발송), CLAIMED(수령), EXPIRED(만료)
	ClaimedAt  *time.Time `gorm:"column:ClaimedAt" json:"claimedAt"`                  // 수령 일시
	ExpiresAt  *time.Time `gorm:"column:ExpiresAt" json:"expiresAt"`                  // 만료 일시 (만료 전까지 수령 가능)
	Message    *string    `gorm:"column:Message;size:200" json:"message"`             // 선물 메시지
	CreatedAt  time.Time  `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`   // 선물 일시
	SenderName string     `gorm:"-" json:"senderName"`                                // 보낸 사람 이름 (DB 저장 안 함, 계산된 값)

	Sender   User  `gorm:"foreignKey:SenderID" json:"sender,omitempty"`     // 보낸 사람 정보
	Receiver User  `gorm:"foreignKey:ReceiverID" json:"receiver,omitempty"` // 받는 사람 정보
	Order    Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`       // 주문 상세 정보
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (Gift) TableName() string { return "Gifts" }
