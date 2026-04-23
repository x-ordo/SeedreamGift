// Package lockout provides a Redis-backed counter+block primitive for
// throttling abusive authentication attempts. It fails open under Redis
// outages — availability is preferred over defense-in-depth when downstream
// systems (payment, notifications) can't recover from a hard block.
package lockout

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Guard tracks failure counts keyed by an identifier (serial or IP). Once the
// count exceeds a threshold within the TTL window, the key is considered
// "blocked" and a separate block marker is set for the same TTL.
//
// Redis failures are treated as "no lockout applies" (fail-open). Callers
// receiving a nil error + false are safe to proceed even when Redis is down.
type Guard struct {
	rdb       *redis.Client
	threshold int
	ttl       time.Duration
}

// NewGuard constructs a Guard. threshold is the attempt count at which
// the block kicks in (e.g., 5). ttl is how long counters and block markers
// live (e.g., 15 minutes).
func NewGuard(rdb *redis.Client, threshold int, ttl time.Duration) *Guard {
	return &Guard{rdb: rdb, threshold: threshold, ttl: ttl}
}

// RegisterSerialFailure increments the failure counter for a SerialNo and
// returns true iff this failure pushes the count past the threshold.
func (g *Guard) RegisterSerialFailure(ctx context.Context, serial string) (bool, error) {
	return g.registerFailure(ctx,
		fmt.Sprintf("seedreampay:lockout:serial:%s", serial),
		fmt.Sprintf("seedreampay:lockout:block:serial:%s", serial),
	)
}

// RegisterIPFailure increments the failure counter for a client IP.
func (g *Guard) RegisterIPFailure(ctx context.Context, ip string) (bool, error) {
	return g.registerFailure(ctx,
		fmt.Sprintf("seedreampay:lockout:ip:%s", ip),
		fmt.Sprintf("seedreampay:lockout:block:ip:%s", ip),
	)
}

// IsSerialBlocked reports whether a SerialNo is currently locked out.
func (g *Guard) IsSerialBlocked(ctx context.Context, serial string) (bool, error) {
	return g.isBlocked(ctx, fmt.Sprintf("seedreampay:lockout:block:serial:%s", serial))
}

// IsIPBlocked reports whether a client IP is currently locked out.
func (g *Guard) IsIPBlocked(ctx context.Context, ip string) (bool, error) {
	return g.isBlocked(ctx, fmt.Sprintf("seedreampay:lockout:block:ip:%s", ip))
}

func (g *Guard) registerFailure(ctx context.Context, counterKey, blockKey string) (bool, error) {
	n, err := g.rdb.Incr(ctx, counterKey).Result()
	if err != nil {
		// fail-open: treat redis outage as "not blocked"
		return false, nil
	}
	// INCR does not reset TTL, so set it once on first increment.
	if n == 1 {
		_ = g.rdb.Expire(ctx, counterKey, g.ttl).Err()
	}
	if int(n) >= g.threshold {
		_ = g.rdb.Set(ctx, blockKey, 1, g.ttl).Err()
		return true, nil
	}
	return false, nil
}

func (g *Guard) isBlocked(ctx context.Context, blockKey string) (bool, error) {
	n, err := g.rdb.Exists(ctx, blockKey).Result()
	if err != nil {
		// fail-open
		return false, nil
	}
	return n > 0, nil
}
