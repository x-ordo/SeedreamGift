# 결제현황 조회 기능 설계 — Partner & Admin

- **작성일**: 2026-04-22
- **대상**: `admin/` (ADMIN role), `partner/` (PARTNER role)
- **상태**: Draft → User Review
- **관련 파일**: `go-server/internal/domain/order.go` (Payment), `go-server/internal/app/services/payment_service.go`, `admin/src/pages/Admin/tabs/OrdersTab.tsx`, `partner/src/pages/Partner/tabs/OrdersTab.tsx`

## 1. 배경

어드민·파트너 양쪽에서 **결제 상태 중심의 조회 뷰가 부재**. 현재는 `OrdersTab`이 주문 관리와 결제 상태를 겸하고 있어, 결제 성공/실패/대기별 흐름을 한눈에 보기 어렵다. PG 트랜잭션 레벨의 시도 이력(같은 주문에 대해 여러 번의 결제 시도)은 전혀 노출되지 않는다.

기반 데이터는 이미 존재: `domain.Payment` 테이블은 `OrderID`에 1:N로 묶여 Method, Status(PENDING/SUCCESS/FAILED/CANCELLED), BankTxID, ConfirmedAt, FailReason 등을 기록하고 있고, `PaymentService`가 initiate·verify·webhook 흐름에서 레코드를 생성·갱신한다. **스키마 변경 없이 조회 경로만 추가**하면 된다.

## 2. 목표 / 비목표

### 목표
- 어드민·파트너가 결제 상태별로 요약 리스트를 조회하고 (관점 A), 특정 주문의 결제 시도 이력을 타임라인으로 드릴다운할 수 있다 (관점 B).
- 파트너 스코프는 "내 상품이 포함된 주문의 결제"로 한정한다.
- 파트너에게 개인정보 및 PG 민감 필드는 서버 응답 단계에서 마스킹/차단한다.

### 비목표
- 신규 엔티티/테이블 추가 없음 (기존 `Payments`·`Orders`·`OrderItems` 활용).
- 결제 재시도/취소 등 write 액션은 본 스펙 범위 외 (기존 환불 플로우 유지).
- 결제 분석/차트 대시보드 별도 신설 없음 (요약 카드 4~5개만 제공).

## 3. 아키텍처 요약

### 접근 방식: 경량 신규 엔드포인트 + 기존 주문 상세 확장

- **리스트 (관점 A)** — 전용 엔드포인트 신설. Payment → Order → User JOIN 결과의 축약 DTO만 반환.
- **상세 드릴다운 (관점 B)** — 신규 엔드포인트 두지 않음. 기존 `GET /admin/orders/:id` / `GET /partner/orders/:id`에 `Payments[]` Preload 추가. 상세 모달 안에 "결제 시도 이력" 섹션을 렌더링.

검토된 대안:
- _독립 엔드포인트 + 독립 상세_ → 상세는 주문 상세와 한 몸이라 호출 2회 발생, 기각.
- _기존 Orders 엔드포인트 확장_ → PaymentsTab이 사실상 OrdersTab 별칭이 되어 존재 이유 약해짐, 기각.

## 4. 백엔드 설계

### 4.1 신규 엔드포인트

```
GET /api/v1/admin/payments       (JWT + RolesGuard: ADMIN)
GET /api/v1/partner/payments     (JWT + RolesGuard: PARTNER, 내 상품 주문으로 자동 스코프)
```

### 4.2 쿼리 파라미터 (양쪽 공통)

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `status` | enum | (전체) | `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED` (Payment.Status 기준) |
| `method` | string | (전체) | `CARD`, `VIRTUAL_ACCOUNT`, `BANK_TRANSFER` |
| `from` | date (YYYY-MM-DD) | 오늘 − 30일 | Payment.CreatedAt 기준 |
| `to` | date | 오늘 | |
| `search` | string | - | 주문코드 / 고객명(ADMIN) |
| `page` | int | 1 | |
| `pageSize` | int | 20 (최대 100) | |

### 4.3 리스트 응답 DTO

```json
{
  "items": [
    {
      "paymentId": 123,
      "orderId": 456,
      "orderCode": "20261022-ABCDE",
      "customerName": "홍길동",
      "method": "VIRTUAL_ACCOUNT",
      "status": "SUCCESS",
      "amount": 100000,
      "failReason": null,
      "confirmedAt": "2026-04-22T10:30:00+09:00",
      "createdAt": "2026-04-22T10:25:00+09:00"
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "summary": {
    "totalCount": 150,
    "successCount": 128,
    "failedCount": 12,
    "pendingCount": 10,
    "refundedCount": 0
  }
}
```

