// Package resilience는 외부 API 호출을 위한 Circuit Breaker와 Bulkhead 패턴을 제공합니다.
// sony/gobreaker v2 제네릭 API를 사용하여 각 외부 서비스별 독립된 CB 인스턴스를 관리합니다.
package resilience

import (
	"fmt"
	"sync"
	"time"

	"github.com/sony/gobreaker/v2"
	"go.uber.org/zap"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/telegram"
)

// CBConfig는 Circuit Breaker 인스턴스 생성에 필요한 설정을 담습니다.
type CBConfig struct {
	// Name은 CB 식별자입니다. 로그 및 텔레그램 알림에 표시됩니다.
	Name string
	// MaxRequests는 Half-Open 상태에서 허용할 최대 시험 요청 수입니다. 기본값 1.
	MaxRequests uint32
	// Interval은 Closed 상태에서 카운터를 초기화하는 주기입니다. 0이면 초기화하지 않습니다.
	Interval time.Duration
	// Timeout은 Open 상태 유지 시간으로, 이후 Half-Open으로 전환됩니다. 기본값 30s.
	Timeout time.Duration
	// FailThreshold는 Open 상태로 전환되는 연속 실패 횟수 임계값입니다. 기본값 5.
	FailThreshold uint32
}

// CBRegistry는 서비스별 Circuit Breaker 인스턴스를 생성하고 관리합니다.
// 멀티 고루틴 환경에서 안전하게 등록/조회할 수 있습니다.
type CBRegistry struct {
	breakers   map[string]*gobreaker.CircuitBreaker[[]byte]
	mu         sync.RWMutex
	teleToken  string
	teleChatID string
}

// NewCBRegistry는 새로운 CBRegistry를 생성합니다.
// telegramToken과 telegramChatID는 선택사항입니다. 빈 문자열이면 알림을 발송하지 않습니다.
func NewCBRegistry(telegramToken, telegramChatID string) *CBRegistry {
	return &CBRegistry{
		breakers:   make(map[string]*gobreaker.CircuitBreaker[[]byte]),
		teleToken:  telegramToken,
		teleChatID: telegramChatID,
	}
}

// Register는 주어진 설정으로 새로운 Circuit Breaker를 등록하고 반환합니다.
// 동일한 Name으로 중복 등록하면 기존 인스턴스를 덮어씁니다.
func (r *CBRegistry) Register(cfg CBConfig) *gobreaker.CircuitBreaker[[]byte] {
	if cfg.MaxRequests == 0 {
		cfg.MaxRequests = 1
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 30 * time.Second
	}
	if cfg.FailThreshold == 0 {
		cfg.FailThreshold = 5
	}

	// 클로저에서 cfg를 캡처하기 위해 로컬 복사본 사용
	capturedCfg := cfg

	settings := gobreaker.Settings{
		Name:        cfg.Name,
		MaxRequests: cfg.MaxRequests,
		Interval:    cfg.Interval,
		Timeout:     cfg.Timeout,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= capturedCfg.FailThreshold
		},
		OnStateChange: func(name string, from, to gobreaker.State) {
			logger.Log.Warn("Circuit Breaker 상태 변경",
				zap.String("name", name),
				zap.String("from", from.String()),
				zap.String("to", to.String()),
			)
			if to == gobreaker.StateOpen && r.teleToken != "" {
				go telegram.SendAlert(r.teleToken, r.teleChatID,
					fmt.Sprintf("🔴 Circuit Breaker OPEN: %s\n연속 %d회 실패로 차단됨 (%.0f초 후 재시도)",
						name, capturedCfg.FailThreshold, capturedCfg.Timeout.Seconds()))
			}
			if to == gobreaker.StateClosed && from == gobreaker.StateHalfOpen && r.teleToken != "" {
				go telegram.SendAlert(r.teleToken, r.teleChatID,
					fmt.Sprintf("🟢 Circuit Breaker CLOSED: %s\n서비스 정상 복구됨", name))
			}
		},
	}

	cb := gobreaker.NewCircuitBreaker[[]byte](settings)

	r.mu.Lock()
	r.breakers[cfg.Name] = cb
	r.mu.Unlock()

	return cb
}

// Get은 등록된 Circuit Breaker를 이름으로 조회합니다. 없으면 nil을 반환합니다.
func (r *CBRegistry) Get(name string) *gobreaker.CircuitBreaker[[]byte] {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.breakers[name]
}

// States는 현재 등록된 모든 Circuit Breaker의 상태를 맵으로 반환합니다.
// 헬스체크 엔드포인트나 모니터링 대시보드에서 활용합니다.
func (r *CBRegistry) States() map[string]string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	states := make(map[string]string, len(r.breakers))
	for name, cb := range r.breakers {
		states[name] = cb.State().String()
	}
	return states
}
