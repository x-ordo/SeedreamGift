# 외부 상품권 발급 API 연동 설계

## 1. 개요

씨드림기프트 플랫폼에서 고객이 상품권을 구매(결제 완료)하면, 외부 발급 API를 자동 호출하여 PIN을 받아 즉시 제공하는 시스템.

**현재**: 관리자가 PIN을 수동 업로드 → 주문 시 재고에서 할당 → 관리자가 "자동 발급" 클릭
**목표**: 결제 완료 즉시 외부 API 호출 → PIN 수신 → 자동 배송 (관리자 개입 없음)

### 제약 조건
- 외부 API 스펙 미확정 — 유연한 어댑터 구조 필수
- 첫 제공업체: 이엑스페이(EXPay)
- 향후 브랜드별 다른 업체 추가 가능
- 기존 수동 재고 방식과 병행 (상품별 선택)

## 2. 아키텍처

### 2.1 발급 플로우

```
고객 결제 완료 (PAID)
  │
  ├─ Product.FulfillmentType == "STOCK"
  │    → 기존 로직 (수동 재고 할당 + 관리자 발급)
  │
  └─ Product.FulfillmentType == "API"
       → FulfillmentPipeline 진입
         1. Provider 조회 (Product.ProviderCode → "EXPAY")
         2. VoucherIssuer.Issue() 호출
         3. 성공 → VoucherCode 생성/저장 → Order DELIVERED → 고객 알림
         4. 실패 → 재시도 (최대 3회, 지수 백오프)
         5. 최종 실패 → 자동 환불 + 텔레그램 알림 + IssuanceLog 기록
```

### 2.2 주문 생성 시 분기 (CreateOrder)

`FulfillmentType=API` 상품은 바우처 사전 예약(RESERVED) 단계를 건너뜁니다:

```
CreateOrder:
  for each OrderItem:
    if product.FulfillmentType == "STOCK" && product.Type == "DIGITAL":
      → 기존 로직: VoucherCode AVAILABLE → RESERVED
    if product.FulfillmentType == "API":
      → 건너뜀 (결제 후 외부 API에서 발급)
```

### 2.3 혼합 주문 제한

**하나의 주문에 STOCK과 API 상품을 혼합할 수 없음.** `CreateOrder` 검증에서 차단:
- 장바구니에 STOCK+API가 섞여 있으면 → "발급 방식이 다른 상품은 별도 주문해주세요" 에러

### 2.4 컴포넌트 구조

```
go-server/
├── internal/
│   ├── domain/
│   │   └── issuance.go              # IssuanceLog 모델
│   ├── app/
│   │   ├── interfaces/
│   │   │   └── voucher_issuer.go    # VoucherIssuer 인터페이스
│   │   └── services/
│   │       └── fulfillment_svc.go   # FulfillmentService (파이프라인 오케스트레이터)
│   └── infra/
│       └── issuance/
│           ├── expay_issuer.go      # EXPay 구현체
│           └── stub_issuer.go       # 테스트용 스텁
```

## 3. 인터페이스 설계

### 3.1 VoucherIssuer (Provider Interface)

```go
package interfaces

type IssuedVoucher struct {
    PinCode         string
    SecurityCode    string
    ExpiresAt       *time.Time
    TransactionRef  string // 외부 거래 참조 ID
}

type IssueRequest struct {
    ProductCode  string // Product.ProviderProductCode 값
    Quantity     int
    OrderCode    string // 우리 주문번호 (멱등성 키)
}

type VoucherIssuer interface {
    // Issue는 외부 API를 호출하여 상품권을 발급합니다.
    Issue(ctx context.Context, req IssueRequest) ([]IssuedVoucher, error)
    // ProviderCode는 이 발급자의 고유 코드를 반환합니다.
    ProviderCode() string
}
```

> **Phase 1에서는 동기 API만 지원.** 비동기(PENDING) 응답을 반환하는 Provider는 향후 `CheckStatus()` 메서드를 인터페이스에 추가하여 대응.

### 3.2 EXPay 구현체 (스켈레톤)

