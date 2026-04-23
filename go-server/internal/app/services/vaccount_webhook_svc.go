package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// VAccountWebhookService 는 Seedream 웹훅을 이벤트 타입별로 dispatch 하고
// webhook_receipts.ProcessedAt 을 UPDATE 합니다.
type VAccountWebhookService struct {
	db    *gorm.DB
	state *VAccountStateService
	log   *zap.Logger
}

func NewVAccountWebhookService(db *gorm.DB, state *VAccountStateService, logger *zap.Logger) *VAccountWebhookService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &VAccountWebhookService{db: db, state: state, log: logger}
}

// Handle 는 deliveryID 의 이벤트를 처리합니다.
// 호출자(핸들러 또는 Worker) 는 이미 webhook_receipts INSERT 를 완료한 상태여야 합니다.
func (s *VAccountWebhookService) Handle(ctx context.Context, deliveryID int64, event string, raw []byte) error {
	ev := seedream.EventType(event)

	var handlerErr error
	switch ev {
	case seedream.EventVAccountRequested:
		// 발급 요청 에코 — Payment 는 Phase 2 Issue() 에서 이미 생성. 수신 로그만.
		s.log.Debug("vaccount.requested 수신 (no-op)",
			zap.Int64("deliveryId", deliveryID))

	case seedream.EventVAccountIssued:
		var p seedream.VAccountIssuedPayload
		if err := json.Unmarshal(raw, &p); err != nil {
			return fmt.Errorf("parse VAccountIssuedPayload: %w", err)
		}
		handlerErr = s.state.ApplyIssued(ctx, &p.OrderNo, p)

	case seedream.EventVAccountDeposited:
		var p seedream.VAccountDepositedPayload
		if err := json.Unmarshal(raw, &p); err != nil {
			return fmt.Errorf("parse VAccountDepositedPayload: %w", err)
		}
		handlerErr = s.state.ApplyDeposited(ctx, &p.OrderNo, p)

	case seedream.EventPaymentCanceled,
		seedream.EventVAccountDepositCanceled,
		seedream.EventVAccountCancelled,
		seedream.EventDepositCancelDeposited:
		// Phase 4 구현 범위 — 현재는 로그만 남기고 no-op.
		// 재시도 폭풍 방지를 위해 에러 반환 안 함 (receipt 만 남겨 감사 추적).
		s.log.Info("Phase 4 이벤트 수신 — 현재는 no-op",
			zap.Int64("deliveryId", deliveryID),
			zap.String("event", event))

	default:
		// 알 수 없는 이벤트 — 기록만 하고 no-op. 재시도 트리거하지 않음.
		s.log.Warn("알 수 없는 Seedream 이벤트 — raw body 보관, no-op",
			zap.Int64("deliveryId", deliveryID),
			zap.String("event", event))
	}

	if handlerErr != nil {
		return handlerErr
	}

	// 성공적으로 처리된 경우 ProcessedAt 세팅
	now := time.Now().UTC()
	return s.db.WithContext(ctx).
		Model(&domain.WebhookReceipt{}).
		Where("DeliveryId = ?", deliveryID).
		Update("ProcessedAt", &now).Error
}
