// Inspect recent WebhookReceipts rows after smoke test.
package main

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	db, err := sql.Open("sqlserver", os.Getenv("DATABASE_URL"))
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	defer db.Close()

	fmt.Println("=== WebhookReceipts (최신 10건) ===")
	rows, err := db.Query(`
		SELECT TOP 10 DeliveryId, Event, ISNULL(OrderNo, '-') AS OrderNo,
		       ReceivedAt,
		       CASE WHEN ProcessedAt IS NULL THEN 'PENDING' ELSE 'DONE' END AS ProcState
		FROM dbo.WebhookReceipts
		ORDER BY ReceivedAt DESC
	`)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	defer rows.Close()

	fmt.Printf("%-20s %-30s %-30s %-25s %s\n", "DeliveryId", "Event", "OrderNo", "ReceivedAt(UTC)", "Proc")
	count := 0
	for rows.Next() {
		var did int64
		var evt, orderNo, proc string
		var rcv time.Time
		if err := rows.Scan(&did, &evt, &orderNo, &rcv, &proc); err != nil {
			fmt.Println(err)
			continue
		}
		fmt.Printf("%-20d %-30s %-30s %-25s %s\n", did, evt, orderNo, rcv.Format("2006-01-02 15:04:05"), proc)
		count++
	}
	fmt.Printf("\nTotal rows returned: %d\n", count)
}
