//go:build integration

// Package services — Seedreampay end-to-end lifecycle integration test.
//
// # Purpose
//
// Exercises the composition of the 3 Seedreampay voucher components we built
// (Issuer → Service.Redeem → Service.Refund → Service.MarkExpired) against a
// live MSSQL instance. Unit tests cover each layer in isolation via sqlmock;
// this test is the "do the pieces actually fit together" safety net that
// catches column-name drift, transaction boundary bugs, and schema/code
// drift between migration 009 and the GORM models.
//
// # How to run
//
//	SEEDREAMPAY_INTEGRATION_DSN="sqlserver://user:pass@host:1433?database=SEEDREAM_GIFT_DB" \
//	  go test -tags=integration ./internal/app/services/... \
//	  -run TestSeedreampayLifecycle_Integration -v
//
// Optional env:
//
//	SEEDREAMPAY_TEST_USER_ID  — existing Users.Id to own the fixture order.
//	                            Defaults to 1 (typical seeded admin).
//
// # Prerequisites
//
//   - Migration 009 (migrations/009_seedreampay_schema.sql) must be applied:
//     it adds the 4 SEEDREAMPAY Products and the SerialNo/SecretHash columns
//     + filtered UNIQUE index on VoucherCodes.
//   - A valid Users row with Id == SEEDREAMPAY_TEST_USER_ID (default 1).
//
// # Isolation
//
// We do NOT rely on a sub-transaction (GORM + MSSQL can be flaky under
// nested txns). Instead, every row created is tracked and deleted in a
// t.Cleanup hook — the test leaves no residue even on failure.
//
// # Exclusion from default runs
//
// The `//go:build integration` tag at the top ensures this file is NOT
// compiled or executed by the default `go test ./...` — it only runs when
// you pass `-tags=integration`. The env-var gate provides a second layer
// of safety so CI without DSN configured skips cleanly.
package services

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"

	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/issuance"
)

