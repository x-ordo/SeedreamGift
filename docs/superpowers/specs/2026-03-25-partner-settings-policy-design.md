# 파트너 설정 & 정책 설계 스펙

## 1. 개요

상품권 거래 플랫폼에서 파트너가 직접 상품/PIN을 등록하고 판매하는 모델에 필요한 **비즈니스 정책, 수수료 정산, 보안, 관리 기능**을 정의합니다.

### 범위
- 수수료 차감 정산 모델
- 정산 주기 (즉시/주간/월간/수동) 설정
- 조건부 자동승인 + 사후 관리
- 파트너 제한 정책 (상품 수, PIN 수, 가격 범위, 최소 정산)
- 파트너 계정 관리 + 보안 관리
- 크론잡 어드민 세팅
- 파트너 전용 OpenAPI 확장 가능성 (추후)

---

## 2. 수수료/정산 모델

### 2.1 수수료 구조

| 항목 | 설명 |
|------|------|
| 전역 기본 수수료율 | SiteConfig `PARTNER_COMMISSION_RATE` (기본 5%) |
| 파트너별 오버라이드 | User 모델 `CommissionRate *decimal` (NULL이면 전역 적용) |
| 계산 공식 | `정산액 = 판매액 × (1 - 수수료율/100)` |

### 2.2 PartnerSettlement 모델 (신규)

```go
type PartnerSettlement struct {
    ID               int
    PartnerID        int             // FK to User
    Period           string          // "2026-03" (월간), "2026-W13" (주간), "INSTANT-{orderId}" (즉시)
    Frequency        string          // INSTANT, WEEKLY, MONTHLY, MANUAL
    TotalSales       NumericDecimal  // 총 판매액
    TotalQuantity    int             // 총 판매 수량
    CommissionRate   NumericDecimal  // 적용 수수료율
    CommissionAmount NumericDecimal  // 수수료 금액
    PayoutAmount     NumericDecimal  // 정산액 = 판매 - 수수료
    Status           string          // PENDING → CONFIRMED → PAID / FAILED
    TransferRef      *string         // 이체 참조번호
    PaidAt           *time.Time
    FailureReason    *string
    AdminNote        *string
    CreatedAt        time.Time
    UpdatedAt        time.Time
}
```

### 2.3 정산 상태 흐름
```
PENDING → CONFIRMED (어드민 확인) → PAID (입금 완료)
                                  → FAILED (입금 실패, 사유 기록)
```

### 2.4 정산 주기

| 주기 | SiteConfig 값 | 크론 스케줄 | 동작 |
|------|--------------|-----------|------|
| 즉시 | `INSTANT` | 주문 DELIVERED 이벤트 | 개별 정산 레코드 즉시 생성 |
| 주간 | `WEEKLY` | 매주 월요일 09:00 KST | 전주 월~일 판매분 일괄 |
| 월간 | `MONTHLY` | 매월 1일 09:00 KST | 전월 1일~말일 판매분 일괄 |
| 수동 | `MANUAL` | 없음 | 어드민이 직접 생성 |

- 파트너별 주기: User 모델 `PayoutFrequency *string` (NULL이면 전역 기본값)
- 전역 기본값: SiteConfig `PARTNER_DEFAULT_PAYOUT_FREQUENCY` = "MONTHLY"

---

## 3. 파트너 상품 등록 정책 — "어드민 권종만 허용"

### 3.1 핵심 원칙

**파트너는 자체 상품(권종)을 생성할 수 없습니다.**
파트너는 어드민이 만든 기존 상품에 PIN 재고만 등록합니다.

```
어드민: 상품(권종) 생성 → AllowPartnerStock = true/false 설정
파트너: 허용된 상품에만 PIN 업로드 가능
고객: 어드민 PIN + 파트너 PIN이 합산된 재고에서 구매
```

### 3.2 Product 모델 확장

```go
// 기존 필드에 추가
AllowPartnerStock  bool  `gorm:"default:false"` // 파트너 PIN 등록 허용 여부
```

- `AllowPartnerStock = true`: 파트너가 이 상품에 PIN 등록 가능
- `AllowPartnerStock = false` (기본값): 어드민만 PIN 등록 가능

