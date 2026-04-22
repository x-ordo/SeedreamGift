package main

import (
	"fmt"
	"log"
	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/infra"
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
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'CashReceipts'`).Scan(&tableExists)

	if tableExists > 0 {
		fmt.Println("✓ CashReceipts table already exists — skipping")
		return
	}

	// 2. Create table
	if err := db.Exec(`
		CREATE TABLE CashReceipts (
			Id                  INT IDENTITY(1,1) PRIMARY KEY,
			OrderId             INT NOT NULL,
			UserId              INT NOT NULL,
			Type                NVARCHAR(20) NOT NULL,
			IdentityType        NVARCHAR(15) NOT NULL,
			IdentityNumber      NVARCHAR(200) NOT NULL,
			MaskedIdentity      NVARCHAR(20) NOT NULL,
			SupplyAmount        DECIMAL(12,0) NOT NULL,
			TaxAmount           DECIMAL(12,0) NOT NULL,
			TotalAmount         DECIMAL(12,0) NOT NULL,
			MgtKey              NVARCHAR(24) NOT NULL,
			ConfirmNum          NVARCHAR(24) NULL,
			TradeDate           NVARCHAR(8) NULL,
			Status              NVARCHAR(10) NOT NULL DEFAULT 'PENDING',
			IsAutoIssued        BIT NOT NULL DEFAULT 0,
			OriginalId          INT NULL,
			FailReason          NVARCHAR(500) NULL,
			CancelledReceiptId  INT NULL,
			RetryCount          INT NOT NULL DEFAULT 0,
			IssuedAt            DATETIME2 NULL,
			CancelledAt         DATETIME2 NULL,
			CreatedAt           DATETIME2 NOT NULL DEFAULT GETDATE(),
			UpdatedAt           DATETIME2 NOT NULL DEFAULT GETDATE(),
			CONSTRAINT FK_CashReceipts_Order FOREIGN KEY (OrderId) REFERENCES Orders(Id),
			CONSTRAINT FK_CashReceipts_User FOREIGN KEY (UserId) REFERENCES Users(Id)
		)
	`).Error; err != nil {
		log.Fatal("Create table error:", err)
	}
	fmt.Println("✓ Created CashReceipts table")

	// 3. Create indexes
	indexes := []struct {
		name string
		sql  string
	}{
		{"UQ_CashReceipts_MgtKey", `CREATE UNIQUE INDEX UQ_CashReceipts_MgtKey ON CashReceipts(MgtKey)`},
		{"IX_CashReceipts_OrderId", `CREATE INDEX IX_CashReceipts_OrderId ON CashReceipts(OrderId)`},
		{"IX_CashReceipts_UserId", `CREATE INDEX IX_CashReceipts_UserId ON CashReceipts(UserId)`},
		{"IX_CashReceipts_Status", `CREATE INDEX IX_CashReceipts_Status ON CashReceipts(Status)`},
	}

	for _, idx := range indexes {
		if err := db.Exec(idx.sql).Error; err != nil {
			log.Fatalf("Create index %s error: %v", idx.name, err)
		}
		fmt.Printf("✓ Created index %s\n", idx.name)
	}

	fmt.Println("\n✅ CashReceipts migration complete")
}
