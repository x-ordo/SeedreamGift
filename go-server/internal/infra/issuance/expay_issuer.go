package issuance

import (
	"context"
	"fmt"
	"net/http"
	"time"
	"w-gift-server/internal/app/interfaces"

	"github.com/sony/gobreaker/v2"
)

// EXPayIssuer는 이엑스페이(EXPay) 상품권 발급 API 구현체입니다.
// API 스펙 수신 후 Issue 메서드를 구현합니다.
type EXPayIssuer struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	cb         *gobreaker.CircuitBreaker[[]byte]
}

// NewEXPayIssuer는 새로운 EXPayIssuer를 생성합니다.
// httpClient와 cb는 외부에서 주입됩니다 (Bulkhead + Circuit Breaker 패턴).
// nil을 전달하면 기본값으로 초기화됩니다.
func NewEXPayIssuer(baseURL, apiKey string, httpClient *http.Client, cb *gobreaker.CircuitBreaker[[]byte]) *EXPayIssuer {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}
	return &EXPayIssuer{
		baseURL:    baseURL,
		apiKey:     apiKey,
		httpClient: httpClient,
		cb:         cb,
	}
}

func (e *EXPayIssuer) Issue(ctx context.Context, req interfaces.IssueRequest) ([]interfaces.IssuedVoucher, error) {
	// TODO: API 스펙 수신 후 구현
	// CB가 등록된 경우 Execute로 래핑합니다.
	// 500대 서버 에러와 네트워크 에러만 CB 실패로 카운트하고, 400대 비즈니스 에러는 제외합니다.
	if e.cb != nil {
		_, err := e.cb.Execute(func() ([]byte, error) {
			// TODO: 실제 HTTP 호출 구현
			// resp, err := e.httpClient.Do(httpReq)
			// if err != nil { return nil, err }
			// if resp.StatusCode >= 500 { return body, fmt.Errorf("server error: %d", resp.StatusCode) }
			// return body, nil
			return nil, fmt.Errorf("EXPay API 스펙 미확정 — 구현 대기")
		})
		if err != nil {
			return nil, err
		}
		return nil, nil
	}
	return nil, fmt.Errorf("EXPay API 스펙 미확정 — 구현 대기")
}

func (e *EXPayIssuer) ProviderCode() string { return "EXPAY" }
