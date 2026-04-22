# 팝빌 현금영수증 API 연동 설계

## 1. 개요

상품권 매매 플랫폼의 법적 의무(5만원 이상 현금 거래 시 현금영수증 발급 의무)를 충족하기 위해
**팝빌(Popbill) 현금영수증 API**를 연동한다.

### 범위

- 가상계좌 입금 결제에 대해서만 현금영수증 발급 (카드 결제는 카드사가 처리)
- 결제 완료 시 자동 발급 (고객 정보 입력 시) 또는 자진발급 (미입력 시)
- 사후 신청: 결제 후 90일 이내 미발급 건에 대해 고객이 직접 신청
- 주문 취소/환불 시 현금영수증 자동 취소

### 범위 외

- 세금계산서 (팝빌 계정은 공유하나, 이번 스펙 범위 밖)
- 카드 결제 현금영수증 (카드사 자동 처리)
- 삼성 현금카드 (결제수단 추가 시 별도 스펙)

---

## 2. 팝빌 SDK 연동

### 사용 SDK

Go용 팝빌 SDK: `github.com/nicepay/popbill.go` 또는 팝빌 REST API 직접 호출.
팝빌 Go SDK가 없을 경우 **REST API + HTTP 클라이언트** 방식으로 구현한다.

### 사용할 팝빌 API

| 팝빌 API | 용도 | 호출 시점 |
|----------|------|----------|
| `RegistIssue` | 즉시 발급 (등록 + 발행 원스텝) | 가상계좌 입금 확인 시 |
| `CancelIssue` | 취소 현금영수증 발행 | 주문 취소/환불 승인 시 |
| `GetInfo` | 단건 상태 조회 | 상태 동기화, 관리자 상세 조회 |
| `Search` | 기간별 목록 조회 | 관리자 리포트 |
| `UpdateTransaction` | 자진발급 → 고객 정보로 수정 | 사후 신청 처리 시 |

### 팝빌 인증 정보 (환경변수)

```env
POPBILL_LINK_ID=...           # 팝빌 연동 아이디
POPBILL_SECRET_KEY=...        # 팝빌 비밀키
POPBILL_CORP_NUM=...          # 사업자등록번호 (10자리, 하이픈 없이)
POPBILL_IS_TEST=true          # 테스트 환경 여부
```

---

## 3. 도메인 모델

### 3.1 CashReceipt (신규 테이블)

```go
type CashReceipt struct {
    ID                int            `gorm:"primaryKey;column:Id"`
    OrderID           int            `gorm:"index;column:OrderId"`
    Order             Order          `gorm:"foreignKey:OrderID"`
    UserID            int            `gorm:"index;column:UserId"`
    User              User           `gorm:"foreignKey:UserID"`

    // 발급 유형: INCOME_DEDUCTION(소득공제), EXPENSE_PROOF(지출증빙)
    Type              string         `gorm:"column:Type;size:20"`
    // 식별 유형: PHONE, BUSINESS_NO, CARD_NO
    IdentityType      string         `gorm:"column:IdentityType;size:15"`
    // 식별 번호 (암호화 저장)
    IdentityNumber    string         `gorm:"column:IdentityNumber;size:200"`
    // 공급가액
    SupplyAmount      NumericDecimal `gorm:"column:SupplyAmount;type:decimal(12,0)"`
    // 부가세
    TaxAmount         NumericDecimal `gorm:"column:TaxAmount;type:decimal(12,0)"`
    // 총 금액
    TotalAmount       NumericDecimal `gorm:"column:TotalAmount;type:decimal(12,0)"`

    // 팝빌 연동 필드
    // 팝빌 문서번호 (자체 생성, 팝빌에 전달)
    MgtKey            string         `gorm:"uniqueIndex;column:MgtKey;size:24"`
    // 국세청 승인번호 (팝빌 응답)
    ConfirmNum        *string        `gorm:"column:ConfirmNum;size:24"`
    // 국세청 거래일자
    TradeDate         *string        `gorm:"column:TradeDate;size:8"`

    // 상태: PENDING, ISSUED, FAILED, CANCELLED
    Status            string         `gorm:"index;column:Status;size:10;default:'PENDING'"`
    // 자진발급 여부
    IsAutoIssued      bool           `gorm:"column:IsAutoIssued;default:false"`
    // 원본 자진발급 건의 ID (사후 신청으로 대체된 경우)
    OriginalID        *int           `gorm:"column:OriginalId"`

    // 실패/취소 사유
    FailReason        *string        `gorm:"column:FailReason;size:500"`
    // 취소 시 원본 현금영수증 ID
    CancelledReceiptID *int          `gorm:"column:CancelledReceiptId"`

    IssuedAt          *time.Time     `gorm:"column:IssuedAt"`
    CancelledAt       *time.Time     `gorm:"column:CancelledAt"`
    CreatedAt         time.Time      `gorm:"column:CreatedAt;autoCreateTime"`
    UpdatedAt         time.Time      `gorm:"column:UpdatedAt;autoUpdateTime"`
}

func (CashReceipt) TableName() string { return "CashReceipts" }
```

