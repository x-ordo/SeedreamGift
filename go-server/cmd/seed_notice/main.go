// cmd/seed_notice/main.go — 공지사항 시드 등록
// Usage: go run ./cmd/seed_notice
package main

import (
	"fmt"
	"os"
	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/logger"

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

	// Content 컬럼 크기 확장 (nvarchar(500) → nvarchar(2000))
	db.Exec("ALTER TABLE Notices ALTER COLUMN Content nvarchar(2000)")

	notice := domain.Notice{
		Title:    "📢 은행 허위신고 강력대응 안내",
		Content: `안녕하십니까, 씨드림기프트입니다.

최근 당사 서비스를 정상적으로 이용하신 후 악의적으로 은행에 허위 신고하는 사례가 급증하고 있어 다음과 같이 안내드립니다.


■ 허위 신고의 정의

고객과 씨드림기프트 간의 직접적인 분쟁이 아님에도 불구하고, 당사를 수사기관·은행 등에 신고하거나 당사 명의 계좌에 대해 지급정지 신청·보이스피싱 의심계좌 신고 등을 하는 일체의 행위를 말합니다.


■ 법적 책임 안내

정상 이용 후 고의적 신고는 아래에 해당하는 명백한 위법행위입니다.
• 사기죄 (형법 제347조)
• 업무방해죄 (형법 제314조)
• 신용훼손죄 (형법 제313조)


■ 당사의 대응 방침

• 관련 증거자료 확보 및 보관
• 형사 고발 조치
• 민사상 손해배상 청구
• 가처분 신청 등 법적 조치


■ 유의사항

타인을 교사(교唆)하여 허위 신고를 유도하는 행위 역시 공동정범으로 처벌 대상이 됩니다.


당사는 부정 행위에 대해 무관용 원칙으로 강력히 법적 대응할 것임을 알려드립니다. 정상적으로 서비스를 이용하시는 고객님께서는 안심하시고 이용해 주시기 바랍니다.

감사합니다.
씨드림기프트 운영팀`,
		IsActive: true,
	}

	// 기존에 같은 제목의 공지가 있으면 업데이트, 없으면 생성
	var existing domain.Notice
	if err := db.Where("Title = ?", notice.Title).First(&existing).Error; err == nil {
		db.Model(&existing).Updates(map[string]any{
			"Content":  notice.Content,
			"IsActive": true,
		})
		fmt.Printf("✓ 공지사항 업데이트 완료 (ID: %d)\n", existing.ID)
	} else {
		if err := db.Create(&notice).Error; err != nil {
			fmt.Fprintf(os.Stderr, "공지사항 생성 실패: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("✓ 공지사항 생성 완료 (ID: %d)\n", notice.ID)
	}

	// 이 공지를 ID 기준 가장 상단에 위치시키기 위해 기존 공지의 ID보다 작은 값이 필요하지만,
	// auto-increment이므로 가장 최신(마지막)에 생성됩니다.
	// 프론트엔드에서 공지 목록은 CreatedAt DESC로 정렬되므로 가장 위에 노출됩니다.
	fmt.Println("=== 공지사항 시드 완료 ===")
}
