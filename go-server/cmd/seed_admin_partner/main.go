// cmd/seed_admin_partner/main.go — 관리자/테스트 파트너 계정 시드
//
// Usage:
//   go run ./cmd/seed_admin_partner
//
// 동작:
//   - 같은 이메일이 이미 존재하면 비밀번호/역할/티어/KYC 등을 UPDATE (멱등)
//   - 존재하지 않으면 신규 생성
//   - 비밀번호는 bcrypt(cost=Config.BcryptCost) 해싱 후 저장
//
// 운영 안전:
//   - 비밀번호는 코드에 평문으로 두지 말고 환경변수(SEED_ADMIN_PW, SEED_PARTNER_PW)로 주입
//     env 미설정 시 fallback 기본값을 사용하지만, 프로덕션에서는 반드시 env로 오버라이드할 것.
package main

import (
	"fmt"
	"os"
	"time"

	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/crypto"
	"seedream-gift-server/pkg/logger"

	"go.uber.org/zap"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

// seedAccount는 시드할 계정 한 건의 입력 데이터입니다.
// Password는 평문이며, upsertUser 안에서 bcrypt 해싱됩니다.
type seedAccount struct {
	Email       string
	Password    string
	Name        string
	Phone       string
	Role        string  // USER | PARTNER | ADMIN
	KycStatus   string  // NONE | PENDING | VERIFIED | REJECTED
	PartnerTier *string // BRONZE | SILVER | GOLD | PLATINUM (PARTNER 일 때만 의미)
}

// ptr는 임의 타입의 값을 받아 그 주소를 반환하는 제너릭 헬퍼입니다.
// (new(string)은 zero value 포인터만 만들 수 있으므로 사용하지 않습니다.)
func ptr[T any](v T) *T { return &v }

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

	bcryptCost := cfg.BcryptCost
	if bcryptCost == 0 {
		bcryptCost = 12
	}

	// ─────────────────────────────────────────────────────────────
	// TODO(사용자 결정 영역): 아래 두 계정의 자격증명/등급을 확정하세요.
	// ─────────────────────────────────────────────────────────────
	// 비밀번호 규칙: 8~72자, 영문 + 숫자 + 특수문자 모두 포함
	// 환경변수 SEED_ADMIN_PW / SEED_PARTNER_PW 가 있으면 그 값을 우선 사용합니다.
	accounts := []seedAccount{
		{
			Email:     "admin@seedreamgift.com",
			Password:  envOr("SEED_ADMIN_PW", "Admin!2026Seed"),
			Name:      "관리자",
			Phone:     "01000000001",
			Role:      "ADMIN",
			KycStatus: "VERIFIED",
		},
		{
			Email:       "partner.test@seedreamgift.com",
			Password:    envOr("SEED_PARTNER_PW", "Partner!2026Seed"),
			Name:        "테스트파트너",
			Phone:       "01000000002",
			Role:        "PARTNER",
			KycStatus:   "VERIFIED",
			PartnerTier: ptr("GOLD"),
		},
	}

	for _, acc := range accounts {
		if err := upsertUser(db, acc, bcryptCost); err != nil {
			fmt.Fprintf(os.Stderr, "[%s] 시드 실패: %v\n", acc.Email, err)
			os.Exit(1)
		}
	}
	fmt.Println("=== 관리자/테스트 파트너 시드 완료 ===")
}

// upsertUser는 이메일을 키로 사용자를 멱등 시드합니다.
// 검증 → 해싱 → 존재 여부 확인 → CREATE 또는 UPDATE 순으로 동작합니다.
func upsertUser(db *gorm.DB, acc seedAccount, bcryptCost int) error {
	if err := domain.ValidateEmail(acc.Email); err != nil {
		return fmt.Errorf("이메일 검증: %w", err)
	}
	if err := domain.ValidatePassword(acc.Password); err != nil {
		return fmt.Errorf("비밀번호 검증: %w", err)
	}
	if err := domain.ValidateRole(acc.Role); err != nil {
		return err
	}
	if err := domain.ValidateKycStatus(acc.KycStatus); err != nil {
		return err
	}

	hashed, err := crypto.HashPassword(acc.Password, bcryptCost)
	if err != nil {
		return fmt.Errorf("비밀번호 해싱: %w", err)
	}

	now := time.Now()
	var existing domain.User
	err = db.Where("Email = ?", acc.Email).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		user := domain.User{
			Email:       acc.Email,
			Password:    hashed,
			Name:        ptr(acc.Name),
			Phone:       ptr(acc.Phone),
			Role:        acc.Role,
			KycStatus:   acc.KycStatus,
			PartnerTier: acc.PartnerTier,
		}
		if acc.Role == "PARTNER" {
			user.PartnerSince = &now
		}
		if err := db.Create(&user).Error; err != nil {
			return fmt.Errorf("생성 실패: %w", err)
		}
		fmt.Printf("✓ 신규 생성: %s (Role=%s, ID=%d)\n", acc.Email, acc.Role, user.ID)
		return nil
	}
	if err != nil {
		return fmt.Errorf("조회 실패: %w", err)
	}

	updates := map[string]any{
		"Password":    hashed,
		"Name":        acc.Name,
		"Phone":       acc.Phone,
		"Role":        acc.Role,
		"KycStatus":   acc.KycStatus,
		"PartnerTier": acc.PartnerTier,
		"IsDeleted":   false,
		"DeletedAt":   nil,
	}
	if acc.Role == "PARTNER" && existing.PartnerSince == nil {
		updates["PartnerSince"] = now
	}
	if err := db.Model(&existing).Updates(updates).Error; err != nil {
		return fmt.Errorf("업데이트 실패: %w", err)
	}
	fmt.Printf("✓ 업데이트: %s (Role=%s, ID=%d)\n", acc.Email, acc.Role, existing.ID)
	return nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
