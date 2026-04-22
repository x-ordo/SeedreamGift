# 더치트(TheCheat) 사기 조회 연동 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 더치트 API를 연동하여 주문/매입 시 사기 피해사례 등록 사용자를 자동 보류(FRAUD_HOLD)하고, 관리자가 수동 조회/해제할 수 있는 기능 구현

**Architecture:** `pkg/thecheat`에 순수 HTTP 클라이언트를 두고, `internal/app/services/fraud_check_svc.go`에서 캐싱·마스킹·로그 기록 비즈니스 로직을 처리. FraudChecker 인터페이스를 통해 OrderService/TradeInService에 DI 주입하여 거래 시 자동 검사. 관리자 API는 별도 핸들러로 실시간 조회 및 FRAUD_HOLD 해제 기능 제공.

**Tech Stack:** Go (Gin), GORM (MSSQL), AES-256-CBC (더치트 자체 암복호화), 텔레그램 알림

**Spec:** `docs/superpowers/specs/2026-03-27-fraud-check-thecheat-design.md`

---

### Task 1: 환경설정 — Config 확장

**Files:**
- Modify: `go-server/internal/config/config.go`

- [ ] **Step 1: Config 구조체에 더치트 필드 추가**

`go-server/internal/config/config.go`의 Config 구조체에 `// ─── 관리자 알림 ───` 섹션 바로 아래(AdminNotifyEmail 필드 다음)에 추가:

```go
	// ─── 더치트 (사기 조회) ───

	// TheCheatAPIKey는 더치트 API 인증 키입니다.
	TheCheatAPIKey string `mapstructure:"THECHEAT_API_KEY"`
	// TheCheatEncKey는 더치트 AES-256-CBC 암복호화 키 (32바이트 문자열)입니다.
	TheCheatEncKey string `mapstructure:"THECHEAT_ENC_KEY"`
	// TheCheatEnabled는 더치트 사기 조회 기능의 활성화 여부입니다.
	TheCheatEnabled bool `mapstructure:"THECHEAT_ENABLED"`
	// TheCheatCacheTTL은 사기 조회 결과 캐시 유효 기간입니다.
	TheCheatCacheTTL time.Duration `mapstructure:"THECHEAT_CACHE_TTL"`
```

- [ ] **Step 2: 기본값 추가**

같은 파일의 `LoadConfig` 함수에서 `viper.SetDefault("ADMIN_NOTIFY_EMAIL", ...)` 아래에 추가:

```go
	// 더치트 (사기 조회) 기본 설정
	viper.SetDefault("THECHEAT_API_KEY", "")
	viper.SetDefault("THECHEAT_ENC_KEY", "")
	viper.SetDefault("THECHEAT_ENABLED", false)
	viper.SetDefault("THECHEAT_CACHE_TTL", "24h")
```

- [ ] **Step 3: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 컴파일 성공

- [ ] **Step 4: 커밋**

```bash
cd go-server
git add internal/config/config.go
git commit -m "feat: add TheCheat fraud check config fields"
```

---

### Task 2: 도메인 모델 — FraudCheckLog

**Files:**
- Create: `go-server/internal/domain/fraud.go`

- [ ] **Step 1: FraudCheckLog 모델 작성**

```go
package domain

import "time"

// FraudCheckLog는 더치트 API를 통한 사기 피해사례 조회 기록을 저장합니다.
// 캐시(24시간)와 감사 로그를 겸합니다.
type FraudCheckLog struct {
	ID          int       `gorm:"primaryKey;column:Id" json:"id"`
	UserID      int       `gorm:"column:UserId;index" json:"userId"`
	Keyword     string    `gorm:"column:Keyword;size:100" json:"keyword"`         // 마스킹된 값 (010****0000)
	KeywordType string    `gorm:"column:KeywordType;size:10" json:"keywordType"`  // "phone" | "account"
	BankCode    *string   `gorm:"column:BankCode;size:4" json:"bankCode"`
	Caution     string    `gorm:"column:Caution;size:1" json:"caution"`           // "Y" | "N"
	KeywordURL  *string   `gorm:"column:KeywordUrl;size:500" json:"keywordUrl"`
	Source      string    `gorm:"column:Source;size:15" json:"source"`            // "ORDER" | "TRADEIN" | "ADMIN"
	SourceID    *int      `gorm:"column:SourceId" json:"sourceId"`
	ExpiresAt   time.Time `gorm:"column:ExpiresAt;index" json:"expiresAt"`
	CreatedAt   time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
}

func (FraudCheckLog) TableName() string { return "FraudCheckLogs" }
```

- [ ] **Step 2: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 컴파일 성공

- [ ] **Step 3: 커밋**

```bash
cd go-server
git add internal/domain/fraud.go
git commit -m "feat: add FraudCheckLog domain model"
```

---

### Task 3: DB 마이그레이션 스크립트

**Files:**
- Create: `go-server/cmd/migrate_fraud_check/main.go`

기존 `cmd/migrate_ip_whitelist/main.go` 패턴을 따라 독립 마이그레이션 도구를 작성합니다.

- [ ] **Step 1: 마이그레이션 도구 작성**

```go
package main

import (
	"fmt"
	"os"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/logger"

	"go.uber.org/zap"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

func main() {
	logger.Log, _ = zap.NewDevelopment()

	cfg, err := config.LoadConfig(".")
	if err != nil {
		fmt.Fprintf(os.Stderr, "설정 로드 실패: %v\n", err)
		os.Exit(1)
	}

	db, err := gorm.Open(sqlserver.Open(cfg.DBUrl), &gorm.Config{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "DB 연결 실패: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("=== FraudCheckLogs 테이블 마이그레이션 ===")

	var tableExists int
	db.Raw(`SELECT COUNT(*) FROM sys.tables WHERE name = 'FraudCheckLogs'`).Scan(&tableExists)

	if tableExists > 0 {
		fmt.Println("- FraudCheckLogs 테이블이 이미 존재합니다")
	} else {
		if err := db.AutoMigrate(&domain.FraudCheckLog{}); err != nil {
			fmt.Fprintf(os.Stderr, "FraudCheckLogs 마이그레이션 실패: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✓ FraudCheckLogs 테이블 생성 완료")
	}

	fmt.Println("=== 마이그레이션 완료 ===")
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd go-server && go build ./cmd/migrate_fraud_check/`
Expected: 컴파일 성공