- `summary`는 현재 필터(`from`/`to`/`method`) 기준. `status` 필터가 걸렸더라도 summary는 해당 필터 **미적용** 기준으로 계산 (상태별 토글 UX에 쓸 수 있도록).
- `refundedCount`는 ADMIN 응답에서만 포함. Partner에서는 필드 자체 제외.

### 4.4 Partner 마스킹 규칙 (서버 응답 단계)

```go
// maskPaymentForPartner(p *PaymentDTO) — 모든 Partner 경로에서 호출
```

| 필드 | Admin | Partner |
|------|-------|---------|
| `customerName` / `customerEmail` / `customerPhone` | 원본 | `null` |
| `depositorName` | 원본 | 첫 글자 + `*` (예: `홍*`) |
| `bankCode`, `bankName` | 원본 | 원본 |
| `accountNumber` (가상계좌) | 원본 | 뒤 4자리만 (`****6789`) |
| `bankTxId` | 원본 | 앞 8자 + `****` (예: `PAY_abc1****`) |
| `paymentKey` | 원본 | `null` |
| `failReason` | 원본 | `null` (상태값 `FAILED`로 성공/실패 구분만) |
| `amount`, `method`, `status`, `confirmedAt`, `createdAt`, `expiresAt` | 원본 | 원본 |

### 4.5 Partner 스코프 구현

- 파트너가 판매 주체인 상품만 필터: `Product.PartnerID = :currentPartnerUserID`.
- SQL 개요:
  ```sql
  SELECT DISTINCT p.*
  FROM Payments p
  JOIN Orders o      ON p.OrderId   = o.Id
  JOIN OrderItems oi ON oi.OrderId  = o.Id
  JOIN Products pr   ON pr.Id       = oi.ProductId
  WHERE pr.PartnerID = :partnerUserId
  -- DISTINCT: 같은 주문에 이 파트너의 아이템이 여러 개면 JOIN으로 행이 복제됨
  ```
- GORM에서는 `Joins(...).Distinct("p.Id")`로 처리. User는 별도 `Preload`로 분리 (N+1 방지).
- 주의: `Product.PartnerID`가 NULL(어드민 등록 상품)인 레코드는 WHERE 절에서 자연 배제됨.

### 4.6 기존 주문 상세 엔드포인트 확장

```go
// admin_order_svc.go / partner_order_svc.go
db.Preload("Payments", func(tx *gorm.DB) *gorm.DB {
    return tx.Order("CreatedAt ASC") // 시도 순으로 타임라인 구성
}).First(&order, orderID)
```

응답 JSON에 `payments: Payment[]` 배열 추가. Partner 경로에서는 각 Payment에 `maskPaymentForPartner` 적용 후 반환.

## 5. 프론트엔드 설계

### 5.1 파일 구조

```
admin/src/pages/Admin/tabs/PaymentsTab.tsx        (신규)
admin/src/pages/Admin/components/PaymentTimeline.tsx   (신규, 모달 섹션용)
admin/src/api/index.ts                               (adminApi.getAllPayments 추가)

partner/src/pages/Partner/tabs/PaymentsTab.tsx    (신규)
partner/src/pages/Partner/components/PaymentTimeline.tsx   (신규)
partner/src/api/manual.ts                            (partnerApi.getMyPayments 추가)
```

### 5.2 화면 구성 (양쪽 동일 구조, 디자인 토큰만 각자)

- **Header**: "결제현황" 제목 + [엑셀 다운로드] 버튼
- **Filter Bar**: 기간(기본 최근 30일), 수단, 상태, 검색
- **Summary Cards**: Admin 5개 / Partner 4개
  - 총 결제 / 성공 / 실패 / 대기 / (Admin: 환불)
- **Table** — `admin`은 `AdminTable`, `partner`는 기존 `table` 스타일 사용
  - 컬럼: 주문코드 · 고객(admin) / 결제ID(partner) · 수단 · 금액 · 상태 · 결제일시 · 상세 보기 버튼
- **페이지네이션**: 20건/페이지

### 5.3 상세 모달 "결제 시도 이력" 섹션

기존 `AdminDetailModal`(admin) 및 파트너 모달에 공통 컴포넌트 `PaymentTimeline`을 삽입. 타임라인 아이템 예:

```
● 2026-04-22 10:25  가상계좌 발급 [PENDING]
  입금기한 2026-04-23 10:25
  가상계좌 신한은행 ****6789

● 2026-04-22 10:30  입금 확인 [SUCCESS]
  BankTxId PAY_abc1****   (Partner 마스킹 / Admin 원본)
  확정 시각 10:30:15
```

상태별 색상은 기존 `ORDER_STATUS_COLOR_MAP` 패턴과 일관되도록 `PAYMENT_STATUS_COLOR_MAP` 상수 신설:
- `PENDING`: yellow
- `SUCCESS`: green
- `FAILED`: red
- `CANCELLED`: grey

### 5.4 엑셀 다운로드

