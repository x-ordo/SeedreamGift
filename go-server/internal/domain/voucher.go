package domain

import "time"

// VoucherCode는 상품권(바우처)의 PIN 번호 재고 및 판매 정보를 나타냅니다.
// 바우처는 시스템 관리자가 일괄 등록하거나 파트너사가 API를 통해 공급할 수 있습니다.
type VoucherCode struct {
	ID                    int             `gorm:"primaryKey;column:Id" json:"id"`
	ProductID             int             `gorm:"column:ProductId;index:IX_VoucherCodes_ProductId_Status" json:"productId"`                                                              // 해당 상품 ID
	Product               Product         `gorm:"foreignKey:ProductID" json:"product,omitempty"`                                                                                         // 상품 상세 정보
	PinCode               string          `gorm:"column:PinCode;size:100" json:"pinCode"`                                                                                                // 바우처 PIN 번호 (암호화되어 저장될 수 있음)
	PinHash               string          `gorm:"unique;column:PinHash;size:64" json:"pinHash"`                                                                                          // PIN 중복 검증을 위한 해시값
	Status                string          `gorm:"column:Status;default:'AVAILABLE';size:10;index:IX_VoucherCodes_ProductId_Status;index:IX_VoucherCodes_Status_ExpiredAt" json:"status"` // 상태: AVAILABLE(판매가능), SOLD(판매됨), USED(사용됨), EXPIRED(만료됨), DISPUTED(분쟁중)
	SecurityCode          *string         `gorm:"column:SecurityCode;size:100" json:"securityCode"`                                                                                      // 보안 코드 (필요 시)
	GiftNumber            *string         `gorm:"column:GiftNumber;size:100" json:"giftNumber"`                                                                                          // 발행 관리 번호
	OrderID               *int            `gorm:"column:OrderId" json:"orderId"`                                                                                                         // 판매된 주문 ID
	SoldAt                *time.Time      `gorm:"column:SoldAt" json:"soldAt"`                                                                                                           // 판매 일시
	UsedAt                *time.Time      `gorm:"column:UsedAt" json:"usedAt"`                                                                                                           // 실제 사용 일시 (외부 연동 시)
	ExpiredAt             *time.Time      `gorm:"column:ExpiredAt" json:"expiredAt"`                                                                                                     // 유효기간 만료 일시
	SupplierName          *string         `gorm:"column:SupplierName;size:30" json:"supplierName,omitempty"`                                                                             // 공급처 명칭
	PurchaseDate          *time.Time      `gorm:"column:PurchaseDate" json:"purchaseDate,omitempty"`                                                                                     // 매입 일자
	PurchasePrice         *NumericDecimal `gorm:"column:PurchasePrice;type:decimal(10,0)" json:"purchasePrice,omitempty"`                                                                // 매입 단가
	Source                string          `gorm:"column:Source;size:20;default:'ADMIN'" json:"source"`                                                                                   // 공급 출처: ADMIN(직접등록), PARTNER(파트너사)
	SuppliedByPartnerID   *int            `gorm:"column:SuppliedByPartnerID;index" json:"suppliedByPartnerId,omitempty"`                                                                 // 공급 파트너사 ID
	IssuerVerifiedAt      *time.Time      `gorm:"column:IssuerVerifiedAt" json:"issuerVerifiedAt,omitempty"`                                                                             // 발행사 검증 완료 일시
	IssuerVerificationRef *string         `gorm:"column:IssuerVerificationRef;size:50" json:"issuerVerificationRef,omitempty"`                                                           // 발행사 검증 참조 번호
	DisputedAt            *time.Time      `gorm:"column:DisputedAt" json:"disputedAt,omitempty"`                                                                                         // 분쟁(클레임) 발생 일시
	DisputeReason          *string         `gorm:"column:DisputeReason;size:200" json:"disputeReason,omitempty"`                                                                          // 분쟁 사유
	ExternalTransactionRef *string         `gorm:"column:ExternalTransactionRef;size:100" json:"externalTransactionRef,omitempty"`                                                           // 외부 발급 거래 참조 ID
	CreatedAt              time.Time       `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`                                                                                      // 등록 일시
	UpdatedAt             time.Time       `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`                                                                                      // 수정 일시
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (VoucherCode) TableName() string { return "VoucherCodes" }
