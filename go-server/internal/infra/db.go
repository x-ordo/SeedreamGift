// Package infra는 데이터베이스 연결 및 외부 서비스 통합과 같은 애플리케이션의 핵심 인프라 구성 요소를 제공합니다.
package infra

import (
	"fmt"
	"w-gift-server/internal/config"
	"w-gift-server/pkg/logger"

	"go.uber.org/zap"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

// DB는 전역 GORM 데이터베이스 연결 인스턴스입니다.
var DB *gorm.DB

// InitDB는 제공된 설정을 사용하여 데이터베이스 연결을 초기화합니다.
// 1. GORM을 사용하여 SQL Server(또는 설정된 DB)에 접속을 시도합니다.
// 2. 애플리케이션의 동시성 처리 성능을 최적화하기 위해 커넥션 풀(Connection Pool) 설정을 구성합니다.
// 3. 연결 성공 시 로깅을 통해 현재 풀 설정을 기록하여 운영 시 참고할 수 있도록 합니다.
func InitDB(cfg *config.Config) {
	var err error
	// GORM DB 인스턴스 오픈
	DB, err = gorm.Open(sqlserver.Open(cfg.DBUrl), &gorm.Config{
		PrepareStmt:            true,
		SkipDefaultTransaction: true,
	})
	if err != nil {
		// DB 연결 실패는 애플리케이션 실행 불가 사유이므로 Fatal 로그와 함께 종료합니다.
		logger.Log.Fatal(fmt.Sprintf("Failed to connect to database: %v", err))
	}

	// 내부 SQL DB 핸들을 추출하여 로우 레벨 풀 설정을 적용합니다.
	sqlDB, err := DB.DB()
	if err == nil {
		// MaxIdleConns: 유휴 상태로 유지할 최대 커넥션 수 (성능 향상을 위해 적절값 유지)
		sqlDB.SetMaxIdleConns(cfg.DBMaxIdleConns)
		// MaxOpenConns: 동시 오픈 가능한 최대 커넥션 수 (DB 서버 자원 한계 고려)
		sqlDB.SetMaxOpenConns(cfg.DBMaxOpenConns)
		// ConnMaxLifetime: 개별 커넥션의 최대 수명 (좀비 커넥션 방지 및 네트워크 재설정 대응)
		sqlDB.SetConnMaxLifetime(cfg.DBConnMaxLifetime)
		// ConnMaxIdleTime: 유휴 커넥션 최대 유지 시간 (불필요한 유휴 커넥션 정리)
		sqlDB.SetConnMaxIdleTime(cfg.DBConnMaxIdleTime)
	}

	logger.Log.Info("DB 연결 완료",
		zap.Int("maxIdleConns", cfg.DBMaxIdleConns),
		zap.Int("maxOpenConns", cfg.DBMaxOpenConns),
		zap.Duration("connMaxLifetime", cfg.DBConnMaxLifetime),
		zap.Duration("connMaxIdleTime", cfg.DBConnMaxIdleTime),
	)
}
