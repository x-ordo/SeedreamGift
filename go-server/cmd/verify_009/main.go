// cmd/verify_009/main.go — Seedreampay migration 009 검증 스크립트
// Usage: DATABASE_URL=... go run ./cmd/verify_009
package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		fmt.Println("DATABASE_URL not set")
		os.Exit(1)
	}
	db, err := sql.Open("sqlserver", dsn)
	if err != nil {
		fmt.Printf("open: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		fmt.Printf("ping: %v\n", err)
		os.Exit(1)
	}

	check := func(label string, got, want any) {
		fmt.Printf("  %s: got=%v want=%v\n", label, got, want)
	}

	var brandCount, productCount int
	_ = db.QueryRow("SELECT COUNT(*) FROM Brands WHERE Code='SEEDREAMPAY'").Scan(&brandCount)
	_ = db.QueryRow("SELECT COUNT(*) FROM Products WHERE BrandCode='SEEDREAMPAY'").Scan(&productCount)

	var serial, hash, orderid, ip sql.NullInt64
	_ = db.QueryRow(`SELECT
		COL_LENGTH('VoucherCodes','SerialNo'),
		COL_LENGTH('VoucherCodes','SecretHash'),
		COL_LENGTH('VoucherCodes','RedeemedOrderId'),
		COL_LENGTH('VoucherCodes','RedeemedIp')`).Scan(&serial, &hash, &orderid, &ip)

	var idxName sql.NullString
	_ = db.QueryRow("SELECT name FROM sys.indexes WHERE name='UX_VoucherCode_SerialNo'").Scan(&idxName)

	fmt.Println("=== Migration 009 Verification ===")
	check("Brands row count (Code=SEEDREAMPAY)", brandCount, 1)
	check("Products row count (BrandCode=SEEDREAMPAY)", productCount, 4)
	check("VoucherCodes.SerialNo size (bytes)", serial.Int64, 64) // NVARCHAR(32) = 64 bytes
	check("VoucherCodes.SecretHash size", hash.Int64, 64)         // CHAR(64)
	check("VoucherCodes.RedeemedOrderId size", orderid.Int64, 4)  // INT
	check("VoucherCodes.RedeemedIp size (bytes)", ip.Int64, 90)   // NVARCHAR(45) = 90 bytes
	check("UX_VoucherCode_SerialNo exists", idxName.Valid, true)

	fmt.Println("\n=== Products Detail ===")
	rows, err := db.Query(`SELECT Name, Price, BuyPrice, FulfillmentType, ProviderCode, ProviderProductCode
		FROM Products WHERE BrandCode='SEEDREAMPAY' ORDER BY Price`)
	if err != nil {
		fmt.Printf("query: %v\n", err)
		os.Exit(1)
	}
	defer rows.Close()
	for rows.Next() {
		var name, ft, pc, ppc string
		var price, buy string // Decimal → string to avoid parse issues
		if err := rows.Scan(&name, &price, &buy, &ft, &pc, &ppc); err != nil {
			fmt.Printf("scan: %v\n", err)
			continue
		}
		fmt.Printf("  %s | price=%s buy=%s | %s %s %s\n", name, price, buy, ft, pc, ppc)
	}
}
