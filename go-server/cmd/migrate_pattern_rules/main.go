// cmd/migrate_pattern_rules/main.go
// PatternRules 테이블을 GORM AutoMigrate 로 생성하고 기본 룰을 시드합니다.
// idempotent — 이미 존재하면 무해 (컬럼/인덱스 추가만 수행).
package main

import (
	"fmt"
	"os"

	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/domain"

	_ "github.com/microsoft/go-mssqldb"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

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

	migrator := db.Migrator()
	existed := migrator.HasTable(&domain.PatternRule{})
	fmt.Printf("[before] PatternRules 테이블 존재: %v\n", existed)

	if err := db.AutoMigrate(&domain.PatternRule{}); err != nil {
		fmt.Printf("[ERROR] AutoMigrate 실패: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("[OK] PatternRules 테이블 생성/동기화 완료")

	// 기본 룰 시드 — 새 테이블이라면 자동 INSERT, 이미 있다면 RuleId 충돌로 무해 skip
	svc := services.NewPatternRuleService(db)
	svc.SeedDefaultPatternRules()
	fmt.Println("[OK] 기본 패턴 룰 시드 완료")

	// 검증: 컬럼 + 인덱스 + 행 수
	rules, err := svc.GetPatternRules()
	if err != nil {
		fmt.Printf("[WARN] 검증 조회 실패: %v\n", err)
	} else {
		fmt.Printf("[검증] PatternRules row 수: %d\n", len(rules))
		for _, r := range rules {
			fmt.Printf("    - %s (%s) enabled=%v category=%s\n", r.RuleID, r.Name, r.Enabled, r.Category)
		}
	}
}