- [ ] **Step 3: 커밋**

```bash
cd go-server
git add cmd/migrate_fraud_check/main.go
git commit -m "feat: add FraudCheckLogs DB migration tool"
```

---

### Task 4: TheCheat API 클라이언트 — pkg/thecheat

**Files:**
- Create: `go-server/pkg/thecheat/client.go`
- Create: `go-server/pkg/thecheat/client_test.go`

- [ ] **Step 1: 테스트 먼저 작성**

`go-server/pkg/thecheat/client_test.go`:

```go
package thecheat

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testEncKey = "n1l3uaJwVpc^*qMR2dYQT5k7CcHdVfJ9" // 32바이트 테스트 키

func TestEncryptDecrypt(t *testing.T) {
	plaintext := "01012345678"
	encrypted, err := encryptAES256CBC(plaintext, testEncKey)
	require.NoError(t, err)
	assert.NotEqual(t, plaintext, encrypted)

	decrypted, err := decryptAES256CBC(encrypted, testEncKey)
	require.NoError(t, err)
	assert.Equal(t, plaintext, decrypted)
}

func TestClient_Search_CautionY(t *testing.T) {
	// 더치트 API를 모킹하여 caution="Y" 응답을 시뮬레이션
	fraudResult := FraudResult{
		Keyword:     "01044440000",
		KeywordType: "phone",
		Caution:     "Y",
		KeywordURL:  "https://thecheat.co.kr/report/12345",
	}
	fraudJSON, _ := json.Marshal(fraudResult)
	encryptedContent, _ := encryptAES256CBC(string(fraudJSON), testEncKey)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "test-api-key", r.Header.Get("X-TheCheat-ApiKey"))
		assert.Equal(t, http.MethodPost, r.Method)
		json.NewEncoder(w).Encode(Response{
			ResultCode: 1,
			ResultMsg:  "success (test)",
			Content:    encryptedContent,
		})
	}))
	defer server.Close()

	client := NewClient("test-api-key", testEncKey)
	client.baseURL = server.URL

	result, err := client.Search("01044440000", "phone", "")
	require.NoError(t, err)
	assert.Equal(t, "Y", result.Caution)
	assert.Equal(t, "01044440000", result.Keyword)
	assert.Equal(t, "https://thecheat.co.kr/report/12345", result.KeywordURL)
}

func TestClient_Search_CautionN(t *testing.T) {
	fraudResult := FraudResult{
		Keyword:     "01000000000",
		KeywordType: "phone",
		Caution:     "N",
	}
	fraudJSON, _ := json.Marshal(fraudResult)
	encryptedContent, _ := encryptAES256CBC(string(fraudJSON), testEncKey)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(Response{
			ResultCode: 1,
			ResultMsg:  "success (test)",
			Content:    encryptedContent,
		})
	}))
	defer server.Close()

	client := NewClient("test-api-key", testEncKey)
	client.baseURL = server.URL

	result, err := client.Search("01000000000", "phone", "")
	require.NoError(t, err)
	assert.Equal(t, "N", result.Caution)
}

func TestClient_Search_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(Response{
			ResultCode: -2,
			ResultMsg:  "Invalid API Key",
		})
	}))
	defer server.Close()

	client := NewClient("bad-key", testEncKey)
	client.baseURL = server.URL

	_, err := client.Search("01044440000", "phone", "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Invalid API Key")
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd go-server && go test ./pkg/thecheat/ -v`
Expected: 컴파일 에러 (Client, FraudResult 등 미정의)

- [ ] **Step 3: 클라이언트 구현**

`go-server/pkg/thecheat/client.go`:

