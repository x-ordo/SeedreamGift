package resilience

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// HTTPClientConfig는 Bulkhead 패턴 적용을 위한 HTTP 클라이언트 설정입니다.
// 각 외부 서비스마다 독립된 커넥션 풀을 가져 한 서비스 장애가 다른 서비스에 영향을 주지 않습니다.
type HTTPClientConfig struct {
	// Name은 클라이언트 식별자입니다.
	Name string
	// MaxConnsPerHost는 대상 호스트당 최대 동시 연결 수입니다 (Bulkhead 크기).
	MaxConnsPerHost int
	// MaxIdleConns는 유휴 상태로 풀에 보관할 최대 연결 수입니다. 기본값은 MaxConnsPerHost와 동일.
	MaxIdleConns int
	// Timeout은 전체 요청 타임아웃입니다.
	Timeout time.Duration
	// IdleConnTimeout은 유휴 연결을 풀에서 제거하기 전 대기 시간입니다. 기본값 90s.
	IdleConnTimeout time.Duration
}

// HTTPClientPool은 외부 서비스별 독립된 http.Client 인스턴스를 관리합니다.
// 각 클라이언트는 전용 Transport를 가지므로 커넥션 풀이 서비스 간에 공유되지 않습니다.
type HTTPClientPool struct {
	clients map[string]*http.Client
	mu      sync.RWMutex
}

// NewHTTPClientPool은 새로운 HTTPClientPool을 생성합니다.
func NewHTTPClientPool() *HTTPClientPool {
	return &HTTPClientPool{
		clients: make(map[string]*http.Client),
	}
}

// Register는 주어진 설정으로 전용 http.Client를 생성하여 등록하고 반환합니다.
func (p *HTTPClientPool) Register(cfg HTTPClientConfig) *http.Client {
	if cfg.MaxIdleConns == 0 {
		cfg.MaxIdleConns = cfg.MaxConnsPerHost
	}
	if cfg.IdleConnTimeout == 0 {
		cfg.IdleConnTimeout = 90 * time.Second
	}

	transport := &http.Transport{
		MaxConnsPerHost:     cfg.MaxConnsPerHost,
		MaxIdleConns:        cfg.MaxIdleConns,
		MaxIdleConnsPerHost: cfg.MaxIdleConns,
		IdleConnTimeout:     cfg.IdleConnTimeout,
		DialContext: (&net.Dialer{
			Timeout:   5 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout: 5 * time.Second,
	}

	client := &http.Client{
		Timeout:   cfg.Timeout,
		Transport: transport,
	}

	p.mu.Lock()
	p.clients[cfg.Name] = client
	p.mu.Unlock()

	return client
}

// Get은 등록된 http.Client를 이름으로 조회합니다. 없으면 nil을 반환합니다.
func (p *HTTPClientPool) Get(name string) *http.Client {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.clients[name]
}
