// cmd/schema_check/main.go — 도메인 모델 vs 운영 DB 스키마 일관성 점검
// 각 GORM 모델의 컬럼이 실제 DB 테이블에 존재하는지 확인하고 누락 컬럼을 보고합니다.
// 자동 ALTER 는 수행하지 않으며, 점검 결과만 출력합니다.
package main

import (
	"fmt"
	"os"
	"sync"

	"seedream-gift-server/internal/domain"

	"github.com/microsoft/go-mssqldb"
	_ "github.com/microsoft/go-mssqldb"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

var _ = mssql.NewConnector // import 유지

// 점검 대상 — TableName() 메서드가 있는 모든 도메인 타입
var models = []any{
	&domain.User{},
	&domain.RefreshToken{},
	&domain.Brand{},
	&domain.Product{},
	&domain.VoucherCode{},
	&domain.Order{},
	&domain.OrderItem{},
	&domain.Payment{},
	&domain.Refund{},
	&domain.OrderEvent{},
	&domain.CartItem{},
	&domain.TradeIn{},
	&domain.KycVerifySession{},
	&domain.SmsVerification{},
	&domain.Gift{},
	&domain.Notice{},
	&domain.Faq{},
	&domain.Event{},
	&domain.Inquiry{},
	&domain.Policy{},
	&domain.PolicyConsent{},
	&domain.BusinessInquiry{},
	&domain.PartnerPrice{},
	&domain.PartnerDocument{},
	&domain.PartnerBusinessInfo{},
	&domain.PartnerSettlement{},
	&domain.LedgerEntry{},
	&domain.OutboxMessage{},
	&domain.IdempotencyRecord{},
	&domain.IPBlacklistEntry{},
	&domain.IPWhitelistEntry{},
	&domain.FraudCheckLog{},
	&domain.BlacklistCheckLog{},
	&domain.IssuanceLog{},
	&domain.AuditLog{},
	&domain.SiteConfig{},
	&domain.PatternRule{},
	&domain.WebhookReceipt{},
	&domain.WebAuthnCredential{},
	&domain.ExternalServiceConfig{},
	&domain.ContentAttachment{},
	&domain.CashReceipt{},
	&domain.ReconcileCursor{},
}

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "sqlserver://dnflrhdwnghkdlxldsql:dnflrhdwnghkdlxld2024!%40@103.97.209.131:7335?database=SEEDREAM_GIFT_DB&encrypt=true&trustServerCertificate=true"
	}

	db, err := gorm.Open(sqlserver.Open(dsn), &gorm.Config{})
	if err != nil {
		fmt.Printf("[ERROR] DB 연결 실패: %v\n", err)
		os.Exit(1)
	}
	sqlDB, _ := db.DB()
	if err := sqlDB.Ping(); err != nil {
		fmt.Printf("[ERROR] Ping 실패: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("==================================================")
	fmt.Println(" Schema Check — domain models vs production DB")
	fmt.Println("==================================================")
	fmt.Printf(" 대상: %d 모델\n", len(models))
	fmt.Println()

	migrator := db.Migrator()
	cache := &sync.Map{}
	totalMissing := 0
	missingTables := []string{}

	for _, model := range models {
		s, err := schema.Parse(model, cache, db.NamingStrategy)
		if err != nil {
			fmt.Printf("[ERROR] schema.Parse 실패: %v\n", err)
			continue
		}
		tableName := s.Table

		// 테이블 존재 여부 먼저
		if !migrator.HasTable(model) {
			fmt.Printf("[MISSING TABLE] %s\n", tableName)
			missingTables = append(missingTables, tableName)
			totalMissing++
			continue
		}

		// 각 필드별 컬럼 존재 확인
		missingCols := []string{}
		for _, f := range s.Fields {
			if f.DBName == "" {
				continue // 비저장 필드 (e.g. relation, gorm:"-")
			}
			if !migrator.HasColumn(model, f.DBName) {
				missingCols = append(missingCols, f.DBName)
			}
		}

		if len(missingCols) > 0 {
			fmt.Printf("[MISMATCH] %s — 누락 컬럼 %d개:\n", tableName, len(missingCols))
			for _, c := range missingCols {
				// 필드의 GORM 데이터 타입 정보도 함께 출력 (ALTER 작성에 도움)
				for _, f := range s.Fields {
					if f.DBName == c {
						fmt.Printf("    - %s  (Go 타입: %s, NOT NULL: %v)\n", c, f.FieldType, f.NotNull)
						break
					}
				}
			}
			totalMissing += len(missingCols)
		}
	}

	fmt.Println()
	fmt.Println("==================================================")
	if totalMissing == 0 && len(missingTables) == 0 {
		fmt.Println(" [OK] 모든 도메인 모델이 운영 DB 와 일치합니다")
	} else {
		fmt.Printf(" [WARN] 총 누락: %d 컬럼\n", totalMissing)
		if len(missingTables) > 0 {
			fmt.Printf(" 누락 테이블: %v\n", missingTables)
		}
	}
	fmt.Println("==================================================")
}
