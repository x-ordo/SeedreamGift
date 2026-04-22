// migrate_last_alert_sent_at은 Products 테이블에 LastAlertSentAt 컬럼을 추가하는 일회성 마이그레이션입니다.
// 재고 부족 알림 억제 상태를 DB에 영속적으로 저장하기 위해 사용됩니다.
package main

import (
	"fmt"
	"log"
	"w-gift-server/internal/config"
	"w-gift-server/internal/infra"
)

func main() {
	cfg, err := config.LoadConfig(".")
	if err != nil {
		log.Fatal("Config 로드 실패:", err)
	}
	infra.InitDB(&cfg)

	var count int
	infra.DB.Raw(`SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'LastAlertSentAt'`).Scan(&count)
	if count > 0 {
		fmt.Println("LastAlertSentAt 컬럼이 이미 존재합니다.")
		return
	}

	if err := infra.DB.Exec(`ALTER TABLE Products ADD LastAlertSentAt DATETIME2 NULL`).Error; err != nil {
		log.Fatal("마이그레이션 실패:", err)
	}
	fmt.Println("Products 테이블에 LastAlertSentAt 컬럼을 추가했습니다.")
}
