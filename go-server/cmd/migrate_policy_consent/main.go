// cmd/migrate_policy_consent/main.go — PolicyConsents 테이블 생성 마이그레이션
// Usage: go run ./cmd/migrate_policy_consent
package main

import (
	"fmt"
	"log"
	"w-gift-server/internal/config"

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

	fmt.Println("=== PolicyConsents Migration ===")

	var tableExists int
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'PolicyConsents'`).Scan(&tableExists)

	if tableExists == 0 {
		if err := db.Exec(`
			CREATE TABLE PolicyConsents (
				Id        INT IDENTITY(1,1) PRIMARY KEY,
				UserId    INT NOT NULL,
				PolicyId  INT NOT NULL,
				Version   NVARCHAR(20) NOT NULL,
				ConsentAt DATETIME2 NOT NULL DEFAULT GETDATE(),
				IpAddress NVARCHAR(45) NOT NULL DEFAULT ''
			)
		`).Error; err != nil {
			log.Fatal("Create PolicyConsents table error:", err)
		}
		fmt.Println("✓ Created PolicyConsents table")

		if err := db.Exec(`
			CREATE INDEX IX_PolicyConsents_UserId ON PolicyConsents(UserId)
		`).Error; err != nil {
			log.Fatal("Create index IX_PolicyConsents_UserId error:", err)
		}
		fmt.Println("✓ Created index IX_PolicyConsents_UserId")

		if err := db.Exec(`
			CREATE INDEX IX_PolicyConsents_PolicyId_Version ON PolicyConsents(PolicyId, Version)
		`).Error; err != nil {
			log.Fatal("Create index IX_PolicyConsents_PolicyId_Version error:", err)
		}
		fmt.Println("✓ Created index IX_PolicyConsents_PolicyId_Version")
	} else {
		fmt.Println("- PolicyConsents table already exists, skipping")
	}

	fmt.Println("\n✓ Migration complete!")
}
