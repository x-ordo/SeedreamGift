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

	migrations := []struct {
		check string
		exec  string
		desc  string
	}{
		{
			check: "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('Products') AND name='FulfillmentType'",
			exec:  "ALTER TABLE Products ADD FulfillmentType NVARCHAR(10) NOT NULL DEFAULT 'STOCK'",
			desc:  "Products.FulfillmentType",
		},
		{
			check: "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('Products') AND name='ProviderCode'",
			exec:  "ALTER TABLE Products ADD ProviderCode NVARCHAR(20) NULL",
			desc:  "Products.ProviderCode",
		},
		{
			check: "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('Products') AND name='ProviderProductCode'",
			exec:  "ALTER TABLE Products ADD ProviderProductCode NVARCHAR(50) NULL",
			desc:  "Products.ProviderProductCode",
		},
		{
			check: "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('VoucherCodes') AND name='ExternalTransactionRef'",
			exec:  "ALTER TABLE VoucherCodes ADD ExternalTransactionRef NVARCHAR(100) NULL",
			desc:  "VoucherCodes.ExternalTransactionRef",
		},
	}

	for _, m := range migrations {
		var exists int
		db.Raw(m.check).Scan(&exists)
		if exists == 0 {
			if err := db.Exec(m.exec).Error; err != nil {
				log.Fatalf("Failed %s: %v", m.desc, err)
			}
			fmt.Printf("✓ Added %s\n", m.desc)
		} else {
			fmt.Printf("- %s already exists\n", m.desc)
		}
	}

	// IssuanceLogs table
	var tableExists int
	db.Raw("SELECT COUNT(*) FROM sys.tables WHERE name='IssuanceLogs'").Scan(&tableExists)
	if tableExists == 0 {
		err := db.Exec(`
			CREATE TABLE IssuanceLogs (
				Id              INT IDENTITY(1,1) PRIMARY KEY,
				OrderId         INT NOT NULL,
				OrderItemId     INT NOT NULL,
				ProductId       INT NOT NULL,
				ProviderCode    NVARCHAR(20) NOT NULL,
				Status          NVARCHAR(20) NOT NULL,
				AttemptCount    INT NOT NULL DEFAULT 0,
				RequestPayload  NVARCHAR(MAX) NULL,
				ResponsePayload NVARCHAR(MAX) NULL,
				ErrorMessage    NVARCHAR(500) NULL,
				TransactionRef  NVARCHAR(100) NULL,
				CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
				CompletedAt     DATETIME2 NULL,
				CONSTRAINT FK_IssuanceLog_Order FOREIGN KEY (OrderId) REFERENCES Orders(Id)
			)
		`).Error
		if err != nil {
			log.Fatal("Create IssuanceLogs error:", err)
		}
		db.Exec("CREATE INDEX IX_IssuanceLog_OrderId ON IssuanceLogs(OrderId)")
		db.Exec("CREATE INDEX IX_IssuanceLog_Status ON IssuanceLogs(Status)")
		fmt.Println("✓ Created IssuanceLogs table + indexes")
	} else {
		fmt.Println("- IssuanceLogs already exists")
	}

	fmt.Println("\nIssuance migration complete!")
}
