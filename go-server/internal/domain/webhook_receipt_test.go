package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestWebhookReceipt_TableName(t *testing.T) {
	var r WebhookReceipt
	assert.Equal(t, "WebhookReceipts", r.TableName())
}

func TestWebhookReceipt_Fields(t *testing.T) {
	// 필수 필드가 제로값이 아닌 상태로 구성 가능한지 컴파일 수준에서 확인
	var s = "ORD-1"
	var eid = "evt-123"
	r := WebhookReceipt{
		DeliveryID: 42,
		Event:      "vaccount.deposited",
		OrderNo:    &s,
		EventID:    &eid,
		RawBody:    `{"eventId":"evt-123"}`,
	}
	assert.Equal(t, int64(42), r.DeliveryID)
	assert.Equal(t, "vaccount.deposited", r.Event)
	assert.Equal(t, "ORD-1", *r.OrderNo)
}