### 3.2 기존 모델 변경

**Order**: 변경 없음. 기존 `CashReceiptType`, `CashReceiptNumber` 필드는 주문 생성 시 고객 입력값 저장용으로 유지. 실제 발급 상태는 `CashReceipt` 테이블에서 관리.

---

## 4. 아키텍처

### 4.1 서비스 구조

```
go-server/internal/
├── domain/
│   └── cash_receipt.go          # CashReceipt 모델
├── infra/
│   └── popbill/
│       ├── client.go            # 팝빌 REST API 클라이언트
│       └── types.go             # 팝빌 요청/응답 타입
├── app/
│   ├── interfaces/
│   │   └── cash_receipt.go      # ICashReceiptProvider 인터페이스
│   └── services/
│       └── cash_receipt_service.go  # 비즈니스 로직
├── api/handlers/
│   └── cash_receipt_handler.go  # HTTP 핸들러
└── routes/
    └── protected.go             # 사용자 라우트 추가
    └── admin.go                 # 관리자 라우트 추가
```

### 4.2 인터페이스 (DI용)

```go
// ICashReceiptProvider는 현금영수증 외부 발급 서비스의 추상화입니다.
type ICashReceiptProvider interface {
    // Issue는 현금영수증을 즉시 발급합니다.
    Issue(req CashReceiptIssueRequest) (*CashReceiptIssueResponse, error)
    // Cancel는 기 발급된 현금영수증을 취소합니다.
    Cancel(req CashReceiptCancelRequest) (*CashReceiptCancelResponse, error)
    // GetInfo는 현금영수증 발급 상태를 조회합니다.
    GetInfo(mgtKey string) (*CashReceiptInfo, error)
    // UpdateTransaction은 자진발급 건의 식별번호를 변경합니다.
    UpdateTransaction(mgtKey string, identityNum string) error
}
```

---

## 5. API 엔드포인트

### 5.1 사용자 API (Protected)

| Method | Path | 설명 | 비고 |
|--------|------|------|------|
| `POST` | `/cash-receipts/request` | 사후 신청 | 90일 이내, Rate Limit 5/분 |
| `GET` | `/cash-receipts/my` | 내 현금영수증 목록 | 페이지네이션 |
| `GET` | `/cash-receipts/:id` | 현금영수증 상세 | 본인 건만 |

### 5.2 관리자 API (Admin)

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/admin/cash-receipts` | 전체 목록 (필터/페이지네이션) |
| `GET` | `/admin/cash-receipts/:id` | 상세 조회 |
| `POST` | `/admin/cash-receipts/:id/cancel` | 수동 취소 |
| `POST` | `/admin/cash-receipts/:id/reissue` | 실패 건 재발급 |
| `POST` | `/admin/cash-receipts/:id/sync` | 팝빌 상태 동기화 |
| `GET` | `/admin/reports/cash-receipts` | 기간별 발급 리포트 |

### 5.3 요청/응답 스펙

#### POST `/cash-receipts/request` (사후 신청)

```json
// Request
{
  "orderId": 123,
  "type": "INCOME_DEDUCTION",       // INCOME_DEDUCTION | EXPENSE_PROOF
  "identityType": "PHONE",          // PHONE | BUSINESS_NO | CARD_NO
  "identityNumber": "01012345678"
}