### 3.3 파트너 PIN 업로드 검증 흐름

```
파트너가 PIN 업로드 요청
  ├─ 상품 존재 확인
  ├─ 상품 IsActive 확인
  ├─ 상품 AllowPartnerStock == true 확인  ← 신규 검증
  ├─ 일일 PIN 한도 확인
  ├─ PIN 중복 확인
  └─ 등록 (Source='PARTNER', SuppliedByPartnerID=파트너ID)
```

### 3.4 어드민 UI 변경
- ProductsTab 상품 생성/수정 모달에 **"파트너 재고 허용"** 토글 스위치 추가
- ProductsTab 테이블에 **파트너 허용** 컬럼 (체크 아이콘 or 뱃지)
- PartnersTab → 파트너 상세 모달에서 "등록 가능 상품" 목록 = AllowPartnerStock=true 상품

### 3.5 파트너 앱 변경
- 파트너 Products/Vouchers 탭에서 AllowPartnerStock=true인 상품만 표시
- 파트너는 상품 생성 불가 (POST /partner/products 제거 또는 비활성화)
- 파트너 대시보드: "등록 가능 상품 N개" 표시

---

## 4. 조건부 자동승인 + 사후 관리

> 주의: 파트너는 상품을 직접 생성하지 않으므로, "자동승인"은 상품이 아니라
> **파트너 PIN 등록의 자동 활성화** 에 적용됩니다.
> 파트너가 등록한 PIN은 즉시 AVAILABLE 상태로 활성화되며,
> 이상 감지 시 사후적으로 비활성화합니다.

### 4.1 사후 관리 (자동 비활성화 트리거)

| 트리거 | 설정 키 | 기본값 | 조치 |
|--------|--------|--------|------|
| 고객 클레임 N건/월 | `PARTNER_CLAIM_THRESHOLD` | 3건 | 파트너 PIN 등록 일시 차단 |
| PIN 불량률 N% | `PARTNER_PIN_DEFECT_RATE` | 5% | 파트너 PIN 전체 검수 전환 |
| 비정상 대량 등록 | 일일 한도 초과 | - | 자동 차단 + 어드민 알림 |

---

## 5. 파트너 제한 정책

### 5.1 전역 제한 (SiteConfig)

| 키 | 기본값 | 설명 |
|----|--------|------|
| `PARTNER_DAILY_PIN_LIMIT` | 500 | 일일 PIN 업로드 수 |
| `PARTNER_MIN_PAYOUT_AMOUNT` | 10000 | 최소 정산 금액 (원) |
| `PARTNER_COMMISSION_RATE` | 5.00 | 기본 수수료율 (%) |

> 파트너는 상품을 생성하지 않으므로 `MAX_PRODUCTS`, `DISCOUNT_RATE` 제한은 불필요.
> 상품별 파트너 PIN 허용 여부는 Product.AllowPartnerStock으로 제어.

### 5.2 파트너별 오버라이드 (User 모델 확장)

```go
// User 모델에 추가
CommissionRate     *NumericDecimal // 개별 수수료율 (NULL = 전역)
PayoutFrequency    *string         // 정산 주기 (NULL = 전역)
DailyPinLimit      *int            // 일일 PIN 수 (NULL = 전역)
```

### 5.3 적용 우선순위
```
파트너 개별 설정 > 전역 SiteConfig 설정 > 하드코딩 기본값
```

---

## 5. 파트너 계정 관리

### 5.1 파트너 온보딩 흐름
```
회원가입(USER) → 파트너 신청 → 어드민 승인 → PARTNER 역할 부여
                                            → 기본 설정 적용
                                            → PartnerSince 기록
```

### 5.2 파트너 상태 관리

| 상태 | 설명 | 조치 |
|------|------|------|
| 활성 | 정상 운영 중 | 상품 등록/판매 가능 |
| 잠금 | LockedUntil 설정 | 로그인 불가, 판매 중단 |
| 정지 | 어드민 판단 | 모든 상품 비활성화 + 잠금 |
| 해제 | 역할 변경 USER | 파트너 기능 상실, 기존 상품 비활성화 |

