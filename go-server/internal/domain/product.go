package domain

import (
	"time"

	"gorm.io/gorm"
)

// Brand는 상품의 소속 브랜드를 정의하는 마스터 엔티티입니다.
// 브랜드별 고유 코드, UI 노출 순서, 핀(PIN) 설정 등을 관리합니다.
type Brand struct {
	// Code는 브랜드 식별값입니다. (예: 'SHINSEGAE', 'LOTTE')
	Code string `gorm:"primaryKey;column:Code;size:20" json:"code"`
	// Name은 사용자에게 표시될 브랜드명입니다.
	Name string `gorm:"unique;column:Name;size:20" json:"name"`
	// Color는 브랜드 테마 색상(Hex)입니다. (예: '#FFFFFF')
	Color *string `gorm:"column:Color;size:7" json:"color"`
	// Order는 목록에서 브랜드를 보여줄 우선순위입니다. (작을수록 상단 노출)
	Order int `gorm:"column:Order;default:99" json:"order"`
	// Description은 브랜드에 대한 상세 설명입니다.
	Description *string `gorm:"column:Description;size:100" json:"description"`
	// ImageUrl은 브랜드 로고 또는 대표 이미지 경로입니다.
	ImageUrl *string `gorm:"column:ImageUrl;size:300" json:"imageUrl"`
	// IsActive가 false이면 해당 브랜드의 모든 상품이 목록에서 숨겨집니다.
	IsActive bool `gorm:"column:IsActive;default:true" json:"isActive"`
	// PinConfig는 브랜드별 바우처 PIN 번호의 특수 설정(정규식 등)을 담습니다.
	PinConfig *string        `gorm:"column:PinConfig;size:300" json:"pinConfig"`
	CreatedAt time.Time      `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index;column:DeletedAt" json:"-"`
}

func (Brand) TableName() string { return "Brands" }

// Product는 시스템에서 판매하거나 매입하는 상품의 상세 정의입니다.
// 가격 정책, 할인율, 매입 조건, 재고 경고 설정 등을 포함합니다.
type Product struct {
	ID int `gorm:"primaryKey;column:Id" json:"id"`
	// BrandCode는 이 상품이 속한 브랜드의 코드입니다.
	BrandCode string `gorm:"column:BrandCode;size:20;index:IX_Products_BrandCode_IsActive" json:"brandCode"`
	// Brand는 관계된 브랜드의 상세 정보입니다.
	Brand Brand `gorm:"foreignKey:BrandCode;references:Code" json:"brand,omitempty"`
	// Name은 상품명입니다. (예: '신세계 상품권 10만원권')
	Name        string  `gorm:"column:Name;size:30" json:"name"`
	Description *string `gorm:"column:Description;size:200" json:"description"`
	// Price는 상품의 권장 소비자 가격(정가)입니다.
	Price NumericDecimal `gorm:"column:Price;type:decimal(10,0)" json:"price"`
	// DiscountRate는 판매 시 적용되는 할인율(%)입니다.
	DiscountRate NumericDecimal `gorm:"column:DiscountRate;type:decimal(5,2);default:0" json:"discountRate"`
	// BuyPrice는 할인율이 적용된 실제 고객 구매가입니다.
	BuyPrice NumericDecimal `gorm:"column:BuyPrice;type:decimal(10,0)" json:"buyPrice"`
	// TradeInRate는 고객으로부터 매입할 때 적용하는 매입율(%)입니다.
	TradeInRate NumericDecimal `gorm:"column:TradeInRate;type:decimal(5,2);default:0" json:"tradeInRate"`
	// AllowTradeIn이 true일 때만 사용자가 이 상품을 판매(매입 신청)할 수 있습니다.
	AllowTradeIn bool    `gorm:"column:AllowTradeIn;default:false" json:"allowTradeIn"`
	ImageUrl     *string `gorm:"column:ImageUrl;size:300" json:"imageUrl"`
	// IsActive가 false이면 판매 중지 상태로 처리됩니다.
	IsActive bool `gorm:"column:IsActive;default:true;index:IX_Products_BrandCode_IsActive" json:"isActive"`
	// Type은 상품의 형태입니다. (DIGITAL: 모바일 쿠폰, PHYSICAL: 실물 카드 등)
	Type string `gorm:"column:Type;default:'PHYSICAL';size:10" json:"type"`
	// ShippingMethod는 배송 방식입니다. (DELIVERY: 택배, KAKAO: 알림톡 등)
	ShippingMethod string `gorm:"column:ShippingMethod;default:'DELIVERY';size:10" json:"shippingMethod"`
	// Denomination은 상품권의 액면가입니다.
	Denomination *int `gorm:"column:Denomination" json:"denomination,omitempty"`
	// MinPurchaseQty는 1회 주문 시 최소 구매 수량입니다.
	MinPurchaseQty int `gorm:"column:MinPurchaseQty;default:1" json:"minPurchaseQty"`
	// MaxPurchaseQty는 1회 주문 시 최대 구매 수량입니다.
	MaxPurchaseQty int `gorm:"column:MaxPurchaseQty;default:99" json:"maxPurchaseQty"`
	// MinStockAlert는 재고가 이 수치 이하로 떨어지면 관리자에게 알림을 보냅니다.
	MinStockAlert int `gorm:"column:MinStockAlert;default:0" json:"minStockAlert"`
	// IssuerId는 발행사 식별 정보입니다.
	IssuerId *string `gorm:"column:IssuerId;size:30" json:"issuerId,omitempty"`
	// AllowPartnerStock은 파트너사가 직접 재고(바우처)를 등록할 수 있는지 여부입니다.
	AllowPartnerStock bool `gorm:"column:AllowPartnerStock;default:false" json:"allowPartnerStock"`
	// PartnerID는 이 상품을 관리하는 파트너사 ID입니다. (관리자 등록 상품은 NULL)
	PartnerID *int `gorm:"column:PartnerID;index" json:"partnerId,omitempty"`
	// FulfillmentType은 발급 방식입니다. STOCK: 수동 재고, API: 외부 API 자동 발급
	FulfillmentType string `gorm:"column:FulfillmentType;default:'STOCK';size:10" json:"fulfillmentType"`
	// ProviderCode는 외부 발급 제공업체 코드입니다. (EXPAY, STUB 등)
	ProviderCode *string `gorm:"column:ProviderCode;size:20" json:"providerCode"`
	// ProviderProductCode는 외부 API에서 사용하는 상품 코드입니다.
	ProviderProductCode *string `gorm:"column:ProviderProductCode;size:50" json:"providerProductCode"`
	// ApprovalStatus는 상품의 승인 상태입니다. (PENDING, APPROVED, REJECTED)
	ApprovalStatus string `gorm:"column:ApprovalStatus;size:10;default:'APPROVED'" json:"approvalStatus"`
	// RejectionReason은 상품 승인 거절 사유입니다.
	RejectionReason *string `gorm:"column:RejectionReason;size:500" json:"rejectionReason,omitempty"`
	// LastAlertSentAt은 마지막으로 재고 부족 알림이 발송된 시각입니다.
	LastAlertSentAt *time.Time     `gorm:"column:LastAlertSentAt" json:"lastAlertSentAt,omitempty"`
	CreatedAt       time.Time      `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time      `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index;column:DeletedAt" json:"-"`
}

func (Product) TableName() string { return "Products" }