- 현재 필터 조건의 전체 결과(페이지네이션 무시)를 서버에서 내려받아 XLSX 생성.
- 파트너는 마스킹된 값을 그대로 엑셀에 기록 (서버 응답 그대로).
- 컬럼: 주문코드, 고객(admin), 수단, 금액, 상태, 결제일시.

## 6. 테스트 전략

### 6.1 Go 서비스 테스트 (`payment_service_test.go` 확장)

- `ListPayments(scope=ADMIN, filters...)` — 기간·상태·수단 조합
- `ListPayments(scope=PARTNER, partnerUserID=X)` — 다른 파트너의 상품 주문은 결과에서 제외 (tenant isolation)
- Summary 카운트 정확성 — `status` 필터 적용/미적용 시 동일 summary 반환
- 마스킹 함수 단위 테스트: 필드별 변환 규칙 10개 케이스

### 6.2 API 통합 테스트

- USER 토큰으로 `/admin/payments` 접근 → 403
- PARTNER 토큰으로 `/admin/payments` 접근 → 403
- PARTNER 토큰으로 `/partner/payments` → 내 파트너의 주문만 반환됨 확인
- 페이지네이션 경계: `pageSize=0`, `pageSize=200`, `page=99999` 처리

### 6.3 Playwright

- `admin/payments.e2e.ts` — 필터 조합 → 테이블 업데이트, 상세 모달에 타임라인 렌더, 엑셀 다운로드
- `partner/payments.e2e.ts` — 동일 시나리오 + 마스킹 필드 값 확인 (`****` 포함 여부)

## 7. 롤아웃 순서 (커밋 단위)

1. **DTO + 마스킹** — `go-server/internal/api/dto/payment.go`, `mask.go`, 마스킹 단위 테스트
2. **Service** — `PaymentQueryService.ListPayments(scope, filters)` 신규, 기존 `AdminOrderService.GetOrder`/`PartnerOrderService.GetOrder`에 Payments Preload 추가
3. **Handler + Route** — `admin_payment_handler.go`, `partner_payment_handler.go`, `routes/admin.go`·`routes/partner.go` 등록
4. **Swagger 재생성** + `pnpm api:generate` (admin/partner 각각)
5. **Admin 프론트** — `PaymentsTab`, `PaymentTimeline`, 상세 모달 통합, 사이드바 메뉴 항목 추가
6. **Partner 프론트** — 동일
7. **Playwright E2E** — admin/partner 각 1개
8. **Go 빌드**: `wails build -platform windows/amd64` 로 검증 (프로젝트 규칙)

## 8. 위험 요소 및 완화

| 위험 | 영향 | 완화 |
|------|------|------|
| 마스킹 누수 (프론트에서 마스킹하면 DevTools 노출) | 개인정보 침해 | 서버 응답 DTO 단계에서 일괄 `maskPaymentForPartner` 호출, 테스트로 검증 |
| N+1 쿼리 (Payment → Order → User → OrderItems → Product) | 성능 | `Joins + Preload` 조합, 결제현황 전용 인덱스 검토: `Payments(Status, CreatedAt)` |
| Order.Status와 Payment.Status 불일치 | 혼란 | 리스트/필터는 Payment.Status 기준으로 통일, 상세 모달에서 두 값 모두 표시 |
| 파트너 스코프 조인 실수로 타 파트너 데이터 노출 | 심각한 데이터 누수 | 통합 테스트 필수 케이스 지정 (tenant isolation), 코드 리뷰 체크리스트 |
| `accountNumber`가 서버에 평문 저장되어 있는지 확인 필요 | 암호화 이슈 | 현재 `json:"-"` 처리되어 응답 제외. 마스킹 적용된 새 필드 `accountNumberMasked`로만 내려보냄 |
| 혼합 주문에서 파트너가 자기 몫 외 금액도 보게 됨 (Partner A·B 상품이 섞인 주문일 때 양쪽 모두 전체 결제금액 노출) | 정산 관점 혼동 | Partner 테이블에 `금액` 옆 "내 상품 소계" 컬럼을 추가하거나, 툴팁으로 "전체 주문 결제금액이며 본인 정산 금액과 다를 수 있음" 안내. 기존 `getMyOrders`도 동일한 트레이드오프를 가지므로 정책 일치 |

## 9. 참고

- 기존 유사 패턴: `admin/src/pages/Admin/tabs/OrdersTab.tsx` (리스트 + 상세모달), `partner/src/pages/Partner/tabs/PayoutsTab.tsx` (기간 필터 + 요약 카드 + 테이블)
- 관련 스펙: `2026-03-26-voucher-issuance-api-design.md` (결제 확정 시 바우처 SOLD 전환 흐름)
- CLAUDE.md — Build Rules (wails build 필수), CSS Visual Consistency Rules
