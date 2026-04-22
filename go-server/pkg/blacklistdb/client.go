// Package blacklistdb는 Blacklist-DB Partner API v3.0.0 스크리닝 클라이언트입니다.
//
// 사용 엔드포인트:
//   - POST /partner/screening/check — 블랙리스트 스크리닝 (이름+전화+계좌)
//
// 더치트 사기조회는 별도 pkg/thecheat 클라이언트에서 직접 호출합니다.
package blacklistdb

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const (
	screeningPath = "/partner/screening/check"
	searchPath    = "/partner/search"
	apiKeyHeader  = "X-API-KEY"
	partnerHeader = "X-Partner-Id"
)

// ════════════════════════════════════════════
// 스크리닝 (POST /partner/screening/check)
// ════════════════════════════════════════════

// ScreeningCandidate는 스크리닝 대상 1건의 정보입니다.
type ScreeningCandidate struct {
	RefID         string `json:"refId"`
	CandidateName string `json:"candidateName"`
	Phone         string `json:"phone"`            // 전체 전화번호 (필수)
	Account       string `json:"account,omitempty"` // 전체 계좌번호 (선택)
}

type screeningRequest struct {
	Candidates []ScreeningCandidate `json:"candidates"`
}

// ScreeningResult는 개별 후보자의 스크리닝 결과입니다.
type ScreeningResult struct {
	RefID         string `json:"refId"`
	Status        string `json:"status"`        // "BLOCKED" | "CLEARED"
	MatchCode     string `json:"matchCode"`     // 5자리 비트맵: [이름][전화][계좌][예비][예비]
	IncidentCount int    `json:"incidentCount"`
}

type screeningData struct {
	RequestID      int               `json:"requestId"`
	CandidateCount int               `json:"candidateCount"`
	BlockedCount   int               `json:"blockedCount"`
	ClearedCount   int               `json:"clearedCount"`
	Results        []ScreeningResult `json:"results"`
}

// ════════════════════════════════════════════
// 블랙리스트 간편 검색 (GET /partner/search)
// ════════════════════════════════════════════

// SearchResultItem은 블랙리스트 검색 결과 단건입니다.
type SearchResultItem struct {
	ID               int     `json:"id"`
	Name             string  `json:"name"`
	PhoneLast4       string  `json:"phoneLast4"`
	AccountLast4     *string `json:"accountLast4"`
	BankName         *string `json:"bankName"`
	IncidentAmount   *string `json:"incidentAmount"`
	IncidentCount    int     `json:"incidentCount"`
	LastIncidentDate *string `json:"lastIncidentDate"`
	RiskType         string  `json:"riskType"`
	Category         string  `json:"category"`
	CreatedAt        string  `json:"createdAt"`
	IsUnlocked       bool    `json:"isUnlocked"`
}

// BillingInfo는 요청의 과금 정보입니다.
type BillingInfo struct {
	Charged          bool    `json:"charged"`
	Deducted         float64 `json:"deducted"`
	RemainingBalance float64 `json:"remainingBalance"`
}

// SearchResponse는 블랙리스트 간편 검색 응답입니다.
type SearchResponse struct {
	Found   bool               `json:"found"`
	Results []SearchResultItem `json:"results"`
	Total   int                `json:"total"`
	Billing *BillingInfo       `json:"billing"`
}

// ════════════════════════════════════════════
// 공통 응답 envelope
// ════════════════════════════════════════════

type apiResponse struct {
	Success bool           `json:"success"`
	Data    screeningData  `json:"data"`
	Error   string         `json:"error,omitempty"`
	Code    string         `json:"code,omitempty"`
}

// ════════════════════════════════════════════
// 클라이언트
// ════════════════════════════════════════════

// Client는 Blacklist-DB Partner API 클라이언트입니다.
type Client struct {
	baseURL   string
	apiKey    string
	partnerID string
	http      *http.Client
}

