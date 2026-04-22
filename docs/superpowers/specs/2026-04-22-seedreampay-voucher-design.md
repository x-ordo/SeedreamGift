# 씨드림페이 상품권 시스템 설계

- **작성일**: 2026-04-22
- **작성자**: David Park (parkdavid31@gmail.com)
- **상태**: Draft — Phase 1 구현 대기
- **대상 Phase**: Phase 1 (사이트 내부 사용 + 선물하기 링크 공유)

---

## 1. 개요

씨드림기프트 플랫폼에서 판매하는 **자체 발행 상품권** 시스템이다. 신세계·현대·롯데 등 외부 브랜드 상품권처럼 진열되나, 씨드림 내부에서 직접 발행하고 씨드림기프트 몰 내 결제 수단으로 사용한다.

giftmoa · EXPay 등 기존 외부 발급사 연동과 동형(同型)의 발급 파이프라인(`VoucherIssuer` 인터페이스 기반)을 재사용하며, **구현체만 내부 DB 인서트로 바뀐다**.

### 용어 구분

| 용어 | 의미 |
|------|------|
| **씨드림페이 (seedreampay)** | 씨드림기프트가 **자체 발행**하는 상품권 (본 문서 주제) |
| **Seedream Payment** | `feat/seedream-payment-p1-data-model` 브랜치의 **외부 결제 게이트웨이 연동** (무관) |
| **giftmoa** | 기존 통합된 외부 상품권 발급사 (참조 모델) |

용어 충돌 해소: `ProviderCode` 값으로 `SEEDREAMPAY` vs `SEEDREAM`을 구분한다. 브랜치 네이밍 규약(§8)도 같은 원칙을 따른다.

---

## 2. 확정된 요구사항

| 항목 | 결정 |
|------|------|
| 사용처 | 씨드림기프트 몰 내부 + 선물하기(링크 공유) |
| 사용 모델 | 1회 단일 사용 (잔액·재사용 없음) |
| 권종 | 1,000 / 10,000 / 100,000 / 500,000원 (고정 4종) |
| 노출 시점 | 결제 완료 즉시 구매자에게 두 코드 모두 노출 |
| 환불 허용 기간 | 7일 (미사용 시 전액, 관리자 직권 환불은 기간 무시) |
| 유효기간 | 발행일로부터 5년 |
| 만료 사전 알림 | 없음 (만료 전이 크론만) |
| B2B 가맹점 API | Phase 2 이후 (범위 외) |
| 잔액식/자유금액 | Phase 2 이후 (범위 외) |
| 수령자 지정 선물 | Phase 2 이후 (Phase 1은 링크 공유 수준) |

---

## 3. 아키텍처 접근

**접근 A — 내부 Issuer 구현체**를 채택한다.

기존 `app/interfaces/voucher_issuer.go`의 `VoucherIssuer` 인터페이스에 신규 구현체 `SeedreampayIssuer`(`infra/issuance/seedreampay_issuer.go`)를 추가한다. `Product.FulfillmentType="API"` / `Product.ProviderCode="SEEDREAMPAY"`. 내부 이슈어는 외부 HTTP 호출 대신 **DB 트랜잭션으로 `VoucherCode` 레코드를 생성**하여 반환한다.

### 재사용되는 기존 자산

- `FulfillmentService` 파이프라인 (주문 PAID → 발급 → DELIVERED)
- `IssuanceLog` 발급 이력 테이블
- 관리자 UI의 주문/발급 로그 뷰
- 크론 `@every 15s` `ProcessPendingOrders`
- 결제·환불 어댑터

### 기각된 접근

- **접근 B** (FulfillmentType에 `INTERNAL_VOUCHER` 분기 신설): 파이프라인이 두 갈래로 분기되어 공통 로직 재활용이 줄고 코드량이 약 2배.
- **접근 C** (독립 서비스/테이블): 장바구니·주문·환불·UI를 전부 복제해야 해서 ROI 부재.

---

## 4. 데이터 모델

