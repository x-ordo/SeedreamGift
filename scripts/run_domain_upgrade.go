package main

import (
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	dsn := "server=103.97.209.194;port=7335;user id=dnflrhdwnghkdlxldsql;password=dnflrhdwnghkdlxld2024!@;database=WOWGIFT_DB"
	db, err := sql.Open("sqlserver", dsn)
	if err != nil {
		fmt.Println("Connection error:", err)
		return
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		fmt.Println("Ping failed:", err)
		return
	}
	fmt.Println("Connected to WOWGIFT_DB")
	fmt.Println()

	// Each ALTER TABLE as individual statement with IF NOT EXISTS guard
	alters := []struct {
		table, column, definition string
	}{
		// Order
		{"Orders", "PaymentDeadlineAt", "DATETIME2 NULL"},
		{"Orders", "WithdrawalDeadlineAt", "DATETIME2 NULL"},
		{"Orders", "DigitalDeliveryAt", "DATETIME2 NULL"},
		// TradeIn
		{"TradeIns", "VerifiedByAdminId", "INT NULL"},
		{"TradeIns", "VerificationMethod", "VARCHAR(20) NULL"},
		{"TradeIns", "AmlRiskScore", "INT NULL"},
		{"TradeIns", "PaymentRefNumber", "VARCHAR(50) NULL"},
		{"TradeIns", "PaymentProcessedAt", "DATETIME2 NULL"},
		{"TradeIns", "ProcessedByAdminId", "INT NULL"},
		// VoucherCode
		{"VoucherCodes", "Source", "VARCHAR(20) NULL"},
		{"VoucherCodes", "IssuerVerifiedAt", "DATETIME2 NULL"},
		{"VoucherCodes", "IssuerVerificationRef", "VARCHAR(50) NULL"},
		{"VoucherCodes", "DisputedAt", "DATETIME2 NULL"},
		{"VoucherCodes", "DisputeReason", "NVARCHAR(200) NULL"},
		// Product
		{"Products", "Denomination", "INT NULL"},
		{"Products", "MinPurchaseQty", "INT NOT NULL DEFAULT 1"},
		{"Products", "MaxPurchaseQty", "INT NOT NULL DEFAULT 99"},
		{"Products", "IssuerId", "VARCHAR(30) NULL"},
		// User
		{"Users", "CustomLimitPerMonth", "DECIMAL(12,0) NULL"},
		{"Users", "CustomLimitPerYear", "DECIMAL(12,0) NULL"},
	}

	fmt.Println("=== Schema Domain Upgrade ===")
	fmt.Println()

	ok, skip, fail := 0, 0, 0
	for _, a := range alters {
		// Check if column already exists
		var exists int
		checkSQL := fmt.Sprintf(
			"SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('%s') AND name = '%s'",
			a.table, a.column,
		)
		if err := db.QueryRow(checkSQL).Scan(&exists); err != nil {
			fmt.Printf("[ERROR] %s.%s check: %v\n", a.table, a.column, err)
			fail++
			continue
		}
		if exists > 0 {
			fmt.Printf("[SKIP]  %s.%-25s already exists\n", a.table, a.column)
			skip++
			continue
		}

		alterSQL := fmt.Sprintf("ALTER TABLE %s ADD %s %s", a.table, a.column, a.definition)
		if _, err := db.Exec(alterSQL); err != nil {
			fmt.Printf("[ERROR] %s.%-25s %v\n", a.table, a.column, err)
			fail++
		} else {
			fmt.Printf("[OK]    %s.%-25s added\n", a.table, a.column)
			ok++
		}
	}

	fmt.Println()
	fmt.Printf("Result: %d added, %d skipped, %d failed\n", ok, skip, fail)

	_ = strings.Join(nil, "")
}
