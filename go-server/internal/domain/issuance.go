package domain

import "time"

// IssuanceLog는 외부 API를 통한 상품권 발급 시도의 이력을 기록합니다.
// 발급 요청/응답, 재시도 횟수, 성공/실패 상태를 추적하여 디버깅과 감사에 활용합니다.
type IssuanceLog struct {
	ID              int        `gorm:"primaryKey;column:Id;autoIncrement" json:"id"`
	OrderID         int        `gorm:"column:OrderId;index" json:"orderId"`
	OrderItemID     int        `gorm:"column:OrderItemId" json:"orderItemId"`
	ProductID       int        `gorm:"column:ProductId" json:"productId"`
	ProviderCode    string     `gorm:"column:ProviderCode;size:20" json:"providerCode"`
	Status          string     `gorm:"column:Status;size:20;index" json:"status"` // PENDING, SUCCESS, FAILED, REFUNDED, FAILED_REFUND_PENDING
	AttemptCount    int        `gorm:"column:AttemptCount;default:0" json:"attemptCount"`
	RequestPayload  *string    `gorm:"column:RequestPayload;type:nvarchar(max)" json:"requestPayload"`
	ResponsePayload *string    `gorm:"column:ResponsePayload;type:nvarchar(max)" json:"responsePayload"` // PIN 마스킹 후 저장
	ErrorMessage    *string    `gorm:"column:ErrorMessage;size:500" json:"errorMessage"`
	TransactionRef  *string    `gorm:"column:TransactionRef;size:100" json:"transactionRef"`
	CreatedAt       time.Time  `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	CompletedAt     *time.Time `gorm:"column:CompletedAt" json:"completedAt"`
}

func (IssuanceLog) TableName() string { return "IssuanceLogs" }