// NewClient는 새로운 Blacklist-DB 클라이언트를 생성합니다.
func NewClient(baseURL, apiKey, partnerID string) *Client {
	return &Client{
		baseURL:   baseURL,
		apiKey:    apiKey,
		partnerID: partnerID,
		http:      &http.Client{Timeout: 10 * time.Second},
	}
}

// Screen은 단건 스크리닝을 수행합니다.
// candidateName, phone은 필수이며 account는 선택입니다.
func (c *Client) Screen(refID, candidateName, phone, account string) (*ScreeningResult, error) {
	candidate := ScreeningCandidate{
		RefID:         refID,
		CandidateName: candidateName,
		Phone:         phone,
		Account:       account,
	}

	reqBody := screeningRequest{Candidates: []ScreeningCandidate{candidate}}
	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("JSON 직렬화 실패: %w", err)
	}

	reqURL := c.baseURL + screeningPath
	httpReq, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("HTTP 요청 생성 실패: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json; charset=utf-8")
	httpReq.Header.Set(apiKeyHeader, c.apiKey)
	httpReq.Header.Set(partnerHeader, c.partnerID)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("HTTP 요청 실패: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("응답 읽기 실패: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, parseError(respBody, resp.StatusCode)
	}

	var apiResp apiResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("응답 파싱 실패: %w", err)
	}

	if !apiResp.Success {
		return nil, fmt.Errorf("블랙리스트 API 실패: %s (code=%s)", apiResp.Error, apiResp.Code)
	}

	if len(apiResp.Data.Results) == 0 {
		return nil, fmt.Errorf("블랙리스트 API 응답에 결과가 없습니다")
	}

	return &apiResp.Data.Results[0], nil
}

// Search는 이름 + 전화번호 뒤 4자리로 블랙리스트를 간편 검색합니다.
// Screen과 달리 전체 전화번호가 아닌 뒤 4자리만으로 조회합니다.
// 관리자 콘솔에서 고객 정보 일부만 알 때 사용합니다.
func (c *Client) Search(name, phoneLast4 string) (*SearchResponse, error) {
	reqURL := fmt.Sprintf("%s%s?name=%s&phoneLast4=%s",
		c.baseURL, searchPath, url.QueryEscape(name), url.QueryEscape(phoneLast4))

	httpReq, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("HTTP 요청 생성 실패: %w", err)
	}
	httpReq.Header.Set(apiKeyHeader, c.apiKey)
	httpReq.Header.Set(partnerHeader, c.partnerID)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("HTTP 요청 실패: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("응답 읽기 실패: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, parseError(respBody, resp.StatusCode)
	}

	var raw struct {
		Success bool           `json:"success"`
		Data    SearchResponse `json:"data"`
		Error   string         `json:"error,omitempty"`
		Code    string         `json:"code,omitempty"`
	}
	if err := json.Unmarshal(respBody, &raw); err != nil {
		return nil, fmt.Errorf("응답 파싱 실패: %w", err)
	}
	if !raw.Success {
		return nil, fmt.Errorf("블랙리스트 검색 실패: %s (code=%s)", raw.Error, raw.Code)
	}

	return &raw.Data, nil
}

// ════════════════════════════════════════════
// 유틸리티
// ════════════════════════════════════════════

// parseError는 HTTP 에러 응답을 파싱합니다.
func parseError(body []byte, statusCode int) error {
	var errResp apiResponse
	if json.Unmarshal(body, &errResp) == nil && errResp.Error != "" {
		return fmt.Errorf("블랙리스트 API 오류 (HTTP %d, code=%s): %s",
			statusCode, errResp.Code, errResp.Error)
	}
	return fmt.Errorf("블랙리스트 API HTTP %d 오류", statusCode)
}

// IsNameBasedBlock은 matchCode를 해석하여 이름 기반 매칭인지 판별합니다.
func IsNameBasedBlock(matchCode string) bool {
	if len(matchCode) < 3 {
		return false
	}
	nameMatch := matchCode[0] == '1'
	phoneMatch := matchCode[1] == '1'
	accountMatch := matchCode[2] == '1'
	return nameMatch && (phoneMatch || accountMatch)
}