### 4.1 기존 재사용 / 신규 분류

| 대상 | 처리 |
|------|------|
| `Brand` | 신규 row: `Code="SEEDREAMPAY"`, `Name="씨드림페이"`, `Color="#3182F6"` |
| `Product` | 신규 4 row: 권종별. `FulfillmentType="API"`, `ProviderCode="SEEDREAMPAY"`, `ProviderProductCode` = 액면가 문자열 |
| `VoucherCode` | 필드 추가(§4.2). 기존 모델 확장만, 별도 테이블 신설 없음 |
| `IssuanceLog` | 그대로 재활용 (`ProviderCode="SEEDREAMPAY"`) |
| 선물 링크 | 기존 `Gift` 테이블 재활용 (Phase 1은 링크 공유 수준이라 추가 필드 불필요) |

### 4.2 VoucherCode 스키마 변경

```sql
ALTER TABLE VoucherCodes ADD SerialNo        NVARCHAR(20) NULL;  -- 공개 조회용
ALTER TABLE VoucherCodes ADD SecretHash      CHAR(64)     NULL;  -- SHA-256(secret + ":" + serialNo)
ALTER TABLE VoucherCodes ADD RedeemedOrderId INT          NULL;  -- 몰 내 사용된 주문 ID
ALTER TABLE VoucherCodes ADD RedeemedIp      NVARCHAR(45) NULL;  -- 사용 시 IP (IPv6 포함)

CREATE UNIQUE INDEX UX_VoucherCode_SerialNo
    ON VoucherCodes(SerialNo) WHERE SerialNo IS NOT NULL;
```

- `SerialNo`: 공개 코드. URL/QR·영수증·목록조회 응답에 노출 가능. 부분 UNIQUE 인덱스로 기존 비-씨드림페이 VoucherCode(`SerialNo=NULL`)에 영향을 주지 않는다.
- `SecretHash`: 비밀 코드의 peppered SHA-256. **원본은 저장하지 않는다**. 솔트는 `SerialNo`.
- `RedeemedOrderId`: 기존 `OrderID`는 "구매 주문"을 가리키므로, "사용된 주문"은 신규 컬럼이 필요.
- 기존 `UsedAt`을 사용 일시 필드로 재활용 (별도 `RedeemedAt` 신설하지 않음).
- 기존 `PinCode`(AES-256)는 씨드림페이 레코드에서 **NULL**. "복호화 불가, 해시 비교만"이 보안 요구사항이므로 컬럼 재사용 대신 분리.

### 4.3 내부 발급 이력

씨드림페이 발급도 기존 `IssuanceLog`에 기록한다.

- `RequestPayload`: `{"orderCode": "...", "publishType": "10000", "quantity": 3}`
- `ResponsePayload`: `{"serials": ["SEED-10K1-X7AB-K9PD-M3QY", ...]}` — SerialNo는 공개값이라 마스킹 불필요
- 원본 비밀코드·`SecretHash`는 **절대 기록 금지** (zap logger 필드 필터 + `json:"-"`)

---

## 5. 코드 스키마 (공개 / 비밀)

### 5.1 공개 코드 `SerialNo`

| 항목 | 값 |
|------|-----|
| 형식 | `SEED-{tag}-{nnnn}-{nnnn}-{cccc}` (접두사 + 4그룹 하이픈) |
| 길이 | 하이픈 제외 16자 |
| `tag` | 권종 태그 4자 (가시성↑): `1K01`, `10K1`, `100K`, `500K` |
| `nnnn-nnnn` | `crypto/rand` 8자리. 32-char alphabet (`0/O/1/I/L/U` 제외) |
| `cccc` | `CRC32(prefix+tag+random) mod 32^4` → base32 4자리 |
| 유일성 | 부분 UNIQUE 인덱스. 충돌 시 발급 트랜잭션 내 최대 3회 재생성 |

**예시**: `SEED-10K1-X7AB-K9PD-M3QY`

### 5.2 비밀 코드 `Secret`

