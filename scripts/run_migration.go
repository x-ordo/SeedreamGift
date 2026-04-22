package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	dsn := "server=103.97.209.194;port=7335;user id=dnflrhdwnghkdlxldsql;password=dnflrhdwnghkdlxld2024!@;database=WOWGIFT_DB"
	db, err := sql.Open("sqlserver", dsn)
	if err != nil {
		fmt.Println("Connection error:", err)
		os.Exit(1)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		fmt.Println("Ping failed:", err)
		os.Exit(1)
	}
	fmt.Println("Connected to WOWGIFT_DB")

	mode := "check"
	if len(os.Args) > 1 {
		mode = os.Args[1]
	}

	switch mode {
	case "check":
		runOrphanCheck(db)
	case "fk":
		runFKConstraints(db)
	case "index":
		runIndexes(db)
	case "cleanup":
		runIndexCleanup(db)
	case "verify":
		runVerify(db)
	case "all":
		runOrphanCheck(db)
		fmt.Println()
		runFKConstraints(db)
		fmt.Println()
		runIndexes(db)
		fmt.Println()
		runIndexCleanup(db)
		fmt.Println()
		runVerify(db)
	default:
		fmt.Println("Usage: go run run_migration.go [check|fk|index|cleanup|verify|all]")
	}
}

func runOrphanCheck(db *sql.DB) {
	fmt.Println("=== STEP 0: Orphan Data Check ===")
	checks := []struct{ name, query string }{
		{"OrderItems", "SELECT COUNT(*) FROM OrderItems oi LEFT JOIN Orders o ON oi.OrderId = o.Id WHERE o.Id IS NULL"},
		{"VoucherCodes", "SELECT COUNT(*) FROM VoucherCodes vc LEFT JOIN Orders o ON vc.OrderId = o.Id WHERE vc.OrderId IS NOT NULL AND o.Id IS NULL"},
		{"CartItems", "SELECT COUNT(*) FROM CartItems ci LEFT JOIN Users u ON ci.UserId = u.Id WHERE u.Id IS NULL"},
		{"TradeIns", "SELECT COUNT(*) FROM TradeIns ti LEFT JOIN Users u ON ti.UserId = u.Id WHERE u.Id IS NULL"},
		{"Gifts", "SELECT COUNT(*) FROM Gifts g LEFT JOIN Orders o ON g.OrderId = o.Id WHERE o.Id IS NULL"},
	}
	for _, c := range checks {
		var count int
		if err := db.QueryRow(c.query).Scan(&count); err != nil {
			fmt.Printf("[ERROR] %s: %v\n", c.name, err)
		} else if count > 0 {
			fmt.Printf("[WARNING] %s orphans: %d\n", c.name, count)
		} else {
			fmt.Printf("[OK] %s: clean\n", c.name)
		}
	}
}

func execIfNotExists(db *sql.DB, checkQuery, execQuery, name string) {
	var exists int
	if err := db.QueryRow(checkQuery).Scan(&exists); err != nil {
		fmt.Printf("[ERROR] %s check: %v\n", name, err)
		return
	}
	if exists > 0 {
		fmt.Printf("[SKIP] %s already exists\n", name)
		return
	}
	if _, err := db.Exec(execQuery); err != nil {
		fmt.Printf("[ERROR] %s: %v\n", name, err)
		return
	}
	fmt.Printf("[OK] %s created\n", name)
}

