// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// config_cache.go는 SiteConfig 테이블에 대한 인메모리 캐시를 제공합니다.
// 여러 서비스에서 반복적으로 조회하는 설정값을 TTL 기반으로 캐싱하여 DB 부하를 줄입니다.
package services

import (
	"strconv"
	"sync"
	"time"
	"seedream-gift-server/internal/domain"

	"gorm.io/gorm"
)

// ConfigProvider는 SiteConfig 값을 조회하는 인터페이스입니다.
// 캐시 구현체를 사용하면 반복적인 DB 조회를 최소화합니다.
type ConfigProvider interface {
	GetConfig(key string) (*domain.SiteConfig, error)
	GetConfigValue(key string, defaultVal string) string
	GetConfigFloat(key string, defaultVal float64) float64
	GetConfigInt(key string, defaultVal int) int
	Invalidate(key string)
	InvalidateAll()
}

// cachedEntry는 캐시에 저장되는 SiteConfig 항목과 조회 시각입니다.
type cachedEntry struct {
	config    *domain.SiteConfig
	fetchedAt time.Time
}

// CachedConfigProvider는 TTL 기반 인메모리 캐시로 SiteConfig 조회를 최적화합니다.
// 동시성 안전(goroutine-safe)하며, RWMutex를 사용하여 읽기 성능을 보장합니다.
type CachedConfigProvider struct {
	db    *gorm.DB
	mu    sync.RWMutex
	cache map[string]cachedEntry
	ttl   time.Duration
}

// NewCachedConfigProvider는 새로운 CachedConfigProvider를 생성합니다.
// ttl은 캐시 항목의 유효 기간입니다.
func NewCachedConfigProvider(db *gorm.DB, ttl time.Duration) *CachedConfigProvider {
	return &CachedConfigProvider{
		db:    db,
		cache: make(map[string]cachedEntry),
		ttl:   ttl,
	}
}

// GetConfig는 SiteConfig를 캐시에서 조회합니다. 캐시 미스 또는 TTL 만료 시 DB에서 가져옵니다.
func (p *CachedConfigProvider) GetConfig(key string) (*domain.SiteConfig, error) {
	// 1. Read lock으로 캐시 확인
	p.mu.RLock()
	if entry, ok := p.cache[key]; ok && time.Since(entry.fetchedAt) < p.ttl {
		p.mu.RUnlock()
		return entry.config, nil
	}
	p.mu.RUnlock()

	// 2. Cache miss → DB 조회
	var cfg domain.SiteConfig
	if err := p.db.Where("[Key] = ?", key).First(&cfg).Error; err != nil {
		return nil, err
	}

	// 3. Write lock으로 캐시 저장
	p.mu.Lock()
	p.cache[key] = cachedEntry{config: &cfg, fetchedAt: time.Now()}
	p.mu.Unlock()

	return &cfg, nil
}

// GetConfigValue는 SiteConfig의 문자열 값을 반환합니다. 조회 실패 시 기본값을 반환합니다.
func (p *CachedConfigProvider) GetConfigValue(key string, defaultVal string) string {
	cfg, err := p.GetConfig(key)
	if err != nil || cfg.Value == "" {
		return defaultVal
	}
	return cfg.Value
}

// GetConfigFloat는 SiteConfig 값을 float64로 파싱하여 반환합니다.
// 조회 실패 또는 파싱 실패 시 기본값을 반환합니다.
func (p *CachedConfigProvider) GetConfigFloat(key string, defaultVal float64) float64 {
	cfg, err := p.GetConfig(key)
	if err != nil || cfg.Value == "" {
		return defaultVal
	}
	if v, err := strconv.ParseFloat(cfg.Value, 64); err == nil && v > 0 {
		return v
	}
	return defaultVal
}

// GetConfigInt는 SiteConfig 값을 int로 파싱하여 반환합니다.
// 조회 실패 또는 파싱 실패 시 기본값을 반환합니다.
func (p *CachedConfigProvider) GetConfigInt(key string, defaultVal int) int {
	cfg, err := p.GetConfig(key)
	if err != nil || cfg.Value == "" {
		return defaultVal
	}
	if v, err := strconv.Atoi(cfg.Value); err == nil {
		return v
	}
	return defaultVal
}

// Invalidate는 특정 키의 캐시를 무효화합니다. 설정 업데이트 후 호출해야 합니다.
func (p *CachedConfigProvider) Invalidate(key string) {
	p.mu.Lock()
	delete(p.cache, key)
	p.mu.Unlock()
}

// InvalidateAll은 전체 캐시를 초기화합니다.
func (p *CachedConfigProvider) InvalidateAll() {
	p.mu.Lock()
	p.cache = make(map[string]cachedEntry)
	p.mu.Unlock()
}
