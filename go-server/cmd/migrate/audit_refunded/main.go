// P0 운영검증: VA 주문 중 Mock 환불 경로로 빠져 silent success 된 의심 행 탐지.
// 사용: DATABASE_URL=... go run ./cmd/migrate/audit_refunded
package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	db, err := sql.Open("sqlserver", os.Getenv("DATABASE_URL"))
	if err != nil {
		fmt.Println("connect:", err)
		os.Exit(1)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		fmt.Println("ping:", err)
		os.Exit(1)
	}

	// 1) 전체 카운트
	fmt.Println("=== 1. IssuanceLogs Status 분포 (REFUNDED/FAILED_REFUND_PENDING) ===")
	rows, _ := db.Query(`
		SELECT Status, COUNT(*) AS cnt
		FROM dbo.IssuanceLogs
		WHERE Status IN ('REFUNDED', 'FAILED_REFUND_PENDING')
		GROUP BY Status
	`)
	for rows.Next() {
		var s string
		var n int
		_ = rows.Scan(&s, &n)
		fmt.Printf("  %-25s %d\n", s, n)
	}
	rows.Close()

	// 2) PaymentMethod x Status
	fmt.Println("\n=== 2. PaymentMethod x IssuanceStatus (의심 행) ===")
	rows, _ = db.Query(`
		SELECT ISNULL(O.PaymentMethod, '<NULL>') AS pm, L.Status, COUNT(*) AS cnt
		FROM dbo.IssuanceLogs L
		INNER JOIN dbo.Orders O ON O.Id = L.OrderId
		WHERE L.Status IN ('REFUNDED', 'FAILED_REFUND_PENDING')
		GROUP BY O.PaymentMethod, L.Status
		ORDER BY pm, L.Status
	`)
	fmt.Printf("  %-30s %-25s %s\n", "PaymentMethod", "IssuanceStatus", "Count")
	any := false
	for rows.Next() {
		var pm, st string
		var n int
		_ = rows.Scan(&pm, &st, &n)
		fmt.Printf("  %-30s %-25s %d\n", pm, st, n)
		any = true
	}
	rows.Close()
	if !any {
		fmt.Println("  (no rows — IssuanceLogs 에 환불 흔적 자체가 없음)")
	}

	// 3) VA 주문 의심행 상세
	fmt.Println("\n=== 3. VA 주문 의심행 상세 (최대 100건) ===")
	rows, _ = db.Query(`
		SELECT TOP 100
			L.Id, L.OrderId, ISNULL(O.OrderCode,'-'), ISNULL(O.PaymentMethod,'-'),
			ISNULL(O.PaymentKey,'-'), CAST(O.TotalAmount AS DECIMAL(18,0)),
			L.Status, L.ProviderCode, L.AttemptCount,
			ISNULL(L.ErrorMessage,''),
			L.CreatedAt, O.Status AS OrderStatus
		FROM dbo.IssuanceLogs L
		INNER JOIN dbo.Orders O ON O.Id = L.OrderId
		WHERE L.Status IN ('REFUNDED', 'FAILED_REFUND_PENDING')
		  AND O.PaymentMethod LIKE 'VIRTUAL_ACCOUNT%'
		ORDER BY L.CreatedAt DESC
	`)
	fmt.Printf("  %-6s %-8s %-22s %-26s %-22s %-12s %-22s %-15s %s\n",
		"LogId", "OrderId", "OrderCode", "PaymentMethod", "PaymentKey", "Amount", "IssuanceStatus", "OrderStatus", "Created")
	count := 0
	for rows.Next() {
		var lid, oid, attempt int
		var oc, pm, pk, st, prov, errMsg, ostat string
		var amt int64
		var created interface{}
		if err := rows.Scan(&lid, &oid, &oc, &pm, &pk, &amt, &st, &prov, &attempt, &errMsg, &created, &ostat); err != nil {
			fmt.Println("  scan err:", err)
			continue
		}
		fmt.Printf("  %-6d %-8d %-22s %-26s %-22s %-12d %-22s %-15s %v\n",
			lid, oid, trunc(oc, 22), trunc(pm, 26), trunc(pk, 22), amt, trunc(st, 22), trunc(ostat, 15), created)
		count++
	}
	rows.Close()
	fmt.Printf("\n  → VA 의심행 총 %d 건\n", count)

	// 4) 카드/즉시결제 환불 흔적 (참고용)
	fmt.Println("\n=== 4. 비-VA 환불 흔적 (Mock 영향 포함) ===")
	rows, _ = db.Query(`
		SELECT ISNULL(O.PaymentMethod,'<NULL>') AS pm, L.Status, COUNT(*) AS cnt
		FROM dbo.IssuanceLogs L
		INNER JOIN dbo.Orders O ON O.Id = L.OrderId
		WHERE L.Status IN ('REFUNDED', 'FAILED_REFUND_PENDING')
		  AND (O.PaymentMethod IS NULL OR O.PaymentMethod NOT LIKE 'VIRTUAL_ACCOUNT%')
		GROUP BY O.PaymentMethod, L.Status
	`)
	any2 := false
	for rows.Next() {
		var pm, st string
		var n int
		_ = rows.Scan(&pm, &st, &n)
		fmt.Printf("  %-30s %-25s %d\n", pm, st, n)
		any2 = true
	}
	rows.Close()
	if !any2 {
		fmt.Println("  (no rows)")
	}
}

func trunc(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}
