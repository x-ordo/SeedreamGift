// cmd/migrate_rejection_reason/main.go — Products 테이블에 RejectionReason 컬럼 추가
// Usage: go run ./cmd/migrate_rejection_reason
package main

import (
	"fmt"
	"log"
	"seedream-gift-server/internal/config"

	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

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

	fmt.Println("=== RejectionReason Migration ===")

	// RejectionReason 컬럼 존재 여부 확인
	var count int
	db.Raw(`
		SELECT COUNT(*) FROM sys.columns
		WHERE object_id = OBJECT_ID('Products') AND name = 'RejectionReason'
	`).Scan(&count)

	if count > 0 {
		fmt.Println("- RejectionReason column already exists, skipping")
	} else {
		if err := db.Exec(`ALTER TABLE Products ADD RejectionReason NVARCHAR(500) NULL`).Error; err != nil {
			log.Fatal("Migration error:", err)
		}
		fmt.Println("+ Added RejectionReason column to Products")
	}

	fmt.Println("\n✓ Migration complete!")
}
