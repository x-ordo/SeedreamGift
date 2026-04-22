package domain

import "time"

// TradeIn은 고객이 보유한 상품권을 시스템에 판매(매입 신청)할 때 생성되는 엔티티입니다.
// 상품 정보, 핀 번호, 입금받을 계좌 정보 및 검수/지급 상태를 관리합니다.
type TradeIn struct {
	ID int `gorm:"primaryKey;column:Id" json:"id"`
	// UserID는 매입을 신청한 사용자의 ID입니다.
	UserID int  `gorm:"column:UserId;index:IX_TradeIns_UserId" json:"userId"`
	User   User `gorm:"foreignKey:UserID" json:"user,omitempty"`
	// ProductID는 매입 신청한 대상 상품의 ID입니다.
	ProductID int     `gorm:"column:ProductId" json:"productId"`
	Product   Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	// 아래 필드들은 상품의 상태가 변경되더라도 신청 당시의 정보를 보존하기 위해 스냅샷으로 저장합니다.
	ProductName  *string         `gorm:"column:ProductName;size:30" json:"productName"`
	ProductBrand *string         `gorm:"column:ProductBrand;size:10" json:"productBrand"`
	ProductPrice *NumericDecimal `gorm:"column:ProductPrice;type:decimal(10,0)" json:"productPrice"`
	Quantity     int             `gorm:"column:Quantity;default:1" json:"quantity"`
	// 디지털 상품권의 경우 핀 번호 및 보안 코드를 저장합니다.
	PinCode      *string `gorm:"column:PinCode;size:100" json:"pinCode"`
	PinHash      *string `gorm:"column:PinHash;size:64" json:"pinHash"`
	SecurityCode *string `gorm:"column:SecurityCode;size:100" json:"securityCode"`
	GiftNumber   *string `gorm:"column:GiftNumber;size:100" json:"giftNumber"`
	// 매입 대금을 입금받을 계좌 정보입니다.
	BankName      *string `gorm:"column:BankName;size:15" json:"bankName"`
	AccountNum    *string `gorm:"column:AccountNum;size:100" json:"accountNum"`
	AccountHolder *string `gorm:"column:AccountHolder;size:10" json:"accountHolder"`
	// PayoutAmount는 수수료 등을 제외하고 실제로 고객에게 입금될 금액입니다.
	PayoutAmount NumericDecimal `gorm:"column:PayoutAmount;type:decimal(10,0)" json:"payoutAmount"`
	// Status는 매입 진행 상태입니다. (REQUESTED, RECEIVED, VERIFIED, PAID, REJECTED)
	Status string `gorm:"column:Status;default:'REQUESTED';size:10" json:"status"`
	// Source는 매입 신청의 발생 채널을 나타냅니다. (USER: 일반 고객, PARTNER: 파트너 대시보드)
	Source string `gorm:"column:Source;default:'USER';size:10" json:"source"`
	// AdminNote는 관리자가 검토 과정에서 남기는 내부 메모입니다.
	AdminNote *string `gorm:"column:AdminNote;size:500" json:"adminNote"`
	// 실물 상품권 매입 시 배송 정보를 담습니다.
	SenderName     *string    `gorm:"column:SenderName;size:10" json:"senderName"`
	SenderPhone    *string    `gorm:"column:SenderPhone;size:15" json:"senderPhone"`
	SenderEmail    *string    `gorm:"column:SenderEmail;size:50" json:"senderEmail"`
	ShippingMethod *string    `gorm:"column:ShippingMethod;size:10" json:"shippingMethod"`
	ShippingDate   *time.Time `gorm:"column:ShippingDate" json:"shippingDate"`
	ArrivalDate    *time.Time `gorm:"column:ArrivalDate" json:"arrivalDate"`
	Message        *string    `gorm:"column:Message;size:200" json:"message"`
	TrackingNumber *string    `gorm:"column:TrackingNumber;size:30" json:"trackingNumber,omitempty"`
	Carrier        *string    `gorm:"column:Carrier;size:20" json:"carrier,omitempty"`
	// 검수 및 정산 처리 정보입니다.
	ReceivedAt         *time.Time      `gorm:"column:ReceivedAt" json:"receivedAt,omitempty"`
	TransferRef        *string         `gorm:"column:TransferRef;size:50" json:"transferRef,omitempty"`
	AppliedRate        *NumericDecimal `gorm:"column:AppliedRate;type:decimal(5,2)" json:"appliedRate,omitempty"`
	InspectionNote     *string         `gorm:"column:InspectionNote;type:nvarchar(500)" json:"inspectionNote,omitempty"`
	VerifiedByAdminId  *int            `gorm:"column:VerifiedByAdminId" json:"verifiedByAdminId,omitempty"`
	VerificationMethod *string         `gorm:"column:VerificationMethod;size:20" json:"verificationMethod,omitempty"`
	AmlRiskScore       *int            `gorm:"column:AmlRiskScore" json:"amlRiskScore,omitempty"`
	PaymentRefNumber   *string         `gorm:"column:PaymentRefNumber;size:50" json:"paymentRefNumber,omitempty"`
	PaymentProcessedAt *time.Time      `gorm:"column:PaymentProcessedAt" json:"paymentProcessedAt,omitempty"`
	ProcessedByAdminId *int            `gorm:"column:ProcessedByAdminId" json:"processedByAdminId,omitempty"`
	CreatedAt          time.Time       `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time       `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
}

func (TradeIn) TableName() string { return "TradeIns" }
