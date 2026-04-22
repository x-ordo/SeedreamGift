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

	// 1. Check if table already exists
	var tableExists int
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'PartnerBusinessInfos'`).Scan(&tableExists)

	if tableExists > 0 {
		fmt.Println("✓ PartnerBusinessInfos table already exists — skipping")
		return
	}

	// 2. Create table
	if err := db.Exec(`
		CREATE TABLE PartnerBusinessInfos (
			Id                    INT IDENTITY(1,1) PRIMARY KEY,
			PartnerId             INT NOT NULL,
			BusinessName          NVARCHAR(100) NOT NULL DEFAULT '',
			BusinessRegNo         NVARCHAR(10) NOT NULL DEFAULT '',
			RepresentativeName    NVARCHAR(30) NOT NULL DEFAULT '',
			TelecomSalesNo        NVARCHAR(30) NULL,
			BusinessAddress       NVARCHAR(200) NULL,
			BusinessType          NVARCHAR(50) NULL,
			BusinessCategory      NVARCHAR(50) NULL,
			VerificationStatus    NVARCHAR(10) NOT NULL DEFAULT 'PENDING',
			VerifiedAt            DATETIME2 NULL,
			VerifiedBy            INT NULL,
			AdminNote             NVARCHAR(500) NULL,
			CreatedAt             DATETIME2 NOT NULL DEFAULT GETDATE(),
			UpdatedAt             DATETIME2 NOT NULL DEFAULT GETDATE(),
			CONSTRAINT FK_PartnerBusinessInfos_User FOREIGN KEY (PartnerId) REFERENCES Users(Id),
			CONSTRAINT UQ_PartnerBusinessInfo_PartnerId UNIQUE (PartnerId)
		)
	`).Error; err != nil {
		log.Fatal("Create table error:", err)
	}
	fmt.Println("✓ Created PartnerBusinessInfos table")

	fmt.Println("\n✅ PartnerBusinessInfos migration complete")
}
