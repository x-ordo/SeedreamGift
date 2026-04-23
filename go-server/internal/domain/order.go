package domain

import "time"

// Order는 시스템에서 발생하는 모든 주문의 핵심 엔티티입니다.
// 주문의 상태 관리, 결제 정보 연동, 배송 및 수령인 정보 등을 포함합니다.
type Order struct {
	// ID는 데이터베이스의 기본 키입니다.
	ID int `gorm:"primaryKey;column:Id" json:"id"`
	// OrderCode는 사용자에게 노출되는 고유 주문 번호입니다. (예: 20231027-ABCDE)
	OrderCode *string `gorm:"column:OrderCode;size:30;uniqueIndex" json:"orderCode"`
	// UserID는 주문을 생성한 사용자의 ID입니다.
	UserID int `gorm:"column:UserId;index:IX_Orders_UserId;index:IX_Orders_UserId_CreatedAt" json:"userId"`
	// User는 주문자와의 관계를 나타냅니다.
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
	// TotalAmount는 주문 총액입니다. (상품 합계 + 배송비 등)
	TotalAmount NumericDecimal `gorm:"column:TotalAmount;type:decimal(12,0)" json:"totalAmount"`
	// Status는 주문의 현재 상태입니다.
	//   기존: PENDING, PAID, DELIVERED, COMPLETED, CANCELLED, REFUNDED
	//   Seedream 추가: ISSUED, EXPIRED, AMOUNT_MISMATCH (최장 15자)
	// 상태 전이는 validation.go의 ValidateOrderTransition에서 관리됩니다.
	// DB 반영: migrations/008_seedream_payment_data_model.sql
	Status string `gorm:"column:Status;default:'PENDING';size:20" json:"status"`
	// Source는 주문의 발생 채널을 나타냅니다. (USER: 일반 고객, PARTNER: 파트너 대시보드)
	Source string `gorm:"column:Source;default:'USER';size:10" json:"source"`
	// PaymentMethod는 사용된 결제 수단입니다. (VIRTUAL_ACCOUNT, CARD, BANK_TRANSFER 등)
	PaymentMethod *string `gorm:"column:PaymentMethod;size:15" json:"paymentMethod"`
	// PaymentKey는 외부 결제 게이트웨이(PG)에서 제공하는 고유 결제 키입니다.
	PaymentKey *string `gorm:"column:PaymentKey;size:64" json:"paymentKey"`
	// IdempotencyKey는 중복 결제 방지를 위한 멱등성 키입니다.
	IdempotencyKey *string `gorm:"column:IdempotencyKey;size:36" json:"idempotencyKey"`
	// ShippingMethod는 배송 방식입니다. (DIGITAL, PHYSICAL 등)
	ShippingMethod *string `gorm:"column:ShippingMethod;size:10" json:"shippingMethod"`
	// RecipientName은 수령인 이름입니다.
	RecipientName *string `gorm:"column:RecipientName;size:10" json:"recipientName"`
	// RecipientPhone은 수령인 연락처입니다.
	RecipientPhone *string `gorm:"column:RecipientPhone;size:15" json:"recipientPhone"`
	// RecipientAddr은 수령인 주소입니다.
	RecipientAddr *string `gorm:"column:RecipientAddr;size:100" json:"recipientAddr"`
	// RecipientZip은 수령인 우편번호입니다.
	RecipientZip *string `gorm:"column:RecipientZip;size:5" json:"recipientZip"`
	// CashReceiptType은 현금영수증 발행 유형입니다. (PERSONAL, BUSINESS 등)
	CashReceiptType *string `gorm:"column:CashReceiptType;size:10" json:"cashReceiptType"`
	// CashReceiptNumber은 현금영수증 발행 번호입니다.
	CashReceiptNumber *string `gorm:"column:CashReceiptNumber;size:20" json:"cashReceiptNumber"`
	// PaymentDeadlineAt은 결제 대기 상태의 입금 기한입니다.
	PaymentDeadlineAt *time.Time `gorm:"column:PaymentDeadlineAt" json:"paymentDeadlineAt,omitempty"`
	// WithdrawalDeadlineAt은 주문 취소 가능 기한입니다.
	WithdrawalDeadlineAt *time.Time `gorm:"column:WithdrawalDeadlineAt" json:"withdrawalDeadlineAt,omitempty"`
	// DigitalDeliveryAt은 디지털 상품(바우처 등)이 발송된 시각입니다.
	DigitalDeliveryAt *time.Time `gorm:"column:DigitalDeliveryAt" json:"digitalDeliveryAt,omitempty"`
	// AdminNote는 관리자가 해당 주문에 대해 남기는 메모입니다.
	AdminNote *string `gorm:"column:AdminNote;type:nvarchar(500)" json:"adminNote,omitempty"`
	// CreatedAt은 주문 생성 일시입니다.
	CreatedAt time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	// UpdatedAt은 주문 정보 수정 일시입니다.
	UpdatedAt time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`

	// OrderItems는 주문에 포함된 상세 상품 목록입니다.
	OrderItems []OrderItem `gorm:"foreignKey:OrderID" json:"items,omitempty"`
	// VoucherCodes는 주문 완료 후 발급되거나 할당된 바우처 코드 목록입니다.
	VoucherCodes []VoucherCode `gorm:"foreignKey:OrderID" json:"voucherCodes,omitempty"`
	// Payments는 주문에 대해 생성된 결제 시도 기록입니다 (1:N).
	// GORM Preload("Payments") 로 주문 상세 드릴다운에서 결제 시도 타임라인을 구성합니다.
	Payments []Payment `gorm:"foreignKey:OrderID" json:"payments,omitempty"`
}

func (Order) TableName() string { return "Orders" }

// OrderItem은 주문에 포함된 개별 상품의 수량 및 가격 정보를 담고 있습니다.
type OrderItem struct {
	ID int `gorm:"primaryKey;column:Id" json:"id"`
	// OrderID는 소속된 주문의 ID입니다.
	OrderID int `gorm:"column:OrderId" json:"orderId"`
	// ProductID는 구매한 상품의 ID입니다.
	ProductID int `gorm:"column:ProductId" json:"productId"`
	// Product는 구매한 상품의 상세 정보입니다.
	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	// Quantity는 구매 수량입니다.
	Quantity int `gorm:"column:Quantity" json:"quantity"`
	// Price는 구매 당시의 개당 상품 가격입니다.
	Price NumericDecimal `gorm:"column:Price;type:decimal(10,0)" json:"price"`
}

func (OrderItem) TableName() string { return "OrderItems" }

// Payment는 주문에 대한 결제 시도 및 결과 정보를 관리합니다.
// 하나의 주문에 대해 여러 번의 결제 시도가 있을 수 있으므로 별도 엔티티로 관리합니다.
type Payment struct {
	ID int `gorm:"primaryKey;column:Id" json:"id"`
	// OrderID는 결제 대상 주문의 ID입니다.
	OrderID int `gorm:"index;column:OrderId" json:"orderId"`
	// Order는 결제 대상 주문의 상세 정보입니다.
	Order Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	// Method는 결제 수단입니다.
	Method string `gorm:"column:Method;size:20" json:"method"`
	// Amount는 실 결제 금액입니다.
	Amount NumericDecimal `gorm:"column:Amount;type:decimal(12,0)" json:"amount"`
	// Status는 결제 상태를 나타냅니다. (PENDING, SUCCESS, FAILED, CANCELLED)
	Status string `gorm:"index;column:Status;default:'PENDING';size:15" json:"status"`
	// BankCode는 가상계좌 입금 시 은행 코드입니다.
	BankCode *string `gorm:"column:BankCode;size:4" json:"bankCode"`
	// BankName은 가상계좌 입금 시 은행 이름입니다.
	BankName *string `gorm:"column:BankName;size:15" json:"bankName"`
	// AccountNumber는 가상계좌 번호입니다. (보안을 위해 JSON 출력에서 제외)
	AccountNumber *string `gorm:"column:AccountNumber;size:100" json:"-"`
	// DepositorName은 입금자명입니다.
	DepositorName *string `gorm:"column:DepositorName;size:15" json:"depositorName"`
	// BankTxID는 은행 또는 PG사에서 발급한 거래 식별 번호입니다.
	BankTxID *string `gorm:"index;column:BankTxId;size:64" json:"bankTxId"`
	// ConfirmedAt은 결제가 확정(입금 완료 등)된 시각입니다.
	ConfirmedAt *time.Time `gorm:"column:ConfirmedAt" json:"confirmedAt"`
	// CancelledAt은 결제가 취소된 시각입니다.
	CancelledAt *time.Time `gorm:"column:CancelledAt" json:"cancelledAt"`
	// ExpiresAt은 가상계좌 등의 입금 만료 시각입니다.
	ExpiresAt *time.Time `gorm:"column:ExpiresAt" json:"expiresAt"`
	// FailReason은 결제 실패 시 사유를 저장합니다.
	FailReason *string `gorm:"column:FailReason;size:200" json:"failReason"`
	// CreatedAt은 결제 정보 생성 시각입니다.
	CreatedAt time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`

	// ── Seedream 통합 필드 (설계 §4.2) ──

	// SeedreamVAccountID 는 Seedream /api/v1/vaccount 발급 응답의 data.id (BIGINT).
	// GET /api/v1/vaccount 단건 조회 및 감사 추적 시 사용.
	SeedreamVAccountID *int64 `gorm:"column:SeedreamVAccountId;index" json:"seedreamVAccountId,omitempty"`
	// SeedreamPhase 는 Seedream 이 노출하는 VA 결제 세부 단계입니다.
	// 값: awaiting_bank_selection | awaiting_deposit | completed | cancelled | failed
	// 주의: Order.Status 와 다른 enum. Payment 의 vendor sub-state 만 표현.
	SeedreamPhase *string `gorm:"column:SeedreamPhase;size:30" json:"seedreamPhase,omitempty"`
	// SeedreamIdempotencyKey 는 Seedream 호출 시 사용한 Idempotency-Key 원본.
	// 형식: gift:vaccount:{OrderCode} | gift:cancel:{OrderCode} | gift:refund:{OrderCode}:{ts}
	// 주의: Order.IdempotencyKey (클라이언트 dedup) 와 별개. 이건 vendor 호출 감사 추적용.
	SeedreamIdempotencyKey *string `gorm:"column:SeedreamIdempotencyKey;size:200" json:"seedreamIdempotencyKey,omitempty"`
	// SeedreamDaouTrx 는 키움페이가 은행선택 완료 시 발급하는 거래번호입니다.
	// Seedream GET /api/v1/vaccount?orderNo= 응답의 daouTrx 필드 또는
	// VAccountCancelled/DepositCancelDeposited 웹훅 payload 에서 획득.
	// 취소/환불 호출 시 CancelPaymentRequest.TrxID 로 전달 (통합 가이드 §7.3).
	// awaiting_bank_selection 단계에서는 null (은행선택 전 발급 안 됨).
	SeedreamDaouTrx *string `gorm:"column:SeedreamDaouTrx;size:20;index" json:"seedreamDaouTrx,omitempty"`

	// UpdatedAt은 결제 정보 수정 시각입니다.
	UpdatedAt time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
}

