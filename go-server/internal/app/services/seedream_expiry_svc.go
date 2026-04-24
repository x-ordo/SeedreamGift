package services

import (
	"time"

	"seedream-gift-server/internal/domain"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// SeedreamExpiryService 는 Seedream LINK 모드 VA 주문의 depositEndDate 만료를 처리합니다.
//
// Seedream 쪽은 depositEndDate 경과 시 자체 타임아웃으로 자동 만료되지만 웹훅이
// best-effort 라(§8.0) 우리가 먼저 선제 만료 처리해 UI 및 감사 로그의 최신성을
// 유지합니다. 이후 vaccount.cancelled 웹훅이 도착하면 terminal state 라 idempotent
// no-op.
//
// 책임 분리: 일반 Order.PaymentDeadlineAt 만료는 OrderService.CancelExpiredOrders
// 가 담당하되 Seedream VA 는 제외 (CancelExpiredOrders 내부에서 Method 필터).
// 이 서비스는 **오로지 Seedream VA 만** 다룹니다.
type SeedreamExpiryService struct {
	db     *gorm.DB
	logger *zap.Logger
	now    func() time.Time // 테스트 주입용
}

// NewSeedreamExpiryService 는 SeedreamExpiryService 를 생성합니다.
func NewSeedreamExpiryService(db *gorm.DB, logger *zap.Logger) *SeedreamExpiryService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &SeedreamExpiryService{db: db, logger: logger, now: time.Now}
}

// ExpireSeedreamOrders 는 Payment.ExpiresAt 이 경과한 Seedream VA 주문을 만료 처리합니다.
// 크론에서 1분 간격으로 호출됩니다.
//
// 전이:
//   - Order.Status:   PENDING/ISSUED → EXPIRED
//   - Payment.Status: PENDING        → CANCELLED (+ CancelledAt, FailReason, SeedreamPhase=failed)
//   - VoucherCode:    RESERVED       → AVAILABLE (OrderId=null, SoldAt=null)
//
// 모든 전이는 주문당 단일 트랜잭션에서 원자적으로 실행합니다. 한 건 실패는
// 다음 건으로 진행 (크론 실행 단위의 부분 진전 허용).
func (s *SeedreamExpiryService) ExpireSeedreamOrders() {
	now := s.now()

	// 만료 대상 Payment 후보 수집. JOIN 으로 Order.Status 도 사전 제한해 락 경합 최소화.
	type expiryRow struct {
		PaymentID int    `gorm:"column:PaymentId"`
		OrderID   int    `gorm:"column:OrderId"`
		OrderCode string `gorm:"column:OrderCode"`
	}
	var rows []expiryRow
	err := s.db.Raw(`
		SELECT p.Id AS PaymentId, o.Id AS OrderId, o.OrderCode AS OrderCode
		FROM Payments p
		JOIN Orders o ON o.Id = p.OrderId
		WHERE p.Method = ?
		  AND p.Status = 'PENDING'
		  AND p.ExpiresAt IS NOT NULL
		  AND p.ExpiresAt < ?
		  AND o.Status IN ('PENDING','ISSUED')
	`, "VIRTUAL_ACCOUNT_SEEDREAM", now).Scan(&rows).Error
	if err != nil {
		s.logger.Error("Seedream expiry scan 실패", zap.Error(err))
		return
	}
	if len(rows) == 0 {
		return
	}

	failedPhase := domain.SeedreamPhaseFailed
	failReason := "결제 기한 만료 (Seedream VA depositEndDate 경과)"

	expired := 0
	for _, r := range rows {
		txErr := s.db.Transaction(func(tx *gorm.DB) error {
			// Order: PENDING/ISSUED → EXPIRED. WHERE 조건으로 race (already PAID) 방어.
			if err := tx.Model(&domain.Order{}).
				Where("Id = ? AND Status IN ?", r.OrderID, []string{"PENDING", "ISSUED"}).
				Updates(map[string]any{"Status": domain.OrderStatusExpired}).Error; err != nil {
				return err
			}

			// Payment: PENDING → CANCELLED. 같은 race 보호.
			if err := tx.Model(&domain.Payment{}).
				Where("Id = ? AND Status = 'PENDING'", r.PaymentID).
				Updates(map[string]any{
					"Status":        "CANCELLED",
					"CancelledAt":   now,
					"FailReason":    failReason,
					"SeedreamPhase": &failedPhase,
				}).Error; err != nil {
				return err
			}

			// VoucherCode: RESERVED 바우처 해제.
			return tx.Model(&domain.VoucherCode{}).
				Where("OrderId = ? AND Status = 'RESERVED'", r.OrderID).
				Updates(map[string]any{"OrderId": nil, "Status": "AVAILABLE", "SoldAt": nil}).Error
		})

		if txErr != nil {
			s.logger.Error("Seedream VA 만료 처리 실패",
				zap.Int("orderId", r.OrderID),
				zap.String("orderCode", r.OrderCode),
				zap.Error(txErr))
			continue
		}
		expired++
	}

	if expired > 0 {
		s.logger.Info("Seedream VA 만료 처리 완료",
			zap.Int("expired", expired),
			zap.Int("candidates", len(rows)))
	}
}