| 항목 | 값 |
|------|-----|
| 형식 | 순수 숫자 12자리 |
| 생성 | `crypto/rand` uniform `[0, 10^12)` |
| 저장 | `SecretHash = SHA-256(secret + ":" + serialNo)` 만 저장, 원본 폐기 |
| 노출 | 발급 직후 **1회만** 구매자에게 전달 (주문 상세, 알림 메일). 재조회 불가 |
| 입력 검증 | `SHA256(input + ":" + serialNo) == SecretHash` 비교 |

### 5.3 남용 방어

- 동일 `SerialNo` 비밀코드 **5회 연속 오입력 → 15분 락아웃**
- 실패 사유별 차등 정책 (DoS 방지):
  - `SERIAL_NOT_FOUND` → **IP 카운터만** 증가 (피해자 SerialNo 락아웃 방지)
  - `SECRET_MISMATCH` → **SerialNo 카운터** +1 (정당한 공격 신호)
- Redis 키 규약:
  ```
  seedreampay:lockout:serial:{serialNo}   TTL 15m
  seedreampay:lockout:ip:{ipAddr}         TTL 15m
  seedreampay:lockout:block:serial:{s}    TTL 15m
  seedreampay:lockout:block:ip:{ip}       TTL 15m
  ```
- Redis 장애 시 **fail-open** (락아웃 비활성, 인증은 통과). 경보 발송 의무.

---

## 6. 상태 머신 & 라이프사이클

### 6.1 VoucherCode 상태 전이 (씨드림페이)

```
(없음) ──(결제 PAID → Issuer가 트랜잭션 내 INSERT)──▶ SOLD
                                                        │
                          ┌─────────────────────────────┼─────────────────────────────┐
                          ▼                             ▼                             ▼
                       USED                         REFUNDED                       EXPIRED
                  (몰 내 결제에                    (7일 내 환불                   (발행 후 5년 경과,
                   실제 사용됨)                      또는 ADMIN)                    일일 크론 전이)
```

- 기존 `AVAILABLE → RESERVED → SOLD → USED` 경로와 달리 **초기 상태가 곧 `SOLD`**.
- 사전 재고가 없으므로 race condition 영역이 생성 트랜잭션 내부로 국한된다.
- 기존 enum 확장: `REFUNDED` 추가. 상태 컬럼은 `NVARCHAR(10)`이라 DDL 변경 없이 삽입만으로 충족된다.

### 6.2 Order 상태와의 관계

```
주문 PENDING → 결제 PAID → FulfillmentService → SeedreampayIssuer.Issue()
   ├─ 성공: VoucherCode n개 생성(Status=SOLD) → Order.Status=DELIVERED + DigitalDeliveryAt
   └─ 실패: 재시도 → 최종 실패 시 Order.Status=CANCELLED + PaymentProvider.Refund
```

동일 주문 내 여러 장 구매: `Quantity=n`으로 단일 호출, 트랜잭션 원자성으로 부분 실패 시 전체 롤백.

### 6.3 환불 정책

| 조건 | 결과 |
|------|------|
| `Status=SOLD` & `CreatedAt + 7d >= now` | 전액 환불 가능 |
| `Status=SOLD` & `CreatedAt + 7d <  now` | USER 요청 거부 |
| `Status=USED` | 불가 |
| `Status=EXPIRED` | 불가 |
| ADMIN 직권 | 정책 무시 가능. 사유 필수, `IssuanceLog`에 기록 |

### 6.4 유효기간 정책

- `VoucherCode.ExpiredAt = IssuedAt + 5년`
- 크론 `@daily 02:00`: `UPDATE VoucherCodes SET Status='EXPIRED' WHERE ProviderCode='SEEDREAMPAY' AND Status='SOLD' AND ExpiredAt < GETDATE()`
- 만료 사전 알림 메일은 Phase 2로 유예.

### 6.5 멱등성 & 재시도

