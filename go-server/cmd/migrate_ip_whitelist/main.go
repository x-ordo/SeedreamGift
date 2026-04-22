package main

import (
	"fmt"
	"log"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"

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

	// 1. Add IpWhitelistEnabled column to Users
	var colExists int
	db.Raw(`
		SELECT COUNT(*) FROM sys.columns
		WHERE object_id = OBJECT_ID('Users') AND name = 'IpWhitelistEnabled'
	`).Scan(&colExists)

	if colExists == 0 {
		if err := db.Exec(`ALTER TABLE Users ADD IpWhitelistEnabled BIT NOT NULL DEFAULT 0`).Error; err != nil {
			log.Fatal("Add column error:", err)
		}
		fmt.Println("✓ Added Users.IpWhitelistEnabled")
	} else {
		fmt.Println("- Users.IpWhitelistEnabled already exists")
	}

	// 2. AutoMigrate IpWhitelistEntries
	var tableExists int
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'IpWhitelistEntries'`).Scan(&tableExists)

	if tableExists == 0 {
		if err := db.Exec(`
			CREATE TABLE IpWhitelistEntries (
				Id          INT IDENTITY(1,1) PRIMARY KEY,
				UserId      INT NOT NULL,
				IpAddress   NVARCHAR(45) NOT NULL,
				Description NVARCHAR(100) NOT NULL DEFAULT '',
				CreatedAt   DATETIME2 NOT NULL DEFAULT GETDATE(),
				CONSTRAINT FK_IpWhitelist_User FOREIGN KEY (UserId)
					REFERENCES Users(Id) ON DELETE CASCADE
			)
		`).Error; err != nil {
			log.Fatal("Create table error:", err)
		}
		fmt.Println("✓ Created IpWhitelistEntries table")

		db.Exec(`CREATE INDEX IX_IpWhitelist_UserId ON IpWhitelistEntries(UserId)`)
		fmt.Println("✓ Created index")

		db.Exec(`CREATE UNIQUE INDEX UX_IpWhitelist_User_Ip ON IpWhitelistEntries(UserId, IpAddress)`)
		fmt.Println("✓ Created unique index")
	} else {
		fmt.Println("- IpWhitelistEntries table already exists")
	}

	// Verify
	var count int64
	db.Model(&domain.IPWhitelistEntry{}).Count(&count)
	fmt.Printf("\n✓ Migration complete! IpWhitelistEntries rows: %d\n", count)
}
