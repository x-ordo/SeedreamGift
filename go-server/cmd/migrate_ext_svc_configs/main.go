package main

import (
	"fmt"
	"log"
	"w-gift-server/internal/config"
	"w-gift-server/internal/infra"
)

func main() {
	cfg, err := config.LoadConfig(".")
	if err != nil {
		log.Fatal("Config load error:", err)
	}

	infra.InitDB(&cfg)
	db := infra.DB

	var tableExists int
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'ExternalServiceConfigs'`).Scan(&tableExists)

	if tableExists > 0 {
		fmt.Println("✓ ExternalServiceConfigs table already exists — skipping")
		return
	}

	if err := db.Exec(`
		CREATE TABLE ExternalServiceConfigs (
			Id          INT IDENTITY(1,1) PRIMARY KEY,
			Channel     NVARCHAR(20) NOT NULL,
			FieldName   NVARCHAR(50) NOT NULL,
			FieldValue  NVARCHAR(MAX) NOT NULL DEFAULT '',
			IsSecret    BIT NOT NULL DEFAULT 0,
			UpdatedAt   DATETIME2 NOT NULL DEFAULT GETDATE(),
			UpdatedBy   NVARCHAR(100) NULL,
			CONSTRAINT UQ_ExtSvcCfg UNIQUE (Channel, FieldName)
		)
	`).Error; err != nil {
		log.Fatal("Create table error:", err)
	}
	fmt.Println("✓ Created ExternalServiceConfigs table")
	fmt.Println("\n✅ ExternalServiceConfigs migration complete")
}
