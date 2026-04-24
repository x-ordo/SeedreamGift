package services

import (
	"context"
	"errors"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ReconcileClient 는 SeedreamReconcileService 가 의존하는 Seedream 클라이언트 계약입니다.
// 테스트에서 mock 하기 위한 경계 — seedream.Client 가 이 인터페이스를 만족합니다.
type ReconcileClient interface {
	WalkVAccountsSince(
		ctx context.Context,
		q seedream.VAccountListQuery,
		visit func(context.Context, seedream.VAccountResult) error,
		traceID string,
	) error
}

// Compile-time guard
var _ ReconcileClient = (*seedream.Client)(nil)

// SeedreamReconcileService 는 Seedream 상태와 내부 DB 의 드리프트를 주기 스캔합니다.
//
// 전략(MVP, Phase 5-B):
//   - 관찰 중심 — 드리프트 감지 시 warn 로그만 남기고 **자동 복구는 하지 않음**.
//   - Ops 는 로그를 보고 수동 재처리(VAccountWebhookService 직접 호출 등) 여부 결정.
//   - 잘못된 자동 복구가 돈 사고로 이어질 수 있으므로 (§6.6 safety net) 단계적 도입.
//
// 동작:
//  1. Seedream `GET /api/v1/vaccount?from=now-window&reservedIndex1=seedreamgift` 스캔
//  2. 각 item 의 orderNo 로 내부 Payment 조회
//  3. Seedream.status vs Payment.Status / Order.Status 비교 → 드리프트 판정
//  4. 드리프트면 warn 로그 (orderNo/internal/seedream/kind)
type SeedreamReconcileService struct {
	db             *gorm.DB
	client         ReconcileClient
	logger         *zap.Logger
	reservedIndex1 string        // 스캔 필터. 현재 구현은 항상 "seedreamgift".
	window         time.Duration // 스캔 창. default 15분.
	now            func() time.Time
}

// NewSeedreamReconcileService 는 Reconcile 서비스를 생성합니다.
func NewSeedreamReconcileService(db *gorm.DB, client ReconcileClient, logger *zap.Logger) *SeedreamReconcileService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &SeedreamReconcileService{
		db:             db,
		client:         client,
		logger:         logger,
		reservedIndex1: seedream.ReservedIndex1Fixed,
		window:         15 * time.Minute,
		now:            time.Now,
	}
}

// DriftKind 는 감지된 드리프트 유형입니다.
type DriftKind string

const (
	DriftNone                   DriftKind = ""
	DriftMissingDepositWebhook  DriftKind = "missing-webhook:deposit"
	DriftMissingCancelWebhook   DriftKind = "missing-webhook:cancel"
	DriftMissingFailureWebhook  DriftKind = "missing-webhook:failure"
	DriftAmountMismatch         DriftKind = "amount-mismatch"
	DriftUnknownOrder           DriftKind = "unknown-order" // Seedream 에 있는데 내부 Payment 가 없음
	DriftIssuedWebhookMissing   DriftKind = "missing-webhook:issued"
)

// Reconcile 은 최근 `window` 내 Seedream 상태를 스캔하고 내부 DB 와 비교합니다.
// 드리프트 감지는 warn 로그로만 표출 — 자동 복구는 수행하지 않음.
func (s *SeedreamReconcileService) Reconcile(ctx context.Context) error {
	since := s.now().Add(-s.window)
	q := seedream.VAccountListQuery{
		From:           since,
		ReservedIndex1: s.reservedIndex1,
		PageSize:       100,
	}

	scanned := 0
	drifts := 0
	err := s.client.WalkVAccountsSince(ctx, q, func(ctx context.Context, item seedream.VAccountResult) error {
		scanned++
		kind := s.classifyDrift(ctx, item)
		if kind == DriftNone {
			return nil
		}
		drifts++
		s.logger.Warn("seedream reconcile drift detected",
			zap.String("orderNo", item.OrderNo),
			zap.String("seedreamStatus", item.Status),
			zap.String("seedreamPhase", item.Phase),
			zap.Int64("seedreamAmount", item.Amount),
			zap.String("kind", string(kind)))
		return nil
	}, "")

	s.logger.Info("seedream reconcile completed",
		zap.Time("since", since),
		zap.Int("scanned", scanned),
		zap.Int("drifts", drifts),
		zap.Error(err))

	return err
}

// classifyDrift 은 Seedream 결과와 내부 Payment/Order 상태를 비교해 drift 유형을 반환합니다.
func (s *SeedreamReconcileService) classifyDrift(ctx context.Context, item seedream.VAccountResult) DriftKind {
	var payment domain.Payment
	err := s.db.WithContext(ctx).
		Joins("JOIN Orders o ON o.Id = Payments.OrderId").
		Where("o.OrderCode = ? AND Payments.Method = ?", item.OrderNo, "VIRTUAL_ACCOUNT_SEEDREAM").
		Preload("Order").
		First(&payment).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return DriftUnknownOrder
	}
	if err != nil {
		s.logger.Error("reconcile internal lookup failed",
			zap.String("orderNo", item.OrderNo),
			zap.Error(err))
		return DriftNone // DB 에러는 drift 로 분류하지 않음 (재시도에서 복구).
	}

	// 내부 Order 가 최종 상태면 Seedream 의 어떤 상태와도 drift 로 취급하지 않음
	// (이미 운영적으로 종결).
	switch payment.Order.Status {
	case domain.OrderStatusCompleted, domain.OrderStatusRefundPaid:
		return DriftNone
	}

	switch item.Status {
	case "SUCCESS":
		// Seedream 입금 완료인데 내부가 아직 PENDING 이면 deposit 웹훅 유실 추정.
		// 내부가 PAID / DELIVERED 로 이미 반영됐으면 sync.
		if payment.Status == "PENDING" {
			return DriftMissingDepositWebhook
		}
	case "CANCELLED":
		// Seedream 이 취소된 상태인데 내부 Order/Payment 가 활성이면 cancel 웹훅 유실.
		if payment.Order.Status == domain.OrderStatusPending ||
			payment.Order.Status == "ISSUED" {
			return DriftMissingCancelWebhook
		}
	case "FAILED":
		if payment.Status == "PENDING" {
			return DriftMissingFailureWebhook
		}
	case "AMOUNT_MISMATCH":
		if payment.Order.Status != "AMOUNT_MISMATCH" {
			return DriftAmountMismatch
		}
	case "PENDING":
		// 은행선택 후(phase=awaiting_deposit)인데 내부가 여전히 PENDING 이면 issued 웹훅 유실.
		if item.Phase == "awaiting_deposit" && payment.Order.Status == domain.OrderStatusPending {
			return DriftIssuedWebhookMissing
		}
	}
	return DriftNone
}
