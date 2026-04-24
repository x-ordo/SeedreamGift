package issuance

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/logger"
)

// Compile-time assertion that SeedreampayIssuer implements VoucherIssuer.
var _ interfaces.VoucherIssuer = (*SeedreampayIssuer)(nil)

const (
	providerCodeSeedreampay = "SEEDREAMPAY"
	voucherStatusSold       = "SOLD"
	serialCollisionRetries  = 3
	validityYears           = 5
	minQuantity             = 1
	maxQuantity             = 100
)

// ErrSerialCollision 은 SerialNo 생성이 DB UNIQUE 제약과 충돌한 재시도 한도 초과를 나타낸다.
var ErrSerialCollision = errors.New("serialNo collision exceeded retry limit")

// SeedreampayIssuer 는 씨드림기프트 내부에서 직접 상품권을 발행하는 VoucherIssuer 구현체다.
// 외부 HTTP 호출이 없어 httpClient / circuit breaker / apiKey 의존성을 받지 않는다.
type SeedreampayIssuer struct {
	db  *gorm.DB
	now func() time.Time
}

// NewSeedreampayIssuer 는 Seedreampay 발급자를 생성한다. now 가 nil 이면 time.Now 로 대체된다.
func NewSeedreampayIssuer(db *gorm.DB, now func() time.Time) *SeedreampayIssuer {
	if now == nil {
		now = time.Now
	}
	return &SeedreampayIssuer{db: db, now: now}
}

// ProviderCode 는 VoucherIssuer 인터페이스를 충족한다.
func (s *SeedreampayIssuer) ProviderCode() string { return providerCodeSeedreampay }

// Issue 는 DB 트랜잭션 안에서 VoucherCode 레코드 n 개를 원자적으로 생성한다.
// PinCode 에는 원본 Secret 을, TransactionRef 에는 SerialNo 를 담아 1회만 호출자에게 전달한다.
// req.ProductID / req.OrderID 가 제공되면 그대로 VoucherCode 에 기록되며,
// FulfillmentService 가 반드시 이 두 필드를 세팅한다 (스펙 §4.2 / §8.2 참조).
//
// PinCode 컬럼에는 공개값 SerialNo 를 저장한다. SerialNo 는 공개 정보라 보안
// 계약을 위배하지 않으며, legacy PinCode NOT NULL 제약을 충족시키기 위한 선택.
// 비밀코드 원문은 어떤 컬럼에도 저장되지 않고 해시 비교만으로 검증한다.
func (s *SeedreampayIssuer) Issue(ctx context.Context, req interfaces.IssueRequest) ([]interfaces.IssuedVoucher, error) {
	if req.Quantity < minQuantity || req.Quantity > maxQuantity {
		return nil, fmt.Errorf("quantity out of range: %d (allowed %d-%d)", req.Quantity, minQuantity, maxQuantity)
	}

	faceValue, err := strconv.Atoi(req.ProductCode)
	if err != nil {
		return nil, fmt.Errorf("invalid ProductCode %q: %w", req.ProductCode, err)
	}
	if _, ok := faceValueTag[faceValue]; !ok {
		return nil, fmt.Errorf("%w: %d", ErrUnknownFaceValue, faceValue)
	}

	now := s.now()
	expiresAt := now.AddDate(validityYears, 0, 0)
	out := make([]interfaces.IssuedVoucher, 0, req.Quantity)

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for i := 0; i < req.Quantity; i++ {
			serial, err := s.generateSerialWithRetry(tx, faceValue)
			if err != nil {
				return fmt.Errorf("serial collision (faceValue=%d, orderCode=%q): %w", faceValue, req.OrderCode, err)
			}
			secret, err := GenerateSecret()
			if err != nil {
				return err
			}
			hash := SecretHash(secret, serial)

			vc := &domain.VoucherCode{
				ProductID:  req.ProductID,
				OrderID:    &req.OrderID,
				// PinCode 에는 공개값 SerialNo 를 저장한다 (spec §4.2 — 보안 계약 준수).
				PinCode:    serial,
				PinHash:    hash,
				SerialNo:   &serial,
				SecretHash: &hash,
				Status:     voucherStatusSold,
				Source:     providerCodeSeedreampay,
				SoldAt:     &now,
				ExpiredAt:  &expiresAt,
			}

			if err := tx.Create(vc).Error; err != nil {
				return fmt.Errorf("create VoucherCode: %w", err)
			}

			out = append(out, interfaces.IssuedVoucher{
				PinCode:        secret,
				TransactionRef: serial,
			})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	// tx commit 후에만 성공 로그를 남긴다 — 루프 중간 rollback 시 허위 로그 방지.
	for _, iv := range out {
		logger.Log.Info("seedreampay.issue.ok",
			zap.String("serialNo", iv.TransactionRef),
			zap.Int("faceValue", faceValue),
			zap.String("orderCode", req.OrderCode),
		)
	}
	return out, nil
}

// generateSerialWithRetry attempts to produce a collision-free SerialNo up to
// serialCollisionRetries times. Collisions should be vanishingly rare in
// practice given the 30^8 search space (~≥10^11).
func (s *SeedreampayIssuer) generateSerialWithRetry(tx *gorm.DB, faceValue int) (string, error) {
	for attempt := 1; attempt <= serialCollisionRetries; attempt++ {
		serial, err := GenerateSerialNo(faceValue)
		if err != nil {
			return "", err
		}

		var exists int64
		if err := tx.Model(&domain.VoucherCode{}).
			Where("SerialNo = ?", serial).
			Count(&exists).Error; err != nil {
			return "", fmt.Errorf("check serial collision: %w", err)
		}
		if exists == 0 {
			return serial, nil
		}

		logger.Log.Warn("seedreampay.serial.collision",
			zap.Int("attempt", attempt),
			zap.String("serialPrefix", serial[:9]),
		)
	}
	return "", ErrSerialCollision
}