```go
// Package thecheat는 더치트(TheCheat) 금융사기 피해사례 조회 API의 HTTP 클라이언트를 제공합니다.
// 이 패키지는 순수 API 호출과 AES-256-CBC 암복호화만 담당하며, 비즈니스 로직은 포함하지 않습니다.
package thecheat

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	defaultBaseURL = "https://api.thecheat.co.kr/api/v2/fraud/search/encrypted"
	apiKeyHeader   = "X-TheCheat-ApiKey"
)

// Response는 더치트 API의 응답 구조입니다.
type Response struct {
	ResultCode int    `json:"result_code"`
	ResultMsg  string `json:"result_msg"`
	Content    string `json:"content"`
}

// FraudResult는 더치트 API content 필드를 복호화한 결과입니다.
type FraudResult struct {
	Keyword     string `json:"keyword"`
	KeywordType string `json:"keyword_type"`
	BankCode    string `json:"bank_code"`
	Caution     string `json:"caution"`      // "Y" 또는 "N"
	DateStart   string `json:"date_start"`
	DateEnd     string `json:"date_end"`
	KeywordURL  string `json:"keyword_url"`
}

// searchRequest는 더치트 API 요청 바디입니다.
type searchRequest struct {
	Keyword     string `json:"keyword"`
	KeywordType string `json:"keyword_type"`
	BankCode    string `json:"bank_code,omitempty"`
}

// Client는 더치트 API를 호출하는 HTTP 클라이언트입니다.
type Client struct {
	apiKey  string
	encKey  string
	baseURL string
	http    *http.Client
}

// NewClient는 API 키와 암호화 키를 받아 Client를 생성합니다.
func NewClient(apiKey, encKey string) *Client {
	return &Client{
		apiKey:  apiKey,
		encKey:  encKey,
		baseURL: defaultBaseURL,
		http:    &http.Client{Timeout: 10 * time.Second},
	}
}

// Search는 키워드(전화번호 또는 계좌번호)를 암호화하여 더치트 API를 호출하고 결과를 반환합니다.
// keywordType: "phone" 또는 "account"
// bankCode: 계좌 검색 시 금융기관 공동코드 (3~4자리), 전화번호 검색 시 빈 문자열
func (c *Client) Search(keyword, keywordType, bankCode string) (*FraudResult, error) {
	encrypted, err := encryptAES256CBC(keyword, c.encKey)
	if err != nil {
		return nil, fmt.Errorf("키워드 암호화 실패: %w", err)
	}

	req := searchRequest{
		Keyword:     encrypted,
		KeywordType: keywordType,
		BankCode:    bankCode,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("JSON 직렬화 실패: %w", err)
	}

	httpReq, err := http.NewRequest(http.MethodPost, c.baseURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("HTTP 요청 생성 실패: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set(apiKeyHeader, c.apiKey)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("HTTP 요청 실패: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("응답 읽기 실패: %w", err)
	}

	var apiResp Response
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("응답 파싱 실패: %w", err)
	}

	if apiResp.ResultCode != 1 {
		return nil, fmt.Errorf("더치트 API 오류 (code=%d): %s", apiResp.ResultCode, apiResp.ResultMsg)
	}

	decrypted, err := decryptAES256CBC(apiResp.Content, c.encKey)
	if err != nil {
		return nil, fmt.Errorf("응답 복호화 실패: %w", err)
	}

	var result FraudResult
	if err := json.Unmarshal([]byte(decrypted), &result); err != nil {
		return nil, fmt.Errorf("복호화 결과 파싱 실패: %w", err)
	}

	return &result, nil
}

// encryptAES256CBC는 AES-256-CBC로 암호화하고 base64로 인코딩합니다.
// 더치트 API 사양: [IV(16바이트) + ciphertext] → base64
func encryptAES256CBC(plaintext, key string) (string, error) {
	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", err
	}

	blockSize := block.BlockSize()
	plaintextBytes := pkcs7Pad([]byte(plaintext), blockSize)

	iv := make([]byte, blockSize)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	ciphertext := make([]byte, len(plaintextBytes))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(ciphertext, plaintextBytes)

	return base64.StdEncoding.EncodeToString(append(iv, ciphertext...)), nil
}

// decryptAES256CBC는 base64 디코딩 후 AES-256-CBC로 복호화합니다.
func decryptAES256CBC(encoded, key string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", err
	}

	blockSize := block.BlockSize()
	if len(data) < blockSize*2 {
		return "", fmt.Errorf("데이터가 너무 짧음 (len=%d)", len(data))
	}

	iv := data[:blockSize]
	ciphertext := data[blockSize:]

	cipher.NewCBCDecrypter(block, iv).CryptBlocks(ciphertext, ciphertext)

	unpadded, err := pkcs7Unpad(ciphertext, blockSize)
	if err != nil {
		return "", err
	}
	return string(unpadded), nil
}

func pkcs7Pad(data []byte, blockSize int) []byte {
	padding := blockSize - len(data)%blockSize
	return append(data, bytes.Repeat([]byte{byte(padding)}, padding)...)
}

func pkcs7Unpad(data []byte, blockSize int) ([]byte, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("빈 데이터")
	}
	padding := int(data[len(data)-1])
	if padding > blockSize || padding == 0 {
		return nil, fmt.Errorf("잘못된 패딩 값: %d", padding)
	}
	return data[:len(data)-padding], nil
}
```

- [ ] **Step 4: 테스트 실행 — 성공 확인**

Run: `cd go-server && go test ./pkg/thecheat/ -v`
Expected: 3개 테스트 모두 PASS

- [ ] **Step 5: 커밋**

```bash
cd go-server
git add pkg/thecheat/
git commit -m "feat: add TheCheat API client with AES-256-CBC encryption"
```

---

### Task 5: FraudChecker 인터페이스

**Files:**
- Create: `go-server/internal/app/interfaces/fraud_checker.go`

- [ ] **Step 1: 인터페이스 작성**

```go
// Package interfaces는 애플리케이션의 핵심 인터페이스를 정의합니다.
package interfaces

// FraudCheckResult는 더치트 사기 조회 결과를 나타냅니다.
type FraudCheckResult struct {
	PhoneCaution   string // "Y" | "N" | "" (전화번호 없으면 빈값)
	AccountCaution string // "Y" | "N" | "" (계좌 없으면 빈값)
	IsFlagged      bool   // 하나라도 "Y"면 true
	PhoneURL       string // 전화번호 피해사례 열람 URL
	AccountURL     string // 계좌번호 피해사례 열람 URL
}

// FraudChecker는 사기 조회 기능의 추상 인터페이스입니다.
// 실제 구현체(FraudCheckService)와 테스트용 mock 모두 이 인터페이스를 만족합니다.
type FraudChecker interface {
	// Check는 캐시를 활용하여 사기 조회를 수행합니다 (거래 시 사용).
	Check(userID int, source string) (*FraudCheckResult, error)
	// CheckRealtime는 캐시를 무시하고 항상 실시간 조회합니다 (관리자 수동 조회).
	CheckRealtime(userID int) (*FraudCheckResult, error)
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 컴파일 성공

- [ ] **Step 3: 커밋**

```bash
cd go-server
git add internal/app/interfaces/fraud_checker.go
git commit -m "feat: add FraudChecker interface"
```

---

### Task 6: FraudCheckService 구현

**Files:**
- Create: `go-server/internal/app/services/fraud_check_svc.go`
- Create: `go-server/internal/app/services/fraud_check_test.go`

- [ ] **Step 1: 테스트 먼저 작성**

`go-server/internal/app/services/fraud_check_test.go`:

```go
package services

