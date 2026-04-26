package workqueue

import (
	"context"
	"errors"

	"go.uber.org/zap"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/logger"
)

// WebhookProcessor 는 dispatch 레이어(VAccountWebhookService) 를 인터페이스로 감싼 것.
// 순환 import 방지 + 테스트 대역 가능.
type WebhookProcessor interface {
	Handle(ctx context.Context, deliveryID int64, event string, raw []byte) error
}

// VAccountWebhookJob 은 비동기 웹훅 처리를 위한 Job 입니다.
// 핸들러(API 레이어) 는 HMAC 검증 + receipt INSERT 까지 동기 수행하고,
// 실제 상태 전이는 이 Job 으로 위임해 10초 timeout 밖으로 밀어냄.
type VAccountWebhookJob struct {
	DeliveryID int64
	Event      string
	RawBody    []byte
	Processor  WebhookProcessor
}

// Name 은 Job 인터페이스 구현.
func (j VAccountWebhookJob) Name() string { return "seedream_webhook" }

// Execute 는 Job 인터페이스 구현.
// 실패 시 error 반환 — webhook_receipts.ProcessedAt 은 nil 로 남아 Seedream 재전송 시 멱등 재처리 가능.
//
// apperror.ErrOrderNotFound 는 race condition (웹훅이 Order INSERT 보다 먼저 도착) /
// smoke test fixture / stale 재전송 등 retriable 시나리오이므로 WARN 으로 강등.
// 그 외 실패는 ERROR 로 알람을 발생시킨다.
func (j VAccountWebhookJob) Execute() error {
	err := j.Processor.Handle(context.Background(), j.DeliveryID, j.Event, j.RawBody)
	if err != nil {
		fields := []zap.Field{
			zap.Int64("deliveryId", j.DeliveryID),
			zap.String("event", j.Event),
			zap.Error(err),
		}
		if errors.Is(err, apperror.ErrOrderNotFound) {
			logger.Log.Warn("seedream webhook job retriable: order not found", fields...)
		} else {
			logger.Log.Error("seedream webhook job 실패", fields...)
		}
	}
	return err
}
