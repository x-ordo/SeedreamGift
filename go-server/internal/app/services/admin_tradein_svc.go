package services

import (
	"fmt"
	"time"
	"w-gift-server/internal/domain"
	"w-gift-server/internal/infra/repository"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/pagination"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// AdminTradeInService는 관리자의 매입 관리 기능을 처리합니다.
type AdminTradeInService struct {
	db          *gorm.DB
	tradeInRepo *repository.BaseRepository[domain.TradeIn]
	ledgerSvc   *LedgerService
}

func (s *AdminTradeInService) SetLedgerService(ls *LedgerService) {
	s.ledgerSvc = ls
}

func NewAdminTradeInService(db *gorm.DB) *AdminTradeInService {
	return &AdminTradeInService{
		db:          db,
		tradeInRepo: repository.NewBaseRepository[domain.TradeIn](db),
	}
}

func (s *AdminTradeInService) GetTradeIns(params pagination.QueryParams, status string) (pagination.PaginatedResponse[domain.TradeIn], error) {
	where := make(map[string]any)
	if status != "" {
		where["Status"] = status
	}
	return s.tradeInRepo.FindAll(params, where)
}

func (s *AdminTradeInService) GetTradeIn(id int) (*domain.TradeIn, error) {
	var tradeIn domain.TradeIn
	err := s.db.Preload("User").Preload("Product").First(&tradeIn, id).Error
	return &tradeIn, err
}

func (s *AdminTradeInService) UpdateTradeInStatus(id int, status string, note string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// UPDLOCK으로 동시 상태 변경을 직렬화하여 레이스 컨디션 방지
		var current domain.TradeIn
		if err := tx.Set("gorm:query_option", "WITH (UPDLOCK)").
			Select("Id", "Status", "PayoutAmount").First(&current, id).Error; err != nil {
			return apperror.NotFoundf("trade-in %d not found", id)
		}
		if err := domain.ValidateTradeInTransition(current.Status, status); err != nil {
			return apperror.Validation(err.Error())
		}

		if err := tx.Model(&domain.TradeIn{}).Where("Id = ?", id).Updates(map[string]any{
			"Status":    status,
			"AdminNote": note,
		}).Error; err != nil {
			return err
		}

		// 매입 정산 완료(PAID) 시 복식부기 원장 기록 (같은 트랜잭션 내 원자적 처리)
		if status == "PAID" && s.ledgerSvc != nil {
			if ledgerErr := s.ledgerSvc.RecordPayout(tx, id, current.PayoutAmount.Decimal); ledgerErr != nil {
				logger.Log.Error("매입 정산 원장 기록 실패",
					zap.Int("tradeInId", id),
					zap.Error(ledgerErr),
				)
				return fmt.Errorf("원장 기록 실패 (매입 정산): %w", ledgerErr)
			}
		}

		return nil
	})
}

// ReceiveTradeIn은 매입 건의 택배 수령 처리를 합니다.
// REQUESTED 상태에서만 RECEIVED로 전환 가능합니다.
func (s *AdminTradeInService) ReceiveTradeIn(id int, trackingNumber, carrier string) error {
	var current domain.TradeIn
	if err := s.db.Select("Id, Status").First(&current, id).Error; err != nil {
		return apperror.NotFoundf("trade-in %d not found", id)
	}
	if err := domain.ValidateTradeInTransition(current.Status, "RECEIVED"); err != nil {
		return apperror.Validation(err.Error())
	}
	now := time.Now()
	return s.db.Model(&domain.TradeIn{}).Where("Id = ?", id).Updates(map[string]any{
		"Status":         "RECEIVED",
		"TrackingNumber": trackingNumber,
		"Carrier":        carrier,
		"ReceivedAt":     now,
	}).Error
}
