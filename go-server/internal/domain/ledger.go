package domain

import "time"

// LedgerEntry는 복식부기 패턴의 원장 기록입니다.
// 모든 금전 거래는 DEBIT(차변, +) / CREDIT(대변, -) 쌍으로 기록됩니다.
// SUM(DEBIT) = SUM(CREDIT)이면 장부가 균형 상태입니다.
//
// 거래 유형별 기록:
//   - 결제: DEBIT(REVENUE, +금액) + CREDIT(CUSTOMER, -금액)
//   - 환불: DEBIT(CUSTOMER, +금액) + CREDIT(REVENUE, -금액)  — 역분개
//   - 매입 정산: DEBIT(PAYOUT, +금액) + CREDIT(CASH, -금액)
//   - 수수료: DEBIT(CASH, +금액) + CREDIT(COMMISSION, -금액)
type LedgerEntry struct {
	ID            int            `gorm:"primaryKey;column:Id" json:"id"`
	TransactionID string         `gorm:"column:TransactionId;size:36;index" json:"transactionId"` // UUID — 같은 거래의 차변/대변을 묶음
	AccountType   string         `gorm:"column:AccountType;size:20;index" json:"accountType"`     // REVENUE, CUSTOMER, PAYOUT, COMMISSION, CASH, STOCK
	Direction     string         `gorm:"column:Direction;size:6" json:"direction"`                 // DEBIT (+) | CREDIT (-)
	Amount        NumericDecimal `gorm:"column:Amount;type:decimal(18,2)" json:"amount"`           // 항상 양수 (방향은 Direction으로 구분)
	BalanceAfter  NumericDecimal `gorm:"column:BalanceAfter;type:decimal(18,2)" json:"balanceAfter"` // 이 기록 후 해당 계정 누적 잔액
	ReferenceType string         `gorm:"column:ReferenceType;size:20;index" json:"referenceType"`  // ORDER, TRADEIN, REFUND, SETTLEMENT
	ReferenceID   int            `gorm:"column:ReferenceId;index" json:"referenceId"`
	Description   string         `gorm:"column:Description;size:200" json:"description"`
	CreatedAt     time.Time      `gorm:"column:CreatedAt;autoCreateTime;index" json:"createdAt"`
}

func (LedgerEntry) TableName() string { return "LedgerEntries" }
