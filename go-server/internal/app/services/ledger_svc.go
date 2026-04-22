package services

import (
	"fmt"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/logger"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// LedgerService는 복식부기 원장 서비스입니다.
// 모든 금전 거래를 DEBIT/CREDIT 쌍으로 기록하여 정산 추적 및 검증을 지원합니다.
type LedgerService struct {
	db *gorm.DB
}

func NewLedgerService(db *gorm.DB) *LedgerService {
	return &LedgerService{db: db}
}

// RecordPayment는 주문 결제 시 원장을 기록합니다.
// DEBIT(REVENUE) + CREDIT(CUSTOMER) — 매출 발생
func (s *LedgerService) RecordPayment(tx *gorm.DB, orderID int, amount decimal.Decimal) error {
	return s.recordPair(tx, "ORDER", orderID, amount,
		"REVENUE", "CUSTOMER",
		fmt.Sprintf("주문 #%d 결제", orderID),
	)
}

// RecordRefund는 환불 시 원장을 역분개합니다.
// DEBIT(CUSTOMER) + CREDIT(REVENUE) — 매출 취소
func (s *LedgerService) RecordRefund(tx *gorm.DB, refundID int, orderID int, amount decimal.Decimal) error {
	return s.recordPair(tx, "REFUND", refundID, amount,
		"CUSTOMER", "REVENUE",
		fmt.Sprintf("환불 #%d (주문 #%d)", refundID, orderID),
	)
}

// RecordPayout는 매입(Trade-in) 정산 시 원장을 기록합니다.
// DEBIT(PAYOUT) + CREDIT(CASH) — 고객에게 지급
func (s *LedgerService) RecordPayout(tx *gorm.DB, tradeInID int, amount decimal.Decimal) error {
	return s.recordPair(tx, "TRADEIN", tradeInID, amount,
		"PAYOUT", "CASH",
		fmt.Sprintf("매입 정산 #%d", tradeInID),
	)
}

// RecordCommission는 파트너 정산 수수료를 기록합니다.
// DEBIT(CASH) + CREDIT(COMMISSION) — 수수료 수익
func (s *LedgerService) RecordCommission(tx *gorm.DB, settlementID int, amount decimal.Decimal) error {
	return s.recordPair(tx, "SETTLEMENT", settlementID, amount,
		"CASH", "COMMISSION",
		fmt.Sprintf("정산 수수료 #%d", settlementID),
	)
}

// GetBalance는 특정 계정 유형의 현재 잔액을 조회합니다.
// DEBIT 합계 - CREDIT 합계 = 잔액
func (s *LedgerService) GetBalance(accountType string) decimal.Decimal {
	var result struct {
		Debit  decimal.Decimal
		Credit decimal.Decimal
	}
	s.db.Model(&domain.LedgerEntry{}).
		Where("AccountType = ? AND Direction = 'DEBIT'", accountType).
		Select("COALESCE(SUM(Amount), 0) as Debit").
		Scan(&result.Debit)
	s.db.Model(&domain.LedgerEntry{}).
		Where("AccountType = ? AND Direction = 'CREDIT'", accountType).
		Select("COALESCE(SUM(Amount), 0) as Credit").
		Scan(&result.Credit)

	return result.Debit.Sub(result.Credit)
}

// Reconcile은 전체 원장의 균형을 검증합니다.
// 정상이면 nil, 불균형이면 차액을 포함한 에러를 반환합니다.
func (s *LedgerService) Reconcile() error {
	var totalDebit, totalCredit decimal.Decimal
	s.db.Model(&domain.LedgerEntry{}).
		Where("Direction = 'DEBIT'").
		Select("COALESCE(SUM(Amount), 0)").
		Scan(&totalDebit)
	s.db.Model(&domain.LedgerEntry{}).
		Where("Direction = 'CREDIT'").
		Select("COALESCE(SUM(Amount), 0)").
		Scan(&totalCredit)

	diff := totalDebit.Sub(totalCredit)
	if !diff.IsZero() {
		return fmt.Errorf("원장 불균형: DEBIT=%s, CREDIT=%s, 차액=%s", totalDebit, totalCredit, diff)
	}
	return nil
}

// recordPair는 DEBIT/CREDIT 쌍을 원자적으로 기록합니다.
func (s *LedgerService) recordPair(
	tx *gorm.DB,
	refType string, refID int,
	amount decimal.Decimal,
	debitAccount, creditAccount string,
	description string,
) error {
	if tx == nil {
		tx = s.db
	}

	txnID := uuid.New().String()
	numAmount := domain.NewNumericDecimal(amount)

	// DEBIT 잔액 계산 (UPDLOCK으로 동시 기록 시 잔액 경쟁 조건 방지)
	debitBalance := s.getAccountBalance(tx, debitAccount).Add(amount)
	// CREDIT 잔액 계산
	creditBalance := s.getAccountBalance(tx, creditAccount).Sub(amount)

	entries := []domain.LedgerEntry{
		{
			TransactionID: txnID,
			AccountType:   debitAccount,
			Direction:     "DEBIT",
			Amount:        numAmount,
			BalanceAfter:  domain.NewNumericDecimal(debitBalance),
			ReferenceType: refType,
			ReferenceID:   refID,
			Description:   description,
		},
		{
			TransactionID: txnID,
			AccountType:   creditAccount,
			Direction:     "CREDIT",
			Amount:        numAmount,
			BalanceAfter:  domain.NewNumericDecimal(creditBalance),
			ReferenceType: refType,
			ReferenceID:   refID,
			Description:   description,
		},
	}

	for _, entry := range entries {
		if err := tx.Create(&entry).Error; err != nil {
			logger.Log.Error("원장 기록 실패",
				zap.String("transactionId", txnID),
				zap.String("account", entry.AccountType),
				zap.String("direction", entry.Direction),
				zap.Error(err),
			)
			return fmt.Errorf("원장 기록 실패 (%s %s): %w", entry.AccountType, entry.Direction, err)
		}
	}
	return nil
}

// getAccountBalance는 특정 계정의 현재 잔액을 조회합니다.
// UPDLOCK 힌트로 동시 트랜잭션 간 잔액 race condition을 방지합니다.
func (s *LedgerService) getAccountBalance(tx *gorm.DB, accountType string) decimal.Decimal {
	var lastEntry domain.LedgerEntry
	err := tx.Where("\"AccountType\" = ?", accountType).
		Clauses(clause.Locking{Strength: "UPDATE"}).
		Order("\"Id\" DESC").
		Select("\"BalanceAfter\"").
		First(&lastEntry).Error
	if err != nil {
		return decimal.Zero
	}
	return lastEntry.BalanceAfter.Decimal
}
