package popbill

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/pkg/logger"

	"github.com/sony/gobreaker/v2"
	"go.uber.org/zap"
)

const (
	prodBaseURL = "https://popbill.linkhub.co.kr"
	testBaseURL = "https://popbill-test.linkhub.co.kr"
	authURL     = "https://auth.linkhub.co.kr"
	testAuthURL = "https://auth-test.linkhub.co.kr"
	scope       = "141"
)

type Config struct {
	LinkID    string
	SecretKey string
	CorpNum   string
	IsTest    bool
}

type Client struct {
	cfg        Config
	httpClient *http.Client
	cb         *gobreaker.CircuitBreaker[[]byte]
	token      *TokenResponse
	tokenMu    sync.RWMutex
}

// NewClient는 새로운 Popbill Client를 생성합니다.
// cb는 외부에서 주입되는 Circuit Breaker입니다. nil이면 CB 없이 동작합니다.
func NewClient(cfg Config, cb *gobreaker.CircuitBreaker[[]byte]) *Client {
	return &Client{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		cb:         cb,
	}
}

func (c *Client) baseURL() string {
	if c.cfg.IsTest {
		return testBaseURL
	}
	return prodBaseURL
}

func (c *Client) authBaseURL() string {
	if c.cfg.IsTest {
		return testAuthURL
	}
	return authURL
}

// getToken gets or refreshes the Popbill auth token with double-check locking.
func (c *Client) getToken() (string, error) {
	c.tokenMu.RLock()
	if c.token != nil && c.token.Expires > time.Now().Unix()+60 {
		token := c.token.SessionToken
		c.tokenMu.RUnlock()
		return token, nil
	}
	c.tokenMu.RUnlock()

	c.tokenMu.Lock()
	defer c.tokenMu.Unlock()

	if c.token != nil && c.token.Expires > time.Now().Unix()+60 {
		return c.token.SessionToken, nil
	}

	url := fmt.Sprintf("%s/CASHBILL/Token?access_id=%s&scope=%s",
		c.authBaseURL(), c.cfg.LinkID, scope)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("토큰 요청 생성 실패: %w", err)
	}
	req.Header.Set("x-pb-userid", c.cfg.LinkID)
	req.Header.Set("x-lh-forwarded", c.cfg.SecretKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("토큰 요청 실패: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("토큰 응답 오류 (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", fmt.Errorf("토큰 응답 파싱 실패: %w", err)
	}

	c.token = &tokenResp
	return tokenResp.SessionToken, nil
}

// doRequest sends an authenticated request to the Popbill API.
// Circuit Breaker가 등록된 경우 500대 서버 에러와 네트워크 에러만 CB 실패로 카운트합니다.
// 팝빌 비즈니스 에러(PopbillError)는 CB 성공으로 처리됩니다.
func (c *Client) doRequest(method, path string, body any) ([]byte, error) {
	token, err := c.getToken()
	if err != nil {
		return nil, err
	}

	var reqBodyBytes []byte
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("요청 바디 직렬화 실패: %w", err)
		}
		reqBodyBytes = b
	}

	execute := func() ([]byte, error) {
		var reqBody io.Reader
		if reqBodyBytes != nil {
			reqBody = bytes.NewReader(reqBodyBytes)
		}

		pbURL := fmt.Sprintf("%s/CashBill/%s/%s", c.baseURL(), c.cfg.CorpNum, path)
		req, err := http.NewRequest(method, pbURL, reqBody)
		if err != nil {
			return nil, fmt.Errorf("HTTP 요청 생성 실패: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json; charset=utf-8")
		req.Header.Set("x-pb-userid", c.cfg.LinkID)

		resp, err := c.httpClient.Do(req)
		if err != nil {
			// 네트워크 에러 → CB 실패 카운트
			return nil, fmt.Errorf("팝빌 API 호출 실패: %w", err)
		}
		defer resp.Body.Close()

		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("응답 읽기 실패: %w", err)
		}

		// 500대 서버 에러 → CB 실패 카운트
		if resp.StatusCode >= 500 {
			return nil, fmt.Errorf("팝빌 서버 에러 (HTTP %d): %s", resp.StatusCode, string(respBody))
		}

		// 팝빌 비즈니스 에러(400대 포함)는 CB 성공으로 처리
		if resp.StatusCode != http.StatusOK {
			var pbErr PopbillError
			if json.Unmarshal(respBody, &pbErr) == nil && pbErr.Code != 0 {
				return nil, &pbErr
			}
			return nil, fmt.Errorf("팝빌 API 오류 (HTTP %d): %s", resp.StatusCode, string(respBody))
		}

		return respBody, nil
	}

	if c.cb != nil {
		return c.cb.Execute(execute)
	}
	return execute()
}

