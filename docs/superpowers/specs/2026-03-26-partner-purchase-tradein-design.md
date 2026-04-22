# 파트너 전용 구매/매입 기능 설계

> **날짜**: 2026-03-26
> **상태**: 승인 대기
> **범위**: Go 서버 (PartnerService 확장) + 파트너 포털 (탭 2개 추가)

## 1. 목적

파트너가 자신의 대시보드(파트너 포털) 내에서 상품권을 **구매**(대량, CSV 수령)하고 **매입**(PIN 제출, 관리자 검수 후 정산)할 수 있도록 한다. 기존 일반 소비자 경로(`/cart`, `/orders`, `/trade-ins`)와 완전 분리된 파트너 전용 경로로 구현한다.

### 기존 소비자 기능과의 관계

- 일반 소비자 경로는 `UserOnly()` 미들웨어로 PARTNER 접근 차단 (유지)
- 파트너 경로는 `PartnerOnly()` + `IPWhitelistGuard`로 보호 (유지)
- 양쪽 모두 동일한 `Order`, `TradeIn` 도메인 모델을 사용하되 `Source` 필드로 구분

## 2. 데이터 모델

### 2.1 신규 테이블: PartnerPrices

관리자가 파트너×상품 조합별로 개별 단가를 설정하는 테이블.

```
PartnerPrices
├── Id            int       (PK, auto-increment)
├── PartnerId     int       (FK → Users.Id, NOT NULL)
├── ProductId     int       (FK → Products.Id, NOT NULL)
├── BuyPrice      decimal   (파트너 구매 단가, NOT NULL)
├── TradeInPrice  decimal   (파트너 매입 단가, NOT NULL)
├── CreatedAt     datetime  (auto)
├── UpdatedAt     datetime  (auto)
└── UNIQUE(PartnerId, ProductId)
```

**가격 해석 우선순위:**

1. `PartnerPrices` 레코드 존재 → 개별 단가 사용
2. 없으면 → 상품 기본값 (`Product.BuyPrice` / `Product.Price × Product.TradeInRate / 100`)

### 2.2 기존 모델 변경

**Order 테이블:**

```diff
+ Source  string  gorm:"column:Source;default:'USER';size:10"  — "USER" | "PARTNER"
```

**TradeIn 테이블:**

```diff
+ Source  string  gorm:"column:Source;default:'USER';size:10"  — "USER" | "PARTNER"
```

기존 데이터는 모두 `Source='USER'`로 간주 (기본값).

### 2.3 도메인 모델 (Go)

```go
type PartnerPrice struct {
    ID           int             `gorm:"primaryKey;column:Id"`
    PartnerId    int             `gorm:"column:PartnerId;uniqueIndex:idx_partner_product"`
    ProductId    int             `gorm:"column:ProductId;uniqueIndex:idx_partner_product"`
    BuyPrice     NumericDecimal  `gorm:"column:BuyPrice;type:decimal(12,0);not null"`
    TradeInPrice NumericDecimal  `gorm:"column:TradeInPrice;type:decimal(12,0);not null"`
    CreatedAt    time.Time       `gorm:"column:CreatedAt;autoCreateTime"`
    UpdatedAt    time.Time       `gorm:"column:UpdatedAt;autoUpdateTime"`

    Partner *User    `gorm:"foreignKey:PartnerId"`
    Product *Product `gorm:"foreignKey:ProductId"`
}
```

## 3. API 엔드포인트

### 3.1 파트너 구매 (Partner Orders)

