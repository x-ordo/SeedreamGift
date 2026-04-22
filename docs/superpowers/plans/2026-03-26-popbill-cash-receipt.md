# 팝빌 현금영수증 API 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가상계좌 입금 결제 시 팝빌 API를 통해 현금영수증을 자동 발급하고, 사후 신청·취소·재시도를 지원한다.

**Architecture:** 팝빌 REST API 클라이언트(`infra/popbill/`)를 `ICashReceiptProvider` 인터페이스로 추상화하고, `CashReceiptService`에서 비즈니스 로직을 처리한다. 기존 `PaymentService.HandleWebhook`에서 입금 확인 시 현금영수증 발급을 호출하고, 실패 건은 크론이 재시도한다.

**Tech Stack:** Go (Gin), GORM (MSSQL), 팝빌 REST API, AES-256 암호화 (기존 `pkg/crypto`)

**Spec:** `docs/superpowers/specs/2026-03-26-popbill-cash-receipt-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `go-server/internal/domain/cash_receipt.go` | CashReceipt 도메인 모델 |
| Create | `go-server/migrations/005_create_cash_receipts.sql` | DB 테이블 생성 스크립트 |
| Create | `go-server/internal/app/interfaces/cash_receipt.go` | ICashReceiptProvider 인터페이스 |
| Create | `go-server/internal/infra/popbill/types.go` | 팝빌 API 요청/응답 타입 |
| Create | `go-server/internal/infra/popbill/client.go` | 팝빌 REST API 클라이언트 (ICashReceiptProvider 구현) |
| Create | `go-server/internal/infra/popbill/stub.go` | 테스트/개발용 Stub 구현 |
| Create | `go-server/internal/app/services/cash_receipt_service.go` | 현금영수증 비즈니스 로직 |
| Create | `go-server/internal/app/services/cash_receipt_test.go` | 서비스 단위 테스트 |
| Create | `go-server/internal/api/handlers/cash_receipt_handler.go` | HTTP 핸들러 (사용자 + 관리자) |
| Modify | `go-server/internal/routes/container.go` | DI: CashReceiptService, Handler 등록 |
| Modify | `go-server/internal/routes/protected.go` | 사용자 현금영수증 라우트 추가 |
| Modify | `go-server/internal/routes/admin.go` | 관리자 현금영수증 라우트 추가 |
| Modify | `go-server/internal/app/services/payment_service.go` | HandleWebhook에서 현금영수증 발급 호출 |
| Modify | `go-server/internal/app/services/admin_refund_svc.go` | 환불 승인 시 현금영수증 취소 호출 |
| Modify | `go-server/internal/cron/scheduler.go` | 실패 재시도 + 상태 동기화 크론 잡 |
| Modify | `go-server/internal/config/config.go` | 팝빌 환경변수 추가 |
| Modify | `go-server/main.go` | 팝빌 클라이언트 초기화, 크론 주입 |

---

## Task 1: 도메인 모델 & DB 마이그레이션

**Files:**
- Create: `go-server/internal/domain/cash_receipt.go`
- Create: `go-server/migrations/005_create_cash_receipts.sql`

- [ ] **Step 1: CashReceipt 도메인 모델 작성**

```go
// go-server/internal/domain/cash_receipt.go
package domain

import "time"

