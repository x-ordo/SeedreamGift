package services

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/issuance"
	"seedream-gift-server/pkg/logger"
)

// Sentinel errors for the redeem/refund flow. Handlers use errors.Is to
// translate each to a precise HTTP status code.
var (
	ErrVoucherNotFound     = errors.New("voucher not found")
	ErrVoucherAlreadyUsed  = errors.New("voucher already used")
	ErrVoucherExpired      = errors.New("voucher expired")
	ErrVoucherRefunded     = errors.New("voucher refunded")
	ErrSecretMismatch      = errors.New("secret mismatch")
	ErrRefundWindowExpired = errors.New("refund window expired")
)

// VoucherView is the safe outward projection of a VoucherCode: the secret
// hash and redeem-side bookkeeping fields are deliberately excluded so that
// callers cannot accidentally leak them to API consumers.
type VoucherView struct {
	SerialNo  string    `json:"serialNo"`
	FaceValue int       `json:"faceValue"`
	Status    string    `json:"status"`
	IssuedAt  time.Time `json:"issuedAt"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// Actor distinguishes user-initiated refund requests (subject to the 7-day
// policy) from admin-initiated refunds (policy bypass with audit trail).
type Actor int

const (
	ActorUser  Actor = iota
	ActorAdmin Actor = iota
)

const refundWindow = 7 * 24 * time.Hour
const sdpProviderCode = "SEEDREAMPAY"

// SeedreampayService orchestrates the post-issuance lifecycle of Seedreampay
// vouchers: lookup, secret verification, in-mall redemption (1회 single-use),
// refund within policy, and daily expiry sweeping.
type SeedreampayService struct {
	db       *gorm.DB
	payments interfaces.IPaymentProvider
	now      func() time.Time
	eventSvc *OrderEventService // 선택 — 주입되지 않으면 이벤트 기록 생략
}

// NewSeedreampayService constructs a SeedreampayService. pp may be nil
// (payment reversal will be skipped). now may be nil (defaults to time.Now).
func NewSeedreampayService(db *gorm.DB, pp interfaces.IPaymentProvider, now func() time.Time) *SeedreampayService {
	if now == nil {
		now = time.Now
	}
	return &SeedreampayService{db: db, payments: pp, now: now}
}

// SetOrderEventService 는 주문 timeline 기록 서비스를 주입합니다 (setter injection).
// 미주입 상태로 두면 이벤트 기록만 건너뛰고 비즈니스 로직은 정상 동작.
func (s *SeedreampayService) SetOrderEventService(svc *OrderEventService) {
	s.eventSvc = svc
}

// recordEvent 는 eventSvc 가 주입됐을 때만 주문 이벤트를 기록합니다.
// OrderEventService.Record 자체가 non-blocking 이라 여기서는 단순 위임.
func (s *SeedreampayService) recordEvent(tx *gorm.DB, orderID int, eventType string, payload any) {
	if s.eventSvc == nil || orderID == 0 {
		return
	}
	s.eventSvc.Record(tx, orderID, eventType, nil, "SYSTEM", payload)
}

// getVoucherRow loads a full VoucherCode record by SerialNo. Returns
// ErrVoucherNotFound if the row is missing, and wraps any other DB error.
func (s *SeedreampayService) getVoucherRow(ctx context.Context, serial string) (*domain.VoucherCode, error) {
	var vc domain.VoucherCode
	err := s.db.WithContext(ctx).Where(`"SerialNo" = ?`, serial).First(&vc).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrVoucherNotFound
	}
	if err != nil {
		return nil, err
	}
	return &vc, nil
}

// GetVoucherBySerial returns a public VoucherView derived from the row plus
// its Product (for face value). The stored SecretHash is never exposed.
func (s *SeedreampayService) GetVoucherBySerial(ctx context.Context, serial string) (*VoucherView, error) {
	vc, err := s.getVoucherRow(ctx, serial)
	if err != nil {
		return nil, err
	}
	var product domain.Product
	if err := s.db.WithContext(ctx).Where(`"Id" = ?`, vc.ProductID).First(&product).Error; err != nil {
		return nil, err
	}

	// NumericDecimal embeds decimal.Decimal whose IntPart() returns int64.
	faceValue := int(product.Price.IntPart())

	serialOut := ""
	if vc.SerialNo != nil {
		serialOut = *vc.SerialNo
	}
	expires := time.Time{}
	if vc.ExpiredAt != nil {
		expires = *vc.ExpiredAt
	}
	return &VoucherView{
		SerialNo:  serialOut,
		FaceValue: faceValue,
		Status:    vc.Status,
		IssuedAt:  vc.CreatedAt,
		ExpiresAt: expires,
	}, nil
}

// VerifySecretAgainst performs a constant-time hash comparison. Does not
// touch the DB. Callers supply the already-loaded storedHash.
func (s *SeedreampayService) VerifySecretAgainst(secret, serial, storedHash string) bool {
	calc := issuance.SecretHash(secret, serial)
	return subtle.ConstantTimeCompare([]byte(calc), []byte(storedHash)) == 1
}

// VerifyPair combines DB lookup + state/expiry gates + constant-time hash
// compare for the pre-flight /verify endpoint.
func (s *SeedreampayService) VerifyPair(ctx context.Context, serial, secret string) error {
	vc, err := s.getVoucherRow(ctx, serial)
	if err != nil {
		return err
	}
	if vc.SecretHash == nil || !s.VerifySecretAgainst(secret, serial, *vc.SecretHash) {
		return ErrSecretMismatch
	}
	switch vc.Status {
	case "USED":
		return ErrVoucherAlreadyUsed
	case "REFUNDED":
		return ErrVoucherRefunded
	case "EXPIRED":
		return ErrVoucherExpired
	case "SOLD":
		// proceed
	default:
		return ErrVoucherNotFound
	}
	if vc.ExpiredAt != nil && vc.ExpiredAt.Before(s.now()) {
		return ErrVoucherExpired
	}
	return nil
}

// RedeemInput is the full set of fields required to redeem a voucher against
// a (usually pending) mall order.
type RedeemInput struct {
	SerialNo   string
	Secret     string
	UserID     int
	UsageOrder int
	ClientIP   string
}

// RedeemResult is the success response for a redeem operation.
type RedeemResult struct {
	SerialNo      string
	AmountApplied int
}

// Redeem validates the SerialNo+Secret pair against the DB, enforces status
// and expiry gates, and atomically transitions the voucher from SOLD → USED
// using a state-CAS update. Returns ErrVoucherAlreadyUsed when the CAS
// affects zero rows (concurrent redeemer won the race).
func (s *SeedreampayService) Redeem(ctx context.Context, in RedeemInput) (*RedeemResult, error) {
	var result *RedeemResult

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var vc domain.VoucherCode
		if err := tx.Where(`"SerialNo" = ?`, in.SerialNo).First(&vc).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrVoucherNotFound
			}
			return err
		}
		switch vc.Status {
		case "USED":
			return ErrVoucherAlreadyUsed
		case "EXPIRED":
			return ErrVoucherExpired
		case "REFUNDED":
			return ErrVoucherRefunded
		case "SOLD":
			// continue
		default:
			return ErrVoucherNotFound
		}
		if vc.ExpiredAt != nil && vc.ExpiredAt.Before(s.now()) {
			return ErrVoucherExpired
		}
		if vc.SecretHash == nil || !s.VerifySecretAgainst(in.Secret, in.SerialNo, *vc.SecretHash) {
			return ErrSecretMismatch
		}

		var product domain.Product
		if err := tx.Where(`"Id" = ?`, vc.ProductID).First(&product).Error; err != nil {
			return err
		}
		faceValue := int(product.Price.IntPart())

		now := s.now()
		usageOrder := in.UsageOrder
		clientIP := in.ClientIP
		res := tx.Model(&domain.VoucherCode{}).
			Where(`"Id" = ? AND "Status" = ?`, vc.ID, "SOLD").
			Updates(map[string]any{
				"Status":          "USED",
				"UsedAt":          &now,
				"RedeemedOrderId": &usageOrder,
				"RedeemedIp":      &clientIP,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrVoucherAlreadyUsed // CAS lost to concurrent redeemer
		}

		result = &RedeemResult{SerialNo: in.SerialNo, AmountApplied: faceValue}

		// Timeline 이벤트: 원 주문(vc.OrderID) 에 "바우처 사용" 을 기록.
		// OrderID 가 없는 legacy 바우처는 기록 생략 (recordEvent 가 0 체크).
		if vc.OrderID != nil {
			s.recordEvent(tx, *vc.OrderID, "VOUCHER_REDEEMED", map[string]any{
				"serialNo":      in.SerialNo,
				"amountApplied": faceValue,
				"usedAt":        now,
			})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// RefundInput encodes a refund request from either a user (policy-bound) or
// an admin (policy bypass with required reason for audit).
type RefundInput struct {
	SerialNo    string
	RequestedBy Actor
	UserID      int    // used when RequestedBy == ActorUser for ownership check
	Reason      string // required when RequestedBy == ActorAdmin
}

// Refund validates policy + ownership, transitions SOLD → REFUNDED via CAS,
// then invokes the payment provider for reversal. Payment-provider failure
// aborts the transaction (rollback) so we never end up with REFUNDED state
// without an actual monetary refund.
func (s *SeedreampayService) Refund(ctx context.Context, in RefundInput) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var vc domain.VoucherCode
		if err := tx.Where(`"SerialNo" = ?`, in.SerialNo).First(&vc).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrVoucherNotFound
			}
			return err
		}
		if vc.Status != "SOLD" {
			return ErrVoucherAlreadyUsed
		}
		if in.RequestedBy == ActorUser {
			if s.now().Sub(vc.CreatedAt) > refundWindow {
				return ErrRefundWindowExpired
			}
			if vc.OrderID != nil {
				var order domain.Order
				if err := tx.Where(`"Id" = ?`, *vc.OrderID).First(&order).Error; err != nil {
					return err
				}
				if order.UserID != in.UserID {
					return ErrVoucherNotFound // minimize info leak
				}
			}
		}

		now := s.now()
		res := tx.Model(&domain.VoucherCode{}).
			Where(`"Id" = ? AND "Status" = ?`, vc.ID, "SOLD").
			Updates(map[string]any{
				"Status":    "REFUNDED",
				"UpdatedAt": &now,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrVoucherAlreadyUsed
		}

		// Payment reversal: best-effort. Payment-provider errors roll back
		// the status change so we never end up with REFUNDED but no money back.
		if s.payments != nil && vc.OrderID != nil {
			if err := s.tryRefundPayment(ctx, tx, *vc.OrderID, in.Reason); err != nil {
				return err
			}
		}

		// Timeline 이벤트: 원 주문에 "바우처 환불" 을 기록.
		// Payment reversal 성공 후에만 실행 (오류 시 transaction rollback 이 이벤트도 롤백).
		if vc.OrderID != nil {
			actorType := "USER"
			if in.RequestedBy == ActorAdmin {
				actorType = "ADMIN"
			}
			s.recordEvent(tx, *vc.OrderID, "VOUCHER_REFUNDED", map[string]any{
				"serialNo":   in.SerialNo,
				"reason":     in.Reason,
				"actorType":  actorType,
				"refundedAt": now,
			})
		}
		return nil
	})
}

// tryRefundPayment loads the Order by ID to obtain the PaymentKey, then
// delegates to the payment provider. Callers must treat non-nil error as a
// reason to roll back the enclosing transaction.
func (s *SeedreampayService) tryRefundPayment(ctx context.Context, tx *gorm.DB, orderID int, reason string) error {
	var order domain.Order
	if err := tx.WithContext(ctx).Where(`"Id" = ?`, orderID).First(&order).Error; err != nil {
		// If we cannot load the order, skip the payment call rather than
		// blocking the refund entirely — the voucher state change is the
		// authoritative record; payment ops can be reconciled separately.
		return nil
	}
	if order.PaymentKey == nil {
		return nil
	}
	if _, err := s.payments.RefundPayment(*order.PaymentKey, reason); err != nil {
		return fmt.Errorf("payment refund failed for order %d: %w", orderID, err)
	}
	return nil
}

// ExpireSeedreampayVouchers is a cron-friendly adapter around MarkExpiredVouchers.
// It discards the row count for logging and swallows errors (cron-safe) so
// the scheduler frame can move on. Satisfies cron.SeedreampayExpiryRunner.
func (s *SeedreampayService) ExpireSeedreampayVouchers() {
	count, err := s.MarkExpiredVouchers(context.Background())
	if err != nil {
		logger.Log.Error("expire seedreampay vouchers failed", zap.Error(err))
		return
	}
	if count > 0 {
		logger.Log.Info("expired seedreampay vouchers", zap.Int64("count", count))
	}
}

// MarkExpiredVouchers transitions all SOLD Seedreampay vouchers whose
// ExpiredAt has passed to EXPIRED. Idempotent batch update — the daily cron
// calls this to keep the status column accurate.
func (s *SeedreampayService) MarkExpiredVouchers(ctx context.Context) (int64, error) {
	now := s.now()
	res := s.db.WithContext(ctx).
		Model(&domain.VoucherCode{}).
		Joins(`JOIN "Products" p ON p."Id" = "VoucherCodes"."ProductId"`).
		Where(`p."ProviderCode" = ?`, sdpProviderCode).
		Where(`"VoucherCodes"."Status" = ?`, "SOLD").
		Where(`"VoucherCodes"."ExpiredAt" < ?`, now).
		Updates(map[string]any{
			"Status":    "EXPIRED",
			"UpdatedAt": &now,
		})
	if res.Error != nil {
		return 0, fmt.Errorf("mark expired seedreampay vouchers: %w", res.Error)
	}
	return res.RowsAffected, nil
}