// Issue는 현금영수증을 즉시 발급합니다.
func (c *Client) Issue(req interfaces.CashReceiptIssueRequest) (*interfaces.CashReceiptIssueResponse, error) {
	body := map[string]any{
		"MgtKey":          req.MgtKey,
		"TradeType":       req.TradeType,
		"IdentityNum":     req.IdentityNum,
		"ItemName":        req.ItemName,
		"SupplyCostTotal": req.SupplyAmount,
		"TaxTotal":        req.TaxAmount,
		"TotalAmount":     req.TotalAmount,
		"TradeUsage":      req.TradeUsage,
		"TradeOpt":        req.TradeOpt,
	}

	respBody, err := c.doRequest("POST", "RegistIssue", body)
	if err != nil {
		logger.Log.Error("팝빌 현금영수증 발급 실패", zap.String("mgtKey", req.MgtKey), zap.Error(err))
		return &interfaces.CashReceiptIssueResponse{Success: false}, err
	}

	var result RegistIssueResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("발급 응답 파싱 실패: %w", err)
	}

	logger.Log.Info("팝빌 현금영수증 발급 성공", zap.String("mgtKey", req.MgtKey), zap.String("confirmNum", result.ConfirmNum))

	return &interfaces.CashReceiptIssueResponse{
		Success:    true,
		ConfirmNum: result.ConfirmNum,
		TradeDate:  result.TradeDate,
	}, nil
}

// Cancel은 현금영수증을 취소합니다.
func (c *Client) Cancel(req interfaces.CashReceiptCancelRequest) (*interfaces.CashReceiptCancelResponse, error) {
	body := map[string]any{
		"MgtKey":          req.MgtKey,
		"OrgConfirmNum":   req.OrgConfirmNum,
		"OrgTradeDate":    req.OrgTradeDate,
		"SupplyCostTotal": req.SupplyAmount,
		"TaxTotal":        req.TaxAmount,
		"TotalAmount":     req.TotalAmount,
		"CancelType":      1,
		"Memo":            req.CancelReason,
	}

	respBody, err := c.doRequest("POST", "RegistIssue", body)
	if err != nil {
		logger.Log.Error("팝빌 현금영수증 취소 실패", zap.String("mgtKey", req.MgtKey), zap.Error(err))
		return &interfaces.CashReceiptCancelResponse{Success: false}, err
	}

	var result RegistIssueResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("취소 응답 파싱 실패: %w", err)
	}

	return &interfaces.CashReceiptCancelResponse{
		Success:    true,
		ConfirmNum: result.ConfirmNum,
		TradeDate:  result.TradeDate,
	}, nil
}

// GetInfo는 현금영수증 상태를 조회합니다.
func (c *Client) GetInfo(mgtKey string) (*interfaces.CashReceiptInfo, error) {
	respBody, err := c.doRequest("GET", mgtKey, nil)
	if err != nil {
		return nil, err
	}

	var info interfaces.CashReceiptInfo
	if err := json.Unmarshal(respBody, &info); err != nil {
		return nil, fmt.Errorf("상태 조회 파싱 실패: %w", err)
	}
	info.MgtKey = mgtKey
	return &info, nil
}

// UpdateTransaction은 현금영수증의 식별번호 또는 용도를 수정합니다.
func (c *Client) UpdateTransaction(mgtKey string, identityNum string, tradeUsage string) error {
	body := map[string]any{
		"IdentityNum": identityNum,
		"TradeUsage":  tradeUsage,
	}
	_, err := c.doRequest("PATCH", mgtKey, body)
	return err
}