import (
	"testing"
	"time"
	"w-gift-server/internal/app/interfaces"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/thecheat"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// stubTheCheatClient는 테스트용 더치트 API 클라이언트 mock입니다.
type stubTheCheatClient struct {
	results map[string]*thecheat.FraudResult // keyword → result
	err     error
}

func (s *stubTheCheatClient) Search(keyword, keywordType, bankCode string) (*thecheat.FraudResult, error) {
	if s.err != nil {
		return nil, s.err
	}
	if r, ok := s.results[keyword]; ok {
		return r, nil
	}
	return &thecheat.FraudResult{Keyword: keyword, KeywordType: keywordType, Caution: "N"}, nil
}

func setupFraudCheckTestDB() (*FraudCheckService, *stubTheCheatClient) {
	db := setupTestDB()
	db.AutoMigrate(&domain.FraudCheckLog{}, &domain.User{})

	stub := &stubTheCheatClient{results: make(map[string]*thecheat.FraudResult)}
	cfg := &config.Config{
		EncryptionKey:    testEncKey,
		TheCheatEnabled:  true,
		TheCheatCacheTTL: 24 * time.Hour,
	}

	svc := NewFraudCheckService(db, cfg, stub)
	return svc, stub
}

func TestFraudCheck_DisabledReturnsNotFlagged(t *testing.T) {
	svc, _ := setupFraudCheckTestDB()
	svc.cfg.TheCheatEnabled = false

	// 사용자 생성
	phone := "01012345678"
	db := svc.db
	db.Create(&domain.User{Email: "test@test.com", Password: "hashed", Phone: &phone})

	result, err := svc.Check(1, "ORDER")
	require.NoError(t, err)
	assert.False(t, result.IsFlagged)
}

func TestFraudCheck_PhoneFlagged(t *testing.T) {
	svc, stub := setupFraudCheckTestDB()

	phone := "01044440000"
	svc.db.Create(&domain.User{Email: "fraud@test.com", Password: "hashed", Phone: &phone})

	stub.results["01044440000"] = &thecheat.FraudResult{
		Keyword:     "01044440000",
		KeywordType: "phone",
		Caution:     "Y",
		KeywordURL:  "https://thecheat.co.kr/report/123",
	}

	result, err := svc.Check(1, "ORDER")
	require.NoError(t, err)
	assert.True(t, result.IsFlagged)
	assert.Equal(t, "Y", result.PhoneCaution)
	assert.Equal(t, "https://thecheat.co.kr/report/123", result.PhoneURL)
}

func TestFraudCheck_CacheHit(t *testing.T) {
	svc, stub := setupFraudCheckTestDB()

	phone := "01044440000"
	svc.db.Create(&domain.User{Email: "cache@test.com", Password: "hashed", Phone: &phone})

	stub.results["01044440000"] = &thecheat.FraudResult{
		Keyword: "01044440000", KeywordType: "phone", Caution: "Y",
	}

	// 첫 번째 호출 — API 호출
	result1, err := svc.Check(1, "ORDER")
	require.NoError(t, err)
	assert.True(t, result1.IsFlagged)

	// stub 결과를 바꿔도 캐시에서 반환
	stub.results["01044440000"] = &thecheat.FraudResult{
		Keyword: "01044440000", KeywordType: "phone", Caution: "N",
	}

	result2, err := svc.Check(1, "ORDER")
	require.NoError(t, err)
	assert.True(t, result2.IsFlagged) // 여전히 캐시된 "Y"
}

func TestFraudCheck_RealtimeIgnoresCache(t *testing.T) {
	svc, stub := setupFraudCheckTestDB()

	phone := "01044440000"
	svc.db.Create(&domain.User{Email: "realtime@test.com", Password: "hashed", Phone: &phone})

	stub.results["01044440000"] = &thecheat.FraudResult{
		Keyword: "01044440000", KeywordType: "phone", Caution: "Y",
	}

	// 캐시 채우기
	svc.Check(1, "ORDER")

	// stub 결과 변경
	stub.results["01044440000"] = &thecheat.FraudResult{
		Keyword: "01044440000", KeywordType: "phone", Caution: "N",
	}

	// CheckRealtime은 캐시 무시
	result, err := svc.CheckRealtime(1)
	require.NoError(t, err)
	assert.False(t, result.IsFlagged)
	assert.Equal(t, "N", result.PhoneCaution)
}

func TestFraudCheck_NoPhoneNoAccount(t *testing.T) {
	svc, _ := setupFraudCheckTestDB()
	svc.db.Create(&domain.User{Email: "nophone@test.com", Password: "hashed"})

	result, err := svc.Check(1, "ORDER")
	require.NoError(t, err)
	assert.False(t, result.IsFlagged)
}

// 인터페이스 만족 확인
var _ interfaces.FraudChecker = (*FraudCheckService)(nil)
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd go-server && go test ./internal/app/services/ -run TestFraudCheck -v`
Expected: 컴파일 에러 (FraudCheckService 미정의)

- [ ] **Step 3: FraudCheckService 구현**

`go-server/internal/app/services/fraud_check_svc.go`:

```go
package services

import (
	"fmt"
	"strings"
	"time"
	"w-gift-server/internal/app/interfaces"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/crypto"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/thecheat"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// TheCheatSearcher는 더치트 API 호출을 추상화합니다 (테스트 시 mock 가능).
type TheCheatSearcher interface {
	Search(keyword, keywordType, bankCode string) (*thecheat.FraudResult, error)
}

// FraudCheckService는 사기 조회 비즈니스 로직을 처리합니다.
type FraudCheckService struct {
	db     *gorm.DB
	cfg    *config.Config
	client TheCheatSearcher
}

// NewFraudCheckService는 새로운 FraudCheckService를 생성합니다.
func NewFraudCheckService(db *gorm.DB, cfg *config.Config, client TheCheatSearcher) *FraudCheckService {
	return &FraudCheckService{db: db, cfg: cfg, client: client}
}

// Check는 캐시를 활용하여 사기 조회를 수행합니다.
func (s *FraudCheckService) Check(userID int, source string) (*interfaces.FraudCheckResult, error) {
	return s.check(userID, source, true)
}

// CheckRealtime는 캐시를 무시하고 항상 실시간으로 조회합니다.
func (s *FraudCheckService) CheckRealtime(userID int) (*interfaces.FraudCheckResult, error) {
	return s.check(userID, "ADMIN", false)
}

func (s *FraudCheckService) check(userID int, source string, useCache bool) (*interfaces.FraudCheckResult, error) {
	if !s.cfg.TheCheatEnabled {
		return &interfaces.FraudCheckResult{}, nil
	}

	// 사용자 조회
	var user domain.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("사용자 조회 실패 (ID=%d): %w", userID, err)
	}

	result := &interfaces.FraudCheckResult{}

	// 전화번호가 없고 계좌번호도 없으면 검사 생략
	hasPhone := user.Phone != nil && *user.Phone != ""
	hasAccount := user.AccountNumber != nil && *user.AccountNumber != ""
	if !hasPhone && !hasAccount {
		return result, nil
	}

	// 전화번호 검사
	if hasPhone {
		phone := *user.Phone
		cached := s.findCache(userID, "phone", useCache)
		if cached != nil {
			result.PhoneCaution = cached.Caution
			if cached.KeywordURL != nil {
				result.PhoneURL = *cached.KeywordURL
			}
		} else {
			fr, err := s.client.Search(phone, "phone", "")
			if err != nil {
				logger.Log.Error("더치트 전화번호 조회 실패", zap.Error(err), zap.Int("userId", userID))
				// fail-open: API 실패 시 차단하지 않음
			} else {
				result.PhoneCaution = fr.Caution
				result.PhoneURL = fr.KeywordURL
				s.saveLog(userID, maskPhone(phone), "phone", nil, fr.Caution, fr.KeywordURL, source)
			}
		}
	}

	// 계좌번호 검사
	if hasAccount {
		accountNum, err := crypto.DecryptCBC(*user.AccountNumber, s.cfg.EncryptionKey)
		if err != nil {
			logger.Log.Error("계좌번호 복호화 실패", zap.Error(err), zap.Int("userId", userID))
		} else {
			bankCode := ""
			if user.BankCode != nil {
				bankCode = *user.BankCode
			}
			cached := s.findCache(userID, "account", useCache)
			if cached != nil {
				result.AccountCaution = cached.Caution
				if cached.KeywordURL != nil {
					result.AccountURL = *cached.KeywordURL
				}
			} else {
				fr, err := s.client.Search(accountNum, "account", bankCode)
				if err != nil {
					logger.Log.Error("더치트 계좌번호 조회 실패", zap.Error(err), zap.Int("userId", userID))
				} else {
					result.AccountCaution = fr.Caution
					result.AccountURL = fr.KeywordURL
					var bc *string
					if bankCode != "" {
						bc = &bankCode
					}
					s.saveLog(userID, maskAccount(accountNum), "account", bc, fr.Caution, fr.KeywordURL, source)
				}
			}
		}
	}

	result.IsFlagged = result.PhoneCaution == "Y" || result.AccountCaution == "Y"
	return result, nil
}

// findCache는 유효한 캐시를 찾아 반환합니다.
func (s *FraudCheckService) findCache(userID int, keywordType string, useCache bool) *domain.FraudCheckLog {
	if !useCache {
		return nil
	}
	var log domain.FraudCheckLog
	err := s.db.Where("UserId = ? AND KeywordType = ? AND ExpiresAt > ?", userID, keywordType, time.Now()).
		Order("CreatedAt DESC").First(&log).Error
	if err != nil {
		return nil
	}
	return &log
}

// saveLog는 조회 결과를 FraudCheckLog에 저장합니다.
func (s *FraudCheckService) saveLog(userID int, maskedKeyword, keywordType string, bankCode *string, caution, keywordURL, source string) {
	var urlPtr *string
	if keywordURL != "" {
		urlPtr = &keywordURL
	}
	log := domain.FraudCheckLog{
		UserID:      userID,
		Keyword:     maskedKeyword,
		KeywordType: keywordType,
		BankCode:    bankCode,
		Caution:     caution,
		KeywordURL:  urlPtr,
		Source:      source,
		ExpiresAt:   time.Now().Add(s.cfg.TheCheatCacheTTL),
	}
	s.db.Create(&log)
}

// maskPhone는 전화번호를 마스킹합니다. (예: 01012345678 → 010****5678)
func maskPhone(phone string) string {
	if len(phone) < 7 {
		return strings.Repeat("*", len(phone))
	}
	return phone[:3] + strings.Repeat("*", len(phone)-7) + phone[len(phone)-4:]
}

// maskAccount는 계좌번호를 마스킹합니다. (예: 1234567890 → 1234****90)
func maskAccount(account string) string {
	if len(account) < 6 {
		return strings.Repeat("*", len(account))
	}
	return account[:4] + strings.Repeat("*", len(account)-6) + account[len(account)-2:]
}
```

- [ ] **Step 4: 테스트 실행 — 성공 확인**

Run: `cd go-server && go test ./internal/app/services/ -run TestFraudCheck -v`
Expected: 5개 테스트 모두 PASS

- [ ] **Step 5: 커밋**

```bash
cd go-server
git add internal/app/services/fraud_check_svc.go internal/app/services/fraud_check_test.go
git commit -m "feat: implement FraudCheckService with caching and masking"
```

---

### Task 7: OrderService에 FraudChecker 통합

**Files:**
- Modify: `go-server/internal/app/services/order_service.go`

- [ ] **Step 1: OrderService 구조체에 FraudChecker 필드 추가**

`order_service.go`의 OrderService 구조체(`type OrderService struct`)에 필드 추가:

```go
type OrderService struct {
	db              *gorm.DB
	orderRepo       *repository.BaseRepository[domain.Order]
	itemRepo        *repository.BaseRepository[domain.OrderItem]
	voucherRepo     *repository.BaseRepository[domain.VoucherCode]
	paymentProvider interfaces.IPaymentProvider
	cfg             *config.Config
	config          ConfigProvider
	fraudChecker    interfaces.FraudChecker // 추가
}
```

- [ ] **Step 2: NewOrderService 시그니처는 변경하지 않음**

기존 호출부의 호환성을 유지하기 위해 setter로 주입:

```go
// SetFraudChecker는 사기 조회 서비스를 주입합니다.
func (s *OrderService) SetFraudChecker(fc interfaces.FraudChecker) {
	s.fraudChecker = fc
}
```

이 setter를 NewOrderService 함수 아래에 추가합니다.

- [ ] **Step 3: CreateOrder에 사기 검사 로직 삽입**

`CreateOrder` 함수의 트랜잭션 진입 직후(`err := s.db.Transaction(func(tx *gorm.DB) error {` 바로 다음 줄)에, 멱등성 체크 전에 사기 검사 분기를 추가합니다.

기존 코드:
```go
	err := s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 멱등성 체크: 동일한 IdempotencyKey로 요청이 온 경우 ...
```

변경 후:
```go
	// 사기 조회 (트랜잭션 밖에서 수행 — 외부 API 호출을 트랜잭션 안에 넣지 않음)
	var fraudResult *interfaces.FraudCheckResult
	if s.fraudChecker != nil {
		var fcErr error
		fraudResult, fcErr = s.fraudChecker.Check(userID, "ORDER")
		if fcErr != nil {
			logger.Log.Error("사기 조회 실패 (fail-open)", zap.Error(fcErr), zap.Int("userId", userID))
		}
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 멱등성 체크: 동일한 IdempotencyKey로 요청이 온 경우 ...
```

그리고 주문이 생성되는 부분(Order 레코드를 DB에 Insert하는 곳)에서 `Status` 결정 로직을 수정합니다. Order의 Status 할당 부분을 찾아:

```go
		// FRAUD_HOLD 판정
		orderStatus := "PENDING"
		if fraudResult != nil && fraudResult.IsFlagged {
			orderStatus = "FRAUD_HOLD"
		}
```

을 주문 레코드 생성 코드 직전에 추가하고, `Status: "PENDING"` 대신 `Status: orderStatus`를 사용합니다.

FRAUD_HOLD인 경우 바우처 예약(Pre-reservation) 블록을 건너뛰어야 합니다. 기존 바우처 예약 코드를 `if orderStatus != "FRAUD_HOLD" {` 로 감싸세요.

imports에 `"w-gift-server/internal/app/interfaces"` 와 `"w-gift-server/pkg/logger"`, `"go.uber.org/zap"` 가 있는지 확인하세요 (이미 있으면 생략).

- [ ] **Step 4: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 컴파일 성공

- [ ] **Step 5: 커밋**

```bash
cd go-server
git add internal/app/services/order_service.go
git commit -m "feat: integrate FraudChecker into OrderService (FRAUD_HOLD)"
```

---

### Task 8: TradeInService에 FraudChecker 통합

**Files:**
- Modify: `go-server/internal/app/services/tradein_service.go`

- [ ] **Step 1: TradeInService 구조체에 FraudChecker 필드 추가**

```go
type TradeInService struct {
	db           *gorm.DB
	cfg          *config.Config
	fraudChecker interfaces.FraudChecker // 추가
}
```

- [ ] **Step 2: setter 추가**

NewTradeInService 아래에:

```go
// SetFraudChecker는 사기 조회 서비스를 주입합니다.
func (s *TradeInService) SetFraudChecker(fc interfaces.FraudChecker) {
	s.fraudChecker = fc
}
```

- [ ] **Step 3: SubmitTradeIn에 사기 검사 삽입**

`SubmitTradeIn` 함수의 시작 부분 (상품 조회 전)에 추가:

```go
func (s *TradeInService) SubmitTradeIn(userID int, input CreateTradeInInput) (*domain.TradeIn, error) {
	// 사기 조회
	var fraudResult *interfaces.FraudCheckResult
	if s.fraudChecker != nil {
		var fcErr error
		fraudResult, fcErr = s.fraudChecker.Check(userID, "TRADEIN")
		if fcErr != nil {
			logger.Log.Error("매입 사기 조회 실패 (fail-open)", zap.Error(fcErr), zap.Int("userId", userID))
		}
	}

	// 1. 매입 대상 상품 정보 조회 및 유효성 확인
	// ... (기존 코드)
```

그리고 TradeIn 레코드의 Status 할당 부분에서:

```go
	tradeInStatus := "REQUESTED"
	if fraudResult != nil && fraudResult.IsFlagged {
		tradeInStatus = "FRAUD_HOLD"
	}
```

를 추가하고, `Status: "REQUESTED"` 대신 `Status: tradeInStatus`를 사용합니다.

imports에 `"w-gift-server/internal/app/interfaces"`, `"w-gift-server/pkg/logger"`, `"go.uber.org/zap"` 추가 (이미 있으면 생략).

- [ ] **Step 4: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 컴파일 성공

- [ ] **Step 5: 커밋**

```bash
cd go-server
git add internal/app/services/tradein_service.go
git commit -m "feat: integrate FraudChecker into TradeInService (FRAUD_HOLD)"
```

---

### Task 9: DI 와이어링 — container.go

**Files:**
- Modify: `go-server/internal/routes/container.go`

- [ ] **Step 1: FraudCheckService 생성 및 주입**

`container.go`의 `NewHandlers` 함수에서, `orderService`와 `tradeInService` 생성 후에 추가:

```go
	orderService := services.NewOrderService(db, pp, cfg, configProvider)
	tradeInService := services.NewTradeInService(db, cfg)

	// 더치트 사기 조회 서비스 — THECHEAT_ENABLED=true일 때만 활성화
	if cfg.TheCheatEnabled && cfg.TheCheatAPIKey != "" && cfg.TheCheatEncKey != "" {
		theCheatClient := thecheat.NewClient(cfg.TheCheatAPIKey, cfg.TheCheatEncKey)
		fraudCheckSvc := services.NewFraudCheckService(db, cfg, theCheatClient)
		orderService.SetFraudChecker(fraudCheckSvc)
		tradeInService.SetFraudChecker(fraudCheckSvc)
	}
```

imports에 `"w-gift-server/pkg/thecheat"` 추가.

- [ ] **Step 2: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 컴파일 성공

- [ ] **Step 3: 커밋**

```bash
cd go-server
git add internal/routes/container.go
git commit -m "feat: wire FraudCheckService into DI container"
```

---

### Task 10: 텔레그램 알림

**Files:**
- Modify: `go-server/internal/api/handlers/order_handler.go`
- Modify: `go-server/internal/api/handlers/tradein_handler.go`

주문/매입 핸들러에서 FRAUD_HOLD 상태인 경우 텔레그램 알림을 발송합니다.

- [ ] **Step 1: OrderHandler에 FRAUD_HOLD 알림 추가**

`order_handler.go`에서 `CreateOrder` 핸들러 함수를 찾습니다. 주문 생성 성공 후 응답을 반환하는 부분 근처에 조건 추가:

```go
	if order.Status == "FRAUD_HOLD" {
		go telegram.SendAlert(telegram.GetGlobalToken(), telegram.GetGlobalChatID(),
			fmt.Sprintf("🚨 <b>사기의심 거래 보류</b>\n━━━━━━━━━━━━━━━\n유형: 주문 #%d\n사용자 ID: %d\n금액: %s원\n━━━━━━━━━━━━━━━\n관리자 패널에서 확인해주세요.",
				order.ID, order.UserID, order.TotalAmount.String()))
		response.Created(c, gin.H{"message": "주문이 검토 중입니다", "orderId": order.ID})
		return
	}
```

imports에 `"w-gift-server/pkg/telegram"` 과 `"fmt"` 추가 (이미 있으면 생략).

- [ ] **Step 2: TradeInHandler에 FRAUD_HOLD 알림 추가**

`tradein_handler.go`의 `SubmitTradeIn` 핸들러에서, tradeIn 생성 성공 후:

```go
	if tradeIn.Status == "FRAUD_HOLD" {
		go telegram.SendAlert(telegram.GetGlobalToken(), telegram.GetGlobalChatID(),
			fmt.Sprintf("🚨 <b>사기의심 매입 보류</b>\n━━━━━━━━━━━━━━━\n유형: 매입 #%d\n사용자 ID: %d\n금액: %s원\n━━━━━━━━━━━━━━━\n관리자 패널에서 확인해주세요.",
				tradeIn.ID, tradeIn.UserID, tradeIn.PayoutAmount.String()))
		response.Created(c, gin.H{"message": "매입 신청이 검토 중입니다", "tradeInId": tradeIn.ID})
		return
	}
```

imports에 `"w-gift-server/pkg/telegram"` 과 `"fmt"` 추가 (이미 있으면 생략).

- [ ] **Step 3: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 컴파일 성공

- [ ] **Step 4: 커밋**

```bash
cd go-server
git add internal/api/handlers/order_handler.go internal/api/handlers/tradein_handler.go
git commit -m "feat: send Telegram alert on FRAUD_HOLD orders/trade-ins"
```

---

### Task 11: 관리자 API 핸들러

**Files:**
- Create: `go-server/internal/api/handlers/admin_fraud_handler.go`

- [ ] **Step 1: AdminFraudHandler 작성**

```go
package handlers

import (
	"fmt"
	"strconv"
	"w-gift-server/internal/app/interfaces"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AdminFraudHandler는 관리자용 사기 조회 및 FRAUD_HOLD 해제 API를 처리합니다.
type AdminFraudHandler struct {
	db           *gorm.DB
	fraudChecker interfaces.FraudChecker
}

// NewAdminFraudHandler는 새로운 AdminFraudHandler를 생성합니다.
func NewAdminFraudHandler(db *gorm.DB, fraudChecker interfaces.FraudChecker) *AdminFraudHandler {
	return &AdminFraudHandler{db: db, fraudChecker: fraudChecker}
}

// FraudCheck godoc
// @Summary 사용자 사기 조회 (실시간)
// @Tags Admin - Fraud
// @Produce json
// @Security BearerAuth
// @Param id path int true "사용자 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/fraud-check [get]
func (h *AdminFraudHandler) FraudCheck(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 사용자 ID입니다")
		return
	}

	if h.fraudChecker == nil {
		response.BadRequest(c, "더치트 사기 조회 기능이 비활성화되어 있습니다")
		return
	}

	result, err := h.fraudChecker.CheckRealtime(userID)
	if err != nil {
		response.InternalServerError(c, fmt.Sprintf("사기 조회 실패: %v", err))
		return
	}

	response.Success(c, result)
}

// FraudHistory godoc
// @Summary 사용자 사기 조회 이력
// @Tags Admin - Fraud
// @Produce json
// @Security BearerAuth
// @Param id path int true "사용자 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/fraud-history [get]
func (h *AdminFraudHandler) FraudHistory(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 사용자 ID입니다")
		return
	}

	var logs []domain.FraudCheckLog
	if err := h.db.Where("UserId = ?", userID).Order("CreatedAt DESC").Find(&logs).Error; err != nil {
		response.InternalServerError(c, "이력 조회 실패")
		return
	}

	response.Success(c, logs)
}

type releaseHoldRequest struct {
	AdminNote string `json:"adminNote" binding:"required"`
}

// ReleaseOrderHold godoc
// @Summary 주문 FRAUD_HOLD 해제
// @Tags Admin - Fraud
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "주문 ID"
// @Param body body releaseHoldRequest true "해제 사유"
// @Success 200 {object} APIResponse
// @Router /admin/orders/{id}/release-hold [post]
func (h *AdminFraudHandler) ReleaseOrderHold(c *gin.Context) {
	orderID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 주문 ID입니다")
		return
	}

	var req releaseHoldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "adminNote는 필수입니다")
		return
	}

	var order domain.Order
	if err := h.db.First(&order, orderID).Error; err != nil {
		response.NotFound(c, "주문을 찾을 수 없습니다")
		return
	}

	if order.Status != "FRAUD_HOLD" {
		response.BadRequest(c, fmt.Sprintf("FRAUD_HOLD 상태가 아닙니다 (현재: %s)", order.Status))
		return
	}

	if err := h.db.Model(&order).Updates(map[string]any{
		"Status":    "PENDING",
		"AdminNote": req.AdminNote,
	}).Error; err != nil {
		response.InternalServerError(c, "상태 변경 실패")
		return
	}

	response.Success(c, gin.H{"message": "주문이 정상 처리로 전환되었습니다", "orderId": orderID})
}

// ReleaseTradeInHold godoc
// @Summary 매입 FRAUD_HOLD 해제
// @Tags Admin - Fraud
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "매입 ID"
// @Param body body releaseHoldRequest true "해제 사유"
// @Success 200 {object} APIResponse
// @Router /admin/trade-ins/{id}/release-hold [post]
func (h *AdminFraudHandler) ReleaseTradeInHold(c *gin.Context) {
	tradeInID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 매입 ID입니다")
		return
	}

	var req releaseHoldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "adminNote는 필수입니다")
		return
	}

	var tradeIn domain.TradeIn
	if err := h.db.First(&tradeIn, tradeInID).Error; err != nil {
		response.NotFound(c, "매입 건을 찾을 수 없습니다")
		return
	}

	if tradeIn.Status != "FRAUD_HOLD" {
		response.BadRequest(c, fmt.Sprintf("FRAUD_HOLD 상태가 아닙니다 (현재: %s)", tradeIn.Status))
		return
	}

	if err := h.db.Model(&tradeIn).Updates(map[string]any{
		"Status":    "REQUESTED",
		"AdminNote": req.AdminNote,
	}).Error; err != nil {
		response.InternalServerError(c, "상태 변경 실패")
		return
	}

	response.Success(c, gin.H{"message": "매입이 정상 처리로 전환되었습니다", "tradeInId": tradeInID})
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 컴파일 성공

