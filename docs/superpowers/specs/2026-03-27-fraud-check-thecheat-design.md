# 더치트(TheCheat) 사기 조회 연동 설계

## 개요

더치트 API를 활용하여 주문/매입 시 사용자의 전화번호·계좌번호에 대한 금융사기 피해사례 등록 여부를 자동 검사하고, 위험 사용자의 거래를 자동 보류(FRAUD_HOLD)하는 기능.

## 요구사항

| 항목 | 결정 |
|------|------|
| 검사 시점 | 주문 생성 시 + 매입 신청 시 + 관리자 수동 조회 |
| 대응 방식 | FRAUD_HOLD 상태로 생성 + 텔레그램 알림 + FraudCheckLog 기록 |
| 검색 키워드 | 전화번호 + 계좌번호 둘 다 (하나라도 caution="Y"면 보류) |
| 캐싱 | 거래 시 24시간 캐시 / 관리자 수동 조회는 항상 실시간 |
| 사용자 메시지 | "주문(매입)이 검토 중입니다" — 사기 사유 노출 안 함 |
| 킬스위치 | `THECHEAT_ENABLED=false`로 즉시 비활성화 가능 |

## 접근 방식: 서비스 레이어 통합 (A안)

FraudCheckService를 만들어 OrderService, TradeInService에 주입.

**선택 이유:**
- 상품권은 결제 후 PIN이 즉시 발급되므로 비동기(C안)는 사기범에게 PIN을 먼저 넘기는 허점 존재
- 미들웨어(B안)는 "차단"에 적합하지만 "FRAUD_HOLD 상태로 생성"은 서비스 레이어가 담당해야 자연스러움
- 기존 go-server의 서비스 DI 패턴과 일관

## 데이터 모델

### FraudCheckLog 테이블 (신규)

```go
type FraudCheckLog struct {
    ID          int        `gorm:"primaryKey;column:Id"`
    UserID      int        `gorm:"column:UserId;index"`
    Keyword     string     `gorm:"column:Keyword;size:100"`       // 마스킹된 값 (010****0000)
    KeywordType string     `gorm:"column:KeywordType;size:10"`    // "phone" | "account"
    BankCode    *string    `gorm:"column:BankCode;size:4"`
    Caution     string     `gorm:"column:Caution;size:1"`         // "Y" | "N"
    KeywordURL  *string    `gorm:"column:KeywordUrl;size:500"`    // 피해사례 열람 URL
    Source      string     `gorm:"column:Source;size:15"`          // "ORDER" | "TRADEIN" | "ADMIN"
    SourceID    *int       `gorm:"column:SourceId"`               // 주문ID 또는 매입ID
    ExpiresAt   time.Time  `gorm:"column:ExpiresAt;index"`        // 캐시 만료 (생성 + 24h)
    CreatedAt   time.Time  `gorm:"column:CreatedAt;autoCreateTime"`
}
```

**설계 포인트:**
- `Keyword`에는 마스킹된 값만 저장 — 원문 전화번호/계좌번호를 로그에 남기지 않음
- `ExpiresAt`으로 캐시 유효성 판단 — 24시간 이내 같은 UserID + KeywordType이면 재사용
- `Source`/`SourceID`로 어떤 거래에서 발생한 검사인지 추적

### Order/TradeIn 상태 확장

- Order Status: 기존 값들 + `FRAUD_HOLD` 추가
- TradeIn Status: 기존 값들 + `FRAUD_HOLD` 추가
- FRAUD_HOLD 상태에서는 PIN 발급/입금 처리가 진행되지 않음

## 서비스 구조

### FraudChecker 인터페이스

```go
type FraudChecker interface {
    // Check는 캐시를 활용하여 사기 조회를 수행 (거래 시 사용)
    Check(userID int, source string) (*FraudCheckResult, error)
    // CheckRealtime는 캐시를 무시하고 항상 실시간 조회 (관리자 수동 조회)
    CheckRealtime(userID int) (*FraudCheckResult, error)
}

type FraudCheckResult struct {
    PhoneCaution   string  // "Y" | "N" | "" (전화번호 없으면 빈값)
    AccountCaution string  // "Y" | "N" | "" (계좌 없으면 빈값)
    IsFlagged      bool    // 하나라도 "Y"면 true
    PhoneURL       string  // 전화번호 피해사례 열람 URL
    AccountURL     string  // 계좌번호 피해사례 열람 URL
}
```

