// cmd/send_test_email/main.go — 프로젝트 이메일 템플릿으로 테스트 메일 발송
// Usage: go run ./cmd/send_test_email
package main

import (
	"fmt"
	"log"
	"time"
	"seedream-gift-server/internal/config"
	"seedream-gift-server/pkg/email"
	"seedream-gift-server/pkg/logger"
)

func main() {
	cfg, err := config.LoadConfig(".")
	if err != nil {
		log.Fatal("Config error:", err)
	}
	logger.InitLogger("", "info", 10, 3, 7)

	// 로컬에서는 smtp.gmail.com 사용 (smtp-relay는 프로덕션 IP만 허용)
	cfg.SMTPHost = "smtp.gmail.com"
	svc := email.NewService(&cfg)
	if !svc.IsEnabled() {
		log.Fatal("SMTP is not enabled. Check .env SMTP_ENABLED=true")
	}

	to := "parkdavid31@gmail.com"

	fmt.Printf("Sending test email to %s...\n", to)

	err = svc.SendDeployNotification(to, time.Now().Format("2006-01-02 15:04:05"))
	if err != nil {
		log.Fatalf("Failed to send email: %v", err)
	}

	fmt.Println("✓ Email sent successfully!")
}