```go
type EXPayIssuer struct {
    baseURL    string
    apiKey     string
    httpClient *http.Client // Timeout: 10s
}

func (e *EXPayIssuer) Issue(ctx context.Context, req IssueRequest) ([]IssuedVoucher, error) {
    // TODO: API 스펙 수신 후 구현
    return nil, fmt.Errorf("EXPay API 스펙 미확정 — 구현 대기")
}

func (e *EXPayIssuer) ProviderCode() string { return "EXPAY" }
```

### 3.3 StubIssuer (개발/테스트용)

```go
type StubIssuer struct{}

func (s *StubIssuer) Issue(ctx context.Context, req IssueRequest) ([]IssuedVoucher, error) {
    var vouchers []IssuedVoucher
    for i := 0; i < req.Quantity; i++ {
        vouchers = append(vouchers, IssuedVoucher{
            PinCode:        fmt.Sprintf("STUB-%s-%04d", req.OrderCode, i+1),
            TransactionRef: fmt.Sprintf("STUB-TX-%d", time.Now().UnixMilli()),
        })
    }
    return vouchers, nil
}

func (s *StubIssuer) ProviderCode() string { return "STUB" }
```

## 4. FulfillmentService (파이프라인 오케스트레이터)

```go
type FulfillmentService struct {
    db        *gorm.DB
    issuers   map[string]VoucherIssuer
    encKey    string
    notifSvc  *notification.Service
    paymentPP interfaces.IPaymentProvider
}
```

### 4.1 FulfillOrder 로직

```
FulfillOrder(ctx, orderID):
  1. Order + Items + Products 로드 (Preload)
  2. FulfillmentType != "API" → return nil
  3. 멱등성 체크: IssuanceLog에 이미 SUCCESS 기록 있으면 → return nil
  4. IssuanceLog 생성 (status=PENDING)
  5. Provider 조회: issuers[product.ProviderCode]
  6. 재시도 루프 (최대 3회):
     - Issue(ctx, IssueRequest{ProductCode: product.ProviderProductCode, ...})
     - 성공 → break
     - 실패 → 대기 후 재시도
  7. 성공 시:
     - 각 IssuedVoucher → VoucherCode 레코드 생성 (PIN AES-256 암호화)
     - Order.Status → DELIVERED, DigitalDeliveryAt 설정
     - IssuanceLog.Status → SUCCESS
     - 고객 알림 (기존 notification.DeliveryComplete 사용)
  8. 최종 실패 시:
     - IssuanceLog.Status → FAILED
     - Order.Status → CANCELLED, AdminNote → "API_ISSUANCE_FAILURE: {error}"
     - PaymentProvider.RefundPayment(paymentKey, "상품권 발급 실패") → Refund 레코드 생성
     - 환불도 실패하면: IssuanceLog.Status → FAILED_REFUND_PENDING, 텔레그램에 환불 실패도 알림
     - 텔레그램 알림
     - 고객 이메일: "발급 실패로 자동 환불 처리되었습니다"
```

### 4.2 재시도 정책

| 시도 | 대기 | 설명 |
|------|------|------|
| 1차 | 즉시 | 첫 호출 |
| 2차 | 2초 | 일시적 네트워크 오류 대응 |
| 3차 | 5초 | 서버 과부하 대응 |
| 최종 실패 | — | 환불 + 텔레그램 + 로그 |

### 4.3 로그 마스킹

IssuanceLog에 저장할 때:
- `RequestPayload`: PIN 필드 없으므로 그대로 저장
- `ResponsePayload`: PIN 필드를 `"****"` 로 치환 후 저장
- `FulfillmentService`가 PIN을 VoucherCode에 저장한 후, 로그 기록 전에 마스킹

## 5. 호출 시점 (트리거)

### 5.1 크론 기반 발급 (goroutine 대신)

서버 크래시/재시작에도 안전하도록 **크론 스케줄러**로 발급:

```go
// cron/scheduler.go에 추가
scheduler.AddFunc("@every 15s", fulfillmentSvc.ProcessPendingOrders)
```