- [ ] **Step 3: 커밋**

```bash
cd go-server
git add internal/api/handlers/admin_fraud_handler.go
git commit -m "feat: add admin fraud check/release-hold handlers"
```

---

### Task 12: 관리자 라우트 등록 & DI 와이어링

**Files:**
- Modify: `go-server/internal/routes/admin.go`
- Modify: `go-server/internal/routes/container.go`

- [ ] **Step 1: Handlers 구조체에 AdminFraud 필드 추가**

`container.go`의 `Handlers` 구조체에 추가:

```go
	// Fraud check (관리자 사기 조회 및 FRAUD_HOLD 해제)
	AdminFraud *handlers.AdminFraudHandler
```

- [ ] **Step 2: NewHandlers에서 AdminFraudHandler 초기화**

`container.go`의 `NewHandlers` 함수에서, 더치트 서비스 생성 블록 아래에 추가. fraudCheckSvc 변수를 블록 밖으로 빼야 합니다:

기존:
```go
	if cfg.TheCheatEnabled && cfg.TheCheatAPIKey != "" && cfg.TheCheatEncKey != "" {
		theCheatClient := thecheat.NewClient(cfg.TheCheatAPIKey, cfg.TheCheatEncKey)
		fraudCheckSvc := services.NewFraudCheckService(db, cfg, theCheatClient)
		orderService.SetFraudChecker(fraudCheckSvc)
		tradeInService.SetFraudChecker(fraudCheckSvc)
	}
```

