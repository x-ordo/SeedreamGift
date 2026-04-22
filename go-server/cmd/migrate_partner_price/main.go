// cmd/migrate_partner_price/main.go — PartnerPrices 테이블 생성 및 Orders/TradeIns Source 컬럼 추가
// Usage: go run ./cmd/migrate_partner_price
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

	fmt.Println("=== PartnerPrice Migration ===")

	// 1. Orders 테이블에 Source 컬럼 추가
	var ordersSourceExists int
	db.Raw(`
		SELECT COUNT(*) FROM sys.columns
		WHERE object_id = OBJECT_ID('Orders') AND name = 'Source'
	`).Scan(&ordersSourceExists)

	if ordersSourceExists == 0 {
		if err := db.Exec(`ALTER TABLE Orders ADD Source NVARCHAR(10) NOT NULL DEFAULT 'USER'`).Error; err != nil {
			log.Fatal("Add Orders.Source error:", err)
		}
		fmt.Println("✓ Added Orders.Source")
	} else {
		fmt.Println("- Orders.Source already exists")
	}

	// 2. TradeIns 테이블에 Source 컬럼 추가
	var tradeInsSourceExists int
	db.Raw(`
		SELECT COUNT(*) FROM sys.columns
		WHERE object_id = OBJECT_ID('TradeIns') AND name = 'Source'
	`).Scan(&tradeInsSourceExists)

	if tradeInsSourceExists == 0 {
		if err := db.Exec(`ALTER TABLE TradeIns ADD Source NVARCHAR(10) NOT NULL DEFAULT 'USER'`).Error; err != nil {
			log.Fatal("Add TradeIns.Source error:", err)
		}
		fmt.Println("✓ Added TradeIns.Source")
	} else {
		fmt.Println("- TradeIns.Source already exists")
	}

	// 3. PartnerPrices 테이블 생성
	var partnerPricesExists int
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'PartnerPrices'`).Scan(&partnerPricesExists)

	if partnerPricesExists == 0 {
		if err := db.Exec(`
			CREATE TABLE PartnerPrices (
				Id           INT IDENTITY(1,1) PRIMARY KEY,
				PartnerId    INT NOT NULL,
				ProductId    INT NOT NULL,
				BuyPrice     DECIMAL(12,0) NOT NULL,
				TradeInPrice DECIMAL(12,0) NOT NULL,
				CreatedAt    DATETIME2 NOT NULL DEFAULT GETDATE(),
				UpdatedAt    DATETIME2 NOT NULL DEFAULT GETDATE(),
				CONSTRAINT FK_PartnerPrices_Partner FOREIGN KEY (PartnerId)
					REFERENCES Users(Id) ON DELETE CASCADE,
				CONSTRAINT FK_PartnerPrices_Product FOREIGN KEY (ProductId)
					REFERENCES Products(Id) ON DELETE CASCADE
			)
		`).Error; err != nil {
			log.Fatal("Create PartnerPrices table error:", err)
		}
		fmt.Println("✓ Created PartnerPrices table")

		if err := db.Exec(`
			CREATE UNIQUE INDEX idx_partner_product ON PartnerPrices(PartnerId, ProductId)
		`).Error; err != nil {
			log.Fatal("Create unique index error:", err)
		}
		fmt.Println("✓ Created unique index idx_partner_product")
	} else {
		fmt.Println("- PartnerPrices table already exists")
	}

	fmt.Println("\n✓ Migration complete!")
}