```
ProcessPendingOrders():
  1. SELECT Orders WHERE Status='PAID'
     AND FulfillmentType='API' (Products JOIN)
     AND NOT EXISTS (IssuanceLogs WHERE Status='SUCCESS' AND OrderId=Orders.Id)
     AND (IssuanceLogs.Status IS NULL OR IssuanceLogs.Status IN ('PENDING','FAILED'))
  2. 각 주문에 대해 FulfillOrder() 실행
  3. 이미 3회 시도한 주문은 최종 실패 처리
```

**장점:**
- 서버 재시작 시 PAID 상태로 남은 주문을 자동 재처리
- goroutine 누수 없음
- 그레이스풀 셧다운 시 안전하게 중단

### 5.2 즉시 발급 (보조)

`ProcessPayment` 완료 후 `ProcessPendingOrders()`를 한 번 즉시 호출하여 15초 대기 없이 빠르게 발급:

```go
// ProcessPayment 끝에:
if hasAPIProducts {
    go fulfillmentSvc.ProcessPendingOrders() // 즉시 1회 실행 (크론과 별도)
}
```

### 5.3 고객 주문 상태 표시

- `PAID` + FulfillmentType=API → "발급 진행 중..."
- `DELIVERED` → PIN 표시
- `CANCELLED` + AdminNote contains "API_ISSUANCE_FAILURE" → "발급 실패 — 환불 처리됨"

## 6. DB 변경

### 6.1 Products 테이블 (3개 컬럼 추가)

```sql
ALTER TABLE Products ADD FulfillmentType NVARCHAR(10) NOT NULL DEFAULT 'STOCK';
ALTER TABLE Products ADD ProviderCode NVARCHAR(20) NULL;
ALTER TABLE Products ADD ProviderProductCode NVARCHAR(50) NULL;
```

### 6.2 VoucherCodes 테이블 (1개 컬럼 추가)

```sql
ALTER TABLE VoucherCodes ADD ExternalTransactionRef NVARCHAR(100) NULL;
```

### 6.3 IssuanceLogs 테이블 (신규)

```sql
CREATE TABLE IssuanceLogs (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    OrderId         INT NOT NULL,
    OrderItemId     INT NOT NULL,
    ProductId       INT NOT NULL,
    ProviderCode    NVARCHAR(20) NOT NULL,
    Status          NVARCHAR(20) NOT NULL,  -- PENDING, SUCCESS, FAILED, REFUNDED, FAILED_REFUND_PENDING
    AttemptCount    INT NOT NULL DEFAULT 0,
    RequestPayload  NVARCHAR(MAX) NULL,
    ResponsePayload NVARCHAR(MAX) NULL,     -- PIN 마스킹 후 저장
    ErrorMessage    NVARCHAR(500) NULL,
    TransactionRef  NVARCHAR(100) NULL,
    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
    CompletedAt     DATETIME2 NULL,
    CONSTRAINT FK_IssuanceLog_Order FOREIGN KEY (OrderId) REFERENCES Orders(Id)
);

CREATE INDEX IX_IssuanceLog_OrderId ON IssuanceLogs(OrderId);
CREATE INDEX IX_IssuanceLog_Status ON IssuanceLogs(Status);
```

## 7. 도메인 모델 변경

### 7.1 Product (3개 필드 추가)

```go
FulfillmentType     string  `gorm:"column:FulfillmentType;default:'STOCK';size:10" json:"fulfillmentType"`
ProviderCode        *string `gorm:"column:ProviderCode;size:20" json:"providerCode"`
ProviderProductCode *string `gorm:"column:ProviderProductCode;size:50" json:"providerProductCode"`
```

### 7.2 VoucherCode (1개 필드 추가)

```go
ExternalTransactionRef *string `gorm:"column:ExternalTransactionRef;size:100" json:"externalTransactionRef"`
```

### 7.3 IssuanceLog (신규 모델)