func runFKConstraints(db *sql.DB) {
	fmt.Println("=== STEP 1: FK Constraints ===")
	fks := []struct{ name, create string }{
		{"FK_Orders_Users",
			"ALTER TABLE Orders WITH NOCHECK ADD CONSTRAINT FK_Orders_Users FOREIGN KEY (UserId) REFERENCES Users(Id)"},
		{"FK_OrderItems_Orders",
			"ALTER TABLE OrderItems WITH NOCHECK ADD CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderId) REFERENCES Orders(Id)"},
		{"FK_OrderItems_Products",
			"ALTER TABLE OrderItems WITH NOCHECK ADD CONSTRAINT FK_OrderItems_Products FOREIGN KEY (ProductId) REFERENCES Products(Id)"},
		{"FK_VoucherCodes_Products",
			"ALTER TABLE VoucherCodes WITH NOCHECK ADD CONSTRAINT FK_VoucherCodes_Products FOREIGN KEY (ProductId) REFERENCES Products(Id)"},
		{"FK_VoucherCodes_Orders",
			"ALTER TABLE VoucherCodes WITH NOCHECK ADD CONSTRAINT FK_VoucherCodes_Orders FOREIGN KEY (OrderId) REFERENCES Orders(Id)"},
		{"FK_CartItems_Users",
			"ALTER TABLE CartItems WITH NOCHECK ADD CONSTRAINT FK_CartItems_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE"},
		{"FK_CartItems_Products",
			"ALTER TABLE CartItems WITH NOCHECK ADD CONSTRAINT FK_CartItems_Products FOREIGN KEY (ProductId) REFERENCES Products(Id)"},
		{"FK_Gifts_Orders",
			"ALTER TABLE Gifts WITH NOCHECK ADD CONSTRAINT FK_Gifts_Orders FOREIGN KEY (OrderId) REFERENCES Orders(Id)"},
		{"FK_Gifts_Sender",
			"ALTER TABLE Gifts WITH NOCHECK ADD CONSTRAINT FK_Gifts_Sender FOREIGN KEY (SenderId) REFERENCES Users(Id)"},
		{"FK_Gifts_Receiver",
			"ALTER TABLE Gifts WITH NOCHECK ADD CONSTRAINT FK_Gifts_Receiver FOREIGN KEY (ReceiverId) REFERENCES Users(Id)"},
		{"FK_TradeIns_Users",
			"ALTER TABLE TradeIns WITH NOCHECK ADD CONSTRAINT FK_TradeIns_Users FOREIGN KEY (UserId) REFERENCES Users(Id)"},
		{"FK_TradeIns_Products",
			"ALTER TABLE TradeIns WITH NOCHECK ADD CONSTRAINT FK_TradeIns_Products FOREIGN KEY (ProductId) REFERENCES Products(Id)"},
		{"FK_Payments_Orders",
			"ALTER TABLE Payments WITH NOCHECK ADD CONSTRAINT FK_Payments_Orders FOREIGN KEY (OrderId) REFERENCES Orders(Id)"},
		{"FK_Refunds_Orders",
			"ALTER TABLE Refunds WITH NOCHECK ADD CONSTRAINT FK_Refunds_Orders FOREIGN KEY (OrderId) REFERENCES Orders(Id)"},
		{"FK_Inquiries_Users",
			"ALTER TABLE Inquiries WITH NOCHECK ADD CONSTRAINT FK_Inquiries_Users FOREIGN KEY (UserId) REFERENCES Users(Id)"},
		{"FK_RefreshTokens_Users",
			"ALTER TABLE RefreshTokens WITH NOCHECK ADD CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE"},
	}
	for _, fk := range fks {
		check := fmt.Sprintf("SELECT COUNT(*) FROM sys.foreign_keys WHERE name = '%s'", fk.name)
		execIfNotExists(db, check, fk.create, fk.name)
		// Enable CHECK after NOCHECK add
		enableCheck := fmt.Sprintf("ALTER TABLE %s CHECK CONSTRAINT %s",
			getTableFromFK(fk.create), fk.name)
		db.Exec(enableCheck)
	}
}

func getTableFromFK(create string) string {
	// Extract table name from "ALTER TABLE XXX WITH NOCHECK..."
	var table string
	fmt.Sscanf(create, "ALTER TABLE %s", &table)
	return table
}

func runIndexes(db *sql.DB) {
	fmt.Println("=== STEP 2: Indexes ===")
	idxs := []struct{ name, create string }{
		{"IX_Orders_UserId",
			"CREATE NONCLUSTERED INDEX IX_Orders_UserId ON Orders(UserId) INCLUDE (Status, TotalAmount, OrderCode, CreatedAt, PaymentMethod)"},
		{"IX_Orders_UserId_CreatedAt",
			"CREATE NONCLUSTERED INDEX IX_Orders_UserId_CreatedAt ON Orders(UserId, CreatedAt) INCLUDE (TotalAmount, Status)"},
		{"IX_VoucherCodes_ProductId_Status",
			"CREATE NONCLUSTERED INDEX IX_VoucherCodes_ProductId_Status ON VoucherCodes(ProductId, Status)"},
		{"IX_VoucherCodes_Status_ExpiredAt",
			"CREATE NONCLUSTERED INDEX IX_VoucherCodes_Status_ExpiredAt ON VoucherCodes(Status, ExpiredAt)"},
		{"IX_TradeIns_UserId",
			"CREATE NONCLUSTERED INDEX IX_TradeIns_UserId ON TradeIns(UserId) INCLUDE (Status, PayoutAmount, ProductBrand, ProductName, CreatedAt)"},
		{"IX_Products_BrandCode_IsActive",
			"CREATE NONCLUSTERED INDEX IX_Products_BrandCode_IsActive ON Products(BrandCode, IsActive) INCLUDE (Name, Price, BuyPrice, DiscountRate, TradeInRate, AllowTradeIn, ImageUrl, Type)"},
		{"IX_Payments_OrderId_Status",
			"CREATE NONCLUSTERED INDEX IX_Payments_OrderId_Status ON Payments(OrderId, Status)"},
		{"IX_Inquiries_UserId_Status",
			"CREATE NONCLUSTERED INDEX IX_Inquiries_UserId_Status ON Inquiries(UserId, Status) INCLUDE (Category, Subject, CreatedAt)"},
		{"IX_Gifts_Status_ExpiresAt",
			"CREATE NONCLUSTERED INDEX IX_Gifts_Status_ExpiresAt ON Gifts(Status, ExpiresAt)"},
		{"IX_AuditLogs_IsArchived_CreatedAt",
			"CREATE NONCLUSTERED INDEX IX_AuditLogs_IsArchived_CreatedAt ON AuditLogs(IsArchived, CreatedAt)"},
	}
	for _, idx := range idxs {
		check := fmt.Sprintf("SELECT COUNT(*) FROM sys.indexes WHERE name = '%s'", idx.name)
		execIfNotExists(db, check, idx.create, idx.name)
	}
}

