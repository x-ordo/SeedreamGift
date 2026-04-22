// cmd/migrate_partner_doc/main.go — PartnerDocuments 및 BusinessInquiries 테이블 생성
// Usage: go run ./cmd/migrate_partner_doc
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

	fmt.Println("=== PartnerDoc & BusinessInquiry Migration ===")

	// 1. PartnerDocuments 테이블 생성
	var partnerDocsExists int
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'PartnerDocuments'`).Scan(&partnerDocsExists)

	if partnerDocsExists == 0 {
		if err := db.Exec(`
			CREATE TABLE PartnerDocuments (
				Id         INT IDENTITY(1,1) PRIMARY KEY,
				PartnerId  INT NOT NULL,
				FileName   NVARCHAR(200) NOT NULL,
				FileType   NVARCHAR(10) NOT NULL,
				FilePath   NVARCHAR(500) NOT NULL,
				FileSize   BIGINT NOT NULL,
				Category   NVARCHAR(50) NOT NULL,
				UploadedBy INT NOT NULL,
				Note       NVARCHAR(500) NULL,
				CreatedAt  DATETIME2 NOT NULL DEFAULT GETDATE(),
				CONSTRAINT FK_PartnerDocuments_Partner FOREIGN KEY (PartnerId)
					REFERENCES Users(Id) ON DELETE CASCADE
			)
		`).Error; err != nil {
			log.Fatal("Create PartnerDocuments table error:", err)
		}
		fmt.Println("✓ Created PartnerDocuments table")

		if err := db.Exec(`
			CREATE INDEX idx_partner_documents_partner_id ON PartnerDocuments(PartnerId)
		`).Error; err != nil {
			log.Fatal("Create index idx_partner_documents_partner_id error:", err)
		}
		fmt.Println("✓ Created index idx_partner_documents_partner_id")
	} else {
		fmt.Println("- PartnerDocuments table already exists")
	}

	// 2. BusinessInquiries 테이블 생성
	var businessInquiriesExists int
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'BusinessInquiries'`).Scan(&businessInquiriesExists)

	if businessInquiriesExists == 0 {
		if err := db.Exec(`
			CREATE TABLE BusinessInquiries (
				Id               INT IDENTITY(1,1) PRIMARY KEY,
				CompanyName      NVARCHAR(100) NOT NULL,
				BusinessRegNo    NVARCHAR(10) NOT NULL,
				BusinessOpenDate NVARCHAR(8) NOT NULL,
				RepName          NVARCHAR(50) NOT NULL,
				ContactName      NVARCHAR(50) NOT NULL,
				Email            NVARCHAR(100) NOT NULL,
				Phone            NVARCHAR(20) NOT NULL,
				Category         NVARCHAR(30) NOT NULL,
				Message          NVARCHAR(200) NOT NULL,
				Status           NVARCHAR(10) NOT NULL DEFAULT 'NEW',
				IpAddress        NVARCHAR(45) NOT NULL DEFAULT '',
				CreatedAt        DATETIME2 NOT NULL DEFAULT GETDATE()
			)
		`).Error; err != nil {
			log.Fatal("Create BusinessInquiries table error:", err)
		}
		fmt.Println("✓ Created BusinessInquiries table")
	} else {
		fmt.Println("- BusinessInquiries table already exists")

		// 신규 컬럼 추가 (기존 테이블 업그레이드)
		addColIfMissing(db, "BusinessInquiries", "BusinessRegNo", "NVARCHAR(10) NOT NULL DEFAULT ''")
		addColIfMissing(db, "BusinessInquiries", "BusinessOpenDate", "NVARCHAR(8) NOT NULL DEFAULT ''")
		addColIfMissing(db, "BusinessInquiries", "RepName", "NVARCHAR(50) NOT NULL DEFAULT ''")
		addColIfMissing(db, "BusinessInquiries", "IpAddress", "NVARCHAR(45) NOT NULL DEFAULT ''")

		// Message 컬럼 타입 변경: NVARCHAR(MAX) → NVARCHAR(200)
		db.Exec(`ALTER TABLE BusinessInquiries ALTER COLUMN Message NVARCHAR(200) NOT NULL`)
		fmt.Println("✓ Updated BusinessInquiries columns")
	}

	// 3. ContentAttachments 테이블 생성
	var attachmentsExists int
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'ContentAttachments'`).Scan(&attachmentsExists)

	if attachmentsExists == 0 {
		if err := db.Exec(`
			CREATE TABLE ContentAttachments (
				Id         INT IDENTITY(1,1) PRIMARY KEY,
				TargetType NVARCHAR(20) NOT NULL,
				TargetId   INT NOT NULL,
				FileName   NVARCHAR(200) NOT NULL,
				FileType   NVARCHAR(10) NOT NULL,
				FilePath   NVARCHAR(500) NOT NULL,
				FileSize   BIGINT NOT NULL,
				SortOrder  INT NOT NULL DEFAULT 0,
				UploadedBy INT NOT NULL,
				CreatedAt  DATETIME2 NOT NULL DEFAULT GETDATE()
			)
		`).Error; err != nil {
			log.Fatal("Create ContentAttachments table error:", err)
		}
		db.Exec(`CREATE INDEX idx_attachment_target ON ContentAttachments(TargetType, TargetId)`)
		fmt.Println("✓ Created ContentAttachments table with index")
	} else {
		fmt.Println("- ContentAttachments table already exists")
	}

	// 4. 기존 Content 테이블 컬럼 크기 조정
	fmt.Println("\n=== Content Column Size Migration ===")

	// 공지사항: Content NVARCHAR(MAX) → NVARCHAR(500)
	alterColIfExists(db, "Notices", "Content", "NVARCHAR(500)")
	// 이벤트: Description NVARCHAR(MAX) → NVARCHAR(500)
	alterColIfExists(db, "Events", "Description", "NVARCHAR(500)")
	// 1:1 문의: Content NVARCHAR(MAX) → NVARCHAR(200)
	alterColIfExists(db, "Inquiries", "Content", "NVARCHAR(200)")

	fmt.Println("\n✓ Migration complete!")
}

// addColIfMissing는 테이블에 컬럼이 없으면 추가합니다 (idempotent).
func addColIfMissing(db *gorm.DB, table, column, colDef string) {
	var exists int
	db.Raw(`SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(?) AND name = ?`, table, column).Scan(&exists)
	if exists == 0 {
		sql := fmt.Sprintf("ALTER TABLE %s ADD %s %s", table, column, colDef)
		if err := db.Exec(sql).Error; err != nil {
			log.Printf("  ⚠ Add column %s.%s failed: %v", table, column, err)
		} else {
			fmt.Printf("  ✓ Added column %s.%s\n", table, column)
		}
	}
}

// alterColIfExists는 컬럼이 존재하면 타입을 변경합니다 (idempotent).
func alterColIfExists(db *gorm.DB, table, column, newType string) {
	var exists int
	db.Raw(`SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(?) AND name = ?`, table, column).Scan(&exists)
	if exists > 0 {
		sql := fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s %s", table, column, newType)
		if err := db.Exec(sql).Error; err != nil {
			log.Printf("  ⚠ Alter %s.%s failed: %v", table, column, err)
		} else {
			fmt.Printf("  ✓ Altered %s.%s → %s\n", table, column, newType)
		}
	}
}