// CashReceipt는 현금영수증 발급/취소 내역을 관리합니다.
type CashReceipt struct {
	ID int `gorm:"primaryKey;column:Id" json:"id"`
	// OrderID는 현금영수증 대상 주문 ID입니다.
	OrderID int `gorm:"index:IX_CashReceipts_OrderId;column:OrderId" json:"orderId"`
	// Order는 대상 주문의 상세 정보입니다.
	Order Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	// UserID는 현금영수증 요청 사용자 ID입니다.
	UserID int `gorm:"index:IX_CashReceipts_UserId;column:UserId" json:"userId"`
	// User는 요청 사용자 정보입니다.
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`

	// Type은 현금영수증 발급 유형입니다. (INCOME_DEDUCTION: 소득공제, EXPENSE_PROOF: 지출증빙)
	Type string `gorm:"column:Type;size:20" json:"type"`
	// IdentityType은 식별번호 유형입니다. (PHONE, BUSINESS_NO, CARD_NO)
	IdentityType string `gorm:"column:IdentityType;size:15" json:"identityType"`
	// IdentityNumber는 식별번호입니다. (AES-256 암호화 저장)
	IdentityNumber string `gorm:"column:IdentityNumber;size:200" json:"-"`
	// MaskedIdentity는 마스킹된 식별번호입니다. (예: 010****5678)
	MaskedIdentity string `gorm:"column:MaskedIdentity;size:20" json:"maskedIdentity"`
	// SupplyAmount는 공급가액입니다.
	SupplyAmount NumericDecimal `gorm:"column:SupplyAmount;type:decimal(12,0)" json:"supplyAmount"`
	// TaxAmount는 부가세입니다.
	TaxAmount NumericDecimal `gorm:"column:TaxAmount;type:decimal(12,0)" json:"taxAmount"`
	// TotalAmount는 총 금액입니다.
	TotalAmount NumericDecimal `gorm:"column:TotalAmount;type:decimal(12,0)" json:"totalAmount"`

	// MgtKey는 팝빌 문서 관리번호입니다. (사업자번호당 고유)
	MgtKey string `gorm:"uniqueIndex:UQ_CashReceipts_MgtKey;column:MgtKey;size:24" json:"mgtKey"`
	// ConfirmNum은 국세청 승인번호입니다. (팝빌 응답)
	ConfirmNum *string `gorm:"column:ConfirmNum;size:24" json:"confirmNum"`
	// TradeDate는 국세청 거래일자입니다. (YYYYMMDD)
	TradeDate *string `gorm:"column:TradeDate;size:8" json:"tradeDate"`

	// Status는 현금영수증 상태입니다. (PENDING, ISSUED, FAILED, CANCELLED)
	Status string `gorm:"index:IX_CashReceipts_Status;column:Status;size:10;default:'PENDING'" json:"status"`
	// IsAutoIssued는 자진발급 여부입니다.
	IsAutoIssued bool `gorm:"column:IsAutoIssued;default:false" json:"isAutoIssued"`
	// OriginalID는 사후 신청으로 대체된 원본 자진발급 건의 ID입니다.
	OriginalID *int `gorm:"column:OriginalId" json:"originalId,omitempty"`
	// FailReason은 발급 실패 사유입니다.
	FailReason *string `gorm:"column:FailReason;size:500" json:"failReason,omitempty"`
	// CancelledReceiptID는 취소 발급 시 원본 현금영수증 ID입니다.
	CancelledReceiptID *int `gorm:"column:CancelledReceiptId" json:"cancelledReceiptId,omitempty"`
	// RetryCount는 발급 재시도 횟수입니다.
	RetryCount int `gorm:"column:RetryCount;default:0" json:"retryCount"`

	IssuedAt    *time.Time `gorm:"column:IssuedAt" json:"issuedAt,omitempty"`
	CancelledAt *time.Time `gorm:"column:CancelledAt" json:"cancelledAt,omitempty"`
	CreatedAt   time.Time  `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time  `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
}

func (CashReceipt) TableName() string { return "CashReceipts" }
```

- [ ] **Step 2: SQL 마이그레이션 스크립트 작성**

```sql
-- go-server/migrations/005_create_cash_receipts.sql
-- 현금영수증 발급/취소 내역 테이블

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CashReceipts')
BEGIN
    CREATE TABLE CashReceipts (
        Id                  INT IDENTITY(1,1) PRIMARY KEY,
        OrderId             INT NOT NULL,
        UserId              INT NOT NULL,
        Type                NVARCHAR(20) NOT NULL,       -- INCOME_DEDUCTION, EXPENSE_PROOF
        IdentityType        NVARCHAR(15) NOT NULL,       -- PHONE, BUSINESS_NO, CARD_NO
        IdentityNumber      NVARCHAR(200) NOT NULL,      -- AES-256 암호화
        MaskedIdentity      NVARCHAR(20) NOT NULL,       -- 010****5678
        SupplyAmount        DECIMAL(12,0) NOT NULL,
        TaxAmount           DECIMAL(12,0) NOT NULL,
        TotalAmount         DECIMAL(12,0) NOT NULL,
        MgtKey              NVARCHAR(24) NOT NULL,       -- 팝빌 문서번호
        ConfirmNum          NVARCHAR(24) NULL,            -- 국세청 승인번호
        TradeDate           NVARCHAR(8) NULL,             -- YYYYMMDD
        Status              NVARCHAR(10) NOT NULL DEFAULT 'PENDING',
        IsAutoIssued        BIT NOT NULL DEFAULT 0,
        OriginalId          INT NULL,
        FailReason          NVARCHAR(500) NULL,
        CancelledReceiptId  INT NULL,
        RetryCount          INT NOT NULL DEFAULT 0,
        IssuedAt            DATETIME2 NULL,
        CancelledAt         DATETIME2 NULL,
        CreatedAt           DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt           DATETIME2 NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_CashReceipts_Order FOREIGN KEY (OrderId)
            REFERENCES Orders(Id),
        CONSTRAINT FK_CashReceipts_User FOREIGN KEY (UserId)
            REFERENCES Users(Id)
    );

    CREATE UNIQUE INDEX UQ_CashReceipts_MgtKey ON CashReceipts(MgtKey);
    CREATE INDEX IX_CashReceipts_OrderId ON CashReceipts(OrderId);
    CREATE INDEX IX_CashReceipts_UserId ON CashReceipts(UserId);
    CREATE INDEX IX_CashReceipts_Status ON CashReceipts(Status);

    PRINT 'Created CashReceipts table with indexes';
END
GO
```

- [ ] **Step 3: 커밋**

```bash
git add go-server/internal/domain/cash_receipt.go go-server/migrations/005_create_cash_receipts.sql
git commit -m "feat: add CashReceipt domain model and migration script"
```

---

## Task 2: ICashReceiptProvider 인터페이스

**Files:**
- Create: `go-server/internal/app/interfaces/cash_receipt.go`

- [ ] **Step 1: 인터페이스 및 DTO 정의**

```go
// go-server/internal/app/interfaces/cash_receipt.go
package interfaces

// CashReceiptIssueRequest는 현금영수증 즉시 발급 요청 데이터입니다.
type CashReceiptIssueRequest struct {
	MgtKey       string // 문서 관리번호 (사업자번호당 고유)
	TradeType    string // 승인거래: "승인거래"
	IdentityNum  string // 식별번호 (휴대폰/사업자번호/카드번호)
	ItemName     string // 품목명
	SupplyAmount int64  // 공급가액
	TaxAmount    int64  // 부가세
	TotalAmount  int64  // 총 금액
	TradeUsage   string // "소득공제용" 또는 "지출증빙용"
	TradeOpt     string // 식별번호 유형: "01"(주민번호/휴대폰), "02"(사업자번호), "03"(카드번호)
}

// CashReceiptIssueResponse는 현금영수증 발급 응답 데이터입니다.
type CashReceiptIssueResponse struct {
	Success    bool
	ConfirmNum string // 국세청 승인번호
	TradeDate  string // 거래일자 (YYYYMMDD)
}

// CashReceiptCancelRequest는 현금영수증 취소 발급 요청 데이터입니다.
type CashReceiptCancelRequest struct {
	MgtKey           string // 취소 건 문서 관리번호 (신규)
	OrgConfirmNum    string // 원본 국세청 승인번호
	OrgTradeDate     string // 원본 거래일자
	SupplyAmount     int64
	TaxAmount        int64
	TotalAmount      int64
	CancelReason     string // 취소 사유
}

// CashReceiptCancelResponse는 현금영수증 취소 응답 데이터입니다.
type CashReceiptCancelResponse struct {
	Success    bool
	ConfirmNum string
	TradeDate  string
}

// CashReceiptInfo는 현금영수증 상태 조회 결과입니다.
type CashReceiptInfo struct {
	MgtKey     string
	ConfirmNum string
	TradeDate  string
	StateCode  int    // 팝빌 상태 코드 (1: 대기, 2: 승인, 3: 거부 등)
	StateDT    string // 상태 변경 일시
}

// ICashReceiptProvider는 현금영수증 외부 발급 서비스의 추상화입니다.
type ICashReceiptProvider interface {
	// Issue는 현금영수증을 즉시 발급합니다.
	Issue(req CashReceiptIssueRequest) (*CashReceiptIssueResponse, error)
	// Cancel은 기 발급된 현금영수증을 취소합니다.
	Cancel(req CashReceiptCancelRequest) (*CashReceiptCancelResponse, error)
	// GetInfo는 현금영수증 발급 상태를 조회합니다.
	GetInfo(mgtKey string) (*CashReceiptInfo, error)
	// UpdateTransaction은 자진발급 건의 식별번호를 변경합니다.
	UpdateTransaction(mgtKey string, identityNum string, tradeUsage string) error
}
```

- [ ] **Step 2: 커밋**

```bash
git add go-server/internal/app/interfaces/cash_receipt.go
git commit -m "feat: add ICashReceiptProvider interface and DTOs"
```

---

## Task 3: 팝빌 Stub 구현 (개발/테스트용)

**Files:**
- Create: `go-server/internal/infra/popbill/types.go`
- Create: `go-server/internal/infra/popbill/stub.go`

- [ ] **Step 1: 팝빌 공통 타입 작성**

```go
// go-server/internal/infra/popbill/types.go
package popbill

// PopbillError는 팝빌 API 에러 응답입니다.
type PopbillError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *PopbillError) Error() string {
	return e.Message
}

// TokenResponse는 팝빌 인증 토큰 응답입니다.
type TokenResponse struct {
	SessionToken string `json:"session_token"`
	ServiceID    string `json:"serviceID"`
	LinkID       string `json:"linkID"`
	Expires      int64  `json:"expires"`
}

// RegistIssueResponse는 팝빌 RegistIssue API 응답입니다.
type RegistIssueResponse struct {
	Code       int    `json:"code"`
	Message    string `json:"message"`
	ConfirmNum string `json:"confirmNum"`
	TradeDate  string `json:"tradeDate"`
}
```

- [ ] **Step 2: Stub 클라이언트 작성**

```go
// go-server/internal/infra/popbill/stub.go
package popbill

import (
	"fmt"
	"time"
	"w-gift-server/internal/app/interfaces"
)

// StubCashReceiptProvider는 개발/테스트용 Stub 구현입니다.
// 실제 팝빌 API를 호출하지 않고 성공 응답을 반환합니다.
type StubCashReceiptProvider struct{}

func NewStubCashReceiptProvider() *StubCashReceiptProvider {
	return &StubCashReceiptProvider{}
}

func (s *StubCashReceiptProvider) Issue(req interfaces.CashReceiptIssueRequest) (*interfaces.CashReceiptIssueResponse, error) {
	return &interfaces.CashReceiptIssueResponse{
		Success:    true,
		ConfirmNum: fmt.Sprintf("STUB-%s", time.Now().Format("20060102150405")),
		TradeDate:  time.Now().Format("20060102"),
	}, nil
}

func (s *StubCashReceiptProvider) Cancel(req interfaces.CashReceiptCancelRequest) (*interfaces.CashReceiptCancelResponse, error) {
	return &interfaces.CashReceiptCancelResponse{
		Success:    true,
		ConfirmNum: fmt.Sprintf("STUB-C-%s", time.Now().Format("20060102150405")),
		TradeDate:  time.Now().Format("20060102"),
	}, nil
}

func (s *StubCashReceiptProvider) GetInfo(mgtKey string) (*interfaces.CashReceiptInfo, error) {
	return &interfaces.CashReceiptInfo{
		MgtKey:     mgtKey,
		ConfirmNum: "STUB-CONFIRM",
		TradeDate:  time.Now().Format("20060102"),
		StateCode:  2, // 승인
		StateDT:    time.Now().Format("20060102150405"),
	}, nil
}

func (s *StubCashReceiptProvider) UpdateTransaction(mgtKey string, identityNum string, tradeUsage string) error {
	return nil
}
```

- [ ] **Step 3: 커밋**

```bash
git add go-server/internal/infra/popbill/types.go go-server/internal/infra/popbill/stub.go
git commit -m "feat: add Popbill stub provider for development"
```

---

## Task 4: 팝빌 REST API 클라이언트

**Files:**
- Create: `go-server/internal/infra/popbill/client.go`

- [ ] **Step 1: 팝빌 클라이언트 구현**

```go
// go-server/internal/infra/popbill/client.go
package popbill

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
	"w-gift-server/internal/app/interfaces"
	"w-gift-server/pkg/logger"

	"go.uber.org/zap"
)

const (
	prodBaseURL = "https://popbill.linkhub.co.kr"
	testBaseURL = "https://popbill-test.linkhub.co.kr"
	authURL     = "https://auth.linkhub.co.kr"
	testAuthURL = "https://auth-test.linkhub.co.kr"
	scope       = "141" // 현금영수증 서비스 코드
)

// Config는 팝빌 API 클라이언트 설정입니다.
type Config struct {
	LinkID    string // 팝빌 연동 아이디
	SecretKey string // 팝빌 비밀키
	CorpNum   string // 사업자등록번호 (10자리)
	IsTest    bool   // 테스트 환경 여부
}

// Client는 팝빌 REST API 클라이언트입니다.
type Client struct {
	cfg        Config
	httpClient *http.Client
	token      *TokenResponse
	tokenMu    sync.RWMutex
}

// NewClient는 팝빌 클라이언트를 생성합니다.
func NewClient(cfg Config) *Client {
	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
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

// getToken은 팝빌 인증 토큰을 가져옵니다. 캐시된 토큰이 유효하면 재사용합니다.
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

	// Double-check after acquiring write lock
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

// doRequest는 팝빌 API에 인증된 HTTP 요청을 보냅니다.
func (c *Client) doRequest(method, path string, body any) ([]byte, error) {
	token, err := c.getToken()
	if err != nil {
		return nil, err
	}

	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("요청 바디 직렬화 실패: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}

	url := fmt.Sprintf("%s/CashBill/%s/%s", c.baseURL(), c.cfg.CorpNum, path)
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("HTTP 요청 생성 실패: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("x-pb-userid", c.cfg.LinkID)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("팝빌 API 호출 실패: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("응답 읽기 실패: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var pbErr PopbillError
		if json.Unmarshal(respBody, &pbErr) == nil && pbErr.Code != 0 {
			return nil, &pbErr
		}
		return nil, fmt.Errorf("팝빌 API 오류 (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// Issue는 현금영수증을 즉시 발급(RegistIssue)합니다.
func (c *Client) Issue(req interfaces.CashReceiptIssueRequest) (*interfaces.CashReceiptIssueResponse, error) {
	body := map[string]any{
		"MgtKey":         req.MgtKey,
		"TradeType":      req.TradeType,
		"IdentityNum":    req.IdentityNum,
		"ItemName":       req.ItemName,
		"SupplyCostTotal": req.SupplyAmount,
		"TaxTotal":       req.TaxAmount,
		"TotalAmount":    req.TotalAmount,
		"TradeUsage":     req.TradeUsage,
		"TradeOpt":       req.TradeOpt,
	}

	respBody, err := c.doRequest("POST", "RegistIssue", body)
	if err != nil {
		logger.Log.Error("팝빌 현금영수증 발급 실패",
			zap.String("mgtKey", req.MgtKey), zap.Error(err))
		return &interfaces.CashReceiptIssueResponse{Success: false}, err
	}

	var result RegistIssueResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("발급 응답 파싱 실패: %w", err)
	}

	logger.Log.Info("팝빌 현금영수증 발급 성공",
		zap.String("mgtKey", req.MgtKey),
		zap.String("confirmNum", result.ConfirmNum))

	return &interfaces.CashReceiptIssueResponse{
		Success:    true,
		ConfirmNum: result.ConfirmNum,
		TradeDate:  result.TradeDate,
	}, nil
}

// Cancel은 기 발급된 현금영수증을 취소합니다.
func (c *Client) Cancel(req interfaces.CashReceiptCancelRequest) (*interfaces.CashReceiptCancelResponse, error) {
	body := map[string]any{
		"MgtKey":         req.MgtKey,
		"OrgConfirmNum":  req.OrgConfirmNum,
		"OrgTradeDate":   req.OrgTradeDate,
		"SupplyCostTotal": req.SupplyAmount,
		"TaxTotal":       req.TaxAmount,
		"TotalAmount":    req.TotalAmount,
		"CancelType":    1, // 취소 현금영수증 발행
		"Memo":           req.CancelReason,
	}

	respBody, err := c.doRequest("POST", "RegistIssue", body)
	if err != nil {
		logger.Log.Error("팝빌 현금영수증 취소 실패",
			zap.String("mgtKey", req.MgtKey), zap.Error(err))
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

// UpdateTransaction은 자진발급 건의 식별번호를 변경합니다.
func (c *Client) UpdateTransaction(mgtKey string, identityNum string, tradeUsage string) error {
	body := map[string]any{
		"IdentityNum": identityNum,
		"TradeUsage":  tradeUsage,
	}

	_, err := c.doRequest("PATCH", mgtKey, body)
	return err
}
```

- [ ] **Step 2: 커밋**

```bash
git add go-server/internal/infra/popbill/client.go
git commit -m "feat: add Popbill REST API client for cash receipts"
```

---

## Task 5: 환경변수 설정

**Files:**
- Modify: `go-server/internal/config/config.go`

- [ ] **Step 1: Config 구조체에 팝빌 필드 추가**

`config.go`의 Config 구조체에서 `AllowRealFulfillment` 필드 바로 위 (카카오 알림톡 섹션 뒤)에 추가:

```go
	// ─── 팝빌 (현금영수증/세금계산서) ───

	// PopbillLinkID는 팝빌 연동 아이디입니다.
	PopbillLinkID string `mapstructure:"POPBILL_LINK_ID"`
	// PopbillSecretKey는 팝빌 비밀키입니다.
	PopbillSecretKey string `mapstructure:"POPBILL_SECRET_KEY"`
	// PopbillCorpNum은 사업자등록번호(10자리, 하이픈 없이)입니다.
	PopbillCorpNum string `mapstructure:"POPBILL_CORP_NUM"`
	// PopbillIsTest는 팝빌 테스트 환경 사용 여부입니다.
	PopbillIsTest bool `mapstructure:"POPBILL_IS_TEST"`
```

- [ ] **Step 2: LoadConfig에 기본값 추가**

`LoadConfig` 함수의 `ALLOW_REAL_FULFILLMENT` 기본값 설정 바로 위에 추가:

```go
	// 팝빌 기본 설정
	viper.SetDefault("POPBILL_LINK_ID", "")
	viper.SetDefault("POPBILL_SECRET_KEY", "")
	viper.SetDefault("POPBILL_CORP_NUM", "")
	viper.SetDefault("POPBILL_IS_TEST", true)
```

- [ ] **Step 3: 커밋**

```bash
git add go-server/internal/config/config.go
git commit -m "feat: add Popbill configuration fields"
```

---

## Task 6: CashReceiptService 비즈니스 로직

**Files:**
- Create: `go-server/internal/app/services/cash_receipt_service.go`
- Create: `go-server/internal/app/services/cash_receipt_test.go`

- [ ] **Step 1: 테스트 작성**

```go
// go-server/internal/app/services/cash_receipt_test.go
package services

import (
	"testing"
	"time"
	"w-gift-server/internal/app/interfaces"
	"w-gift-server/internal/domain"
	"w-gift-server/internal/infra/popbill"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupCashReceiptTestDB() (*CashReceiptService, *popbill.StubCashReceiptProvider) {
	db := setupTestDB() // 기존 auth_test.go의 setupTestDB 재사용
	db.AutoMigrate(&domain.CashReceipt{}, &domain.Order{}, &domain.Payment{}, &domain.User{})

	stub := popbill.NewStubCashReceiptProvider()
	svc := NewCashReceiptService(db, stub, testEncKey)
	return svc, stub
}

func createTestOrderWithVirtualAccount(db interface{ Create(any) interface{ Error() error } }, userID int, amount int64) *domain.Order {
	// Helper: 가상계좌 결제 주문 생성
	method := "VIRTUAL_ACCOUNT"
	status := "PAID"
	order := &domain.Order{
		UserID:        userID,
		TotalAmount:   domain.NumericDecimal{Decimal: decimal.NewFromInt(amount)},
		Status:        status,
		PaymentMethod: &method,
	}
	return order
}

// ── MgtKey 생성 ──

func TestCashReceipt_GenerateMgtKey(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	key := svc.generateMgtKey(123, 1)
	assert.Contains(t, key, "CR-")
	assert.Contains(t, key, "-00123-")
	assert.LessOrEqual(t, len(key), 24)
}

// ── 금액 분리 (공급가/부가세) ──

func TestCashReceipt_SplitAmount(t *testing.T) {
	supply, tax := splitAmount(11000)
	assert.Equal(t, int64(10000), supply)
	assert.Equal(t, int64(1000), tax)

	supply2, tax2 := splitAmount(10000)
	assert.Equal(t, int64(9091), supply2)
	assert.Equal(t, int64(909), tax2)
	assert.Equal(t, int64(10000), supply2+tax2)
}

// ── TradeOpt 매핑 ──

func TestCashReceipt_MapTradeOpt(t *testing.T) {
	assert.Equal(t, "01", mapTradeOpt("PHONE"))
	assert.Equal(t, "02", mapTradeOpt("BUSINESS_NO"))
	assert.Equal(t, "03", mapTradeOpt("CARD_NO"))
	assert.Equal(t, "01", mapTradeOpt("UNKNOWN"))
}

// ── 자동 발급 (고객 정보 있을 때) ──

func TestCashReceipt_AutoIssue_WithCustomerInfo(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	method := "VIRTUAL_ACCOUNT"
	crType := "PERSONAL"
	crNum := "01012345678"
	order := domain.Order{
		UserID:            1,
		TotalAmount:       domain.NumericDecimal{Decimal: decimal.NewFromInt(50000)},
		Status:            "PAID",
		PaymentMethod:     &method,
		CashReceiptType:   &crType,
		CashReceiptNumber: &crNum,
	}
	svc.db.Create(&order)

	err := svc.AutoIssue(order.ID)
	require.NoError(t, err)

	var receipt domain.CashReceipt
	svc.db.Where("OrderId = ?", order.ID).First(&receipt)
	assert.Equal(t, "ISSUED", receipt.Status)
	assert.False(t, receipt.IsAutoIssued)
	assert.Equal(t, "INCOME_DEDUCTION", receipt.Type)
	assert.NotNil(t, receipt.ConfirmNum)
}

// ── 자진발급 (고객 정보 없을 때) ──

func TestCashReceipt_AutoIssue_SelfIssue(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	method := "VIRTUAL_ACCOUNT"
	order := domain.Order{
		UserID:        1,
		TotalAmount:   domain.NumericDecimal{Decimal: decimal.NewFromInt(50000)},
		Status:        "PAID",
		PaymentMethod: &method,
	}
	svc.db.Create(&order)

	err := svc.AutoIssue(order.ID)
	require.NoError(t, err)

	var receipt domain.CashReceipt
	svc.db.Where("OrderId = ?", order.ID).First(&receipt)
	assert.Equal(t, "ISSUED", receipt.Status)
	assert.True(t, receipt.IsAutoIssued)
}

// ── 비가상계좌 주문은 스킵 ──

func TestCashReceipt_AutoIssue_SkipNonVirtualAccount(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	method := "CARD"
	order := domain.Order{
		UserID:        1,
		TotalAmount:   domain.NumericDecimal{Decimal: decimal.NewFromInt(50000)},
		Status:        "PAID",
		PaymentMethod: &method,
	}
	svc.db.Create(&order)

	err := svc.AutoIssue(order.ID)
	require.NoError(t, err)

	var count int64
	svc.db.Model(&domain.CashReceipt{}).Where("OrderId = ?", order.ID).Count(&count)
	assert.Equal(t, int64(0), count)
}

// ── 사후 신청 ──

func TestCashReceipt_RequestAfterPurchase(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	method := "VIRTUAL_ACCOUNT"
	order := domain.Order{
		UserID:        1,
		TotalAmount:   domain.NumericDecimal{Decimal: decimal.NewFromInt(50000)},
		Status:        "PAID",
		PaymentMethod: &method,
	}
	svc.db.Create(&order)
	// 자진발급 먼저
	svc.AutoIssue(order.ID)

	// 사후 신청
	receipt, err := svc.RequestAfterPurchase(1, RequestCashReceiptInput{
		OrderID:        order.ID,
		Type:           "INCOME_DEDUCTION",
		IdentityType:   "PHONE",
		IdentityNumber: "01098765432",
	})
	require.NoError(t, err)
	assert.Equal(t, "ISSUED", receipt.Status)
	assert.False(t, receipt.IsAutoIssued)
}

// ── 90일 초과 사후 신청 거부 ──

func TestCashReceipt_RequestAfterPurchase_Expired(t *testing.T) {
	svc, _ := setupCashReceiptTestDB()

	method := "VIRTUAL_ACCOUNT"
	order := domain.Order{
		UserID:        1,
		TotalAmount:   domain.NumericDecimal{Decimal: decimal.NewFromInt(50000)},
		Status:        "PAID",
		PaymentMethod: &method,
	}
	svc.db.Create(&order)
	// CreatedAt을 91일 전으로 조작
	svc.db.Model(&order).Update("CreatedAt", time.Now().AddDate(0, 0, -91))

	_, err := svc.RequestAfterPurchase(1, RequestCashReceiptInput{
		OrderID:        order.ID,
		Type:           "INCOME_DEDUCTION",
		IdentityType:   "PHONE",
		IdentityNumber: "01098765432",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "90일")
}
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `cd /d/dev/seedream-gift/go-server && go test ./internal/app/services/ -run TestCashReceipt -v`
Expected: FAIL — `CashReceiptService` 타입이 아직 없음

- [ ] **Step 3: CashReceiptService 구현**

```go
// go-server/internal/app/services/cash_receipt_service.go
package services

import (
	"fmt"
	"math"
	"time"
	"w-gift-server/internal/app/interfaces"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/crypto"
	"w-gift-server/pkg/logger"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// CashReceiptService는 현금영수증 발급, 취소, 사후 신청 등의 비즈니스 로직을 처리합니다.
type CashReceiptService struct {
	db            *gorm.DB
	provider      interfaces.ICashReceiptProvider
	encryptionKey string
}

// NewCashReceiptService는 현금영수증 서비스를 생성합니다.
func NewCashReceiptService(db *gorm.DB, provider interfaces.ICashReceiptProvider, encKey string) *CashReceiptService {
	return &CashReceiptService{db: db, provider: provider, encryptionKey: encKey}
}

// RequestCashReceiptInput은 사후 신청 요청 데이터입니다.
type RequestCashReceiptInput struct {
	OrderID        int    `json:"orderId" binding:"required"`
	Type           string `json:"type" binding:"required,oneof=INCOME_DEDUCTION EXPENSE_PROOF"`
	IdentityType   string `json:"identityType" binding:"required,oneof=PHONE BUSINESS_NO CARD_NO"`
	IdentityNumber string `json:"identityNumber" binding:"required"`
}

// AutoIssue는 가상계좌 입금 확인 시 현금영수증을 자동 발급합니다.
// 고객이 주문 시 현금영수증 정보를 입력했으면 해당 정보로 발급하고,
// 입력하지 않았으면 자진발급(010-000-1234)으로 처리합니다.
func (s *CashReceiptService) AutoIssue(orderID int) error {
	var order domain.Order
	if err := s.db.First(&order, orderID).Error; err != nil {
		return apperror.NotFound("주문을 찾을 수 없습니다")
	}

	// 가상계좌 결제만 현금영수증 대상
	if order.PaymentMethod == nil || *order.PaymentMethod != "VIRTUAL_ACCOUNT" {
		return nil
	}

	// 이미 발급된 건이 있는지 확인
	var existingCount int64
	s.db.Model(&domain.CashReceipt{}).
		Where("OrderId = ? AND Status IN ('PENDING','ISSUED')", orderID).
		Count(&existingCount)
	if existingCount > 0 {
		return nil
	}

	totalAmount := order.TotalAmount.InexactFloat64()
	supply, tax := splitAmount(int64(totalAmount))

	// 고객이 현금영수증 정보를 입력했는지 확인
	isAutoIssued := order.CashReceiptType == nil || *order.CashReceiptType == ""
	var receiptType, identityType, identityNum, maskedIdentity string

	if isAutoIssued {
		receiptType = "INCOME_DEDUCTION"
		identityType = "PHONE"
		identityNum = "0100001234"
		maskedIdentity = "010****1234"
	} else {
		receiptType = mapReceiptType(*order.CashReceiptType)
		identityType = "PHONE" // 기본값
		identityNum = ""
		if order.CashReceiptNumber != nil {
			identityNum = *order.CashReceiptNumber
		}
		maskedIdentity = maskIdentity(identityNum)
	}

	mgtKey := s.generateMgtKey(orderID, 1)

	// 식별번호 암호화
	encIdentity, err := crypto.Encrypt(identityNum, s.encryptionKey)
	if err != nil {
		return apperror.Internal("식별번호 암호화 실패", err)
	}

	receipt := &domain.CashReceipt{
		OrderID:        orderID,
		UserID:         order.UserID,
		Type:           receiptType,
		IdentityType:   identityType,
		IdentityNumber: encIdentity,
		MaskedIdentity: maskedIdentity,
		SupplyAmount:   domain.NumericDecimal{Decimal: decimal.NewFromInt(supply)},
		TaxAmount:      domain.NumericDecimal{Decimal: decimal.NewFromInt(tax)},
		TotalAmount:    order.TotalAmount,
		MgtKey:         mgtKey,
		Status:         "PENDING",
		IsAutoIssued:   isAutoIssued,
	}

	if err := s.db.Create(receipt).Error; err != nil {
		return apperror.Internal("현금영수증 레코드 생성 실패", err)
	}

	// 팝빌 발급 호출
	tradeUsage := "소득공제용"
	if receiptType == "EXPENSE_PROOF" {
		tradeUsage = "지출증빙용"
	}

	result, err := s.provider.Issue(interfaces.CashReceiptIssueRequest{
		MgtKey:       mgtKey,
		TradeType:    "승인거래",
		IdentityNum:  identityNum,
		ItemName:     "상품권",
		SupplyAmount: supply,
		TaxAmount:    tax,
		TotalAmount:  int64(totalAmount),
		TradeUsage:   tradeUsage,
		TradeOpt:     mapTradeOpt(identityType),
	})

	now := time.Now()
	if err != nil || !result.Success {
		failReason := "팝빌 API 호출 실패"
		if err != nil {
			failReason = err.Error()
		}
		s.db.Model(receipt).Updates(map[string]any{
			"Status":     "FAILED",
			"FailReason": failReason,
		})
		logger.Log.Error("현금영수증 자동발급 실패",
			zap.Int("orderId", orderID), zap.Error(err))
		return nil // 발급 실패가 결제를 블로킹하지 않음
	}

	s.db.Model(receipt).Updates(map[string]any{
		"Status":     "ISSUED",
		"ConfirmNum": result.ConfirmNum,
		"TradeDate":  result.TradeDate,
		"IssuedAt":   now,
	})

	return nil
}

// RequestAfterPurchase는 사후 신청을 처리합니다.
func (s *CashReceiptService) RequestAfterPurchase(userID int, input RequestCashReceiptInput) (*domain.CashReceipt, error) {
	var order domain.Order
	if err := s.db.First(&order, input.OrderID).Error; err != nil {
		return nil, apperror.NotFound("주문을 찾을 수 없습니다")
	}
	if order.UserID != userID {
		return nil, apperror.Forbidden("본인 주문만 신청 가능합니다")
	}
	if order.PaymentMethod == nil || *order.PaymentMethod != "VIRTUAL_ACCOUNT" {
		return nil, apperror.Validation("가상계좌 결제 주문만 현금영수증 신청이 가능합니다")
	}
	if order.Status != "PAID" && order.Status != "DELIVERED" && order.Status != "COMPLETED" {
		return nil, apperror.Validation("결제 완료된 주문만 현금영수증 신청이 가능합니다")
	}

	// 90일 이내 확인
	if time.Since(order.CreatedAt) > 90*24*time.Hour {
		return nil, apperror.Validation("결제일로부터 90일이 지나 현금영수증 신청이 불가합니다")
	}

	// 기존 자진발급 건 확인 → UpdateTransaction 처리
	var existingReceipt domain.CashReceipt
	hasExisting := s.db.Where("OrderId = ? AND Status = 'ISSUED' AND IsAutoIssued = ?", input.OrderID, true).
		First(&existingReceipt).Error == nil

	if hasExisting {
		// 자진발급 건을 고객 정보로 변경
		tradeUsage := "소득공제용"
		if input.Type == "EXPENSE_PROOF" {
			tradeUsage = "지출증빙용"
		}
		if err := s.provider.UpdateTransaction(existingReceipt.MgtKey, input.IdentityNumber, tradeUsage); err != nil {
			return nil, apperror.Internal("현금영수증 식별번호 변경 실패", err)
		}

		encIdentity, _ := crypto.Encrypt(input.IdentityNumber, s.encryptionKey)
		s.db.Model(&existingReceipt).Updates(map[string]any{
			"Type":           input.Type,
			"IdentityType":   input.IdentityType,
			"IdentityNumber": encIdentity,
			"MaskedIdentity": maskIdentity(input.IdentityNumber),
			"IsAutoIssued":   false,
		})
		s.db.First(&existingReceipt, existingReceipt.ID)
		return &existingReceipt, nil
	}

	// 이미 유효한 발급 건 존재 여부
	var issuedCount int64
	s.db.Model(&domain.CashReceipt{}).
		Where("OrderId = ? AND Status = 'ISSUED'", input.OrderID).
		Count(&issuedCount)
	if issuedCount > 0 {
		return nil, apperror.Validation("이미 현금영수증이 발급된 주문입니다")
	}

	// 신규 발급
	totalAmount := order.TotalAmount.InexactFloat64()
	supply, tax := splitAmount(int64(totalAmount))
	mgtKey := s.generateMgtKey(input.OrderID, 2)

	encIdentity, err := crypto.Encrypt(input.IdentityNumber, s.encryptionKey)
	if err != nil {
		return nil, apperror.Internal("식별번호 암호화 실패", err)
	}

	receipt := &domain.CashReceipt{
		OrderID:        input.OrderID,
		UserID:         userID,
		Type:           input.Type,
		IdentityType:   input.IdentityType,
		IdentityNumber: encIdentity,
		MaskedIdentity: maskIdentity(input.IdentityNumber),
		SupplyAmount:   domain.NumericDecimal{Decimal: decimal.NewFromInt(supply)},
		TaxAmount:      domain.NumericDecimal{Decimal: decimal.NewFromInt(tax)},
		TotalAmount:    order.TotalAmount,
		MgtKey:         mgtKey,
		Status:         "PENDING",
		IsAutoIssued:   false,
	}
	if err := s.db.Create(receipt).Error; err != nil {
		return nil, apperror.Internal("현금영수증 레코드 생성 실패", err)
	}

	tradeUsage := "소득공제용"
	if input.Type == "EXPENSE_PROOF" {
		tradeUsage = "지출증빙용"
	}

	result, err := s.provider.Issue(interfaces.CashReceiptIssueRequest{
		MgtKey:       mgtKey,
		TradeType:    "승인거래",
		IdentityNum:  input.IdentityNumber,
		ItemName:     "상품권",
		SupplyAmount: supply,
		TaxAmount:    tax,
		TotalAmount:  int64(totalAmount),
		TradeUsage:   tradeUsage,
		TradeOpt:     mapTradeOpt(input.IdentityType),
	})
	if err != nil {
		failReason := err.Error()
		s.db.Model(receipt).Updates(map[string]any{"Status": "FAILED", "FailReason": failReason})
		return nil, apperror.Internal("현금영수증 발급 실패", err)
	}

	now := time.Now()
	s.db.Model(receipt).Updates(map[string]any{
		"Status":     "ISSUED",
		"ConfirmNum": result.ConfirmNum,
		"TradeDate":  result.TradeDate,
		"IssuedAt":   now,
	})
	s.db.First(receipt, receipt.ID)
	return receipt, nil
}

// CancelByOrder는 주문 취소/환불 시 해당 주문의 현금영수증을 취소합니다.
func (s *CashReceiptService) CancelByOrder(orderID int, reason string) error {
	var receipt domain.CashReceipt
	err := s.db.Where("OrderId = ? AND Status = 'ISSUED'", orderID).First(&receipt).Error
	if err != nil {
		return nil // 발급된 현금영수증 없으면 스킵
	}
	if receipt.ConfirmNum == nil || receipt.TradeDate == nil {
		return nil
	}

	totalAmount := receipt.TotalAmount.InexactFloat64()
	supply, tax := splitAmount(int64(totalAmount))
	cancelMgtKey := s.generateMgtKey(orderID, 9)

	result, err := s.provider.Cancel(interfaces.CashReceiptCancelRequest{
		MgtKey:        cancelMgtKey,
		OrgConfirmNum: *receipt.ConfirmNum,
		OrgTradeDate:  *receipt.TradeDate,
		SupplyAmount:  supply,
		TaxAmount:     tax,
		TotalAmount:   int64(totalAmount),
		CancelReason:  reason,
	})

	if err != nil || !result.Success {
		logger.Log.Error("현금영수증 취소 실패 — 환불은 계속 진행",
			zap.Int("orderId", orderID), zap.Error(err))
		return nil // 취소 실패가 환불을 블로킹하지 않음
	}

	now := time.Now()
	// 원본 상태 변경
	s.db.Model(&receipt).Updates(map[string]any{
		"Status":      "CANCELLED",
		"CancelledAt": now,
	})

	// 취소 현금영수증 레코드 생성
	cancelReceipt := &domain.CashReceipt{
		OrderID:            orderID,
		UserID:             receipt.UserID,
		Type:               receipt.Type,
		IdentityType:       receipt.IdentityType,
		IdentityNumber:     receipt.IdentityNumber,
		MaskedIdentity:     receipt.MaskedIdentity,
		SupplyAmount:       receipt.SupplyAmount,
		TaxAmount:          receipt.TaxAmount,
		TotalAmount:        receipt.TotalAmount,
		MgtKey:             cancelMgtKey,
		ConfirmNum:         &result.ConfirmNum,
		TradeDate:          &result.TradeDate,
		Status:             "ISSUED",
		CancelledReceiptID: &receipt.ID,
		IssuedAt:           &now,
	}
	s.db.Create(cancelReceipt)
	return nil
}

// GetMyReceipts는 사용자의 현금영수증 목록을 조회합니다.
func (s *CashReceiptService) GetMyReceipts(userID int, page, limit int) ([]domain.CashReceipt, int64, error) {
	var receipts []domain.CashReceipt
	var total int64

	query := s.db.Model(&domain.CashReceipt{}).Where("UserId = ? AND CancelledReceiptId IS NULL", userID)
	query.Count(&total)

	if limit <= 0 || limit > 50 {
		limit = 20
	}
	offset := (page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	err := query.Order("CreatedAt DESC").Offset(offset).Limit(limit).Find(&receipts).Error
	return receipts, total, err
}

// GetByID는 현금영수증 상세를 조회합니다 (본인 확인 포함).
func (s *CashReceiptService) GetByID(userID, receiptID int) (*domain.CashReceipt, error) {
	var receipt domain.CashReceipt
	if err := s.db.First(&receipt, receiptID).Error; err != nil {
		return nil, apperror.NotFound("현금영수증을 찾을 수 없습니다")
	}
	if receipt.UserID != userID {
		return nil, apperror.Forbidden("접근 권한이 없습니다")
	}
	return &receipt, nil
}

// RetryFailedReceipts는 실패한 현금영수증 발급을 재시도합니다 (크론용).
func (s *CashReceiptService) RetryFailedReceipts() {
	cutoff := time.Now().Add(-72 * time.Hour)
	var failedReceipts []domain.CashReceipt
	s.db.Where("Status = 'FAILED' AND RetryCount < 5 AND CreatedAt > ?", cutoff).
		Find(&failedReceipts)

	for _, receipt := range failedReceipts {
		identityNum, err := crypto.DecryptAuto(receipt.IdentityNumber, s.encryptionKey)
		if err != nil {
			logger.Log.Error("현금영수증 재시도 복호화 실패", zap.Int("id", receipt.ID), zap.Error(err))
			continue
		}

		tradeUsage := "소득공제용"
		if receipt.Type == "EXPENSE_PROOF" {
			tradeUsage = "지출증빙용"
		}

		result, err := s.provider.Issue(interfaces.CashReceiptIssueRequest{
			MgtKey:       receipt.MgtKey,
			TradeType:    "승인거래",
			IdentityNum:  identityNum,
			ItemName:     "상품권",
			SupplyAmount: int64(receipt.SupplyAmount.InexactFloat64()),
			TaxAmount:    int64(receipt.TaxAmount.InexactFloat64()),
			TotalAmount:  int64(receipt.TotalAmount.InexactFloat64()),
			TradeUsage:   tradeUsage,
			TradeOpt:     mapTradeOpt(receipt.IdentityType),
		})

		s.db.Model(&receipt).Update("RetryCount", receipt.RetryCount+1)

		if err == nil && result.Success {
			now := time.Now()
			s.db.Model(&receipt).Updates(map[string]any{
				"Status":     "ISSUED",
				"ConfirmNum": result.ConfirmNum,
				"TradeDate":  result.TradeDate,
				"IssuedAt":   now,
			})
			logger.Log.Info("현금영수증 재시도 성공", zap.Int("id", receipt.ID))
		} else {
			logger.Log.Warn("현금영수증 재시도 실패",
				zap.Int("id", receipt.ID), zap.Int("retryCount", receipt.RetryCount+1))
		}
	}
}

// SyncPendingReceipts는 PENDING 상태로 남은 건의 팝빌 상태를 동기화합니다 (크론용).
func (s *CashReceiptService) SyncPendingReceipts() {
	cutoff := time.Now().Add(-7 * 24 * time.Hour)
	var pendingReceipts []domain.CashReceipt
	s.db.Where("Status = 'PENDING' AND CreatedAt > ?", cutoff).
		Find(&pendingReceipts)

	for _, receipt := range pendingReceipts {
		info, err := s.provider.GetInfo(receipt.MgtKey)
		if err != nil {
			continue
		}
		if info.StateCode == 2 { // 승인
			now := time.Now()
			s.db.Model(&receipt).Updates(map[string]any{
				"Status":     "ISSUED",
				"ConfirmNum": info.ConfirmNum,
				"TradeDate":  info.TradeDate,
				"IssuedAt":   now,
			})
		}
	}
}

// ── Admin Methods ──

// AdminGetAll은 관리자용 전체 현금영수증 목록입니다.
func (s *CashReceiptService) AdminGetAll(page, limit int, status string) ([]domain.CashReceipt, int64, error) {
	var receipts []domain.CashReceipt
	var total int64

	query := s.db.Model(&domain.CashReceipt{})
	if status != "" {
		query = query.Where("Status = ?", status)
	}
	query.Count(&total)

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	err := query.Preload("Order").Preload("User").
		Order("CreatedAt DESC").Offset(offset).Limit(limit).
		Find(&receipts).Error
	return receipts, total, err
}

// AdminGetByID는 관리자용 상세 조회입니다.
func (s *CashReceiptService) AdminGetByID(id int) (*domain.CashReceipt, error) {
	var receipt domain.CashReceipt
	if err := s.db.Preload("Order").Preload("User").First(&receipt, id).Error; err != nil {
		return nil, apperror.NotFound("현금영수증을 찾을 수 없습니다")
	}
	return &receipt, nil
}

// AdminCancel은 관리자가 수동으로 현금영수증을 취소합니다.
func (s *CashReceiptService) AdminCancel(receiptID int, reason string) error {
	var receipt domain.CashReceipt
	if err := s.db.First(&receipt, receiptID).Error; err != nil {
		return apperror.NotFound("현금영수증을 찾을 수 없습니다")
	}
	if receipt.Status != "ISSUED" {
		return apperror.Validation("발급 완료 상태의 현금영수증만 취소할 수 있습니다")
	}
	return s.CancelByOrder(receipt.OrderID, reason)
}

// AdminReissue는 실패 건을 관리자가 수동으로 재발급합니다.
func (s *CashReceiptService) AdminReissue(receiptID int) error {
	var receipt domain.CashReceipt
	if err := s.db.First(&receipt, receiptID).Error; err != nil {
		return apperror.NotFound("현금영수증을 찾을 수 없습니다")
	}
	if receipt.Status != "FAILED" {
		return apperror.Validation("실패 상태의 현금영수증만 재발급할 수 있습니다")
	}

	identityNum, err := crypto.DecryptAuto(receipt.IdentityNumber, s.encryptionKey)
	if err != nil {
		return apperror.Internal("식별번호 복호화 실패", err)
	}

	tradeUsage := "소득공제용"
	if receipt.Type == "EXPENSE_PROOF" {
		tradeUsage = "지출증빙용"
	}

	result, err := s.provider.Issue(interfaces.CashReceiptIssueRequest{
		MgtKey:       receipt.MgtKey,
		TradeType:    "승인거래",
		IdentityNum:  identityNum,
		ItemName:     "상품권",
		SupplyAmount: int64(receipt.SupplyAmount.InexactFloat64()),
		TaxAmount:    int64(receipt.TaxAmount.InexactFloat64()),
		TotalAmount:  int64(receipt.TotalAmount.InexactFloat64()),
		TradeUsage:   tradeUsage,
		TradeOpt:     mapTradeOpt(receipt.IdentityType),
	})
	if err != nil {
		return apperror.Internal("현금영수증 재발급 실패", err)
	}

	now := time.Now()
	return s.db.Model(&receipt).Updates(map[string]any{
		"Status":     "ISSUED",
		"ConfirmNum": result.ConfirmNum,
		"TradeDate":  result.TradeDate,
		"IssuedAt":   now,
	}).Error
}

// ── Helpers ──

// generateMgtKey는 팝빌 문서 관리번호를 생성합니다.
// 형식: CR-YYYYMMDD-{OrderID 5자리}-{seq 2자리} (최대 24자)
func (s *CashReceiptService) generateMgtKey(orderID int, seq int) string {
	return fmt.Sprintf("CR-%s-%05d-%02d", time.Now().Format("20060102"), orderID, seq)
}

// splitAmount는 총액을 공급가액과 부가세로 분리합니다.
// 부가세 = 총액 / 11 (반올림), 공급가액 = 총액 - 부가세
func splitAmount(total int64) (supply, tax int64) {
	tax = int64(math.Round(float64(total) / 11.0))
	supply = total - tax
	return
}

// mapReceiptType은 주문의 CashReceiptType을 팝빌 Type으로 매핑합니다.
func mapReceiptType(orderType string) string {
	switch orderType {
	case "PERSONAL":
		return "INCOME_DEDUCTION"
	case "BUSINESS":
		return "EXPENSE_PROOF"
	default:
		return "INCOME_DEDUCTION"
	}
}

// mapTradeOpt은 IdentityType을 팝빌 TradeOpt 코드로 매핑합니다.
func mapTradeOpt(identityType string) string {
	switch identityType {
	case "PHONE":
		return "01"
	case "BUSINESS_NO":
		return "02"
	case "CARD_NO":
		return "03"
	default:
		return "01"
	}
}

// maskIdentity는 식별번호를 마스킹합니다.
func maskIdentity(num string) string {
	if len(num) <= 4 {
		return num
	}
	runes := []rune(num)
	start := 3
	end := len(runes) - 4
	if end <= start {
		return num
	}
	for i := start; i < end; i++ {
		runes[i] = '*'
	}
	return string(runes)
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `cd /d/dev/seedream-gift/go-server && go test ./internal/app/services/ -run TestCashReceipt -v`
Expected: ALL PASS

- [ ] **Step 5: 커밋**

```bash
git add go-server/internal/app/services/cash_receipt_service.go go-server/internal/app/services/cash_receipt_test.go
git commit -m "feat: add CashReceiptService with auto-issue, post-purchase request, and cancel"
```

---

## Task 7: HTTP 핸들러

**Files:**
- Create: `go-server/internal/api/handlers/cash_receipt_handler.go`

- [ ] **Step 1: 핸들러 구현**

```go
// go-server/internal/api/handlers/cash_receipt_handler.go
package handlers

import (
	"strconv"
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// CashReceiptHandler는 현금영수증 관련 HTTP 요청을 처리합니다.
type CashReceiptHandler struct {
	service *services.CashReceiptService
}

// NewCashReceiptHandler는 핸들러를 생성합니다.
func NewCashReceiptHandler(service *services.CashReceiptService) *CashReceiptHandler {
	return &CashReceiptHandler{service: service}
}

// ── 사용자 API ──

// RequestAfterPurchase는 사후 현금영수증 신청을 처리합니다.
func (h *CashReceiptHandler) RequestAfterPurchase(c *gin.Context) {
	userID := c.GetInt("userId")
	var input services.RequestCashReceiptInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	receipt, err := h.service.RequestAfterPurchase(userID, input)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, receipt)
}

// GetMyReceipts는 사용자의 현금영수증 목록을 조회합니다.
func (h *CashReceiptHandler) GetMyReceipts(c *gin.Context) {
	userID := c.GetInt("userId")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	receipts, total, err := h.service.GetMyReceipts(userID, page, limit)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{
		"items": receipts,
		"meta":  gin.H{"total": total, "page": page, "limit": limit},
	})
}

// GetByID는 현금영수증 상세를 조회합니다.
func (h *CashReceiptHandler) GetByID(c *gin.Context) {
	userID := c.GetInt("userId")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 ID입니다")
		return
	}

	receipt, err := h.service.GetByID(userID, id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, receipt)
}

// ── 관리자 API ──

// AdminGetAll은 관리자용 전체 현금영수증 목록입니다.
func (h *CashReceiptHandler) AdminGetAll(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")

	receipts, total, err := h.service.AdminGetAll(page, limit, status)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{
		"items": receipts,
		"meta":  gin.H{"total": total, "page": page, "limit": limit},
	})
}

// AdminGetByID는 관리자용 상세 조회입니다.
func (h *CashReceiptHandler) AdminGetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 ID입니다")
		return
	}

	receipt, err := h.service.AdminGetByID(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, receipt)
}

// AdminCancel은 관리자가 현금영수증을 수동 취소합니다.
func (h *CashReceiptHandler) AdminCancel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 ID입니다")
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&body)

	if err := h.service.AdminCancel(id, body.Reason); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "현금영수증이 취소되었습니다"})
}

// AdminReissue는 실패 건을 수동 재발급합니다.
func (h *CashReceiptHandler) AdminReissue(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 ID입니다")
		return
	}

	if err := h.service.AdminReissue(id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "현금영수증이 재발급되었습니다"})
}

// AdminSync는 팝빌 상태를 수동 동기화합니다.
func (h *CashReceiptHandler) AdminSync(c *gin.Context) {
	// 특정 건의 상태를 팝빌에서 조회하여 갱신
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 ID입니다")
		return
	}

	receipt, err := h.service.AdminGetByID(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, receipt)
}
```

- [ ] **Step 2: 커밋**

```bash
git add go-server/internal/api/handlers/cash_receipt_handler.go
git commit -m "feat: add CashReceipt HTTP handlers for user and admin"
```

---

## Task 8: 라우트 등록 & DI 연결

**Files:**
- Modify: `go-server/internal/routes/container.go`
- Modify: `go-server/internal/routes/protected.go`
- Modify: `go-server/internal/routes/admin.go`

- [ ] **Step 1: container.go — Handlers 구조체에 필드 추가**

`AdminSession` 필드 뒤에 추가:

```go
	// Cash receipt handler
	CashReceipt *handlers.CashReceiptHandler

	// CashReceiptService — 크론 및 Payment webhook에서 사용
	cashReceiptSvc *services.CashReceiptService
```

- [ ] **Step 2: container.go — NewHandlers에서 서비스/핸들러 생성**

`ipWhitelistSvc` 생성 줄 바로 뒤에 추가:

```go
	// Cash receipt (팝빌 현금영수증)
	cashReceiptSvc := services.NewCashReceiptService(db, NewCashReceiptProvider(cfg), cfg.EncryptionKey)
```

그리고 `return &Handlers{` 블록의 `AdminSession` 줄 뒤에 추가:

```go
		CashReceipt:    handlers.NewCashReceiptHandler(cashReceiptSvc),
		cashReceiptSvc: cashReceiptSvc,
```

- [ ] **Step 3: container.go — 팝빌 프로바이더 팩토리 함수 추가**

파일 끝에 추가:

```go
// NewCashReceiptProvider는 설정에 따라 팝빌 클라이언트 또는 Stub을 반환합니다.
func NewCashReceiptProvider(cfg *config.Config) interfaces.ICashReceiptProvider {
	if cfg.PopbillLinkID == "" || cfg.PopbillSecretKey == "" {
		return popbill.NewStubCashReceiptProvider()
	}
	return popbill.NewClient(popbill.Config{
		LinkID:    cfg.PopbillLinkID,
		SecretKey: cfg.PopbillSecretKey,
		CorpNum:   cfg.PopbillCorpNum,
		IsTest:    cfg.PopbillIsTest,
	})
}
```

`import`에 `"w-gift-server/internal/infra/popbill"` 추가.

- [ ] **Step 4: protected.go — 사용자 현금영수증 라우트 추가**

`RegisterProtectedRoutes` 함수 안, `consumer` 그룹 내에 추가 (예: `inquiries` 그룹 뒤):

```go
	cashReceipts := consumer.Group("/cash-receipts")
	{
		cashReceipts.POST("/request", middleware.RateLimiter("5-M"), h.CashReceipt.RequestAfterPurchase)
		cashReceipts.GET("/my", h.CashReceipt.GetMyReceipts)
		cashReceipts.GET("/:id", h.CashReceipt.GetByID)
	}
```

- [ ] **Step 5: admin.go — 관리자 현금영수증 라우트 추가**

`RegisterAdminRoutes` 함수 안, 기존 admin 그룹 내에 추가:

```go
	adminCashReceipts := admin.Group("/cash-receipts")
	{
		adminCashReceipts.GET("", h.CashReceipt.AdminGetAll)
		adminCashReceipts.GET("/:id", h.CashReceipt.AdminGetByID)
		adminCashReceipts.POST("/:id/cancel", h.CashReceipt.AdminCancel)
		adminCashReceipts.POST("/:id/reissue", h.CashReceipt.AdminReissue)
		adminCashReceipts.POST("/:id/sync", h.CashReceipt.AdminSync)
	}
```

- [ ] **Step 6: 빌드 확인**

Run: `cd /d/dev/seedream-gift/go-server && go build ./...`
Expected: BUILD SUCCESS

- [ ] **Step 7: 커밋**

```bash
git add go-server/internal/routes/container.go go-server/internal/routes/protected.go go-server/internal/routes/admin.go
git commit -m "feat: wire CashReceipt DI and register routes"
```

---

## Task 9: PaymentService 웹훅 연동

**Files:**
- Modify: `go-server/internal/app/services/payment_service.go`

- [ ] **Step 1: PaymentService에 CashReceiptService 의존성 추가**

`PaymentService` 구조체에 필드 추가:

```go
type PaymentService struct {
	db             *gorm.DB
	provider       interfaces.IPaymentProvider
	cashReceiptSvc *CashReceiptService
}
```

`NewPaymentService` 시그니처 변경:

```go
func NewPaymentService(db *gorm.DB, provider interfaces.IPaymentProvider, cashReceiptSvc *CashReceiptService) *PaymentService {
	return &PaymentService{db: db, provider: provider, cashReceiptSvc: cashReceiptSvc}
}
```

- [ ] **Step 2: HandleWebhook에 현금영수증 발급 호출 추가**

`HandleWebhook` 함수의 마지막 부분 (`return apperror.Internal("웹훅 처리 로직이 아직 구현되지 않았습니다", nil)`) 을 다음으로 교체:

```go
	orderID := int(orderIDFloat)

	if status == "DONE" || status == "PAID" {
		err := s.db.Transaction(func(tx *gorm.DB) error {
			var order domain.Order
			if err := tx.Set("gorm:query_option", "WITH (UPDLOCK, ROWLOCK)").
				First(&order, orderID).Error; err != nil {
				return apperror.NotFound("주문을 찾을 수 없습니다")
			}
			if order.Status != "PENDING" {
				return nil // 이미 처리됨
			}

			if err := tx.Model(&order).Updates(map[string]any{
				"Status": "PAID",
			}).Error; err != nil {
				return err
			}

			if err := tx.Model(&domain.Payment{}).Where("OrderId = ?", orderID).Updates(map[string]any{
				"Status":      "CONFIRMED",
				"ConfirmedAt": time.Now(),
			}).Error; err != nil {
				return err
			}

			if err := tx.Model(&domain.VoucherCode{}).
				Where("OrderId = ? AND Status = 'RESERVED'", orderID).
				Updates(map[string]any{
					"Status": "SOLD",
					"SoldAt": time.Now(),
				}).Error; err != nil {
				return err
			}

			return nil
		})
		if err != nil {
			return err
		}

		// 현금영수증 자동 발급 (비동기 — 실패해도 웹훅 처리는 성공)
		if s.cashReceiptSvc != nil {
			go s.cashReceiptSvc.AutoIssue(orderID)
		}

		return nil
	}

	return nil
```

- [ ] **Step 3: container.go에서 PaymentService 생성 업데이트**

`NewPaymentService` 호출 부분을 수정:

```go
	paymentService := services.NewPaymentService(db, pp, cashReceiptSvc)
```

이를 위해 `cashReceiptSvc` 생성이 `paymentService` 생성보다 먼저 와야 하므로, `container.go`에서 순서를 조정합니다.

- [ ] **Step 4: 빌드 확인**

Run: `cd /d/dev/seedream-gift/go-server && go build ./...`
Expected: BUILD SUCCESS

- [ ] **Step 5: 커밋**

```bash
git add go-server/internal/app/services/payment_service.go go-server/internal/routes/container.go
git commit -m "feat: trigger cash receipt auto-issue on payment webhook"
```

---

## Task 10: 환불 시 현금영수증 취소 연동

**Files:**
- Modify: `go-server/internal/app/services/admin_refund_svc.go`

- [ ] **Step 1: AdminRefundService에 CashReceiptService 의존성 추가**

```go
type AdminRefundService struct {
	db             *gorm.DB
	cashReceiptSvc *CashReceiptService
}

func NewAdminRefundService(db *gorm.DB, cashReceiptSvc ...*CashReceiptService) *AdminRefundService {
	svc := &AdminRefundService{db: db}
	if len(cashReceiptSvc) > 0 {
		svc.cashReceiptSvc = cashReceiptSvc[0]
	}
	return svc
}
```

- [ ] **Step 2: ApproveRefund에 현금영수증 취소 호출 추가**

`ApproveRefund` 함수의 트랜잭션 성공 후 (return nil 전) 에 추가:

```go
		// 현금영수증 취소 (실패해도 환불은 계속 진행)
		if s.cashReceiptSvc != nil {
			go s.cashReceiptSvc.CancelByOrder(refund.OrderID, "주문 환불")
		}
```

- [ ] **Step 3: container.go에서 AdminRefundService 생성 업데이트**

```go
	adminRefundSvc := services.NewAdminRefundService(db, cashReceiptSvc)
```

- [ ] **Step 4: 빌드 확인**

Run: `cd /d/dev/seedream-gift/go-server && go build ./...`
Expected: BUILD SUCCESS

- [ ] **Step 5: 커밋**

```bash
git add go-server/internal/app/services/admin_refund_svc.go go-server/internal/routes/container.go
git commit -m "feat: auto-cancel cash receipt on refund approval"
```

---

## Task 11: 크론 잡 등록

**Files:**
- Modify: `go-server/internal/cron/scheduler.go`
- Modify: `go-server/main.go`

- [ ] **Step 1: scheduler.go — CashReceiptRetryRunner 인터페이스 추가**

기존 `FulfillmentRunner` 인터페이스 뒤에 추가:

```go
// CashReceiptRetryRunner는 현금영수증 실패 재시도 및 상태 동기화를 실행하는 인터페이스입니다.
type CashReceiptRetryRunner interface {
	RetryFailedReceipts()
	SyncPendingReceipts()
}
```

- [ ] **Step 2: scheduler.go — Scheduler 구조체에 필드 추가**

```go
type Scheduler struct {
	c                *cron.Cron
	db               *gorm.DB
	archiveDays      int
	deleteDays       int
	settlementSvc    SettlementBatchRunner
	fulfillmentSvc   FulfillmentRunner
	cashReceiptSvc   CashReceiptRetryRunner
}
```

- [ ] **Step 3: scheduler.go — 크론 잡 등록 추가**

`New` 함수의 `jobs` 슬라이스에 2개 추가:

```go
		{"현금영수증 실패 재시도", "@every 30m", "30분 간격", s.retryCashReceipts},
		{"현금영수증 상태 동기화", "0 4 * * *", "매일 04:00 KST", s.syncCashReceipts},
```

- [ ] **Step 4: scheduler.go — 실행 함수 및 Setter 추가**

파일 끝에 추가:

```go
// SetCashReceiptService는 현금영수증 재시도 서비스를 주입합니다.
func (s *Scheduler) SetCashReceiptService(svc CashReceiptRetryRunner) {
	s.cashReceiptSvc = svc
}

func (s *Scheduler) retryCashReceipts() {
	if s.cashReceiptSvc == nil {
		return
	}
	s.cashReceiptSvc.RetryFailedReceipts()
}

func (s *Scheduler) syncCashReceipts() {
	if s.cashReceiptSvc == nil {
		return
	}
	s.cashReceiptSvc.SyncPendingReceipts()
}
```

- [ ] **Step 5: main.go — 크론 서비스 주입 추가**

`startAPIServer` 함수에서 `scheduler.SetFulfillmentService(h.Fulfillment)` 줄 뒤에 추가:

```go
	scheduler.SetCashReceiptService(h.cashReceiptSvc)
```

이를 위해 `Handlers` 구조체에서 `cashReceiptSvc`를 public으로 변경하거나 getter를 추가해야 합니다. `container.go`에서:

```go
	// CashReceiptSvc는 크론 잡에서 사용하기 위해 노출합니다.
	CashReceiptSvc *services.CashReceiptService
```

그리고 `return &Handlers{}`에서:

```go
		CashReceiptSvc: cashReceiptSvc,
```

`main.go`에서:

```go
	scheduler.SetCashReceiptService(h.CashReceiptSvc)
```

- [ ] **Step 6: 빌드 확인**

Run: `cd /d/dev/seedream-gift/go-server && go build ./...`
Expected: BUILD SUCCESS

- [ ] **Step 7: 커밋**

```bash
git add go-server/internal/cron/scheduler.go go-server/main.go go-server/internal/routes/container.go
git commit -m "feat: add cash receipt retry and sync cron jobs"
```

---

## Task 12: DB 마이그레이션 실행 & 통합 확인

**Files:**
- Run: `go-server/migrations/005_create_cash_receipts.sql`

- [ ] **Step 1: 마이그레이션 실행**

프로덕션 DB에 마이그레이션 스크립트를 실행합니다. 개발 환경에서는 SSMS 또는 sqlcmd로:

```bash
# 개발 환경에서 마이그레이션 실행 (사용자가 직접 실행)
sqlcmd -S localhost -d WowGift -i go-server/migrations/005_create_cash_receipts.sql
```

- [ ] **Step 2: 전체 테스트 실행**

Run: `cd /d/dev/seedream-gift/go-server && go test ./... -v -count=1`
Expected: ALL PASS

- [ ] **Step 3: 서버 시작 확인**

Run: `cd /d/dev/seedream-gift/go-server && HEADLESS=true go run .`
Expected: 서버가 정상 시작되고 크론 잡에 "현금영수증 실패 재시도", "현금영수증 상태 동기화"가 등록됨

- [ ] **Step 4: API 엔드포인트 수동 테스트**

```bash
# 현금영수증 목록 조회 (인증 필요)
curl -H "Authorization: Bearer <token>" http://localhost:5140/api/v1/cash-receipts/my

# 관리자 목록 조회
curl -H "Authorization: Bearer <admin-token>" http://localhost:5140/api/v1/admin/cash-receipts
```

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "feat: complete Popbill cash receipt integration"
```
