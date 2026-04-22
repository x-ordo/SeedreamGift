package domain

import "time"

// CashReceipt는 현금영수증 발급/취소 내역을 관리합니다.
type CashReceipt struct {
	ID      int   `gorm:"primaryKey;column:Id" json:"id"`
	OrderID int   `gorm:"index:IX_CashReceipts_OrderId;column:OrderId" json:"orderId"`
	Order   Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	UserID  int   `gorm:"index:IX_CashReceipts_UserId;column:UserId" json:"userId"`
	User    User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
	// Type은 현금영수증 발급 유형입니다. (INCOME_DEDUCTION: 소득공제, EXPENSE_PROOF: 지출증빙)
	Type string `gorm:"column:Type;size:20" json:"type"`
	// IdentityType은 식별번호 유형입니다. (PHONE, BUSINESS_NO, CARD_NO)
	IdentityType string `gorm:"column:IdentityType;size:15" json:"identityType"`
	// IdentityNumber는 식별번호입니다. (AES-256 암호화 저장)
	IdentityNumber string `gorm:"column:IdentityNumber;size:200" json:"-"`
	// MaskedIdentity는 마스킹된 식별번호입니다. (예: 010****5678)
	MaskedIdentity string `gorm:"column:MaskedIdentity;size:20" json:"maskedIdentity"`
	// SupplyAmount는 공급가액입니다.
	SupplyAmount NumericDecimal `gorm:"column:SupplyAmount;type:decimal(12,0)" json:"supplyAmount"`
	// TaxAmount는 부가세입니다.
	TaxAmount NumericDecimal `gorm:"column:TaxAmount;type:decimal(12,0)" json:"taxAmount"`
	// TotalAmount는 총 금액입니다.
	TotalAmount NumericDecimal `gorm:"column:TotalAmount;type:decimal(12,0)" json:"totalAmount"`
	// MgtKey는 팝빌 문서 관리번호입니다.
	MgtKey string `gorm:"uniqueIndex:UQ_CashReceipts_MgtKey;column:MgtKey;size:24" json:"mgtKey"`
	// ConfirmNum은 국세청 승인번호입니다.
	ConfirmNum *string `gorm:"column:ConfirmNum;size:24" json:"confirmNum"`
	// TradeDate는 국세청 거래일자입니다. (YYYYMMDD)
	TradeDate *string `gorm:"column:TradeDate;size:8" json:"tradeDate"`
	// Status는 현금영수증 상태입니다. (PENDING, ISSUED, FAILED, CANCELLED)
	Status string `gorm:"index:IX_CashReceipts_Status;column:Status;size:10;default:'PENDING'" json:"status"`
	// IsAutoIssued는 자진발급 여부입니다.
	IsAutoIssued bool `gorm:"column:IsAutoIssued;default:false" json:"isAutoIssued"`
	// OriginalID는 사후 신청으로 대체된 원본 자진발급 건의 ID입니다.
	OriginalID *int `gorm:"column:OriginalId" json:"originalId,omitempty"`
	// FailReason은 발급 실패 사유입니다.
	FailReason *string `gorm:"column:FailReason;size:500" json:"failReason,omitempty"`
	// CancelledReceiptID는 취소 발급 시 원본 현금영수증 ID입니다.
	CancelledReceiptID *int `gorm:"column:CancelledReceiptId" json:"cancelledReceiptId,omitempty"`
	// RetryCount는 발급 재시도 횟수입니다.
	RetryCount  int        `gorm:"column:RetryCount;default:0" json:"retryCount"`
	IssuedAt    *time.Time `gorm:"column:IssuedAt" json:"issuedAt,omitempty"`
	CancelledAt *time.Time `gorm:"column:CancelledAt" json:"cancelledAt,omitempty"`
	CreatedAt   time.Time  `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time  `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
}

func (CashReceipt) TableName() string { return "CashReceipts" }
