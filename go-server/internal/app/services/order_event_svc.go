package services

import (
	"encoding/json"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/logger"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// OrderEventService는 주문 이벤트를 기록하고 조회하는 서비스입니다.
type OrderEventService struct {
	db *gorm.DB
}

func NewOrderEventService(db *gorm.DB) *OrderEventService {
	return &OrderEventService{db: db}
}

// Record는 트랜잭션 내에서 이벤트를 기록합니다.
// tx가 nil이면 기본 DB를 사용합니다.
// 이벤트 기록 실패는 주문 처리를 막지 않습니다 (로그만 남김).
func (s *OrderEventService) Record(tx *gorm.DB, orderID int, eventType string, actorID *int, actorType string, payload interface{}) {
	db := tx
	if db == nil {
		db = s.db
	}

	var payloadStr string
	if payload != nil {
		if b, err := json.Marshal(payload); err == nil {
			payloadStr = string(b)
		}
	}

	event := domain.OrderEvent{
		OrderID:   orderID,
		EventType: eventType,
		Payload:   payloadStr,
		ActorID:   actorID,
		ActorType: actorType,
	}

	if err := db.Create(&event).Error; err != nil {
		logger.Log.Error("주문 이벤트 기록 실패 (비치명적)",
			zap.Int("orderID", orderID),
			zap.String("eventType", eventType),
			zap.Error(err),
		)
	}
}

// GetOrderHistory는 주문의 전체 이벤트 이력을 시간순으로 반환합니다.
func (s *OrderEventService) GetOrderHistory(orderID int) ([]domain.OrderEvent, error) {
	var events []domain.OrderEvent
	err := s.db.Where("\"OrderId\" = ?", orderID).Order("\"CreatedAt\" ASC").Find(&events).Error
	return events, err
}
