package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"time"

	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"
	"seedream-gift-server/internal/infra/workqueue"
	"seedream-gift-server/pkg/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// MaxWebhookBody 는 웹훅 body 의 안전 한도 (Seedream payload 는 수 KB, 1 MiB 여유).
const MaxWebhookBody = 1 << 20

// SeedreamWebhookHandler 는 Seedream 웹훅 수신 핸들러.
type SeedreamWebhookHandler struct {
	db            *gorm.DB
	webhookSvc    *services.VAccountWebhookService
	webhookPool   *workqueue.WorkerPool
	webhookSecret string
}

func NewSeedreamWebhookHandler(
	db *gorm.DB,
	svc *services.VAccountWebhookService,
	pool *workqueue.WorkerPool,
	secret string,
) *SeedreamWebhookHandler {
	return &SeedreamWebhookHandler{
		db: db, webhookSvc: svc, webhookPool: pool, webhookSecret: secret,
	}
}

// Receive 는 POST /webhook/seedream 의 실행 로직입니다.
// 중요 원칙 (§8.6.3): 검증 실패 시에도 500 반환 (4xx 는 즉시 DLQ 드롭).
func (h *SeedreamWebhookHandler) Receive(c *gin.Context) {
	// 1) body 읽기 — 크기 제한
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxWebhookBody)
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.Log.Warn("webhook body read failed", zap.Error(err))
		c.Status(http.StatusInternalServerError)
		return
	}
	_ = c.Request.Body.Close()

	// 2) 헤더 추출
	tsHeader := c.GetHeader(seedream.HeaderTimestamp)
	sigHeader := c.GetHeader(seedream.HeaderSignature)
	event := c.GetHeader(seedream.HeaderEvent)
	deliveryIDStr := c.GetHeader(seedream.HeaderDeliveryID)

	// 3) HMAC 검증 — 실패 시 500 (영구 DLQ 이관 방지)
	if err := seedream.VerifyWebhook(h.webhookSecret, raw, tsHeader, sigHeader, seedream.DefaultMaxSkew); err != nil {
		logger.Log.Warn("seedream webhook 서명 검증 실패",
			zap.Error(err),
			zap.String("deliveryId", deliveryIDStr),
			zap.String("event", event))
		c.Status(http.StatusInternalServerError)
		return
	}

	// 4) DeliveryID 파싱
	deliveryID, err := strconv.ParseInt(deliveryIDStr, 10, 64)
	if err != nil || deliveryID == 0 {
		logger.Log.Warn("seedream webhook DeliveryId 누락/invalid", zap.String("raw", deliveryIDStr))
		c.Status(http.StatusInternalServerError)
		return
	}

	// 5) webhook_receipts INSERT — 멱등성 보장 (OnConflict DoNothing)
	ctx := c.Request.Context()
	orderNoPtr, eventIDPtr := extractOrderNoAndEventID(raw)
	receipt := &domain.WebhookReceipt{
		DeliveryID: deliveryID, Event: event,
		EventID: eventIDPtr, OrderNo: orderNoPtr,
		RawBody:    string(raw),
		ReceivedAt: time.Now().UTC(),
	}
	res := h.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(receipt)
	if res.Error != nil {
		logger.Log.Error("webhook_receipts INSERT 실패", zap.Error(res.Error))
		c.Status(http.StatusInternalServerError)
		return
	}
	if res.RowsAffected == 0 {
		// 이미 처리된 delivery — Seedream 재시도 중지 목적 200 즉시 반환
		logger.Log.Info("webhook 재수신 (idempotent no-op)", zap.Int64("deliveryId", deliveryID))
		c.Status(http.StatusOK)
		return
	}

	// 6) 워커 풀에 비동기 처리 위임 — 10초 내 응답 보장
	job := workqueue.VAccountWebhookJob{
		DeliveryID: deliveryID, Event: event, RawBody: raw, Processor: h.webhookSvc,
	}
	if err := h.webhookPool.Submit(job); err != nil {
		// 큐 포화 등 — 동기 fallback 으로 직접 처리 (Seedream 재시도 유도 피하기 위해)
		logger.Log.Warn("webhook worker pool submit 실패 — sync fallback",
			zap.Error(err), zap.Int64("deliveryId", deliveryID))
		if err := h.webhookSvc.Handle(ctx, deliveryID, event, raw); err != nil {
			logger.Log.Error("sync fallback 도 실패", zap.Error(err))
			c.Status(http.StatusInternalServerError)
			return
		}
	}

	c.Status(http.StatusOK)
}

// extractOrderNoAndEventID 는 payload 에서 orderNo 와 eventId 를 best-effort 로 추출합니다.
// 파싱 실패 시 nil — 감사 인덱스 용도일 뿐이라 실패해도 플로우에 지장 없음.
func extractOrderNoAndEventID(raw []byte) (orderNoPtr, eventIDPtr *string) {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, nil
	}
	if v, ok := m["orderNo"].(string); ok && v != "" {
		orderNoPtr = &v
	}
	if v, ok := m["eventId"].(string); ok && v != "" {
		eventIDPtr = &v
	}
	return
}
