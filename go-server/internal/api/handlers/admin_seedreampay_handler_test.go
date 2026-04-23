package handlers

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

// newMockGormAdminSdp builds a gorm.DB backed by sqlmock. Regex matching is
// used so we can assert the ProviderCode filter without pinning exact SQL.
func newMockGormAdminSdp(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	t.Helper()
	sqlDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	require.NoError(t, err)
	db, err := gorm.Open(sqlserver.New(sqlserver.Config{Conn: sqlDB}), &gorm.Config{})
	require.NoError(t, err)
	return db, mock
}

// TestAdminSeedreampayHandler_ListVouchers_FiltersByProviderCode verifies the
// handler always restricts results to ProviderCode='SEEDREAMPAY' via a JOIN
// against Products.
func TestAdminSeedreampayHandler_ListVouchers_FiltersByProviderCode(t *testing.T) {
	db, mock := newMockGormAdminSdp(t)

	// Two queries expected: count, then select. Both must contain the
	// ProviderCode = 'SEEDREAMPAY' restriction in the WHERE clause.
	mock.ExpectQuery(regexp.QuoteMeta(`"Products"."ProviderCode"`)).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	now := time.Now()
	mock.ExpectQuery(regexp.QuoteMeta(`"Products"."ProviderCode"`)).
		WillReturnRows(sqlmock.NewRows([]string{
			"Id", "SerialNo", "Status", "ProductId", "OrderId",
			"CreatedAt", "SoldAt", "UsedAt", "ExpiredAt",
			"RedeemedOrderId", "RedeemedIp",
		}).
			AddRow(1, "SEED-10K1-X7AB-K9PD-M3QY", "SOLD", 7, 55, now, now, nil, now.Add(24*time.Hour), nil, nil).
			AddRow(2, "SEED-10K2-XYZ1-AB23-CD45", "USED", 7, 66, now, now, now, now.Add(24*time.Hour), 66, "203.0.113.1"))

	h := NewAdminSeedreampayHandler(db)
	r := gin.New()
	r.GET("/admin/seedreampay/vouchers", h.ListVouchers)

	req := httptest.NewRequest(http.MethodGet, "/admin/seedreampay/vouchers?page=1&limit=20", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.NoError(t, mock.ExpectationsWereMet(), "all expected queries should fire")
}