### Check 플로우

```
Check(userID, "ORDER")
  ├─ DB에서 User 조회 → Phone, AccountNumber, BankCode 획득
  ├─ AccountNumber 복호화 (기존 pkg/crypto AES-256)
  ├─ 캐시 확인: FraudCheckLog에서 같은 UserID + ExpiresAt > now 조회
  │   ├─ phone 캐시 히트 + account 캐시 히트 → 캐시 결과 반환
  │   └─ 캐시 미스인 항목만 API 호출 ↓
  ├─ TheCheat API 호출 (암호화 엔드포인트 사용)
  │   ├─ Phone 검색 (phone이 있을 때)
  │   └─ Account + BankCode 검색 (account가 있을 때)
  ├─ 결과를 FraudCheckLog에 저장 (마스킹 키워드 + ExpiresAt = now + 24h)
  └─ FraudCheckResult 반환
```

### 환경설정

Config 구조체에 추가:

```go
TheCheatAPIKey   string        `mapstructure:"THECHEAT_API_KEY"`
TheCheatEncKey   string        `mapstructure:"THECHEAT_ENC_KEY"`
TheCheatEnabled  bool          `mapstructure:"THECHEAT_ENABLED"`
TheCheatCacheTTL time.Duration `mapstructure:"THECHEAT_CACHE_TTL"`
```

```env
THECHEAT_API_KEY=...           # 더치트 API 키
THECHEAT_ENC_KEY=...           # 더치트 AES-256 암호화 키 (32바이트)
THECHEAT_ENABLED=true          # 기능 ON/OFF 토글
THECHEAT_CACHE_TTL=24h         # 캐시 유효기간 (기본 24시간)
```

`THECHEAT_ENABLED=false`일 때는 항상 `IsFlagged=false`를 반환하여 거래를 차단하지 않음.

## 주문/매입 통합 지점

### CreateOrder (order_service.go ~Line 81)

트랜잭션 진입 직후, 멱등성 체크 전에 삽입:

```
→ FraudCheckService.Check(userID, "ORDER")
→ IsFlagged == true?
    → 주문을 FRAUD_HOLD 상태로 생성 (PIN 발급 안 함, 바우처 예약 안 함)
    → FraudCheckLog.SourceID = order.ID 업데이트
    → 텔레그램 알림 발송
    → 사용자에게 "주문이 검토 중입니다" 응답 반환
→ IsFlagged == false?
    → 기존 로직 그대로 (PENDING → 결제 → PIN 발급)
```

OrderService에 FraudChecker 필드 추가 (nil이면 검사 생략 — 테스트 시 편의):

```go
type OrderService struct {
    db           *gorm.DB
    cfg          *config.Config
    fraudChecker interfaces.FraudChecker  // 추가
    // ... 기존 필드
}
```

### SubmitTradeIn (tradein_service.go ~Line 57)

함수 진입 직후, 상품 검증 전에 삽입:

```
→ FraudCheckService.Check(userID, "TRADEIN")
→ IsFlagged == true?
    → 매입을 FRAUD_HOLD 상태로 생성 (입금 처리 안 함)
    → 텔레그램 알림 발송
    → 사용자에게 "매입 신청이 검토 중입니다" 응답
→ IsFlagged == false?
    → 기존 로직 그대로 (REQUESTED → 검수 → 입금)
```

TradeInService에도 동일하게 FraudChecker 필드 추가.

## 관리자 API

### 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/admin/users/:id/fraud-check` | 실시간 더치트 조회 (캐시 무시) |
| GET | `/admin/users/:id/fraud-history` | FraudCheckLog 이력 조회 |
| POST | `/admin/orders/:id/release-hold` | FRAUD_HOLD → PENDING 전환 |
| POST | `/admin/trade-ins/:id/release-hold` | FRAUD_HOLD → REQUESTED 전환 |

### fraud-check 응답 예시

