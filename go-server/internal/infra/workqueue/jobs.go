package workqueue

import (
	"fmt"

	"go.uber.org/zap"
	"gorm.io/gorm"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/telegram"
)

// TelegramAlertJob은 텔레그램 알림을 비동기로 발송합니다.
// token/chatID가 비어 있으면 telegram.SendAlert가 조용히 건너뜁니다.
type TelegramAlertJob struct {
	Token   string
	ChatID  string
	Message string
}

// Name은 Job 인터페이스를 구현합니다.
func (j TelegramAlertJob) Name() string { return "telegram_alert" }

// Execute는 Job 인터페이스를 구현합니다.
func (j TelegramAlertJob) Execute() error {
	return telegram.SendAlert(j.Token, j.ChatID, j.Message)
}

// AuditLogJob은 감사 로그를 비동기로 DB에 기록합니다.
// Model은 *domain.AuditLog 등 GORM이 Create할 수 있는 포인터 값이어야 합니다.
type AuditLogJob struct {
	DB    *gorm.DB
	Model interface{}
}

// Name은 Job 인터페이스를 구현합니다.
func (j AuditLogJob) Name() string { return "audit_log" }

// Execute는 Job 인터페이스를 구현합니다.
func (j AuditLogJob) Execute() error {
	if err := j.DB.Create(j.Model).Error; err != nil {
		logger.Log.Error("감사 로그 기록 실패", zap.Error(err))
		return fmt.Errorf("audit log: %w", err)
	}
	return nil
}
