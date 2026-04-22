// cmd/migrate_indexes/main.go — 성능 최적화 인덱스 추가
// Usage: go run ./cmd/migrate_indexes
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

	fmt.Println("=== Performance Index Migration ===")

	// 1. Products.MinStockAlert — 재고 부족 알림 쿼리 최적화 (필터링 인덱스)
	addIndexIfMissing(db, "Products", "IX_Products_MinStockAlert",
		"CREATE INDEX IX_Products_MinStockAlert ON Products(MinStockAlert, LastAlertSentAt) WHERE MinStockAlert > 0 AND DeletedAt IS NULL")

	// 2. OrderItems.OrderId — FK 관계 조인 최적화
	addIndexIfMissing(db, "OrderItems", "IX_OrderItems_OrderId",
		"CREATE INDEX IX_OrderItems_OrderId ON OrderItems(OrderId)")

	// 3. Orders.Status + CreatedAt — 관리자 보고서 쿼리 최적화
	addIndexIfMissing(db, "Orders", "IX_Orders_Status_CreatedAt",
		"CREATE INDEX IX_Orders_Status_CreatedAt ON Orders(Status, CreatedAt DESC)")

	// 4. VoucherCodes 복합 인덱스 — 파트너 매출/정산 쿼리 최적화
	addIndexIfMissing(db, "VoucherCodes", "IX_VoucherCodes_Partner_Status",
		"CREATE INDEX IX_VoucherCodes_Partner_Status ON VoucherCodes(SuppliedByPartnerID, Status) WHERE SuppliedByPartnerID IS NOT NULL")

	// 5. Orders/TradeIns Source 필터 인덱스 (파트너 조회 최적화)
	addIndexIfMissing(db, "Orders", "IX_Orders_UserId_Source",
		"CREATE INDEX IX_Orders_UserId_Source ON Orders(UserId, Source) WHERE Source = 'PARTNER'")

	addIndexIfMissing(db, "TradeIns", "IX_TradeIns_UserId_Source",
		"CREATE INDEX IX_TradeIns_UserId_Source ON TradeIns(UserId, Source) WHERE Source = 'PARTNER'")

	// 6. BusinessInquiries 상태+날짜 인덱스 (어드민 목록 조회)
	addIndexIfMissing(db, "BusinessInquiries", "IX_BusinessInquiries_Status_CreatedAt",
		"CREATE INDEX IX_BusinessInquiries_Status_CreatedAt ON BusinessInquiries(Status, CreatedAt DESC)")

	// 7. ContentAttachments 커버링 인덱스 (SortOrder, CreatedAt 포함)
	addIndexIfMissing(db, "ContentAttachments", "IX_ContentAttachments_Target_Cover",
		"CREATE INDEX IX_ContentAttachments_Target_Cover ON ContentAttachments(TargetType, TargetId) INCLUDE (SortOrder, CreatedAt)")

	// 8. PartnerDocuments 복합 인덱스 (파트너별 날짜순 조회)
	addIndexIfMissing(db, "PartnerDocuments", "IX_PartnerDocuments_PartnerId_CreatedAt",
		"CREATE INDEX IX_PartnerDocuments_PartnerId_CreatedAt ON PartnerDocuments(PartnerId, CreatedAt DESC)")

	fmt.Println("\n✓ Index migration complete!")
}

func addIndexIfMissing(db *gorm.DB, tableName, indexName, createSQL string) {
	var exists int
	db.Raw(`SELECT COUNT(*) FROM sys.indexes WHERE name = ? AND object_id = OBJECT_ID(?)`, indexName, tableName).Scan(&exists)
	if exists == 0 {
		if err := db.Exec(createSQL).Error; err != nil {
			log.Printf("  ⚠ Create %s failed: %v", indexName, err)
		} else {
			fmt.Printf("  ✓ Created %s on %s\n", indexName, tableName)
		}
	} else {
		fmt.Printf("  - %s already exists\n", indexName)
	}
}