// TestSeedreampayLifecycle_Integration is the full end-to-end lifecycle test.
// See the package doc comment for run instructions.
func TestSeedreampayLifecycle_Integration(t *testing.T) {
	dsn := os.Getenv("SEEDREAMPAY_INTEGRATION_DSN")
	if dsn == "" {
		t.Skip("SEEDREAMPAY_INTEGRATION_DSN not set; skipping integration test")
	}

	// Resolve the fixture user id (defaults to 1 for the typical seeded admin).
	testUserID := 1
	if raw := os.Getenv("SEEDREAMPAY_TEST_USER_ID"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		require.NoError(t, err, "SEEDREAMPAY_TEST_USER_ID must be numeric")
		testUserID = parsed
	}

	db, err := gorm.Open(sqlserver.Open(dsn), &gorm.Config{})
	require.NoError(t, err, "gorm.Open MSSQL")
	sqlDB, err := db.DB()
	require.NoError(t, err)
	defer sqlDB.Close()

	ctx := context.Background()

	// ── Fixture sanity: migration 009 applied? Find the 10,000원권 Product. ──
	var product domain.Product
	err = db.WithContext(ctx).
		Where(`"ProviderCode" = ? AND "ProviderProductCode" = ?`, "SEEDREAMPAY", "10000").
		First(&product).Error
	if err != nil {
		t.Skipf("migration 009 not applied (Products row for SEEDREAMPAY/10000 missing): %v", err)
	}
	productID := product.ID

	// ── Verify the test user exists (we won't create one — risky on a shared DB). ──
	var userCount int64
	require.NoError(t, db.WithContext(ctx).Model(&domain.User{}).
		Where(`"Id" = ?`, testUserID).Count(&userCount).Error)
	if userCount == 0 {
		t.Skipf("user id %d not found; set SEEDREAMPAY_TEST_USER_ID to an existing user", testUserID)
	}

	// ── Cleanup bookkeeping: collect every row we create. ──
	var (
		createdSerials []string
		createdOrderID int
	)
	t.Cleanup(func() {
		// Clean up in FK-safe order. Use a fresh context (the test ctx may be done).
		cctx := context.Background()
		if len(createdSerials) > 0 {
			if err := db.WithContext(cctx).
				Where(`"SerialNo" IN ?`, createdSerials).
				Delete(&domain.VoucherCode{}).Error; err != nil {
				t.Logf("cleanup: delete VoucherCodes: %v", err)
			}
		}
		if createdOrderID != 0 {
			if err := db.WithContext(cctx).
				Where(`"Id" = ?`, createdOrderID).
				Delete(&domain.Order{}).Error; err != nil {
				t.Logf("cleanup: delete Order %d: %v", createdOrderID, err)
			}
		}
	})

	// ── Step 1: Create a pending Order for this test. ──
	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	orderCode := "IT-" + suffix
	order := &domain.Order{
		OrderCode:   &orderCode,
		UserID:      testUserID,
		TotalAmount: domain.NewNumericDecimalFromInt(10000),
		Status:      "PENDING",
		Source:      "USER",
	}
	require.NoError(t, db.WithContext(ctx).Create(order).Error, "create fixture Order")
	createdOrderID = order.ID
	require.NotZero(t, order.ID, "created Order Id should be set by OUTPUT clause")

	// ── Step 2: Issue 2 vouchers via the Seedreampay issuer. ──
	issuer := issuance.NewSeedreampayIssuer(db, time.Now)
	issued, err := issuer.Issue(ctx, interfaces.IssueRequest{
		ProductCode: "10000",
		Quantity:    2,
		OrderCode:   orderCode,
		ProductID:   productID,
		OrderID:     order.ID,
	})
	require.NoError(t, err, "Issuer.Issue")
	require.Len(t, issued, 2, "2 vouchers expected")
	for _, iv := range issued {
		require.Regexp(t, `^\d{12}$`, iv.PinCode, "PinCode should be 12 digits")
		require.Regexp(t, `^SEED-10K1-`, iv.TransactionRef, "SerialNo prefix")
		createdSerials = append(createdSerials, iv.TransactionRef)
	}

	// Verify both rows exist in the DB as SOLD with a SecretHash.
	var persisted []domain.VoucherCode
	require.NoError(t, db.WithContext(ctx).
		Where(`"SerialNo" IN ?`, createdSerials).
		Find(&persisted).Error)
	require.Len(t, persisted, 2)
	for _, vc := range persisted {
		require.Equal(t, "SOLD", vc.Status)
		require.NotNil(t, vc.SecretHash)
		require.NotEmpty(t, *vc.SecretHash)
	}

	svc := NewSeedreampayService(db, nil, time.Now)

	// ── Step 3: Redeem the first voucher (SOLD → USED via CAS). ──
	iv1 := issued[0]
	iv2 := issued[1]
	clientIP := "127.0.0.1"
	res, err := svc.Redeem(ctx, RedeemInput{
		SerialNo:   iv1.TransactionRef,
		Secret:     iv1.PinCode,
		UserID:     testUserID,
		UsageOrder: order.ID,
		ClientIP:   clientIP,
	})
	require.NoError(t, err, "Redeem first voucher")
	require.NotNil(t, res)
	require.Equal(t, 10000, res.AmountApplied)

	var redeemed domain.VoucherCode
	require.NoError(t, db.WithContext(ctx).
		Where(`"SerialNo" = ?`, iv1.TransactionRef).
		First(&redeemed).Error)
	require.Equal(t, "USED", redeemed.Status)
	require.NotNil(t, redeemed.UsedAt)
	require.NotNil(t, redeemed.RedeemedOrderID)
	require.Equal(t, order.ID, *redeemed.RedeemedOrderID)
	require.NotNil(t, redeemed.RedeemedIP)
	require.Equal(t, clientIP, *redeemed.RedeemedIP)

	// ── Step 4: Second Redeem of the same voucher must fail. ──
	_, err = svc.Redeem(ctx, RedeemInput{
		SerialNo:   iv1.TransactionRef,
		Secret:     iv1.PinCode,
		UserID:     testUserID,
		UsageOrder: order.ID,
		ClientIP:   clientIP,
	})
	require.ErrorIs(t, err, ErrVoucherAlreadyUsed, "double-redeem must be blocked")

	// ── Step 5: Refund the second voucher (admin bypass — no policy/ownership check). ──
	err = svc.Refund(ctx, RefundInput{
		SerialNo:    iv2.TransactionRef,
		RequestedBy: ActorAdmin,
		Reason:      "integration test",
	})
	require.NoError(t, err, "Refund admin path")

	var refunded domain.VoucherCode
	require.NoError(t, db.WithContext(ctx).
		Where(`"SerialNo" = ?`, iv2.TransactionRef).
		First(&refunded).Error)
	require.Equal(t, "REFUNDED", refunded.Status)

	// ── Step 6: MarkExpired — time-travel via direct UPDATE of ExpiredAt. ──
	// Issue a third voucher dedicated to the expiry scenario so we don't
	// disturb the refund/redeem rows above.
	issued3, err := issuer.Issue(ctx, interfaces.IssueRequest{
		ProductCode: "10000",
		Quantity:    1,
		OrderCode:   orderCode + "-EXP",
		ProductID:   productID,
		OrderID:     order.ID,
	})
	require.NoError(t, err)
	require.Len(t, issued3, 1)
	expireSerial := issued3[0].TransactionRef
	createdSerials = append(createdSerials, expireSerial)

	pastTime := time.Now().Add(-1 * time.Second)
	require.NoError(t, db.WithContext(ctx).
		Model(&domain.VoucherCode{}).
		Where(`"SerialNo" = ?`, expireSerial).
		Update("ExpiredAt", pastTime).Error)

	n, err := svc.MarkExpiredVouchers(ctx)
	require.NoError(t, err, "MarkExpiredVouchers")
	require.GreaterOrEqual(t, n, int64(1), "at least 1 row should be marked EXPIRED")

	var expired domain.VoucherCode
	require.NoError(t, db.WithContext(ctx).
		Where(`"SerialNo" = ?`, expireSerial).
		First(&expired).Error)
	require.Equal(t, "EXPIRED", expired.Status)
}
