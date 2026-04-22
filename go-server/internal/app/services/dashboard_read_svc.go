package services

import (
	"sync"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"
	"seedream-gift-server/pkg/logger"
)

// DashboardReadService는 관리자 대시보드 통계를 위한 읽기 전용 서비스입니다.
// 쓰기 부하와 격리된 캐시 기반 조회로, DB 읽기 성능에 최적화됩니다.
// CQRS 패턴에서 Read Model 역할을 담당하며, AdminStatsService(Write side)와 협력합니다.
type DashboardReadService struct {
	db       *gorm.DB
	cache    sync.Map
	cacheTTL time.Duration
}

type cacheEntry struct {
	data      interface{}
	expiresAt time.Time
}

// NewDashboardReadService는 새로운 DashboardReadService 인스턴스를 생성합니다.
// ttl이 0이면 기본값 2분을 사용합니다.
func NewDashboardReadService(db *gorm.DB, ttl time.Duration) *DashboardReadService {
	if ttl == 0 {
		ttl = 2 * time.Minute
	}
	return &DashboardReadService{db: db, cacheTTL: ttl}
}

// Get은 캐시에서 데이터를 조회합니다. 만료되었으면 nil, false를 반환합니다.
func (s *DashboardReadService) Get(key string) (interface{}, bool) {
	val, ok := s.cache.Load(key)
	if !ok {
		return nil, false
	}
	entry, ok := val.(*cacheEntry)
	if !ok {
		s.cache.Delete(key)
		return nil, false
	}
	if time.Now().After(entry.expiresAt) {
		s.cache.Delete(key)
		return nil, false
	}
	return entry.data, true
}

// Set은 캐시에 데이터를 TTL과 함께 저장합니다.
func (s *DashboardReadService) Set(key string, data interface{}) {
	s.cache.Store(key, &cacheEntry{
		data:      data,
		expiresAt: time.Now().Add(s.cacheTTL),
	})
}

// InvalidateCache는 모든 캐시 항목을 무효화합니다.
// 주문 상태 변경 등 쓰기 작업 후 호출합니다.
func (s *DashboardReadService) InvalidateCache() {
	s.cache.Range(func(key, _ interface{}) bool {
		s.cache.Delete(key)
		return true
	})
	logger.Log.Debug("DashboardReadService 캐시 전체 무효화됨")
}

// InvalidateKey는 특정 캐시 키 하나를 무효화합니다.
func (s *DashboardReadService) InvalidateKey(key string) {
	s.cache.Delete(key)
	logger.Log.Debug("DashboardReadService 캐시 키 무효화됨", zap.String("key", key))
}