### 5.3 어드민 파트너 관리 기능

| 기능 | 엔드포인트 | 설명 |
|------|-----------|------|
| 파트너 목록 | `GET /admin/users?role=PARTNER` | 기존 |
| 파트너 상세 | `GET /admin/users/:id/summary` | 기존 |
| 계정 잠금/해제 | `PATCH /admin/users/:id/lock\|unlock` | 기존 |
| 역할 변경 | `PATCH /admin/users/:id/role` | 기존 |
| **수수료율 설정** | `PATCH /admin/users/:id/commission` | **신규** |
| **정산 주기 설정** | `PATCH /admin/users/:id/payout-frequency` | **신규** |
| **제한 설정** | `PATCH /admin/users/:id/partner-limits` | **신규** |
| **파트너 정지** | `PATCH /admin/users/:id/suspend` | **신규** (잠금+상품 일괄 비활성화) |
| **정산 생성** | `POST /admin/settlements` | **신규** |
| **정산 확인/입금** | `PATCH /admin/settlements/:id/status` | **신규** |

---

## 6. 파트너 보안 관리

### 6.1 인증/접근 제어

| 항목 | 현재 | 추가 필요 |
|------|------|----------|
| JWT 인증 | 완료 | - |
| PartnerOnly 미들웨어 | 완료 | - |
| 소유권 검증 | 완료 (상품/바우처) | - |
| **IP 화이트리스트** | 어드민만 | 파트너에도 선택적 적용 |
| **API Rate Limit** | 전역 패턴 룰 | 파트너 전용 룰 추가 |
| **세션 관리** | 어드민에서 강제 로그아웃 | 파트너 세션 모니터링 |

### 6.2 파트너 보안 SiteConfig

| 키 | 기본값 | 설명 |
|----|--------|------|
| `PARTNER_SESSION_TIMEOUT_MIN` | 60 | 파트너 세션 만료 (분) |
| `PARTNER_MAX_LOGIN_ATTEMPTS` | 5 | 최대 로그인 시도 |
| `PARTNER_LOCK_DURATION_MIN` | 30 | 로그인 실패 잠금 (분) |
| `PARTNER_IP_WHITELIST_ENABLED` | false | IP 화이트리스트 활성화 |
| `PARTNER_API_RATE_LIMIT` | 100 | 분당 API 호출 제한 |

### 6.3 이상 감지

| 패턴 | 설명 | 조치 |
|------|------|------|
| 대량 PIN 등록 시도 | 일일 한도 초과 | 차단 + 어드민 알림 |
| 비정상 가격 설정 | 시장가 대비 +-30% 이상 | 자동승인 차단 → 수동 검토 |
| 짧은 시간 내 대량 상품 변경 | 1분 내 10건 이상 | 일시 차단 + 어드민 알림 |

---

## 7. 크론잡 어드민 세팅

### 7.1 정산 크론잡 (신규)

| 잡 이름 | 스케줄 | 설명 |
|---------|--------|------|
| 주간 정산 배치 | 매주 월요일 09:00 KST | WEEKLY 파트너 정산 레코드 생성 |
| 월간 정산 배치 | 매월 1일 09:00 KST | MONTHLY 파트너 정산 레코드 생성 |
| 사후 관리 체크 | 매일 03:00 KST | 재고 0 지속, 클레임 초과 감지 |

### 7.2 Wails 콘솔에서 크론잡 관리

기존 `GetCronStatus()` + `RunCronJob()` 확장:
- 새 크론잡들 표시
- 수동 실행 가능
- 마지막 실행 상태 표시

### 7.3 어드민 웹에서 크론잡 설정 (신규)

ConfigsTab에 "정산 스케줄" 섹션 추가:
- 주간 정산 요일/시간 설정
- 월간 정산 일자/시간 설정
- 사후 관리 임계값 설정 (재고 0 일수, 클레임 건수, 불량률)

---

## 8. 파트너 전용 OpenAPI 확장 가능성

### 8.1 현재 구조
- 모든 파트너 엔드포인트: `/api/v1/partner/*` (JWT 인증)
- 파트너 프론트엔드 앱(`partner/`)에서만 호출

