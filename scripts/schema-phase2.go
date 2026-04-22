package main

import (
	"database/sql"
	"fmt"
	"os"
	"strings"

	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	dsn := "server=103.97.209.131;port=7335;user id=dnflrhdwnghkdlxldsql;password=dnflrhdwnghkdlxld2024!@;database=SEEDREAM_GIFT_DB"
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
	fmt.Println("Connected to SEEDREAM_GIFT_DB successfully.\n")

	// =========================================================================
	// STEP 5: CHECK constraints on status columns and value columns
	// =========================================================================
	fmt.Println("=== STEP 5: CHECK constraints ===")

	type checkConstraint struct {
		name      string
		table     string
		condition string
	}

	checks := []checkConstraint{
		{"CK_Orders_Status", "Orders", "Status IN ('PENDING','PAID','DELIVERED','CANCELLED','REFUNDED')"},
		{"CK_Orders_TotalAmount", "Orders", "TotalAmount >= 0"},
		{"CK_OrderItems_Quantity", "OrderItems", "Quantity >= 1"},
		{"CK_OrderItems_Price", "OrderItems", "Price >= 0"},
		{"CK_VoucherCodes_Status", "VoucherCodes", "Status IN ('AVAILABLE','RESERVED','SOLD','USED','EXPIRED')"},
		{"CK_TradeIns_Status", "TradeIns", "Status IN ('REQUESTED','VERIFIED','PAID','REJECTED')"},
		{"CK_TradeIns_PayoutAmount", "TradeIns", "PayoutAmount >= 0"},
		{"CK_TradeIns_Quantity", "TradeIns", "Quantity >= 1"},
		{"CK_Payments_Status", "Payments", "Status IN ('PENDING','PAID','FAILED','CANCELLED','EXPIRED')"},
		{"CK_Payments_Amount", "Payments", "Amount >= 0"},
		{"CK_Refunds_Status", "Refunds", "Status IN ('REQUESTED','APPROVED','REJECTED','COMPLETED')"},
		{"CK_Refunds_Amount", "Refunds", "Amount > 0"},
		{"CK_Gifts_Status", "Gifts", "Status IN ('SENT','CLAIMED','EXPIRED','CANCELLED')"},
		{"CK_CartItems_Quantity", "CartItems", "Quantity >= 1"},
		{"CK_Users_Role", "Users", "Role IN ('USER','PARTNER','ADMIN')"},
		{"CK_Users_KycStatus", "Users", "KycStatus IN ('NONE','PENDING','VERIFIED','REJECTED')"},
		{"CK_Products_Price", "Products", "Price > 0"},
		{"CK_Products_DiscountRate", "Products", "DiscountRate >= 0 AND DiscountRate < 100"},
		{"CK_Products_TradeInRate", "Products", "TradeInRate >= 0 AND TradeInRate < 100"},
		{"CK_Products_BuyPrice", "Products", "BuyPrice >= 0"},
		{"CK_Inquiries_Status", "Inquiries", "Status IN ('PENDING','ANSWERED','CLOSED')"},
	}

	for _, ck := range checks {
		var exists int
		err := db.QueryRow("SELECT COUNT(*) FROM sys.check_constraints WHERE name = @p1", ck.name).Scan(&exists)
		if err != nil {
			fmt.Printf("[ERROR] %s (query): %v\n", ck.name, err)
			continue
		}
		if exists > 0 {
			fmt.Printf("[SKIP] %s already exists\n", ck.name)
			continue
		}

		addSQL := fmt.Sprintf("ALTER TABLE %s WITH NOCHECK ADD CONSTRAINT %s CHECK (%s)", ck.table, ck.name, ck.condition)
		_, err = db.Exec(addSQL)
		if err != nil {
			fmt.Printf("[ERROR] %s: %v\n", ck.name, err)
			continue
		}

		enableSQL := fmt.Sprintf("ALTER TABLE %s CHECK CONSTRAINT %s", ck.table, ck.name)
		_, err = db.Exec(enableSQL)
		if err != nil {
			fmt.Printf("[WARN] %s created but enable failed: %v\n", ck.name, err)
			continue
		}

		fmt.Printf("[OK] %s created on %s\n", ck.name, ck.table)
	}

	// =========================================================================
	// STEP 6: UNIQUE indexes (filtered, NULL-safe)
	// =========================================================================
	fmt.Println("\n=== STEP 6: Filtered UNIQUE indexes ===")

	type uniqueIndex struct {
		name   string
		table  string
		column string
	}

	uniques := []uniqueIndex{
		{"UQ_Orders_IdempotencyKey", "Orders", "IdempotencyKey"},
		{"UQ_Orders_OrderCode", "Orders", "OrderCode"},
		{"UQ_TradeIns_PinHash", "TradeIns", "PinHash"},
	}

	for _, uq := range uniques {
		var exists int
		err := db.QueryRow("SELECT COUNT(*) FROM sys.indexes WHERE name = @p1 AND object_id = OBJECT_ID(@p2)", uq.name, uq.table).Scan(&exists)
		if err != nil {
			fmt.Printf("[ERROR] %s (query): %v\n", uq.name, err)
			continue
		}
		if exists > 0 {
			fmt.Printf("[SKIP] %s already exists\n", uq.name)
			continue
		}

		createSQL := fmt.Sprintf(
			"CREATE UNIQUE NONCLUSTERED INDEX %s ON %s(%s) WHERE %s IS NOT NULL",
			uq.name, uq.table, uq.column, uq.column,
		)
		_, err = db.Exec(createSQL)
		if err != nil {
			fmt.Printf("[ERROR] %s: %v\n", uq.name, err)
			continue
		}
		fmt.Printf("[OK] %s created on %s(%s)\n", uq.name, uq.table, uq.column)
	}

	// =========================================================================
	// STEP 7: Additional performance indexes
	// =========================================================================
	fmt.Println("\n=== STEP 7: Performance indexes ===")

	type perfIndex struct {
		name      string
		createSQL string
	}

	perfIndexes := []perfIndex{
		{
			"IX_TradeIns_Status_CreatedAt",
			"CREATE NONCLUSTERED INDEX IX_TradeIns_Status_CreatedAt ON TradeIns(Status, CreatedAt ASC) INCLUDE (UserId, ProductName, ProductBrand, PayoutAmount, Quantity)",
		},
		{
			"IX_RefreshTokens_UserId_ExpiresAt",
			"CREATE NONCLUSTERED INDEX IX_RefreshTokens_UserId_ExpiresAt ON RefreshTokens(UserId, ExpiresAt) INCLUDE (Id)",
		},
	}

	for _, idx := range perfIndexes {
		var exists int
		// Extract table name from the SQL (between "ON " and "(")
		tableName := ""
		if strings.Contains(idx.name, "TradeIns") {
			tableName = "TradeIns"
		} else if strings.Contains(idx.name, "RefreshTokens") {
			tableName = "RefreshTokens"
		}

		err := db.QueryRow("SELECT COUNT(*) FROM sys.indexes WHERE name = @p1 AND object_id = OBJECT_ID(@p2)", idx.name, tableName).Scan(&exists)
		if err != nil {
			fmt.Printf("[ERROR] %s (query): %v\n", idx.name, err)
			continue
		}
		if exists > 0 {
			fmt.Printf("[SKIP] %s already exists\n", idx.name)
			continue
		}

		_, err = db.Exec(idx.createSQL)
		if err != nil {
			fmt.Printf("[ERROR] %s: %v\n", idx.name, err)
			continue
		}
		fmt.Printf("[OK] %s created\n", idx.name)
	}

	// =========================================================================
	// STEP 8: AuditLogs index rationalization
	// =========================================================================
	fmt.Println("\n=== STEP 8: AuditLogs index rationalization ===")

	// First, list all existing IX_ indexes on AuditLogs
	fmt.Println("  Discovering existing AuditLogs indexes...")
	rows, err := db.Query("SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('AuditLogs') AND name LIKE 'IX_%' ORDER BY name")
	if err != nil {
		fmt.Printf("[ERROR] Could not query AuditLogs indexes: %v\n", err)
	} else {
		var existingIndexes []string
		for rows.Next() {
			var name string
			rows.Scan(&name)
			existingIndexes = append(existingIndexes, name)
			fmt.Printf("  Found: %s\n", name)
		}
		rows.Close()

		// Drop individual single-column indexes (keep composites like IsArchived_CreatedAt)
		// GORM typically generates: idx_audit_logs_<column> or IX_AuditLogs_<column>
		keepPatterns := []string{"IsArchived_CreatedAt", "IsArchived"}
		for _, idxName := range existingIndexes {
			shouldKeep := false
			for _, keep := range keepPatterns {
				if strings.Contains(idxName, keep) {
					shouldKeep = true
					break
				}
			}
			// Also keep the new composite indexes if they already exist
			if idxName == "IX_AuditLogs_UserId_CreatedAt" || idxName == "IX_AuditLogs_Action_Resource_CreatedAt" {
				shouldKeep = true
			}

			if shouldKeep {
				fmt.Printf("[SKIP] Keeping composite index: %s\n", idxName)
				continue
			}

			// This is a single-column index that should be dropped
			dropSQL := fmt.Sprintf("DROP INDEX %s ON AuditLogs", idxName)
			_, err := db.Exec(dropSQL)
			if err != nil {
				fmt.Printf("[ERROR] Drop %s: %v\n", idxName, err)
			} else {
				fmt.Printf("[OK] Dropped single-column index: %s\n", idxName)
			}
		}
	}

	// Create 2 targeted composite indexes
	type auditIndex struct {
		name      string
		createSQL string
	}
	auditIndexes := []auditIndex{
		{
			"IX_AuditLogs_UserId_CreatedAt",
			"CREATE NONCLUSTERED INDEX IX_AuditLogs_UserId_CreatedAt ON AuditLogs(UserId, CreatedAt DESC) INCLUDE (Action, Resource, ResourceId, Method, StatusCode, IP)",
		},
		{
			"IX_AuditLogs_Action_Resource_CreatedAt",
			"CREATE NONCLUSTERED INDEX IX_AuditLogs_Action_Resource_CreatedAt ON AuditLogs(Action, Resource, CreatedAt DESC) INCLUDE (UserId, ResourceId, StatusCode)",
		},
	}

	for _, idx := range auditIndexes {
		var exists int
		err := db.QueryRow("SELECT COUNT(*) FROM sys.indexes WHERE name = @p1 AND object_id = OBJECT_ID('AuditLogs')", idx.name).Scan(&exists)
		if err != nil {
			fmt.Printf("[ERROR] %s (query): %v\n", idx.name, err)
			continue
		}
		if exists > 0 {
			fmt.Printf("[SKIP] %s already exists\n", idx.name)
			continue
		}

		_, err = db.Exec(idx.createSQL)
		if err != nil {
			fmt.Printf("[ERROR] %s: %v\n", idx.name, err)
			continue
		}
		fmt.Printf("[OK] %s created\n", idx.name)
	}

	// =========================================================================
	// STEP 9: Enable RCSI
	// =========================================================================
	fmt.Println("\n=== STEP 9: Enable READ_COMMITTED_SNAPSHOT ===")

	var rcsiEnabled bool
	err = db.QueryRow("SELECT is_read_committed_snapshot_on FROM sys.databases WHERE name = 'SEEDREAM_GIFT_DB'").Scan(&rcsiEnabled)
	if err != nil {
		fmt.Printf("[ERROR] Could not check RCSI status: %v\n", err)
	} else if rcsiEnabled {
		fmt.Println("[SKIP] READ_COMMITTED_SNAPSHOT is already enabled")
	} else {
		// Must force exclusive access with ROLLBACK IMMEDIATE, then re-enable multi-user
		_, err = db.Exec("ALTER DATABASE SEEDREAM_GIFT_DB SET SINGLE_USER WITH ROLLBACK IMMEDIATE")
		if err != nil {
			fmt.Printf("[WARN] Could not set SINGLE_USER: %v\n", err)
			fmt.Println("[WARN] Attempting RCSI without exclusive access...")
			_, err2 := db.Exec("ALTER DATABASE SEEDREAM_GIFT_DB SET READ_COMMITTED_SNAPSHOT ON")
			if err2 != nil {
				fmt.Printf("[WARN] RCSI enable failed (needs exclusive access): %v\n", err2)
			} else {
				fmt.Println("[OK] READ_COMMITTED_SNAPSHOT enabled")
			}
		} else {
			_, err = db.Exec("ALTER DATABASE SEEDREAM_GIFT_DB SET READ_COMMITTED_SNAPSHOT ON")
			if err != nil {
				fmt.Printf("[ERROR] RCSI enable failed: %v\n", err)
			} else {
				fmt.Println("[OK] READ_COMMITTED_SNAPSHOT enabled")
			}
			// Always restore MULTI_USER
			_, err = db.Exec("ALTER DATABASE SEEDREAM_GIFT_DB SET MULTI_USER")
			if err != nil {
				fmt.Printf("[WARN] Could not restore MULTI_USER: %v\n", err)
			} else {
				fmt.Println("[OK] Restored MULTI_USER mode")
			}
		}
	}

	// =========================================================================
	// STEP 10: Verification
	// =========================================================================
	fmt.Println("\n=== STEP 10: Verification ===")

	var ckCount int
	db.QueryRow("SELECT COUNT(*) FROM sys.check_constraints").Scan(&ckCount)
	fmt.Printf("Total CHECK constraints in database: %d\n", ckCount)

	var fkCount int
	db.QueryRow("SELECT COUNT(*) FROM sys.foreign_keys").Scan(&fkCount)
	fmt.Printf("Total FK constraints in database:    %d\n", fkCount)

	// Index counts per key table
	keyTables := []string{"Orders", "OrderItems", "VoucherCodes", "TradeIns", "Payments", "Refunds", "Gifts", "CartItems", "Users", "Products", "AuditLogs", "RefreshTokens", "Inquiries"}
	fmt.Println("\nIndex counts per table:")
	for _, table := range keyTables {
		var idxCount int
		err := db.QueryRow("SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(@p1) AND type > 0", table).Scan(&idxCount)
		if err != nil {
			fmt.Printf("  %-15s [ERROR] %v\n", table, err)
		} else {
			fmt.Printf("  %-15s %d indexes\n", table, idxCount)
		}
	}

	// RCSI status
	var rcsiStatus bool
	db.QueryRow("SELECT is_read_committed_snapshot_on FROM sys.databases WHERE name = 'SEEDREAM_GIFT_DB'").Scan(&rcsiStatus)
	fmt.Printf("\nRCSI enabled: %v\n", rcsiStatus)

	fmt.Println("\nSchema Phase 2 complete.")
}
