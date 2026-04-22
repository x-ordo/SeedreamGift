// cmd/migrate_webauthn/main.go — WebAuthnCredentials 테이블 생성
// Usage: go run ./cmd/migrate_webauthn
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

	fmt.Println("=== WebAuthn Migration ===")

	// 1. WebAuthnCredentials 테이블 생성
	var exists int
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'WebAuthnCredentials'`).Scan(&exists)

	if exists == 0 {
		if err := db.Exec(`
			CREATE TABLE WebAuthnCredentials (
				Id              INT IDENTITY(1,1) PRIMARY KEY,
				UserId          INT NOT NULL,
				CredentialId    NVARCHAR(500) NOT NULL,
				PublicKey       VARBINARY(MAX) NOT NULL,
				AttestationType NVARCHAR(30) NULL DEFAULT '',
				Transport       NVARCHAR(100) NULL DEFAULT '',
				SignCount       INT NOT NULL DEFAULT 0,
				AAGUID          NVARCHAR(36) NULL DEFAULT '',
				Name            NVARCHAR(50) NULL DEFAULT '',
				CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
				LastUsedAt      DATETIME2 NULL
			)
		`).Error; err != nil {
			log.Fatal("Create WebAuthnCredentials table error:", err)
		}
		fmt.Println("✓ Created WebAuthnCredentials table")

		db.Exec(`CREATE INDEX IX_WebAuthnCredentials_UserId ON WebAuthnCredentials(UserId)`)
		db.Exec(`CREATE UNIQUE INDEX UQ_WebAuthnCredentials_CredentialId ON WebAuthnCredentials(CredentialId)`)
		fmt.Println("✓ Created indexes")
	} else {
		fmt.Println("- WebAuthnCredentials table already exists")
	}

	// 2. Users 테이블에 WebAuthnEnabled 컬럼 추가
	var colExists int
	db.Raw(`SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'WebAuthnEnabled'`).Scan(&colExists)
	if colExists == 0 {
		db.Exec(`ALTER TABLE Users ADD WebAuthnEnabled BIT NOT NULL DEFAULT 0`)
		fmt.Println("✓ Added Users.WebAuthnEnabled column")
	} else {
		fmt.Println("- Users.WebAuthnEnabled already exists")
	}

	fmt.Println("\n✓ WebAuthn migration complete!")
}
