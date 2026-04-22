package main

import (
	"fmt"
	"os"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/logger"

	"go.uber.org/zap"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

func main() {
	logger.Log, _ = zap.NewDevelopment()

	cfg, err := config.LoadConfig(".")
	if err != nil {
		fmt.Fprintf(os.Stderr, "설정 로드 실패: %v\n", err)
		os.Exit(1)
	}

	db, err := gorm.Open(sqlserver.Open(cfg.DBUrl), &gorm.Config{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "DB 연결 실패: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("=== FraudCheckLogs 테이블 마이그레이션 ===")

	var tableExists int
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'FraudCheckLogs'`).Scan(&tableExists)

	if tableExists > 0 {
		fmt.Println("- FraudCheckLogs 테이블이 이미 존재합니다")
	} else {
		if err := db.AutoMigrate(&domain.FraudCheckLog{}); err != nil {
			fmt.Fprintf(os.Stderr, "FraudCheckLogs 마이그레이션 실패: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✓ FraudCheckLogs 테이블 생성 완료")
	}

	fmt.Println("=== BlacklistCheckLogs 테이블 마이그레이션 ===")

	var blTableExists int
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'BlacklistCheckLogs'`).Scan(&blTableExists)

	if blTableExists > 0 {
		fmt.Println("- BlacklistCheckLogs 테이블이 이미 존재합니다")
	} else {
		if err := db.AutoMigrate(&domain.BlacklistCheckLog{}); err != nil {
			fmt.Fprintf(os.Stderr, "BlacklistCheckLogs 마이그레이션 실패: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✓ BlacklistCheckLogs 테이블 생성 완료")
	}

	fmt.Println("=== 마이그레이션 완료 ===")
}
