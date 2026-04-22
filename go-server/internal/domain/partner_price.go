package domain

import "time"

// PartnerPrice는 관리자가 파트너×상품 조합별로 설정한 개별 단가입니다.
// 일반 사용자 가격(Product.BuyPrice, Product.TradeInRate)과 별개로,
// 특정 파트너에게 적용되는 구매가 및 매입가를 관리합니다.
type PartnerPrice struct {
	ID           int            `gorm:"primaryKey;column:Id" json:"id"`
	PartnerId    int            `gorm:"column:PartnerId;uniqueIndex:idx_partner_product;not null" json:"partnerId"`
	ProductId    int            `gorm:"column:ProductId;uniqueIndex:idx_partner_product;not null" json:"productId"`
	BuyPrice     NumericDecimal `gorm:"column:BuyPrice;type:decimal(12,0);not null" json:"buyPrice"`
	TradeInPrice NumericDecimal `gorm:"column:TradeInPrice;type:decimal(12,0);not null" json:"tradeInPrice"`
	CreatedAt    time.Time      `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time      `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`

	Partner *User    `gorm:"foreignKey:PartnerId" json:"partner,omitempty"`
	Product *Product `gorm:"foreignKey:ProductId" json:"product,omitempty"`
}

func (PartnerPrice) TableName() string { return "PartnerPrices" }
