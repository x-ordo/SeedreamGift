package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPayment_HasSeedreamFields(t *testing.T) {
	// Seedream 통합을 위해 Payment 구조체에 추가된 3개 필드가 존재해야 한다.
	// 참조: 통합 설계 §4.2
	var vaID int64 = 102847
	var phase = "awaiting_deposit"
	var idem = "gift:vaccount:ORD-1"

	p := Payment{
		SeedreamVAccountID:     &vaID,
		SeedreamPhase:          &phase,
		SeedreamIdempotencyKey: &idem,
	}

	assert.NotNil(t, p.SeedreamVAccountID)
	assert.Equal(t, int64(102847), *p.SeedreamVAccountID)

	assert.NotNil(t, p.SeedreamPhase)
	assert.Equal(t, "awaiting_deposit", *p.SeedreamPhase)

	assert.NotNil(t, p.SeedreamIdempotencyKey)
	assert.Equal(t, "gift:vaccount:ORD-1", *p.SeedreamIdempotencyKey)
}