// Response 200
{
  "id": 456,
  "orderId": 123,
  "status": "ISSUED",
  "confirmNum": "820123456",
  "issuedAt": "2026-03-26T14:30:00+09:00"
}
```

#### 사후 신청 검증 규칙
- 해당 주문이 가상계좌 결제인지 확인
- 주문 상태가 PAID/DELIVERED/COMPLETED 중 하나인지 확인
- 결제 확정일로부터 90일 이내인지 확인
- 이미 유효한 현금영수증이 있는지 확인 (자진발급 건은 대체 가능)
- 본인 주문인지 확인

---

## 6. 핵심 플로우

### 6.1 자동 발급 플로우 (입금 확인 시)

```
[PG 웹훅: 가상계좌 입금 확인]
  │
  ├─ PaymentService.HandleWebhook()
  │    ├─ 주문 상태 PENDING → PAID
  │    ├─ Payment 상태 → CONFIRMED
  │    └─ 바우처 RESERVED → SOLD
  │
  └─ CashReceiptService.AutoIssue(orderID)
       │
       ├─ Order.CashReceiptType 확인
       │    ├─ 값 있음 → 고객 정보로 RegistIssue 호출
       │    └─ 값 없음 → 자진발급 (identityNum: "0100001234")
       │
       ├─ CashReceipt 레코드 생성 (Status: PENDING)
       ├─ 팝빌 RegistIssue API 호출
       │    ├─ 성공 → Status: ISSUED, ConfirmNum 저장
       │    └─ 실패 → Status: FAILED, FailReason 저장
       └─ (실패 시 크론 재시도 대상)
```

### 6.2 사후 신청 플로우

```
[고객: POST /cash-receipts/request]
  │
  ├─ 검증 (90일 이내, 가상계좌, 본인 주문)
  │
  ├─ 기존 자진발급 건 확인
  │    ├─ 있음 → UpdateTransaction으로 식별번호 변경
  │    │         원본 CashReceipt.OriginalID 설정
  │    └─ 없음 → 새로 RegistIssue 호출
  │
  └─ 결과 반환
```

### 6.3 취소 발급 플로우

```
[환불 승인 or 관리자 수동 취소]
  │
  ├─ 해당 주문의 ISSUED 상태 CashReceipt 조회
  │    └─ 없으면 스킵 (현금영수증 미발급 건)
  │
  ├─ 팝빌 CancelIssue API 호출
  │    ├─ 성공 → 취소 CashReceipt 레코드 생성
  │    │         원본 CashReceipt.Status → CANCELLED
  │    └─ 실패 → 로그 기록 + 관리자 알림
  │
  └─ 환불 프로세스 계속 진행 (현금영수증 취소 실패가 환불을 블로킹하지 않음)
