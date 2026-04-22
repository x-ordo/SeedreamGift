package domain

import "time"

// PartnerSettlement는 파트너(공급처)에 대한 정산 내역을 관리합니다.
// 파트너가 공급한 상품이 판매되었을 때, 정해진 수수료를 제외한 금액을 파트너에게 지급하기 위한 근거 데이터로 사용됩니다.
type PartnerSettlement struct {
	ID               int            `gorm:"primaryKey;column:Id" json:"id"`
	PartnerID        int            `gorm:"column:PartnerId;index" json:"partnerId"`                            // 정산 대상 파트너 ID
	Partner          User           `gorm:"foreignKey:PartnerID" json:"-"`                                      // 파트너 상세 정보
	Period           string         `gorm:"column:Period;size:20" json:"period"`                                // 정산 기간 (예: 2024-01-01~2024-01-15)
	Frequency        string         `gorm:"column:Frequency;size:10" json:"frequency"`                          // 정산 주기 (DAILY, WEEKLY, MONTHLY)
	TotalSales       NumericDecimal `gorm:"column:TotalSales;type:decimal(12,0)" json:"totalSales"`             // 총 판매 금액
	TotalQuantity    int            `gorm:"column:TotalQuantity" json:"totalQuantity"`                          // 총 판매 수량
	CommissionRate   NumericDecimal `gorm:"column:CommissionRate;type:decimal(5,2)" json:"commissionRate"`      // 수수료율 (백분율)
	CommissionAmount NumericDecimal `gorm:"column:CommissionAmount;type:decimal(12,0)" json:"commissionAmount"` // 수수료 합계 금액
	PayoutAmount     NumericDecimal `gorm:"column:PayoutAmount;type:decimal(12,0)" json:"payoutAmount"`         // 최종 지급 금액 (판매액 - 수수료)
	Status           string         `gorm:"column:Status;size:10;default:'PENDING'" json:"status"`              // 상태: PENDING(대기), PAID(지급완료), FAILED(실패)
	TransferRef      *string        `gorm:"column:TransferRef;size:50" json:"transferRef,omitempty"`            // 송금 참조 번호 (이체 확인용)
	PaidAt           *time.Time     `gorm:"column:PaidAt" json:"paidAt,omitempty"`                              // 실제 지급 일시
	FailureReason    *string        `gorm:"column:FailureReason;size:500" json:"failureReason,omitempty"`       // 지급 실패 사유
	AdminNote        *string        `gorm:"column:AdminNote;size:500" json:"adminNote,omitempty"`               // 관리자 비고
	CreatedAt        time.Time      `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`                   // 생성 일시
	UpdatedAt        time.Time      `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`                   // 수정 일시
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (PartnerSettlement) TableName() string { return "PartnerSettlements" }
