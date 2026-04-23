package issuance

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"

	"seedream-gift-server/internal/app/interfaces"
)

func newMockGorm(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	t.Helper()
	sqlDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	require.NoError(t, err)
	db, err := gorm.Open(sqlserver.New(sqlserver.Config{Conn: sqlDB}), &gorm.Config{})
	require.NoError(t, err)
	return db, mock
}

func TestSeedreampayIssuer_ProviderCode(t *testing.T) {
	db, _ := newMockGorm(t)
	issuer := NewSeedreampayIssuer(db, time.Now)
	require.Equal(t, "SEEDREAMPAY", issuer.ProviderCode())
}

func TestSeedreampayIssuer_Issue_Success(t *testing.T) {
	db, mock := newMockGorm(t)
	fixed := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	issuer := NewSeedreampayIssuer(db, func() time.Time { return fixed })

	mock.ExpectBegin()
	for i := 0; i < 2; i++ {
		mock.ExpectQuery(`SELECT count\(\*\).*VoucherCodes`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		// GORM MSSQL uses OUTPUT INSERTED."Id" so INSERT is a Query, not Exec.
		mock.ExpectQuery(`INSERT INTO "VoucherCodes"`).
			WillReturnRows(sqlmock.NewRows([]string{"Id"}).AddRow(int64(i + 1)))
	}
	mock.ExpectCommit()

	out, err := issuer.Issue(context.Background(), interfaces.IssueRequest{
		ProductCode: "10000",
		Quantity:    2,
		OrderCode:   "ORD-001",
		ProductID:   7,
		OrderID:     42,
	})
	require.NoError(t, err)
	require.Len(t, out, 2)
	for _, v := range out {
		require.NotEmpty(t, v.PinCode)
		require.NotEmpty(t, v.TransactionRef)
		require.Regexp(t, `^SEED-10K1-`, v.TransactionRef)
		require.Regexp(t, `^\d{12}$`, v.PinCode)
	}
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSeedreampayIssuer_Issue_SerialCollisionThenSucceeds(t *testing.T) {
	db, mock := newMockGorm(t)
	fixed := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	issuer := NewSeedreampayIssuer(db, func() time.Time { return fixed })

	mock.ExpectBegin()
	// 1차 시도: 충돌 (count=1)
	mock.ExpectQuery(`SELECT count\(\*\).*VoucherCodes`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	// 2차 시도: 성공 (count=0) → INSERT
	mock.ExpectQuery(`SELECT count\(\*\).*VoucherCodes`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`INSERT INTO "VoucherCodes"`).
		WillReturnRows(sqlmock.NewRows([]string{"Id"}).AddRow(int64(1)))
	mock.ExpectCommit()

	out, err := issuer.Issue(context.Background(), interfaces.IssueRequest{
		ProductCode: "10000", Quantity: 1, OrderCode: "ORD-RETRY", ProductID: 7, OrderID: 42,
	})
	require.NoError(t, err)
	require.Len(t, out, 1)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSeedreampayIssuer_Issue_SerialCollisionExceedsRetry(t *testing.T) {
	db, mock := newMockGorm(t)
	issuer := NewSeedreampayIssuer(db, time.Now)

	mock.ExpectBegin()
	// 3회 연속 충돌 → INSERT 없음 → rollback
	for i := 0; i < 3; i++ {
		mock.ExpectQuery(`SELECT count\(\*\).*VoucherCodes`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	}
	mock.ExpectRollback()

	_, err := issuer.Issue(context.Background(), interfaces.IssueRequest{
		ProductCode: "10000", Quantity: 1, OrderCode: "ORD-EXHAUST", ProductID: 7, OrderID: 42,
	})
	require.ErrorIs(t, err, ErrSerialCollision)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSeedreampayIssuer_Issue_InvalidFaceValue(t *testing.T) {
	db, _ := newMockGorm(t)
	issuer := NewSeedreampayIssuer(db, time.Now)
	_, err := issuer.Issue(context.Background(), interfaces.IssueRequest{
		ProductCode: "9999",
		Quantity:    1,
	})
	require.ErrorIs(t, err, ErrUnknownFaceValue)
}

func TestSeedreampayIssuer_Issue_QuantityBoundary(t *testing.T) {
	db, _ := newMockGorm(t)
	issuer := NewSeedreampayIssuer(db, time.Now)

	_, err := issuer.Issue(context.Background(), interfaces.IssueRequest{ProductCode: "10000", Quantity: 0})
	require.Error(t, err)

	_, err = issuer.Issue(context.Background(), interfaces.IssueRequest{ProductCode: "10000", Quantity: 101})
	require.Error(t, err)
}

func TestSeedreampayIssuer_Issue_ProductCodeNonNumeric(t *testing.T) {
	db, _ := newMockGorm(t)
	issuer := NewSeedreampayIssuer(db, time.Now)
	_, err := issuer.Issue(context.Background(), interfaces.IssueRequest{ProductCode: "abc", Quantity: 1})
	require.Error(t, err)
}