### 8.2 향후 확장 (추후 구현)
- **파트너 API 키** 발급: JWT 대신 API Key 인증
- **Swagger/OpenAPI 문서** 자동 생성: `/partner/docs`
- **Webhook**: 주문 완료, 정산 완료 시 파트너에게 콜백
- **외부 연동**: 파트너 자체 시스템에서 API로 상품/재고 관리

설계 시점에서 라우트 그룹 분리가 되어 있으므로 (`/partner/*`), 추후 인증 미들웨어만 교체하면 API Key 기반으로 전환 가능.

---

## 9. SiteConfig 전체 키 목록

| 키 | 기본값 | 카테고리 |
|----|--------|----------|
| `PARTNER_COMMISSION_RATE` | 5.00 | 수수료 |
| `PARTNER_MIN_PAYOUT_AMOUNT` | 10000 | 정산 |
| `PARTNER_DEFAULT_PAYOUT_FREQUENCY` | MONTHLY | 정산 |
| `PARTNER_DAILY_PIN_LIMIT` | 500 | 제한 |
| `PARTNER_CLAIM_THRESHOLD` | 3 | 사후관리 |
| `PARTNER_PIN_DEFECT_RATE` | 5 | 사후관리 |
| `PARTNER_SESSION_TIMEOUT_MIN` | 60 | 보안 |
| `PARTNER_MAX_LOGIN_ATTEMPTS` | 5 | 보안 |
| `PARTNER_LOCK_DURATION_MIN` | 30 | 보안 |
| `PARTNER_IP_WHITELIST_ENABLED` | false | 보안 |
| `PARTNER_API_RATE_LIMIT` | 100 | 보안 |

---

## 10. 수정 대상 파일

### Go 백엔드
| 파일 | 변경 |
|------|------|
| `internal/domain/settlement.go` | **신규** — PartnerSettlement 모델 |
| `internal/domain/product.go` | `AllowPartnerStock bool` 필드 추가 |
| `internal/domain/user.go` | CommissionRate, PayoutFrequency, DailyPinLimit 필드 추가 |
| `internal/app/services/partner_svc.go` | BulkUpload에 AllowPartnerStock + 일일 한도 체크, CreateProduct 제거/비활성화 |
| `internal/app/services/settlement_svc.go` | **신규** — 정산 생성/조회/상태변경 서비스 |
| `internal/api/handlers/settlement_handler.go` | **신규** — 정산 핸들러 |
| `internal/api/handlers/admin_user_handler.go` | 수수료/정산주기/제한 설정 핸들러 추가 |
| `internal/routes/admin.go` | 정산 라우트 추가 |
| `internal/routes/partner.go` | POST /partner/products 제거 |
| `internal/cron/scheduler.go` | 주간/월간 정산 배치, 사후 관리 크론잡 추가 |
| `migrations/add_settlement_tables.sql` | **신규** — DB 마이그레이션 |

### 어드민 UI
| 파일 | 변경 |
|------|------|
| `admin/src/pages/Admin/tabs/ProductsTab.tsx` | "파트너 재고 허용" 토글 + 컬럼 추가 |
| `admin/src/pages/Admin/tabs/PartnersTab.tsx` | 수수료/정산/제한 설정 모달 추가 |
| `admin/src/pages/Admin/tabs/ConfigsTab.tsx` | 파트너 정책 SiteConfig 섹션 추가 |
| **SettlementsTab.tsx** | **신규** — 정산 관리 탭 |

### 파트너 앱
| 파일 | 변경 |
|------|------|
| `partner/src/pages/Partner/tabs/ProductsTab.tsx` | AllowPartnerStock=true 상품만 표시, 생성 기능 제거 |
| `partner/src/pages/Partner/tabs/VouchersTab.tsx` | 허용된 상품에만 PIN 등록 |
| `partner/src/pages/Partner/tabs/DashboardTab.tsx` | "등록 가능 상품 N개" 표시 |

### Wails 콘솔
| 파일 | 변경 |
|------|------|
| `internal/gui/app.go` | 정산 크론잡 상태 표시 |