```json
{
    "phoneCaution": "Y",
    "accountCaution": "N",
    "isFlagged": true,
    "phoneUrl": "https://thecheat.co.kr/...",
    "accountUrl": ""
}
```

### release-hold 요청

```json
{
    "adminNote": "더치트 오탐 확인 — 동명이인 계좌, 거래 정상 승인"
}
```

관리자가 검토 후 해제하면:
- Order/TradeIn 상태를 PENDING/REQUESTED로 변경
- AdminNote에 해제 사유 기록
- FraudCheckLog에 해제 이벤트는 별도 기록하지 않음 (Order/TradeIn 자체의 AdminNote + 상태 변경 이력으로 추적)

## 알림

### 텔레그램 알림 (기존 pkg/telegram 활용)

FRAUD_HOLD 발생 시:

```
🚨 사기의심 거래 보류
━━━━━━━━━━━━━━━
유형: 주문 #1234 / 매입 #5678
사용자: 홍길동 (ID: 42)
사유: 전화번호 피해사례 등록 / 계좌번호 피해사례 등록
상세: https://thecheat.co.kr/...
━━━━━━━━━━━━━━━
관리자 패널에서 확인해주세요.
```

- 기존 `pkg/telegram.SendAlert()` 또는 `pkg/notification.Service`를 활용
- 고루틴으로 비동기 발송 (거래 응답 지연 방지)

## 파일 구조

```
go-server/
├── internal/
│   ├── domain/
│   │   └── fraud.go                    # FraudCheckLog 모델
│   ├── app/
│   │   ├── interfaces/
│   │   │   └── fraud_checker.go        # FraudChecker 인터페이스
│   │   └── services/
│   │       └── fraud_check_svc.go      # FraudCheckService 구현체
│   └── api/handlers/
│       └── admin_fraud_handler.go      # 관리자 조회/해제 핸들러
├── pkg/
│   └── thecheat/
│       ├── client.go                   # TheCheat API HTTP 클라이언트 + AES 암복호화
│       └── client_test.go              # 단위 테스트
```

**pkg/thecheat vs internal 분리 이유:**
- `pkg/thecheat`: 순수 HTTP 클라이언트 — 더치트 API 호출과 AES 암복호화만 담당, 비즈니스 로직 없음
- `internal/app/services/fraud_check_svc.go`: 비즈니스 로직 — 캐싱, 사용자 조회, 로그 기록, 마스킹
- thecheat.Client는 독립적으로 테스트 가능, 서비스는 FraudChecker 인터페이스 mock으로 테스트 가능

## 보안 고려사항

1. **원문 데이터 비저장**: FraudCheckLog에는 마스킹된 전화번호/계좌번호만 저장
2. **암호화 엔드포인트 사용**: 프로덕션에서는 반드시 `/fraud/search/encrypted` 사용 (평문 전송 금지)
3. **API 키 보호**: `THECHEAT_API_KEY`, `THECHEAT_ENC_KEY`는 `.env`에만 저장, git 제외
4. **사용자 메시지 중립화**: 사기 의심 사유를 사용자에게 노출하지 않음 (오탐 시 법적 리스크 방지)
5. **IP 제한**: 더치트 API는 허용 IP만 접근 가능 — 프로덕션 서버(103.97.209.194) IP를 더치트에 등록 필요

## 에러 처리

| 상황 | 대응 |
|------|------|
| 더치트 API 타임아웃/장애 | 거래를 차단하지 않음 (fail-open). 에러 로그 기록, 텔레그램 경고 발송 |
| API Key 무효 (401) | 거래 차단 안 함. 에러 로그 + 텔레그램 긴급 알림 |
| IP 차단 (403) | 거래 차단 안 함. 에러 로그 + 텔레그램 긴급 알림 |
| THECHEAT_ENABLED=false | 항상 IsFlagged=false 반환, 검사 생략 |
| 사용자에게 Phone/Account 모두 없음 | 검사 생략, IsFlagged=false |

**Fail-open 정책 이유**: 더치트 장애 시 모든 거래가 멈추면 사업 영향이 큼. 장애는 로그+알림으로 빠르게 감지하고, 더치트 복구 후 수동 검사로 보완.