기존 `IssuanceLog` 멱등성 키 (`OrderId` 단위 `Status=SUCCESS` 존재 시 스킵)를 그대로 사용한다. 씨드림페이 이슈어는 **DB 트랜잭션 내부에서 생성**하므로 외부 API 이중 발급 위험이 없다.

```text
SeedreampayIssuer.Issue(ctx, req):
  1. DB tx 시작
  2. SerialNo 생성 (충돌 시 3회 재시도)
  3. Secret 생성 + SecretHash 계산
  4. VoucherCode 레코드 INSERT (Status=SOLD)
  5. tx commit
  6. IssuedVoucher{PinCode=Secret, TransactionRef=SerialNo} 반환
     * PinCode 필드에 원본 Secret을 잠시 담아 FulfillmentService로만 전달.
       알림 렌더링 후 메모리에서 폐기.
```

---

## 7. API 엔드포인트

### 7.1 신규 엔드포인트 (씨드림페이 전용)

모두 `go-server/internal/api/handlers/seedreampay_handler.go` 집약. JWT + RolesGuard.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| `GET`  | `/api/v1/seedreampay/vouchers/:serialNo` | USER(본인)/ADMIN | 공개 코드로 정보 조회 (액면가·상태·발행·만료일). 비밀코드 없이 가능 |
| `POST` | `/api/v1/seedreampay/vouchers/verify` | USER | body: `{serialNo, secret}`. 유효성만 검증 (사용 안 함). 결제 직전 pre-flight |
| `POST` | `/api/v1/seedreampay/vouchers/redeem` | USER | body: `{serialNo, secret, orderId}`. 몰 주문 결제에 즉시 사용 |
| `POST` | `/api/v1/seedreampay/vouchers/:serialNo/refund` | USER(본인 7일)/ADMIN | 환불 요청. USER는 정책 체크, ADMIN은 직권 환불(reason 필수) |
| `GET`  | `/api/v1/admin/seedreampay/issuance-logs` | ADMIN | 기존 IssuanceLog에 `ProviderCode="SEEDREAMPAY"` 필터 |
| `GET`  | `/api/v1/admin/seedreampay/vouchers` | ADMIN | 상품권 전체 목록. 필터: 상태·권종·기간·SerialNo |

### 7.2 기존 엔드포인트 재사용

| 유스케이스 | 재사용할 API |
|-----------|-------------|
| 권종별 상품 목록 | `GET /api/v1/products?brand=SEEDREAMPAY` |
| 장바구니/주문 | `/cart`, `/orders` (FulfillmentType=API로 자동 발급) |
| 구매 후 조회 | `GET /orders/:id` 응답에 VoucherCode 포함 (Secret은 **최초 조회 1회만**) |
| 발급 실패 모니터링 | Admin UI `/admin/orders/:id` + IssuanceLog |

### 7.3 `redeem` 서버 처리

```
POST /api/v1/seedreampay/vouchers/redeem

1. Redis 락아웃 체크 (serial + IP)
2. SELECT VoucherCode WHERE SerialNo=?
3. Status != 'SOLD' → 409
4. ExpiredAt < now → 410
5. SHA256(secret+":"+serialNo) != SecretHash
     → lockout counter 증가, 401
6. Order 검증: Order.UserId == current user, Status=PENDING
7. State-transition-as-CAS:
     UPDATE VoucherCodes
     SET Status='USED', UsedAt=now, RedeemedOrderId=?, RedeemedIp=?
     WHERE Id=? AND Status='SOLD'
     → RowsAffected == 0 이면 409 (경쟁 패배)
8. Payment 레코드 생성 (기존 `Payment` struct 패턴 재사용, `Method="SEEDREAMPAY"`, `seedreampaySerialNo=?`)
   * `Order.PaymentMethod` 컬럼 크기(15)에 `"SEEDREAMPAY"`(11자) 수용 가능
9. 응답: { redeemed: true, amountApplied, orderRemainingAmount }
```

