package services

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"

	"seedream-gift-server/internal/infra/issuance"
)

func newMockGormSvc(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	t.Helper()
	sqlDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	require.NoError(t, err)
	db, err := gorm.Open(sqlserver.New(sqlserver.Config{Conn: sqlDB}), &gorm.Config{})
	require.NoError(t, err)
	return db, mock
}

func TestSeedreampay_GetVoucherBySerial_NotFound(t *testing.T) {
	db, mock := newMockGormSvc(t)
	mock.ExpectQuery(`SELECT .* FROM "VoucherCodes"`).
		WillReturnRows(sqlmock.NewRows([]string{"Id"}))
	svc := NewSeedreampayService(db, nil, time.Now)

	_, err := svc.GetVoucherBySerial(context.Background(), "SEED-10K1-X-Y-Z")
	require.ErrorIs(t, err, ErrVoucherNotFound)
}

func TestSeedreampay_VerifySecretAgainst(t *testing.T) {
	db, _ := newMockGormSvc(t)
	svc := NewSeedreampayService(db, nil, time.Now)

	serial := "SEED-10K1-X7AB-K9PD-M3QY"
	secret := "482917365021"
	hash := issuance.SecretHash(secret, serial)

	require.True(t, svc.VerifySecretAgainst(secret, serial, hash))
	require.False(t, svc.VerifySecretAgainst("000000000000", serial, hash))
}

func TestSeedreampay_Redeem_SecretMismatch(t *testing.T) {
	db, mock := newMockGormSvc(t)
	svc := NewSeedreampayService(db, nil, time.Now)

	serial := "SEED-10K1-X7AB-K9PD-M3QY"
	correctSecret := "482917365021"
	hash := issuance.SecretHash(correctSecret, serial)

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT .* FROM "VoucherCodes"`).
		WillReturnRows(sqlmock.NewRows([]string{"Id", "Status", "ExpiredAt", "SecretHash", "ProductId"}).
			AddRow(100, "SOLD", time.Now().Add(time.Hour), hash, 7))
	mock.ExpectRollback()

	_, err := svc.Redeem(context.Background(), RedeemInput{
		SerialNo: serial, Secret: "000000000000", UserID: 42, UsageOrder: 999, ClientIP: "203.0.113.1",
	})
	require.ErrorIs(t, err, ErrSecretMismatch)
}

func TestSeedreampay_Refund_WithinWindow(t *testing.T) {
	db, mock := newMockGormSvc(t)
	now := time.Date(2026, 4, 23, 12, 0, 0, 0, time.UTC)
	createdAt := now.AddDate(0, 0, -6) // 6 days ago — within window
	svc := NewSeedreampayService(db, nil, func() time.Time { return now })

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT .* FROM "VoucherCodes"`).
		WillReturnRows(sqlmock.NewRows([]string{"Id", "Status", "CreatedAt", "OrderId"}).
			AddRow(100, "SOLD", createdAt, 55))
	mock.ExpectQuery(`SELECT .* FROM "Orders"`).
		WillReturnRows(sqlmock.NewRows([]string{"Id", "UserId"}).AddRow(55, 42))
	mock.ExpectExec(`UPDATE "VoucherCodes"`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := svc.Refund(context.Background(), RefundInput{
		SerialNo: "SEED-10K1-AAAA-BBBB-CCCC", RequestedBy: ActorUser, UserID: 42,
	})
	require.NoError(t, err)
}

func TestSeedreampay_Refund_WindowExpired_UserBlocked(t *testing.T) {
	db, mock := newMockGormSvc(t)
	now := time.Date(2026, 4, 23, 12, 0, 0, 0, time.UTC)
	createdAt := now.AddDate(0, 0, -8) // 8 days ago — outside window
	svc := NewSeedreampayService(db, nil, func() time.Time { return now })

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT .* FROM "VoucherCodes"`).
		WillReturnRows(sqlmock.NewRows([]string{"Id", "Status", "CreatedAt", "OrderId"}).
			AddRow(100, "SOLD", createdAt, 55))
	mock.ExpectRollback()

	err := svc.Refund(context.Background(), RefundInput{
		SerialNo: "SEED-10K1-AAAA-BBBB-CCCC", RequestedBy: ActorUser, UserID: 42,
	})
	require.ErrorIs(t, err, ErrRefundWindowExpired)
}

func TestSeedreampay_MarkExpiredVouchers(t *testing.T) {
	db, mock := newMockGormSvc(t)
	svc := NewSeedreampayService(db, nil, time.Now)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE "VoucherCodes"`).
		WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectCommit()

	n, err := svc.MarkExpiredVouchers(context.Background())
	require.NoError(t, err)
	require.Equal(t, int64(3), n)
}