모든 엔드포인트: `JWTAuth → PartnerOnly → IPWhitelistGuard`

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/partner/products/purchasable` | 구매 가능 상품 목록 (파트너 단가 포함) |
| `POST` | `/partner/orders` | 주문 생성 (파트너 단가, PG 결제) |
| `GET` | `/partner/orders/purchases` | 내 구매 내역 (Source=PARTNER) |
| `GET` | `/partner/orders/:id` | 구매 상세 (기존 재사용) |
| `POST` | `/partner/orders/:id/cancel` | 구매 취소 |
| `GET` | `/partner/orders/:id/export` | CSV 다운로드 (PIN 코드 복호화 포함) |
| `POST` | `/partner/orders/payment/confirm` | PG 결제 확인 |

### 3.2 파트너 매입 (Partner Trade-ins)

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/partner/trade-ins` | 매입 신청 (PIN 입력, 파트너 매입 단가) |
| `GET` | `/partner/trade-ins` | 내 매입 내역 |
| `GET` | `/partner/trade-ins/:id` | 매입 상세 |

### 3.3 관리자: 파트너 단가 관리

모든 엔드포인트: `JWTAuth → AdminOnly → IPWhitelistGuard`

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/admin/partner-prices` | 파트너 단가 목록 (파트너/상품 필터) |
| `GET` | `/admin/partner-prices/:partnerId` | 특정 파트너 전체 단가 |
| `POST` | `/admin/partner-prices` | 단가 설정 (upsert: partnerId + productId) |
| `DELETE` | `/admin/partner-prices/:id` | 단가 삭제 (기본값 복귀) |

## 4. 서비스 레이어

### 4.1 PartnerService 확장

기존 `PartnerService`에 메서드 추가:

**구매 관련:**

- `GetPurchasableProducts(partnerId, pagination)` — 활성 상품 목록 + 파트너 단가 조인
- `CreatePartnerOrder(partnerId, items)` — 파트너 단가 조회 → 총액 산출 → Order(Source=PARTNER) 생성
- `GetMyPurchases(partnerId, filters)` — Source=PARTNER 주문 목록
- `CancelPartnerOrder(partnerId, orderId)` — PENDING 상태만 취소 가능
- `ExportOrderPins(partnerId, orderId)` — PIN 복호화 + CSV 생성

**매입 관련:**

- `CreatePartnerTradeIn(partnerId, input)` — 파트너 매입 단가 조회 → TradeIn(Source=PARTNER) 생성
- `GetMyTradeIns(partnerId, filters)` — Source=PARTNER 매입 목록
- `GetTradeInDetail(partnerId, tradeInId)` — 매입 상세 (소유권 검증)

### 4.2 AdminPartnerPriceService (신규)

- `GetPrices(filters)` — 파트너 단가 목록 (파트너/상품 조인)
- `GetPricesByPartner(partnerId)` — 특정 파트너 단가
- `UpsertPrice(partnerId, productId, buyPrice, tradeInPrice)` — 생성 또는 갱신
- `DeletePrice(id)` — 삭제

### 4.3 가격 조회 헬퍼

```go
func (s *PartnerService) resolvePartnerPrice(partnerId, productId int) (buyPrice, tradeInPrice decimal.Decimal, err error)
```

1. `PartnerPrices`에서 `(PartnerId, ProductId)` 조회
2. 존재 → 해당 단가 반환
3. 없으면 → `Product.BuyPrice`, `Product.Price × Product.TradeInRate / 100` 반환

## 5. 파트너 구매 흐름

```
파트너 포털 [Buy 탭]
    │
    ├─ 1. 상품 목록 조회 (파트너 단가 표시)
    │     GET /partner/products/purchasable
    │
    ├─ 2. 상품 선택 + 수량 입력
    │
    ├─ 3. 주문 생성
    │     POST /partner/orders
    │     → 서버: PartnerPrices 조회 → 총액 산출
    │     → 서버: 1일 구매 한도 검증 (DailyPinLimit)
    │     → 서버: Order(Source=PARTNER, Status=PENDING) 생성
    │     → 응답: orderId + 결제 정보
    │
    ├─ 4. PG 결제 진행
    │     POST /partner/orders/payment/confirm
    │     → 서버: 결제 검증 → Status=PAID
    │     → 서버: 바우처 할당 (기존 fulfillment 로직)
    │
    └─ 5. CSV 다운로드
          GET /partner/orders/:id/export
          → 서버: PIN 복호화 → CSV 생성 → 응답
