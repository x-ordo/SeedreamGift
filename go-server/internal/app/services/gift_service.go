// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// Gift Service는 사용자 간의 선물하기 기능과 선물 수령 처리를 담당합니다.
package services

import (
	"fmt"
	"strings"
	"time"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/crypto"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/pagination"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// GiftService는 선물하기 관련 비즈니스 로직을 처리하는 서비스입니다.
type GiftService struct {
	db  *gorm.DB
	cfg *config.Config
}

// NewGiftService는 새로운 GiftService 인스턴스를 생성합니다.
func NewGiftService(db *gorm.DB, cfg *config.Config) *GiftService {
	return &GiftService{db: db, cfg: cfg}
}

// GetReceivedGifts는 특정 사용자가 받은 선물 목록을 페이지네이션하여 조회합니다.
func (s *GiftService) GetReceivedGifts(userID int, params pagination.QueryParams) (pagination.PaginatedResponse[domain.Gift], error) {
	var items []domain.Gift
	var total int64

	db := s.db.Model(&domain.Gift{}).Where("ReceiverId = ?", userID).
		Preload("Sender", func(db *gorm.DB) *gorm.DB {
			return db.Select("Id", "Name", "Email")
		}).
		Preload("Order.OrderItems.Product")
	if err := db.Count(&total).Error; err != nil {
		return pagination.PaginatedResponse[domain.Gift]{}, apperror.Internal("선물 수 조회 실패", err)
	}

	offset := (params.Page - 1) * params.Limit
	err := db.Order("CreatedAt DESC").Offset(offset).Limit(params.Limit).Find(&items).Error

	// Populate senderName from the preloaded Sender
	for i := range items {
		if items[i].Sender.Name != nil && *items[i].Sender.Name != "" {
			items[i].SenderName = *items[i].Sender.Name
		} else if items[i].Sender.Email != "" {
			items[i].SenderName = items[i].Sender.Email
		}
	}

	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), err
}

// ClaimGift는 사용자가 받은 선물을 수령 처리합니다.
func (s *GiftService) ClaimGift(userID int, giftID int) (*domain.Gift, error) {
	var gift domain.Gift
	err := s.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&domain.Gift{}).
			Where("Id = ? AND ReceiverId = ? AND Status = 'SENT'", giftID, userID).
			Updates(map[string]any{"Status": "CLAIMED", "ClaimedAt": time.Now()})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return apperror.NotFound("선물을 찾을 수 없거나 이미 수령된 선물입니다")
		}
		return tx.Preload("Order.OrderItems.Product").
			Preload("Order.VoucherCodes").
			Preload("Sender", func(db *gorm.DB) *gorm.DB {
				return db.Select("Id", "Name", "Email")
			}).
			First(&gift, giftID).Error
	})
	if err != nil {
		return nil, err
	}

	// Populate senderName from the preloaded Sender
	if gift.Sender.Name != nil && *gift.Sender.Name != "" {
		gift.SenderName = *gift.Sender.Name
	} else if gift.Sender.Email != "" {
		gift.SenderName = gift.Sender.Email
	}

	// 보안: 주문이 결제 완료 상태가 아니면 PIN 노출 금지
	if gift.Order.ID != 0 {
		switch gift.Order.Status {
		case "PAID", "DELIVERED", "COMPLETED":
			// OK
		default:
			gift.Order.VoucherCodes = nil
			return &gift, nil
		}
	}

	// 감사 로그: 선물 수령 — 누가 언제 어떤 주문의 PIN을 열람했는지 DB + 구조화 로그
	pinCount := len(gift.Order.VoucherCodes)
	logger.Log.Info("AUDIT: 선물 수령 (PIN 열람)",
		zap.Int("giftId", gift.ID),
		zap.Int("receiverId", userID),
		zap.Int("senderId", gift.SenderID),
		zap.Int("orderId", gift.OrderID),
		zap.Int("pinCount", pinCount),
		zap.Stringp("orderCode", gift.Order.OrderCode),
	)

	// DB 감사 로그 저장 (비동기 — 실패해도 수령 처리에 영향 없음)
	go func() {
		giftIDStr := fmt.Sprintf("%d", gift.ID)
		detail := fmt.Sprintf("선물수령: giftId=%d, orderId=%d, senderId=%d, pinCount=%d",
			gift.ID, gift.OrderID, gift.SenderID, pinCount)
		s.db.Create(&domain.AuditLog{
			UserID:     &userID,
			Action:     "PIN_VIEW",
			Resource:   "Gift",
			ResourceID: &giftIDStr,
			NewValue:   &detail,
		})
	}()

	// PIN 마스킹: 선물 수령 시 복호화 후 마지막 4자리만 노출
	if gift.Order.ID != 0 {
		for j := range gift.Order.VoucherCodes {
			vc := &gift.Order.VoucherCodes[j]
			if vc.PinCode != "" {
				// 암호화된 PIN을 먼저 복호화합니다. 복호화 실패 시 원본 암호문을 마스킹합니다.
				pin := vc.PinCode
				if decrypted, err := crypto.DecryptAuto(pin, s.cfg.EncryptionKey); err == nil {
					pin = decrypted
				}
				if len(pin) > 4 {
					vc.PinCode = strings.Repeat("*", len(pin)-4) + pin[len(pin)-4:]
				} else {
					vc.PinCode = pin
				}
			}
			vc.SecurityCode = nil
		}
	}

	return &gift, nil
}

// CheckReceiver는 선물을 받을 사용자가 존재하는지, 선물을 받을 수 있는 상태인지 이메일로 확인합니다.
// senderUserID는 자기 자신에게 선물하는 것을 방지하기 위해 사용됩니다.
func (s *GiftService) CheckReceiver(email string, senderUserID int) (map[string]any, error) {
	var user domain.User
	err := s.db.Where("Email = ?", email).First(&user).Error
	if err != nil {
		return nil, apperror.NotFound("존재하지 않는 이메일입니다.")
	}

	// 자기 자신에게 선물하는 것을 방지합니다.
	if user.ID == senderUserID {
		return nil, apperror.Validation("자기 자신에게는 선물할 수 없습니다")
	}

	return map[string]any{
		"success":    true,
		"receiverId": user.ID,
		"name":       user.Name,
		"email":      user.Email,
	}, nil
}

// SearchReceiver는 이름이나 이메일 검색을 통해 선물을 받을 수 있는 사용자 목록을 검색합니다.
func (s *GiftService) SearchReceiver(query string) ([]map[string]any, error) {
	query = strings.TrimSpace(query)
	if len(query) < s.cfg.GiftSearchMinQuery {
		return []map[string]any{}, nil
	}

	var users []domain.User
	s.db.Where(
		"(Email LIKE ? OR Name LIKE ?) AND Role = ?",
		query+"%", "%"+query+"%", "USER",
	).Limit(s.cfg.GiftSearchLimit).Select("Id, Email, Name").Find(&users)

	result := make([]map[string]any, len(users))
	for i, u := range users {
		result[i] = map[string]any{"id": u.ID, "email": u.Email, "name": u.Name}
	}
	return result, nil
}
