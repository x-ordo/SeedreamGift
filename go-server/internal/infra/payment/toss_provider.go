// Package payment는 다양한 결제 게이트웨이(PG) 연동 구현체를 포함합니다.
package payment

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
	"seedream-gift-server/internal/app/interfaces"

	"github.com/sony/gobreaker/v2"
)

// TossPaymentProvider는 토스페이먼츠(Toss Payments) API를 사용한 결제 처리 구현체입니다.
type TossPaymentProvider struct {
	secretKey  string
	httpClient *http.Client
	cb         *gobreaker.CircuitBreaker[[]byte]
}

// NewTossPaymentProvider는 새로운 TossPaymentProvider 인스턴스를 생성합니다.
// httpClient와 cb는 외부에서 주입됩니다 (Bulkhead + Circuit Breaker 패턴).
// nil을 전달하면 기본값으로 초기화됩니다.
func NewTossPaymentProvider(secretKey string, httpClient *http.Client, cb *gobreaker.CircuitBreaker[[]byte]) *TossPaymentProvider {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}
	return &TossPaymentProvider{
		secretKey:  secretKey,
		httpClient: httpClient,
		cb:         cb,
	}
}

// VerifyPayment는 토스페이먼츠의 결제 승인 API를 호출하여 최종적으로 결제를 확정합니다.
// Circuit Breaker가 등록된 경우 500대 서버 에러와 네트워크 에러만 CB 실패로 카운트합니다.
// 성공 시 결제 수단, 거래 키 등의 상세 정보를 반환합니다.
func (p *TossPaymentProvider) VerifyPayment(paymentKey string, orderID int, expectedAmount float64) (*interfaces.PaymentVerifyResult, error) {
	tossURL := "https://api.tosspayments.com/v1/payments/confirm"
	payload := map[string]any{
		"paymentKey": paymentKey,
		"orderId":    fmt.Sprintf("ORDER_%d", orderID),
		"amount":     expectedAmount,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payment payload: %w", err)
	}

	body, err := p.doRequest("POST", tossURL, jsonPayload)
	if err != nil {
		return nil, err
	}

	var successRes map[string]any
	if err := json.Unmarshal(body, &successRes); err != nil {
		return nil, fmt.Errorf("failed to decode toss response: %w", err)
	}

	method, _ := successRes["method"].(string)

	return &interfaces.PaymentVerifyResult{
		Success:    true,
		PaymentKey: paymentKey,
		OrderID:    orderID,
		Amount:     expectedAmount,
		Method:     method,
	}, nil
}

// RefundPayment는 토스페이먼츠 API를 통해 결제 취소(환불)를 요청합니다.
// Circuit Breaker가 등록된 경우 500대 서버 에러와 네트워크 에러만 CB 실패로 카운트합니다.
func (p *TossPaymentProvider) RefundPayment(paymentKey string, reason string) (*interfaces.PaymentRefundResult, error) {
	tossURL := fmt.Sprintf("https://api.tosspayments.com/v1/payments/%s/cancel", paymentKey)
	payload := map[string]any{"cancelReason": reason}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal refund payload: %w", err)
	}

	_, err = p.doRequest("POST", tossURL, jsonPayload)
	if err != nil {
		return nil, err
	}

	return &interfaces.PaymentRefundResult{Success: true}, nil
}

// doRequest는 토스페이먼츠 API에 인증 헤더를 포함하여 HTTP 요청을 보냅니다.
// Circuit Breaker가 등록된 경우 Execute로 래핑되며, 500대 에러와 네트워크 에러만 CB 실패로 카운트합니다.
func (p *TossPaymentProvider) doRequest(method, tossURL string, jsonPayload []byte) ([]byte, error) {
	execute := func() ([]byte, error) {
		req, err := http.NewRequest(method, tossURL, bytes.NewBuffer(jsonPayload))
		if err != nil {
			return nil, fmt.Errorf("failed to create toss request: %w", err)
		}
		req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(p.secretKey+":")))
		req.Header.Set("Content-Type", "application/json")

		resp, err := p.httpClient.Do(req)
		if err != nil {
			// 네트워크 에러 → CB 실패 카운트
			return nil, err
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read toss response body: %w", err)
		}

		// 500대 서버 에러 → CB 실패 카운트
		if resp.StatusCode >= 500 {
			return nil, fmt.Errorf("toss server error: status %d", resp.StatusCode)
		}

		// 400대 에러는 CB 성공으로 처리 (비즈니스 에러)
		if resp.StatusCode != http.StatusOK {
			var errorRes map[string]any
			if decErr := json.Unmarshal(body, &errorRes); decErr != nil {
				return nil, fmt.Errorf("toss error: status %d", resp.StatusCode)
			}
			return nil, fmt.Errorf("toss error: %v", errorRes)
		}

		return body, nil
	}

	if p.cb != nil {
		return p.cb.Execute(execute)
	}
	return execute()
}
