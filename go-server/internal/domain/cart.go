package domain

import "time"

// CartItem은 사용자의 장바구니에 담긴 개별 상품 항목을 나타냅니다.
// 동일한 사용자가 동일한 상품을 여러 번 담을 수 없도록 UserID와 ProductID의 조합에 유니크 인덱스가 설정되어 있습니다.
type CartItem struct {
	ID        int       `gorm:"primaryKey;column:Id" json:"id"`
	UserID    int       `gorm:"uniqueIndex:UQ_CartItems_UserId_ProductId;column:UserId" json:"userId"`       // 장바구니 소유자 ID
	ProductID int       `gorm:"uniqueIndex:UQ_CartItems_UserId_ProductId;column:ProductId" json:"productId"` // 상품 ID
	Product   Product   `gorm:"foreignKey:ProductID" json:"product,omitempty"`                               // 연관된 상품 정보
	Quantity  int       `gorm:"column:Quantity;default:1" json:"quantity"`                                   // 담은 수량
	CreatedAt time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`                            // 생성 일시
	UpdatedAt time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`                            // 수정 일시
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (CartItem) TableName() string { return "CartItems" }