```

## 6. 파트너 매입 흐름

```
파트너 포털 [Trade-in 탭]
    │
    ├─ 1. 상품 선택 (드롭다운)
    │     → 파트너 매입 단가 표시
    │
    ├─ 2. PIN 코드 입력 (단건 또는 줄바꿈 복수)
    │
    ├─ 3. 매입 신청
    │     POST /partner/trade-ins
    │     → 서버: PartnerPrices.TradeInPrice 조회
    │     → 서버: PIN 중복 검사 (PinHash)
    │     → 서버: PIN 암호화 저장
    │     → 서버: TradeIn(Source=PARTNER, Status=REQUESTED) 생성
    │
    ├─ 4. 관리자 검수
    │     기존 /admin/trade-ins 흐름 그대로
    │     → REQUESTED → VERIFIED → PAID
    │
    └─ 5. 정산
          관리자 승인 시 파트너 계좌 입금
          (기존 매입 정산 흐름 동일)
```

## 7. 파트너 포털 프론트엔드

### 7.1 탭 구성 (8탭)

```
Dashboard | Products | Buy | Trade-in | Orders | Vouchers | Payouts | Profile
                      ^^^   ^^^^^^^^^
                      신규      신규
```

### 7.2 Buy 탭

- **상품 카드 그리드**: 상품명, 액면가(취소선), 파트너 단가(강조), 할인율 표시
- **주문 폼**: 수량 입력, 총액 실시간 계산
- **결제 버튼**: PG 결제 모달 연동
- **완료 화면**: PIN 목록 테이블 + CSV 다운로드 버튼
- **구매 내역**: 하단 테이블, 상태 필터, 각 주문의 CSV 다운로드 링크

### 7.3 Trade-in 탭

- **상품 선택**: 드롭다운 (매입 가능 상품 + 파트너 매입 단가 표시)
- **PIN 입력**: 텍스트에어리어 (줄바꿈으로 복수 PIN 입력)
- **예상 정산**: 매입 단가 × 수량 = 정산 예상액 실시간 표시
- **제출 버튼**: 매입 신청
- **매입 내역**: 하단 테이블, 상태별 필터 (REQUESTED, VERIFIED, PAID, REJECTED)

### 7.4 Dashboard 통합

기존 대시보드 위젯에 추가:
- 이번 달 구매 건수/금액
- 이번 달 매입 건수/금액

## 8. 보안

| 항목 | 대책 |
|------|------|
| 가격 조작 | 클라이언트 가격 무시, 서버에서 `PartnerPrices` 재조회 |
| 수량 한도 | `DailyPinLimit` 기반 1일 구매/매입 수량 검증 |
| PIN 보안 | AES-256 암호화 저장, SHA256 해시로 중복 검사 |
| CSV 다운로드 | HTTPS 전용, 다운로드 감사 로그 기록, 소유권 검증 |
| 인증/인가 | `JWTAuth → PartnerOnly → IPWhitelistGuard` 3중 체인 |
| 매입 중복 | PinHash 유니크 제약으로 동일 PIN 재매입 차단 |

## 9. 한도 체계

| 한도 | 출처 | 기본값 |
|------|------|--------|
| 1일 구매 수량 | `User.DailyPinLimit` → `SiteConfig.PARTNER_DAILY_BUY_LIMIT` → 100 | 100 |
| 1일 매입 수량 | `SiteConfig.PARTNER_DAILY_TRADEIN_LIMIT` → 50 | 50 |
| 1회 주문 최대 수량 | 고정 | 50 |
| 1회 매입 최대 PIN | 고정 | 20 |

## 10. 범위 외 (YAGNI)

- 파트너간 상품권 거래 (P2P)
- 파트너 전용 선물 기능
- 파트너 구매의 자동 발급(API 연동) — 기존 재고 기반만 지원
- 매입 자동 승인 — 관리자 수동 검수 유지
- 파트너 구매 전용 결제 수단 (후불/예치금) — PG 결제만