**at-most-once 보장**: 동일 요청 두 번 도착해도 상태 전이 조건 덕에 두 번째는 409. 별도 RowVersion 컬럼 없이 기존 `Status` 컬럼이 CAS 토큰 역할.

### 7.4 응답 바디 규약

```jsonc
// GET /vouchers/:serialNo
{
  "serialNo": "SEED-10K1-X7AB-K9PD-M3QY",
  "faceValue": 10000,
  "status": "SOLD",
  "issuedAt": "2026-04-22T10:00:00Z",
  "expiresAt": "2031-04-22T10:00:00Z",
  "usableInMall": true
}

// POST /vouchers/redeem  (성공)
{
  "redeemed": true,
  "serialNo": "SEED-10K1-X7AB-K9PD-M3QY",
  "amountApplied": 10000,
  "orderRemainingAmount": 23000
}
```

**응답 어디에도 `secret`·`secretHash` 필드가 존재하지 않는다.** JSON 직렬화 시 `VoucherCode.SecretHash`는 `json:"-"`.

---

## 8. 코드 연결 (Issuer / DI / 크론)

### 8.1 파일 구성

```
go-server/internal/
├── app/
│   ├── interfaces/
│   │   └── voucher_issuer.go          # 재사용
│   └── services/
│       ├── fulfillment_svc.go         # 재사용
│       └── seedreampay_svc.go         # 신규: 조회·검증·사용·환불 비즈니스 로직
├── infra/
│   └── issuance/
│       ├── giftmoa_issuer.go          # 기존
│       ├── expay_issuer.go            # 기존
│       └── seedreampay_issuer.go      # 신규: 내부 발급 구현체
├── api/handlers/
│   ├── seedreampay_handler.go         # 신규
│   └── admin_seedreampay_handler.go   # 신규
└── domain/
    └── voucher.go                     # 필드 확장: SerialNo/SecretHash/RedeemedOrderId/RedeemedIp
```

### 8.2 SeedreampayIssuer 뼈대

```go
package issuance

type SeedreampayIssuer struct {
    db        *gorm.DB
    genSerial func(faceValue int) (string, error)
    genSecret func() (string, error)
    now       func() time.Time
}

func (s *SeedreampayIssuer) ProviderCode() string { return "SEEDREAMPAY" }

func (s *SeedreampayIssuer) Issue(ctx context.Context, req interfaces.IssueRequest) ([]interfaces.IssuedVoucher, error) {
    faceValue, err := strconv.Atoi(req.ProductCode) // "1000"/"10000"/"100000"/"500000"
    if err != nil { return nil, ErrInvalidFaceValue }

    var out []interfaces.IssuedVoucher
    err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
        for i := 0; i < req.Quantity; i++ {
            serial, err := s.genSerialWithRetry(tx, faceValue)
            if err != nil { return err }
            secret, err := s.genSecret()
            if err != nil { return err }
            hash := sha256Hex(secret + ":" + serial)

            vc := &domain.VoucherCode{
                ProductID:  req.ProductID,
                SerialNo:   &serial,
                SecretHash: &hash,
                Status:     "SOLD",
                OrderID:    &req.OrderID,
                SoldAt:     ptr(s.now()),
                ExpiredAt:  ptr(s.now().AddDate(5, 0, 0)),
            }
            if err := tx.Create(vc).Error; err != nil { return err }

            out = append(out, interfaces.IssuedVoucher{
                PinCode:        secret,
                TransactionRef: serial,
            })
        }
        return nil
    })
    return out, err
}
```

**외부 HTTP 호출이 없으므로 `gobreaker`·`httpClient`·`baseURL`·`apiKey`를 주입받지 않는다.** giftmoa Issuer와 생성자 시그니처가 의도적으로 다르다.

### 8.3 DI 연결 (container.go)

```go
seedreampayIssuer := issuance.NewSeedreampayIssuer(db, time.Now)
issuers[seedreampayIssuer.ProviderCode()] = seedreampayIssuer
```

추가 환경변수 0개.

### 8.4 크론 작업

