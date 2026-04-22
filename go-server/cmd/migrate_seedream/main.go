// cmd/migrate_seedream/main.go — Seedream 결제 통합 Phase 1 데이터 모델 마이그레이션
//
// Usage: go run ./cmd/migrate_seedream
//        또는 빌드: go build -o migrate_seedream.exe ./cmd/migrate_seedream
//
// 실행 대상: go-server/migrations/008_seedream_payment_data_model.sql
// idempotent — 반복 실행 안전 (IF NOT EXISTS / IF EXISTS 가드).
package main

import (
	"fmt"
	"log"
	"os"
	"seedream-gift-server/internal/config"
	"strings"

	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

const migrationPath = "migrations/008_seedream_payment_data_model.sql"

func main() {
	cfg, err := config.LoadConfig(".")
	if err != nil {
		log.Fatal("Config error:", err)
	}

	db, err := gorm.Open(sqlserver.Open(cfg.DBUrl), &gorm.Config{})
	if err != nil {
		log.Fatal("DB connect error:", err)
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()

	fmt.Println("=== Seedream Payment Phase 1 Migration ===")

	raw, err := os.ReadFile(migrationPath)
	if err != nil {
		log.Fatalf("Read migration file %s: %v", migrationPath, err)
	}

	// MSSQL 의 GO 는 배치 분리자 (T-SQL 파서 전용, DB 가 직접 실행 불가).
	// 문자열 레벨에서 분리 후 각 배치를 개별 Exec 로 실행.
	// Windows 에디터로 저장된 CRLF 파일도 안전히 처리하기 위해 LF 로 정규화.
	normalized := strings.ReplaceAll(string(raw), "\r\n", "\n")
	batches := strings.Split(normalized, "\nGO\n")

	executed := 0
	for i, batch := range batches {
		batch = strings.TrimSpace(batch)
		if batch == "" {
			continue
		}
		if err := db.Exec(batch).Error; err != nil {
			log.Fatalf("Batch #%d failed: %v\n\nSQL:\n%s", i+1, err, batch)
		}
		executed++
	}

	fmt.Printf("\n✓ Executed %d SQL batches\n", executed)

	// 사후 검증: 핵심 객체 존재 여부를 스스로 확인
	var tableCount int
	db.Raw(`
		SELECT COUNT(*) FROM sys.tables
		WHERE name IN ('WebhookReceipts', 'SeedreamReconcileCursors')
	`).Scan(&tableCount)
	if tableCount != 2 {
		log.Fatalf("Post-check failed: expected 2 new tables, found %d", tableCount)
	}
	fmt.Println("✓ Verified: WebhookReceipts & SeedreamReconcileCursors tables exist")

	var payCols int
	db.Raw(`
		SELECT COUNT(*) FROM sys.columns
		WHERE object_id = OBJECT_ID('Payments')
		  AND name IN ('SeedreamVAccountId', 'SeedreamPhase', 'SeedreamIdempotencyKey')
	`).Scan(&payCols)
	if payCols != 3 {
		log.Fatalf("Post-check failed: expected 3 new Payments columns, found %d", payCols)
	}
	fmt.Println("✓ Verified: Payments table has 3 new Seedream columns")

	// Orders.Status 는 VARCHAR(20) 으로 확장됨 (ASCII enum 전용, NVARCHAR 불요).
	// sys.columns.max_length: VARCHAR 은 바이트=문자, NVARCHAR 은 UTF-16 바이트.
	var statusLen int
	var statusType string
	db.Raw(`
		SELECT c.max_length, t.name
		FROM sys.columns c
		INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
		WHERE c.object_id = OBJECT_ID('Orders') AND c.name = 'Status'
	`).Row().Scan(&statusLen, &statusType)
	var statusChars int
	switch statusType {
	case "varchar":
		statusChars = statusLen
	case "nvarchar":
		statusChars = statusLen / 2
	default:
		log.Fatalf("Post-check failed: Orders.Status 예상 외 타입 %s", statusType)
	}
	if statusChars < 20 {
		log.Fatalf("Post-check failed: Orders.Status %s(%d) (expected >= 20 chars)", statusType, statusChars)
	}
	fmt.Printf("✓ Verified: Orders.Status %s(%d chars)\n", statusType, statusChars)

	var cursorRows int
	db.Raw(`SELECT COUNT(*) FROM SeedreamReconcileCursors WHERE Id = 1`).Scan(&cursorRows)
	if cursorRows != 1 {
		log.Fatalf("Post-check failed: ReconcileCursor seed row missing (found %d)", cursorRows)
	}
	fmt.Println("✓ Verified: SeedreamReconcileCursors has singleton seed row")

	fmt.Println("\n=== Migration 008 complete ===")
}
