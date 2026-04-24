// cmd/migrate/verify/main.go — migration 008~013 적용 검증.
// Usage: DATABASE_URL=... go run ./cmd/migrate/verify
package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/microsoft/go-mssqldb"
)

type check struct {
	name     string
	query    string
	expected string
}

var checks = []check{
	{
		name:     "Orders deadline 컬럼 3개 (012)",
		query:    `SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Orders') AND name IN ('PaymentDeadlineAt','WithdrawalDeadlineAt','DigitalDeliveryAt')`,
		expected: "3",
	},
	{
		name:     "Orders.Status size (008/012)",
		query:    `SELECT CAST(max_length AS INT) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Orders') AND name = 'Status'`,
		expected: "20",
	},
	{
		name:     "UX_Payments_OrderId_Pending filter (013 재정의)",
		query:    `SELECT ISNULL(filter_definition, '') FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Payments') AND name = 'UX_Payments_OrderId_Pending'`,
		expected: "Method",
	},
	{
		name:     "IX_Orders_Status_PaymentDeadlineAt index (012)",
		query:    `SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Orders') AND name = 'IX_Orders_Status_PaymentDeadlineAt'`,
		expected: "1",
	},
	{
		name:     "Payments.SeedreamDaouTrx col (010)",
		query:    `SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Payments') AND name = 'SeedreamDaouTrx'`,
		expected: "1",
	},
	{
		name:     "WebhookReceipts table (008)",
		query:    `SELECT COUNT(*) FROM sys.tables WHERE name = 'WebhookReceipts'`,
		expected: "1",
	},
	{
		name:     "ReconcileCursors seed row (008)",
		query:    `SELECT COUNT(*) FROM dbo.SeedreamReconcileCursors`,
		expected: "1",
	},
	{
		name:     "VoucherCodes Seedreampay cols (009)",
		query:    `SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VoucherCodes') AND name IN ('SerialNo','SecretHash','RedeemedOrderId','RedeemedIp')`,
		expected: "4",
	},
}

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL required")
		os.Exit(2)
	}
	db, err := sql.Open("sqlserver", dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	pass, fail := 0, 0
	for _, c := range checks {
		var got string
		err := db.QueryRow(c.query).Scan(&got)
		if err != nil {
			fmt.Printf("[FAIL] %s: %v\n", c.name, err)
			fail++
			continue
		}
		// "contains" 매칭 — filter_definition 처럼 정확한 값 대조가 어려운 경우 대응
		ok := got == c.expected || (len(c.expected) > 2 && containsFold(got, c.expected))
		if ok {
			fmt.Printf("[PASS] %-55s  got=%s\n", c.name, got)
			pass++
		} else {
			fmt.Printf("[FAIL] %-55s  expected=%s got=%s\n", c.name, c.expected, got)
			fail++
		}
	}
	fmt.Printf("\n=== Verify: %d pass, %d fail ===\n", pass, fail)
	if fail > 0 {
		os.Exit(1)
	}
}

func containsFold(s, sub string) bool {
	return len(s) >= len(sub) && indexFold(s, sub) >= 0
}

func indexFold(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if equalFold(s[i:i+len(sub)], sub) {
			return i
		}
	}
	return -1
}

func equalFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if 'A' <= ca && ca <= 'Z' {
			ca += 32
		}
		if 'A' <= cb && cb <= 'Z' {
			cb += 32
		}
		if ca != cb {
			return false
		}
	}
	return true
}