```go
type IssuanceLog struct {
    ID              int        `gorm:"primaryKey;column:Id;autoIncrement" json:"id"`
    OrderID         int        `gorm:"column:OrderId;index" json:"orderId"`
    OrderItemID     int        `gorm:"column:OrderItemId" json:"orderItemId"`
    ProductID       int        `gorm:"column:ProductId" json:"productId"`
    ProviderCode    string     `gorm:"column:ProviderCode;size:20" json:"providerCode"`
    Status          string     `gorm:"column:Status;size:20;index" json:"status"`
    AttemptCount    int        `gorm:"column:AttemptCount;default:0" json:"attemptCount"`
    RequestPayload  *string    `gorm:"column:RequestPayload;type:nvarchar(max)" json:"requestPayload"`
    ResponsePayload *string    `gorm:"column:ResponsePayload;type:nvarchar(max)" json:"responsePayload"`
    ErrorMessage    *string    `gorm:"column:ErrorMessage;size:500" json:"errorMessage"`
    TransactionRef  *string    `gorm:"column:TransactionRef;size:100" json:"transactionRef"`
    CreatedAt       time.Time  `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
    CompletedAt     *time.Time `gorm:"column:CompletedAt" json:"completedAt"`
}

func (IssuanceLog) TableName() string { return "IssuanceLogs" }
```

### 7.4 Validation 추가

```go
var ValidFulfillmentTypes = map[string]bool{"STOCK": true, "API": true}

func ValidateProductCreate(p *Product) error {
    // ... 기존 검증 ...
    if !ValidFulfillmentTypes[p.FulfillmentType] {
        return fmt.Errorf("유효하지 않은 발급 방식: %s", p.FulfillmentType)
    }
    if p.FulfillmentType == "API" && (p.ProviderCode == nil || *p.ProviderCode == "") {
        return fmt.Errorf("API 발급 상품은 ProviderCode가 필수입니다")
    }
}
```

## 8. 주문 상태 머신 (변경 없음)

기존 상태 전이를 그대로 사용:
- `PAID → DELIVERED` (발급 성공)
- `PAID → CANCELLED` (발급 실패 → 환불)
- `PAID → REFUNDED` (환불 직접 처리 시)

발급 실패와 사용자 취소를 구분하기 위해 `Order.AdminNote`에 `"API_ISSUANCE_FAILURE: {error}"` 기록.

## 9. Admin UI 변경

### 9.1 상품 편집 — 발급 방식 설정

ProductsTab 상품 생성/수정 모달에 추가:
- **발급 방식** 선택: `수동 재고` / `외부 API`
- `외부 API` 선택 시:
  - **제공업체**: 드롭다운 (EXPAY, ...)
  - **외부 상품코드**: 텍스트 입력

### 9.2 주문 목록 — 발급 상태 표시

- API 발급 상품: PAID 상태에서 "발급 중" 뱃지 표시
- 실패 시: "발급 실패" 뱃지 + AdminNote에 사유

### 9.3 발급 로그 조회

OrdersTab 주문 상세에서 IssuanceLog 확인:
- 시도 횟수, 각 시도의 에러/응답, 최종 상태

## 10. DI 연결 (container.go)

```go
// container.go NewHandlers()에 추가:
stubIssuer := issuance.NewStubIssuer()
issuers := map[string]interfaces.VoucherIssuer{
    stubIssuer.ProviderCode(): stubIssuer,
}
if cfg.EXPayAPIKey != "" {
    expay := issuance.NewEXPayIssuer(cfg.EXPayBaseURL, cfg.EXPayAPIKey)
    issuers[expay.ProviderCode()] = expay
}
fulfillmentSvc := services.NewFulfillmentService(db, issuers, cfg.EncryptionKey, notifSvc, pp)

// cron scheduler에 등록:
scheduler.AddFunc("@every 15s", fulfillmentSvc.ProcessPendingOrders)
```

## 11. 보안

- 외부 API 인증 정보: `.env` 환경변수 (`EXPAY_BASE_URL`, `EXPAY_API_KEY`)
- PIN 수신 즉시 AES-256 암호화 저장 (기존 패턴)
- IssuanceLog 응답에서 PIN 마스킹 후 저장
- Provider별 HTTP 타임아웃: 10초
- 구조화 로깅: `logger.Log` (zap) 사용, PIN 원문 로깅 금지

## 12. 범위 외 (향후)

- 비동기 Provider 대응 (CheckStatus 폴링)
- 외부 API 실시간 재고 조회
- 발급 취소/교환 API 연동
- 대량 발급 배치 처리
- EXPay 외 추가 제공업체 (스펙 수신 시)
- 발급 로그 전용 Admin 탭 (현재는 주문 상세에서 조회)