func runIndexCleanup(db *sql.DB) {
	fmt.Println("=== STEP 3: Redundant Index Cleanup ===")
	drops := []struct{ name, table string }{
		{"idx_payments_order_id", "Payments"},
		{"idx_payments_status", "Payments"},
		{"idx_inquiries_user_id", "Inquiries"},
		{"idx_inquiries_status", "Inquiries"},
	}
	for _, d := range drops {
		var exists int
		check := fmt.Sprintf("SELECT COUNT(*) FROM sys.indexes WHERE name = '%s' AND object_id = OBJECT_ID('%s')", d.name, d.table)
		if err := db.QueryRow(check).Scan(&exists); err != nil || exists == 0 {
			fmt.Printf("[SKIP] %s not found\n", d.name)
			continue
		}
		drop := fmt.Sprintf("DROP INDEX %s ON %s", d.name, d.table)
		if _, err := db.Exec(drop); err != nil {
			fmt.Printf("[ERROR] %s: %v\n", d.name, err)
		} else {
			fmt.Printf("[OK] %s dropped\n", d.name)
		}
	}
}

func runVerify(db *sql.DB) {
	fmt.Println("=== STEP 4: Verification ===")
	var fkCount, idxCount int
	db.QueryRow("SELECT COUNT(*) FROM sys.foreign_keys WHERE name LIKE 'FK_%'").Scan(&fkCount)
	db.QueryRow("SELECT COUNT(*) FROM sys.indexes WHERE name LIKE 'IX_%' AND object_id IN (OBJECT_ID('Orders'), OBJECT_ID('VoucherCodes'), OBJECT_ID('TradeIns'), OBJECT_ID('Products'), OBJECT_ID('Payments'), OBJECT_ID('Inquiries'), OBJECT_ID('Gifts'), OBJECT_ID('AuditLogs'))").Scan(&idxCount)
	fmt.Printf("FK constraints: %d\n", fkCount)
	fmt.Printf("Custom indexes: %d\n", idxCount)

	rows, err := db.Query("SELECT fk.name, OBJECT_NAME(fk.parent_object_id), OBJECT_NAME(fk.referenced_object_id), fk.delete_referential_action_desc FROM sys.foreign_keys fk WHERE fk.name LIKE 'FK_%' ORDER BY 2")
	if err == nil {
		defer rows.Close()
		fmt.Println("\nFK Details:")
		for rows.Next() {
			var name, tbl, ref, action string
			rows.Scan(&name, &tbl, &ref, &action)
			fmt.Printf("  %s -> %s (%s) [%s]\n", tbl, ref, action, name)
		}
	}

	rows2, err := db.Query("SELECT OBJECT_NAME(i.object_id), i.name FROM sys.indexes i WHERE i.name LIKE 'IX_%' AND i.object_id IN (OBJECT_ID('Orders'), OBJECT_ID('VoucherCodes'), OBJECT_ID('TradeIns'), OBJECT_ID('Products'), OBJECT_ID('Payments'), OBJECT_ID('Inquiries'), OBJECT_ID('Gifts'), OBJECT_ID('AuditLogs')) ORDER BY 1, 2")
	if err == nil {
		defer rows2.Close()
		fmt.Println("\nIndex Details:")
		for rows2.Next() {
			var tbl, name string
			rows2.Scan(&tbl, &name)
			fmt.Printf("  %s.%s\n", tbl, name)
		}
	}
}
