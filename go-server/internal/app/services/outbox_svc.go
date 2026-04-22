package services

import (
	"encoding/json"
	"fmt"
	"time"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/telegram"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// OutboxService는 트랜잭셔널 아웃박스 패턴의 릴레이 서비스입니다.
// DB에 저장된 PENDING 메시지를 읽어 실제 채널로 발송합니다.
type OutboxService struct {
	db *gorm.DB
}

func NewOutboxService(db *gorm.DB) *OutboxService {
	return &OutboxService{db: db}
}

// Enqueue는 트랜잭션 안에서 아웃박스 메시지를 저장합니다.
// tx가 nil이면 기본 DB를 사용합니다.
func Enqueue(tx *gorm.DB, channel, eventType string, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		logger.Log.Error("outbox: payload 직렬화 실패",
			zap.String("channel", channel),
			zap.String("eventType", eventType),
			zap.Error(err),
		)
		return
	}

	msg := domain.OutboxMessage{
		Channel:   channel,
		EventType: eventType,
		Payload:   string(data),
		Status:    "PENDING",
		MaxRetry:  5,
	}
	if err := tx.Create(&msg).Error; err != nil {
		logger.Log.Error("outbox: 메시지 저장 실패",
			zap.String("channel", channel),
			zap.String("eventType", eventType),
			zap.Error(err),
		)
	}
}

// ProcessPending는 PENDING 상태의 아웃박스 메시지를 처리합니다.
// 크론에서 30초 간격으로 호출됩니다.
func (s *OutboxService) ProcessPending() {
	var messages []domain.OutboxMessage
	if err := s.db.Where("Status = ? AND Attempts < MaxRetry", "PENDING").
		Order("CreatedAt ASC").
		Limit(50).
		Find(&messages).Error; err != nil {
		logger.Log.Error("outbox: PENDING 메시지 조회 실패", zap.Error(err))
		return
	}

	if len(messages) == 0 {
		return
	}

	for i := range messages {
		s.dispatch(&messages[i])
	}
}

// dispatch는 개별 메시지를 실제 채널로 발송합니다.
func (s *OutboxService) dispatch(msg *domain.OutboxMessage) {
	msg.Attempts++
	var err error

	switch msg.Channel {
	case "TELEGRAM":
		var payload struct {
			Token  string `json:"token"`
			ChatID string `json:"chatId"`
			HTML   string `json:"html"`
		}
		if jsonErr := json.Unmarshal([]byte(msg.Payload), &payload); jsonErr != nil {
			err = jsonErr
		} else {
			if sendErr := telegram.SendAlert(payload.Token, payload.ChatID, payload.HTML); sendErr != nil {
				err = fmt.Errorf("텔레그램 전송 실패: %w", sendErr)
			}
		}

	// EMAIL, KAKAO 등 추가 채널은 여기에 구현
	default:
		logger.Log.Warn("outbox: 미지원 채널", zap.String("channel", msg.Channel))
		errMsg := "unsupported channel: " + msg.Channel
		msg.Error = &errMsg
		msg.Status = "FAILED"
		s.db.Save(msg)
		return
	}

	if err != nil {
		errMsg := err.Error()
		msg.Error = &errMsg
		if msg.Attempts >= msg.MaxRetry {
			msg.Status = "FAILED"
			logger.Log.Error("outbox: 최대 재시도 초과 → FAILED",
				zap.Int("id", msg.ID),
				zap.String("channel", msg.Channel),
				zap.String("eventType", msg.EventType),
			)
		}
		s.db.Save(msg)
		return
	}

	// 성공
	now := time.Now()
	msg.Status = "SENT"
	msg.SentAt = &now
	s.db.Save(msg)
}