| 주기 | 작업 | 구현 |
|------|------|------|
| `@every 15s` | `FulfillmentService.ProcessPendingOrders` | 기존 재사용 |
| `@daily 02:00` | `SeedreampayService.MarkExpiredVouchers` | 신규 |

---

## 9. 테스트 전략

### 9.1 계층별 커버리지

| 계층 | 대상 |
|------|------|
| 단위 | `SeedreampayIssuer.Issue()` — 직렬번호 충돌 재시도, 수량 경계, 권종 파싱 오류 |
| 단위 | `generateSerialNo(faceValue)` — 체크섬 검증, 권종 태그, 혼동문자 미포함 |
| 단위 | `verifySecret(serial, input, hash)` — 해시·솔트 결합 |
| 단위 | `LockoutGuard` — Redis mock으로 5회 임계·TTL·reset |
| 통합 | Issue → Redeem → Refund 전체 플로우 (MSSQL test DB) |
| 통합 | `FulfillmentService.ProcessPendingOrders`가 PAID 주문을 자동 발급 |
| 통합 | 동시 redeem 두 번 → 두 번째 409 (state-CAS 검증) |
| E2E HTTP | Happy path: 주문→결제→발급→redeem |
| E2E | 환불 7일 경계 |
| E2E | 락아웃: 5회 비밀코드 오입력 → 429 |

### 9.2 관찰성

구조화 로그 키 접두사: `seedreampay.*`

| 이벤트 | 레벨 | 필드 (Secret 금지) |
|--------|------|-------------------|
| 발급 성공 | Info | orderCode, quantity, faceValue, serialNos |
| SerialNo 충돌 재시도 | Warn | attempt, serialPrefix |
| redeem 성공 | Info | serialNo, orderId, amountApplied |
| redeem 비밀코드 오류 | Warn | serialNo, clientIP, counter |
| 락아웃 발동 | Warn | serialNo OR clientIP, counter |
| 환불 처리 | Info | serialNo, amount, reason, actor |
| 만료 배치 결과 | Info | expiredCount |

### 9.3 Prometheus 지표

```
seedreampay_issuance_total{face_value="10000"}                          counter
seedreampay_redeem_total{outcome="success|mismatch|expired|locked"}     counter
seedreampay_refund_total{actor="user|admin"}                            counter
seedreampay_voucher_status_gauge{status="SOLD|USED|EXPIRED|REFUNDED"}   gauge (5분 주기 스냅샷)
```

---

## 10. Admin UI (Phase 1 최소)

| 위치 | 기능 |
|------|------|
| 기존 `/admin/products` | 씨드림페이 Brand의 4 Product를 일반 상품처럼 편집 |
| 기존 `/admin/orders/:id` | 주문 상세에 VoucherCode 목록 포함 (SerialNo만, Secret 영영 미노출) |
| 기존 `/admin/issuance-logs` | Provider 필터에 `SEEDREAMPAY` 추가 |
| 신규 `/admin/seedreampay` | 상품권 목록 — 필터: 상태·권종·기간·SerialNo 검색. 상세 모달에 직권 환불 버튼 |

**비밀코드 조회 기능은 Admin UI에서도 제공하지 않는다**. 해시만 저장되어 물리적으로 조회 불가능하며, 이 사실 자체가 감사 증거가 된다.

---

## 11. 마이그레이션 · 배포 · 롤백

### 11.1 DB 마이그레이션

파일: `migrations/009_seedreampay_schema.sql` (idempotent, 기존 runner 패턴 준수)

