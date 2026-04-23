package lockout

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func newTestGuard(t *testing.T) (*Guard, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	g := NewGuard(rdb, 5, 15*time.Minute)
	return g, mr
}

func TestGuard_IncrementSerial_ThresholdReached_Blocks(t *testing.T) {
	g, _ := newTestGuard(t)
	ctx := context.Background()
	serial := "SEED-10K1-AAAA-BBBB-CCCC"

	for i := 1; i <= 4; i++ {
		blocked, err := g.RegisterSerialFailure(ctx, serial)
		require.NoError(t, err)
		require.False(t, blocked, "should not block before threshold, i=%d", i)
	}
	blocked, err := g.RegisterSerialFailure(ctx, serial)
	require.NoError(t, err)
	require.True(t, blocked, "5th failure should block")

	isBlocked, err := g.IsSerialBlocked(ctx, serial)
	require.NoError(t, err)
	require.True(t, isBlocked)
}

func TestGuard_IncrementIP_IndependentFromSerial(t *testing.T) {
	g, _ := newTestGuard(t)
	ctx := context.Background()
	ip := "203.0.113.9"

	for i := 1; i <= 5; i++ {
		_, err := g.RegisterIPFailure(ctx, ip)
		require.NoError(t, err)
	}
	blocked, err := g.IsIPBlocked(ctx, ip)
	require.NoError(t, err)
	require.True(t, blocked)

	// Unrelated serial should NOT be blocked.
	serialBlocked, err := g.IsSerialBlocked(ctx, "SEED-100K-WWWW-XXXX-YYYY")
	require.NoError(t, err)
	require.False(t, serialBlocked)
}

func TestGuard_FailOpen_WhenRedisDown(t *testing.T) {
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1"}) // unreachable
	g := NewGuard(rdb, 5, 15*time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	blocked, err := g.IsSerialBlocked(ctx, "SEED-X-1-2-3")
	require.NoError(t, err)
	require.False(t, blocked, "fail-open: redis down means 'not blocked'")

	blockedAfterRegister, err := g.RegisterSerialFailure(ctx, "SEED-X-1-2-3")
	require.NoError(t, err)
	require.False(t, blockedAfterRegister, "fail-open: register under redis outage reports 'not blocked'")
}