func (Payment) TableName() string { return "Payments" }

// Refund는 주문 취소 또는 반품에 따른 환불 요청 정보를 관리합니다.
type Refund struct {
	ID int `gorm:"primaryKey;column:Id" json:"id"`
	// OrderID는 환불 대상 주문의 ID입니다. (주문당 하나의 환불 레코드)
	OrderID int `gorm:"uniqueIndex;column:OrderId" json:"orderId"`
	// Order는 환불 대상 주문의 상세 정보입니다.
	Order Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	// Amount는 환불 예정 또는 완료된 금액입니다.
	Amount NumericDecimal `gorm:"column:Amount;type:decimal(12,0)" json:"amount"`
	// Reason은 사용자가 입력한 환불 사유입니다.
	Reason string `gorm:"column:Reason;size:200" json:"reason"`
	// Status는 환불 진행 상태입니다. (REQUESTED, APPROVED, REJECTED, COMPLETED)
	Status string `gorm:"index;column:Status;default:'REQUESTED';size:10" json:"status"`
	// ProcessedBy는 환불을 처리한 관리자의 ID입니다.
	ProcessedBy *int `gorm:"column:ProcessedBy" json:"processedBy"`
	// ProcessedAt은 환불 처리가 완료된 시각입니다.
	ProcessedAt *time.Time `gorm:"column:ProcessedAt" json:"processedAt"`
	// AdminNote는 관리자가 환불 처리 시 남기는 메모(거절 사유 등)입니다.
	AdminNote *string `gorm:"column:AdminNote;size:500" json:"adminNote"`
	// CreatedAt은 환불 요청 시각입니다.
	CreatedAt time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	// UpdatedAt은 환불 정보 수정 시각입니다.
	UpdatedAt time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
}

func (Refund) TableName() string { return "Refunds" }