```sql
BEGIN TRANSACTION;

-- Brand
IF NOT EXISTS (SELECT 1 FROM Brands WHERE Code='SEEDREAMPAY')
    INSERT INTO Brands (Code, Name, Color, [Order])
    VALUES ('SEEDREAMPAY', '씨드림페이', '#3182F6', 99);

-- VoucherCodes 컬럼
IF COL_LENGTH('VoucherCodes','SerialNo')        IS NULL
    ALTER TABLE VoucherCodes ADD SerialNo        NVARCHAR(20) NULL;
IF COL_LENGTH('VoucherCodes','SecretHash')      IS NULL
    ALTER TABLE VoucherCodes ADD SecretHash      CHAR(64)     NULL;
IF COL_LENGTH('VoucherCodes','RedeemedOrderId') IS NULL
    ALTER TABLE VoucherCodes ADD RedeemedOrderId INT          NULL;
IF COL_LENGTH('VoucherCodes','RedeemedIp')      IS NULL
    ALTER TABLE VoucherCodes ADD RedeemedIp      NVARCHAR(45) NULL;

-- Filtered unique index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_VoucherCode_SerialNo')
    CREATE UNIQUE INDEX UX_VoucherCode_SerialNo
        ON VoucherCodes(SerialNo) WHERE SerialNo IS NOT NULL;

-- Products 4개 권종
MERGE Products AS target
USING (VALUES
    ('SEEDREAMPAY','씨드림페이 1,000원권',  1000,  'API','SEEDREAMPAY','1000'),
    ('SEEDREAMPAY','씨드림페이 10,000원권', 10000, 'API','SEEDREAMPAY','10000'),
    ('SEEDREAMPAY','씨드림페이 100,000원권',100000,'API','SEEDREAMPAY','100000'),
    ('SEEDREAMPAY','씨드림페이 500,000원권',500000,'API','SEEDREAMPAY','500000')
) AS src (Brand, Name, Price, FulfillmentType, ProviderCode, ProviderProductCode)
ON target.Brand = src.Brand AND target.ProviderProductCode = src.ProviderProductCode
WHEN NOT MATCHED THEN
    INSERT (Brand, Name, Price, DiscountRate, TradeInRate, FulfillmentType, ProviderCode, ProviderProductCode)
    VALUES (src.Brand, src.Name, src.Price, 0, 0, src.FulfillmentType, src.ProviderCode, src.ProviderProductCode);

COMMIT;
```

### 11.2 배포 순서 (Server B = Go API)

1. 마이그레이션 runner로 009 적용:
   `.\migration-runner.exe -migration=009_seedreampay_schema.sql`
2. Go API zip 배포: `.\scripts\deploy-all.ps1 -Target api`
3. NSSM 재시작 (`nssm restart SeedreamGiftAPI`)
4. Smoke test: SEEDREAMPAY 상품 주문 → 결제 → VoucherCode 발급 확인 → redeem 성공까지

client/admin 번들 재빌드는 Phase 1에서 **불필요** (관리자 전용 UI는 Phase 2).

### 11.3 롤백 전략

- 컬럼 DROP은 **피한다** (데이터 손실 위험).
- 롤백 트리거 시: Brand Row를 `Order=999`로 내리고, Product 4개를 `IsActive=false`로 비활성.
- DI 맵에서 `seedreampayIssuer` 항목을 빼면 즉시 호출 경로 소멸.

---

## 12. 브랜치 전략

`feat/seedream-payment-*` (외부 결제 GW) 과 혼동을 피하기 위해 하이픈 위치로 구분한다.

| 브랜치 | 범위 |
|--------|------|
| `feat/seedreampay-voucher-p1-design` | 본 설계 문서 커밋 (현재) |
| `feat/seedreampay-voucher-p1-schema` | §4·§11.1 마이그레이션 + 도메인 필드 확장 |
| `feat/seedreampay-voucher-p1-issuer` | §8 Issuer + DI + 발급 테스트 |
| `feat/seedreampay-voucher-p1-redeem` | §7 핸들러 + 락아웃 + E2E |

각 브랜치는 독립 PR로 머지하여 리뷰 단위 최소화.

---

## 13. 보안 체크리스트

