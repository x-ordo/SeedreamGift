package services

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// SQLite 는 nvarchar(max) 를 파싱 못 하므로 AutoMigrate 대신 수동 테이블 생성.
// WebhookReceipt 의 프로덕션 GORM 태그와 필드 이름은 유지.
func setupWebhookReceiptTable(t *testing.T, db *gorm.DB) {
	t.Helper()
	err := db.Exec(`CREATE TABLE "WebhookReceipts" (
		"DeliveryId" INTEGER PRIMARY KEY,
		"Event" TEXT NOT NULL,
		"EventId" TEXT,
		"OrderNo" TEXT,
		"ReceivedAt" DATETIME,
		"ProcessedAt" DATETIME,
		"RawBody" TEXT
	)`).Error
	require.NoError(t, err)
}

func TestVAccountWebhookService_Handle_Issued(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	setupWebhookReceiptTable(t, db)

	// Handle() 의 계약 (svc.go:32) 에 따라 호출 전에 receipt 가 이미 INSERT 되어 있어야 함.
	require.NoError(t, db.Create(&domain.WebhookReceipt{
		DeliveryID: 42, Event: string(seedream.EventVAccountIssued), RawBody: `{}`,
	}).Error)

	svc := NewVAccountWebhookService(db, NewVAccountStateService(db, zap.NewNop()), zap.NewNop())

	payload := seedream.VAccountIssuedPayload{
		EventID:          "evt-1",
		OrderNo:          *order.OrderCode,
		BankCode:         "088",
		AccountNo:        "110-123",
		ReceiverName:     "Seedream",
		DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
		IssuedAt:         time.Now().UTC(),
	}
	raw, _ := json.Marshal(payload)

	err := svc.Handle(context.Background(), 42, string(seedream.EventVAccountIssued), raw)
	require.NoError(t, err)

	// receipt.ProcessedAt 세팅 확인
	var r domain.WebhookReceipt
	require.NoError(t, db.Where("DeliveryId = ?", 42).First(&r).Error)
	require.NotNil(t, r.ProcessedAt)
	assert.Equal(t, string(seedream.EventVAccountIssued), r.Event)

	// Order 상태 확인
	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "ISSUED", got.Status)
}

func TestVAccountWebhookService_Handle_UnknownEvent_NoOp(t *testing.T) {
	db := setupStateTestDB(t)
	setupWebhookReceiptTable(t, db)

	// receipt 먼저 INSERT (핸들러 레이어가 이미 INSERT 했다고 가정)
	require.NoError(t, db.Create(&domain.WebhookReceipt{
		DeliveryID: 99, Event: "unknown.event", RawBody: `{}`,
	}).Error)

	svc := NewVAccountWebhookService(db, NewVAccountStateService(db, zap.NewNop()), zap.NewNop())
	// Phase 3 범위 외 이벤트는 no-op + 정상 완료
	err := svc.Handle(context.Background(), 99, "unknown.event", []byte("{}"))
	require.NoError(t, err)

	var r domain.WebhookReceipt
	require.NoError(t, db.Where("DeliveryId = ?", 99).First(&r).Error)
	require.NotNil(t, r.ProcessedAt)
}

func TestVAccountWebhookService_Handle_Deposited(t *testing.T) {
	db := setupStateTestDB(t)
	order, _ := seedPendingOrderWithPayment(t, db)
	setupWebhookReceiptTable(t, db)
	db.Model(&domain.Order{}).Where("Id = ?", order.ID).Update("Status", "ISSUED")

	svc := NewVAccountWebhookService(db, NewVAccountStateService(db, zap.NewNop()), zap.NewNop())
	payload := seedream.VAccountDepositedPayload{
		OrderNo: *order.OrderCode, Amount: 50000, DepositedAt: time.Now().UTC(),
	}
	raw, _ := json.Marshal(payload)

	err := svc.Handle(context.Background(), 55, string(seedream.EventVAccountDeposited), raw)
	require.NoError(t, err)

	var got domain.Order
	require.NoError(t, db.First(&got, order.ID).Error)
	assert.Equal(t, "PAID", got.Status)
}
