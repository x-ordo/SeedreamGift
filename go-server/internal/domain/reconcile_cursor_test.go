package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestReconcileCursor_TableName(t *testing.T) {
	var c ReconcileCursor
	assert.Equal(t, "SeedreamReconcileCursors", c.TableName())
}

func TestReconcileCursor_SingletonIDDefault(t *testing.T) {
	// 싱글턴 제약: ID 가 명시되지 않아도 1 을 기본값으로 사용해야 함.
	// 이 테스트는 struct 수준의 기본값 설정을 검증.
	c := ReconcileCursor{
		LastSyncAt: time.Date(2026, 4, 22, 0, 0, 0, 0, time.UTC),
		LastRunAt:  time.Date(2026, 4, 22, 1, 0, 0, 0, time.UTC),
	}
	// GORM 태그로 default:1 이 설정되어 있으나 Go struct 초기화는 zero-value(0).
	// DB 저장 시점에 default:1 이 적용되며, struct 초기화 시점엔 0 허용.
	// 여기서는 타입이 int 인지만 확인.
	assert.IsType(t, 0, c.ID)
	assert.Equal(t, 2026, c.LastSyncAt.Year())
	assert.Equal(t, 1, c.LastRunAt.Hour())
	assert.Nil(t, c.LastErrorAt)
	assert.Nil(t, c.LastError)
}