- [ ] 비밀코드 원문은 DB·로그·응답에 절대 기록되지 않는다 (zap 필드 필터 + `json:"-"`)
- [ ] `VoucherCode.SecretHash` 는 API 응답 직렬화에서 제외
- [ ] 비밀코드는 발급 직후 1회만 노출 (재조회 불가)
- [ ] `redeem` 엔드포인트는 JWT + CSRF (기존 미들웨어)
- [ ] Redis 장애 시 fail-open + 경보 (가용성 > 공격 방어)
- [ ] SerialNo 락아웃은 `SECRET_MISMATCH` 케이스에만 증가 (피해자 DoS 방지)
- [ ] 환불 시 PaymentProvider 실패 → VoucherCode 상태 원복 금지, `IssuanceLog.Status=FAILED_REFUND_PENDING` 큐로 관리자 처리
- [ ] Admin에서도 비밀코드 조회 기능 제공 안 함 (해시만 저장이라 불가)

---

## 14. 범위 외 (Phase 2+)

- 수령자 지정 선물하기 (이메일/SMS 워크플로우, 공개 코드 전용 수령 링크)
- 자유 금액 발행 (5천–50만원 범위 입력)
- 잔액식(stored value) 상품권
- B2B 가맹점 API (giftmoa가 우리에게 쓰는 관계의 반대)
- 만료 사전 알림 (90/30/7일)
- Admin 전용 `/admin/seedreampay` 탭 (Phase 1은 기존 화면 재사용)
- 상품권 양도 (계정 간 이전)
- 대량 구매 모니터링 (OFAC/AML 대응)
- `VoucherIssuer.TransactionRef` 필드명 일반화 리팩터링 (내부/외부 참조 의미론 통일)

---

## 15. 결정 로그

| # | 결정 | 이유 |
|---|------|------|
| 1 | 접근 A (내부 Issuer 구현체) | 기존 파이프라인 재사용, 향후 B2B 확장 시 같은 인터페이스로 HTTP 서버 앞에 노출 가능 |
| 2 | 1회 단일 사용 | 잔액 추적·Transaction 테이블 불필요, 데이터 모델 최소 |
| 3 | 권종 1,000/10,000/100,000/500,000 | 사용자 지정 |
| 4 | 결제 완료 즉시 두 코드 노출 | Phase 1은 링크 공유 수준, 수령자 워크플로우는 Phase 2 |
| 5 | 공개·비밀 2-코드 분리 | 공개는 식별자(URL/QR), 비밀은 사용 승인. 용도 분리로 UX·보안 동시 달성 |
| 6 | 비밀코드 평문 미저장, peppered SHA-256 해시만 | 금융 감사 대응, DB 유출 시 전체 상품권 탈취 방지 |
| 7 | 공개코드에 권종 태그 포함 | CS·운영 가시성 우선, 엔트로피 손해 미미 |
| 8 | 환불 7일 | 사용자 지정 (업계 관례 7–14일 중 최소) |
| 9 | 유효기간 5년 | 상사법 소멸시효 및 업계 표준, 만료 알림은 Phase 2 유예 |
| 10 | 락아웃: SerialNo-miss는 IP만 증가 | 피해자 SerialNo 락아웃 DoS 방지 |
| 11 | State-transition-as-CAS | 기존 Status 컬럼을 낙관적 락 토큰으로 재활용, RowVersion 컬럼 신설 회피 |
| 12 | `ProviderCode="SEEDREAMPAY"` | 기존 `SEEDREAM`(외부 결제) 과 하이픈/대소문자가 아닌 전체 문자열로 명확히 구분 |

---

## 참고 문서

- `docs/superpowers/specs/2026-03-26-voucher-issuance-api-design.md` — 외부 발급사 연동 상위 설계 (재사용 기반)
- `docs/superpowers/specs/2026-04-22-seedream-payment-integration-design.md` — 외부 결제 GW 설계 (별개)
- `go-server/internal/app/interfaces/voucher_issuer.go` — 재사용 인터페이스
- `go-server/internal/infra/issuance/giftmoa_issuer.go` — 참조 구현체
- `CLAUDE.md` — MSSQL·Prisma·Go 빌드 주의사항