변경:
```go
	var fraudChecker interfaces.FraudChecker
	if cfg.TheCheatEnabled && cfg.TheCheatAPIKey != "" && cfg.TheCheatEncKey != "" {
		theCheatClient := thecheat.NewClient(cfg.TheCheatAPIKey, cfg.TheCheatEncKey)
		fraudCheckSvc := services.NewFraudCheckService(db, cfg, theCheatClient)
		orderService.SetFraudChecker(fraudCheckSvc)
		tradeInService.SetFraudChecker(fraudCheckSvc)
		fraudChecker = fraudCheckSvc
	}
```

`return &Handlers{` 블록에 추가:
```go
		AdminFraud: handlers.NewAdminFraudHandler(db, fraudChecker),
```

imports에 `"w-gift-server/internal/app/interfaces"` 추가 (이미 있으면 생략).

- [ ] **Step 3: admin.go에 라우트 등록**

`admin.go`의 `RegisterAdminRoutes` 함수에서, Users 관련 라우트 블록 아래에 추가:

```go
		// Fraud Check (사기 조회)
		admin.GET("/users/:id/fraud-check", h.AdminFraud.FraudCheck)
		admin.GET("/users/:id/fraud-history", h.AdminFraud.FraudHistory)
		admin.POST("/orders/:id/release-hold", h.AdminFraud.ReleaseOrderHold)
		admin.POST("/trade-ins/:id/release-hold", h.AdminFraud.ReleaseTradeInHold)
```

- [ ] **Step 4: 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 컴파일 성공

- [ ] **Step 5: 커밋**

```bash
cd go-server
git add internal/routes/admin.go internal/routes/container.go
git commit -m "feat: register admin fraud check routes and wire DI"
```

---

### Task 13: 최종 빌드 및 테스트

**Files:** (변경 없음 — 검증만)

- [ ] **Step 1: 전체 테스트 실행**

Run: `cd go-server && go test ./... -count=1`
Expected: 기존 테스트 + 새 테스트 모두 PASS

- [ ] **Step 2: 전체 빌드 확인**

Run: `cd go-server && go build ./...`
Expected: 컴파일 성공

- [ ] **Step 3: 최종 커밋 (필요한 경우)**

누락된 파일이 있으면 추가 커밋. 없으면 이 단계는 생략.