```

---

## 7. 크론 잡

### 7.1 현금영수증 실패 재시도

- **스케줄**: `@every 30m` (30분 간격)
- **대상**: `Status = 'FAILED'`, `CreatedAt > now - 72시간`
- **최대 재시도**: 5회 (CreatedAt 기준 72시간 이내)
- **동작**: 팝빌 `RegistIssue` 재호출, 성공 시 ISSUED로 변경

### 7.2 팝빌 상태 동기화

- **스케줄**: `0 4 * * *` (매일 04:00 KST)
- **대상**: 최근 7일간 `Status = 'PENDING'` 상태로 남아있는 건
- **동작**: 팝빌 `GetInfo`로 실제 상태 확인 후 DB 동기화

### 크론 등록

기존 `Scheduler`에 `CashReceiptRetryRunner` 인터페이스 주입:

```go
type CashReceiptRetryRunner interface {
    RetryFailedReceipts()
    SyncPendingReceipts()
}
```

---

## 8. 보안 고려사항

### 8.1 민감정보 암호화

- `IdentityNumber`(휴대폰번호, 사업자번호, 카드번호)는 기존 AES-256 암호화 유틸 사용
- 팝빌 API 통신은 HTTPS 필수
- `POPBILL_SECRET_KEY`는 환경변수로만 관리 (코드에 하드코딩 금지)

### 8.2 접근 제어

- 사용자: 본인 주문 건만 조회/신청 가능
- 관리자: 전체 조회, 수동 취소/재발급 가능
- Rate Limit: 사후 신청 5회/분 (기존 Rate Limiter 재사용)

### 8.3 MgtKey 생성 규칙

팝빌 문서번호(MgtKey)는 사업자번호당 고유. 형식:

```
CR-{YYYYMMDD}-{OrderID}-{seq}
예: CR-20260326-00123-01
```

- 최대 24자
- 영문, 숫자, 하이픈만 허용
- 주문 ID 포함으로 추적 용이

---

## 9. 에러 처리

### 팝빌 API 에러 시 전략

| 시나리오 | 대응 |
|---------|------|
| 팝빌 API 일시 장애 | FAILED 저장 → 크론 재시도 (30분 간격, 72시간 이내) |
| 잘못된 식별번호 | 즉시 FAILED + 사유 저장, 고객에게 재입력 안내 |
| 중복 MgtKey | seq 증가 후 재시도 |
| 팝빌 잔액 부족 | FAILED + 관리자 알림 (이메일) |
| 주문 취소 시 현금영수증 취소 실패 | 환불은 진행, 취소 실패 건 관리자 대시보드에 표시 |

### 현금영수증 발급 실패가 결제를 블로킹하지 않음

입금 확인 → 주문 상태 변경은 현금영수증 발급 성공 여부와 무관하게 진행.
현금영수증 발급은 비동기로 처리하며, 실패 시 크론이 재시도.

---

## 10. 기존 코드 수정 포인트

| 파일 | 변경 내용 |
|------|----------|
| `domain/cash_receipt.go` | 신규: CashReceipt 모델 |
| `infra/popbill/client.go` | 신규: 팝빌 REST API 클라이언트 |
| `infra/popbill/types.go` | 신규: 요청/응답 타입 |
| `app/interfaces/cash_receipt.go` | 신규: ICashReceiptProvider 인터페이스 |
| `app/services/cash_receipt_service.go` | 신규: 현금영수증 비즈니스 로직 |
| `app/services/payment_service.go` | 수정: HandleWebhook에 현금영수증 자동발급 호출 추가 |
| `app/services/refund_service.go` | 수정: 환불 승인 시 현금영수증 취소 호출 추가 |
| `api/handlers/cash_receipt_handler.go` | 신규: HTTP 핸들러 |
| `routes/protected.go` | 수정: 사용자 현금영수증 라우트 추가 |
| `routes/admin.go` | 수정: 관리자 현금영수증 라우트 추가 |
| `routes/container.go` | 수정: CashReceiptService, Handler DI 등록 |
| `cron/scheduler.go` | 수정: 실패 재시도 + 상태 동기화 크론 잡 추가 |
| `main.go` | 수정: 팝빌 클라이언트 초기화, AutoMigrate에 CashReceipt 추가 |
| `.env` / `.env.production` | 수정: POPBILL_* 환경변수 추가 |

---

## 11. 프론트엔드 영향

### 주문 생성 시 (이미 있음, 강화만)

- 결제수단이 가상계좌일 때 현금영수증 정보 입력 UI 표시
- 입력 필드: 유형 선택 (소득공제/지출증빙) + 식별번호 (휴대폰/사업자번호/카드번호)
- "나중에 신청" 옵션 (자진발급으로 처리됨)

### 마이페이지 추가

- 내 현금영수증 내역 탭 또는 섹션
- 사후 신청 버튼 (미발급 또는 자진발급 건)
- 상태 표시: 발급완료, 처리중, 실패, 취소

### 관리자 대시보드 추가

- 현금영수증 관리 메뉴
- 목록 (필터: 상태, 기간, 유형)
- 수동 취소/재발급 기능
- 발급 현황 리포트

---

## 12. 테스트 전략

### 단위 테스트

- `CashReceiptService`: Mock `ICashReceiptProvider` 주입
- 자동발급 / 자진발급 분기 검증
- 90일 초과 사후 신청 거부 검증
- 취소 발급 시 원본 상태 변경 검증
- MgtKey 생성 규칙 검증

### 통합 테스트

- 팝빌 테스트 환경(Sandbox)으로 실제 API 호출 테스트
- `POPBILL_IS_TEST=true` 환경에서 발급 → 조회 → 취소 플로우

### E2E 테스트

- 주문 생성(현금영수증 정보 포함) → 입금 확인 → 현금영수증 자동 발급 확인
- 사후 신청 → 발급 확인
- 환불 → 현금영수증 취소 확인
