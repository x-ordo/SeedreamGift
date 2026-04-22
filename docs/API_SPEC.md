# 씨드림기프트 API 명세서

> **Base URL**: `/api/v1`
> **인증**: JWT Bearer Token (`Authorization: Bearer {access_token}`)
> **응답 형식**: 모든 응답은 `APIResponse` 구조를 따름

## 응답 구조

```json
{
  "success": true,
  "data": { ... },
  "message": "optional message",
  "error": "error description (실패 시)",
  "errorId": "trace-id (5xx 에러 시)"
}
```

### 페이지네이션 응답

```json
{
  "success": true,
  "data": {
    "items": [...],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

### HTTP 상태 코드

| 코드 | 의미 |
|------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 (유효성 검사 실패) |
| 401 | 인증 실패 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 429 | 요청 횟수 초과 |
| 500 | 서버 내부 오류 |

---

## 공통 헤더

### 요청 헤더

| 헤더 | 설명 | 필수 |
|------|------|------|
| `Authorization` | `Bearer {access_token}` | 인증 필요 API |
| `Content-Type` | `application/json` | POST/PATCH/PUT |
| `X-Trace-Id` | 요청 추적 ID (클라이언트 설정) | 선택 |

### 응답 헤더

| 헤더 | 설명 |
|------|------|
| `X-Trace-Id` | 요청 추적 ID |
| `X-Response-Time` | 응답 소요 시간 |
| `X-RateLimit-Limit` | 분당 허용 요청 수 |
| `X-RateLimit-Remaining` | 남은 요청 수 |
| `X-RateLimit-Reset` | 리셋 시간 (Unix) |
| `ETag` | 응답 캐시 해시 |

---

## 1. 시스템

### 헬스 체크

| | |
|---|---|
| **GET** | `/health` |
| **인증** | 불필요 |

```json
// Response 200
{
  "status": "ok",
  "details": {
    "database": "ok",
    "memory_heap": "12.5 MB"
  }
}
```

### Sitemap

| | |
|---|---|
| **GET** | `/sitemap.xml` |
| **인증** | 불필요 |
| **Content-Type** | `application/xml` |

### Swagger 문서

| | |
|---|---|
| **GET** | `/docs/index.html` |
| **인증** | 불필요 (프로덕션 차단) |

---

## 2. 인증 (Auth)

> 브루트포스 방어 미들웨어 적용: `login`, `register`, `forgot-password`, `reset-password`

### 2.1 로그인

| | |
|---|---|
| **POST** | `/api/v1/auth/login` |
| **Rate Limit** | LoginBruteForceGuard |

```json
// Request
{ "email": "user@example.com", "password": "password123" }

// Response 200
{
  "success": true,
  "data": {
    "user": { "id": 1, "email": "user@example.com", "role": "USER", ... },
    "accessToken": "eyJ...",
    "requireMfa": false
  }
}

// Response 200 (MFA 필요 시)
{
  "success": true,
  "data": {
    "requireMfa": true,
    "mfaToken": "temp-token-for-mfa"
  }
}
```

### 2.2 MFA 2단계 로그인

| | |
|---|---|
| **POST** | `/api/v1/auth/login/mfa` |
| **Rate Limit** | LoginBruteForceGuard |

```json
// Request
{ "mfaToken": "temp-token", "code": "123456" }

// Response 200 — 로그인 완료 (user + tokens)
```

### 2.3 회원가입

| | |
|---|---|
| **POST** | `/api/v1/auth/register` |
| **Rate Limit** | LoginBruteForceGuard |

```json
// Request
{
  "email": "user@example.com",
  "password": "password123",
  "name": "홍길동",
  "phone": "01012345678"
}

// Response 201
```

### 2.4 토큰 갱신

| | |
|---|---|
| **POST** | `/api/v1/auth/refresh` |
| **인증** | 쿠키 기반 (refresh_token) |

```json
// Response 200 — 새 access_token + refresh_token 발급
```

### 2.5 로그아웃

| | |
|---|---|
| **POST** | `/api/v1/auth/logout` |

```json
// Response 200 — refresh_token 무효화, 쿠키 제거
```

### 2.6 내 정보 조회

| | |
|---|---|
| **GET** | `/api/v1/auth/me` |
| **인증** | JWT 필수 |

```json
// Response 200 — User 객체
```

### 2.7 프로필 수정

| | |
|---|---|
| **PATCH** | `/api/v1/auth/profile` |
| **인증** | JWT 필수 |

```json
// Request — 수정할 필드만 전송
{ "name": "새이름", "phone": "01098765432", "zipCode": "12345", "address": "서울시..." }
```

### 2.8 비밀번호 변경

| | |
|---|---|
| **PATCH** | `/api/v1/auth/password` |
| **인증** | JWT 필수 |

```json
// Request
{ "oldPassword": "current123", "newPassword": "newpass456" }
```

### 2.9 비밀번호 재설정 요청

| | |
|---|---|
| **POST** | `/api/v1/auth/forgot-password` |

```json
// Request
{ "email": "user@example.com" }

// Response 200 — 재설정 토큰 발급 (이메일 전송)
```

### 2.10 비밀번호 재설정

| | |
|---|---|
| **POST** | `/api/v1/auth/reset-password` |

```json
// Request
{ "email": "user@example.com", "token": "reset-token", "newPassword": "newpass123" }
```

### 2.11 세션 관리

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/api/v1/auth/sessions` | 내 활성 세션 목록 |
| **DELETE** | `/api/v1/auth/sessions` | 현재 세션 외 전체 삭제 |
| **DELETE** | `/api/v1/auth/sessions/:id` | 특정 세션 삭제 |

> 모든 세션 API는 JWT 인증 필수

### 2.12 MFA (다중 인증)

| Method | Path | 설명 |
|--------|------|------|
| **POST** | `/api/v1/auth/mfa/setup` | QR 코드 생성 (secret, qrUrl 반환) |
| **POST** | `/api/v1/auth/mfa/verify` | TOTP 코드 검증 후 MFA 활성화 |
| **GET** | `/api/v1/auth/mfa/status` | MFA 활성화 상태 조회 |
| **POST** | `/api/v1/auth/mfa/disable` | MFA 비활성화 (TOTP 코드 필요) |

> 모든 MFA API는 JWT 인증 필수

---

## 3. 브랜드 (Brands)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| **GET** | `/api/v1/brands` | 브랜드 목록 | 불필요 |
| **GET** | `/api/v1/brands/:code` | 브랜드 상세 | 불필요 |

**Query Parameters** (목록):

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `page` | int | 1 | 페이지 번호 |
| `limit` | int | 20 | 페이지당 항목 수 |

---

## 4. 상품 (Products)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| **GET** | `/api/v1/products` | 상품 목록 | 불필요 |
| **GET** | `/api/v1/products/:id` | 상품 상세 | 불필요 |
| **GET** | `/api/v1/products/brand/:brand` | 브랜드별 상품 | 불필요 |
| **GET** | `/api/v1/products/rates` | 할인율 조회 | 불필요 |
| **GET** | `/api/v1/products/live-rates` | 실시간 할인율 | 불필요 |

**Query Parameters** (목록):

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `page` | int | 1 | 페이지 번호 |
| `limit` | int | 20 | 페이지당 항목 수 |
| `brand` | string | - | 브랜드 코드 필터 |

---

## 5. 콘텐츠 (Content)

### 5.1 공지사항

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| **GET** | `/api/v1/notices` | 목록 (페이징) | 불필요 |
| **GET** | `/api/v1/notices/active` | 활성 목록 | 불필요 |
| **GET** | `/api/v1/notices/:id` | 상세 | 불필요 |
| **PATCH** | `/api/v1/notices/:id/view` | 조회수 증가 | 불필요 |

### 5.2 FAQ

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| **GET** | `/api/v1/faqs` | 목록 (페이징, 카테고리 필터) | 불필요 |
| **GET** | `/api/v1/faqs/active` | 활성 목록 | 불필요 |
| **GET** | `/api/v1/faqs/categories` | 카테고리 목록 | 불필요 |
| **GET** | `/api/v1/faqs/:id` | 상세 | 불필요 |
| **PATCH** | `/api/v1/faqs/:id/helpful` | 도움됨 수 증가 | 불필요 |

### 5.3 이벤트

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| **GET** | `/api/v1/events` | 목록 (페이징) | 불필요 |
| **GET** | `/api/v1/events/active` | 활성 이벤트 (상태 필터) | 불필요 |
| **GET** | `/api/v1/events/featured` | 추천 이벤트 | 불필요 |
| **GET** | `/api/v1/events/:id` | 상세 | 불필요 |
| **PATCH** | `/api/v1/events/:id/view` | 조회수 증가 | 불필요 |

---

## 6. 장바구니 (Cart)

> 모든 API JWT 인증 필수

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/api/v1/cart` | 장바구니 조회 |
| **GET** | `/api/v1/cart/check-limit` | 구매 한도 확인 |
| **POST** | `/api/v1/cart` | 상품 추가 |
| **PATCH** | `/api/v1/cart/:id` | 수량 변경 |
| **DELETE** | `/api/v1/cart/:id` | 항목 삭제 |
| **DELETE** | `/api/v1/cart/batch` | 일괄 삭제 |
| **DELETE** | `/api/v1/cart` | 전체 비우기 |

```json
// POST /cart — Request
{ "productId": 1, "quantity": 2 }

// PATCH /cart/:id — Request
{ "quantity": 3 }

// DELETE /cart/batch — Request
{ "productIds": [1, 2, 3] }

// GET /cart — Response
{
  "items": [...],
  "itemCount": 3,
  "totalAmount": 150000
}
```

---

## 7. 결제 (Payments)

> 모든 API JWT 인증 필수

| Method | Path | 설명 |
|--------|------|------|
| **POST** | `/api/v1/payments/initiate` | 결제 시작 |
| **GET** | `/api/v1/payments/verify` | 결제 검증 |

```json
// POST /payments/initiate — Request
{ "orderId": 1, "method": "BANK_TRANSFER", "amount": 100000 }

// GET /payments/verify — Query
?paymentKey=xxx&orderId=1
```

---

## 8. 주문 (Orders)

> 모든 API JWT 인증 필수

| Method | Path | 설명 | 비고 |
|--------|------|------|------|
| **POST** | `/api/v1/orders` | 주문 생성 | TransactionThrottle |
| **GET** | `/api/v1/orders/my` | 내 주문 목록 | 페이징 |
| **GET** | `/api/v1/orders/:id` | 주문 상세 | |
| **POST** | `/api/v1/orders/:id/cancel` | 주문 취소 | |
| **POST** | `/api/v1/orders/payment/confirm` | 결제 확인 | |
| **GET** | `/api/v1/orders/my/export` | 주문 내역 내보내기 | |
| **GET** | `/api/v1/orders/my/bank-submission` | 계좌 제출 내역 | |

```json
// POST /orders — Request
{
  "items": [{ "productId": 1, "quantity": 2 }],
  "paymentMethod": "BANK_TRANSFER",
  "shippingMethod": "DELIVERY",
  "recipientName": "홍길동",
  "recipientPhone": "01012345678",
  "recipientAddr": "서울시 강남구...",
  "recipientZip": "12345"
}

// POST /orders/payment/confirm — Request
{ "orderId": 1, "paymentKey": "toss-payment-key" }
```

**주문 상태 흐름**:
```
PENDING → PAID → DELIVERED → COMPLETED
   ↓         ↓
CANCELLED  CANCELLED
```

---

## 9. 선물 (Gifts)

> 모든 API JWT 인증 필수

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/api/v1/gifts/received` | 받은 선물 목록 |
| **GET** | `/api/v1/orders/my-gifts` | 받은 선물 (별칭) |
| **POST** | `/api/v1/gifts/check-receiver` | 수신자 확인 |
| **GET** | `/api/v1/gifts/search` | 수신자 검색 |
| **POST** | `/api/v1/gifts/:id/claim` | 선물 수령 |

```json
// POST /gifts/check-receiver — Request
{ "email": "receiver@example.com" }

// GET /gifts/search — Query
?query=홍길  (최소 3자)
```

---

## 10. 매입 (Trade-Ins)

> 모든 API JWT 인증 필수

| Method | Path | 설명 | 비고 |
|--------|------|------|------|
| **POST** | `/api/v1/trade-ins` | 매입 신청 | TransactionThrottle |
| **GET** | `/api/v1/trade-ins/my` | 내 매입 목록 | 페이징 |
| **GET** | `/api/v1/trade-ins/:id` | 매입 상세 | |

```json
// POST /trade-ins — Request
{
  "productId": 1,
  "quantity": 1,
  "pinCode": "1234-5678-9012",
  "securityCode": "1234",
  "bankName": "신한은행",
  "accountNum": "110-123-456789",
  "accountHolder": "홍길동"
}
```

**매입 상태 흐름**:
```
REQUESTED → VERIFIED → PAID
     ↓
  REJECTED
```

---

## 11. KYC (본인인증)

> 모든 API JWT 인증 필수

### 11.1 1원 계좌 인증

| Method | Path | 설명 |
|--------|------|------|
| **POST** | `/api/v1/kyc/bank-verify/request` | 1원 인증 요청 |
| **POST** | `/api/v1/kyc/bank-verify/confirm` | 1원 인증 확인 |
| **GET** | `/api/v1/kyc/bank-account` | 등록 계좌 조회 |
| **POST** | `/api/v1/kyc/bank-account` | 계좌 변경 |
| **POST** | `/api/v1/kyc/verify-sms` | SMS 인증 |

```json
// POST /kyc/bank-verify/request — Request
{ "bankCode": "088", "accountNumber": "110123456789", "accountHolder": "홍길동" }

// Response 200
{ "verifyTrDt": "20260322", "verifyTrNo": "TRX123456" }

// POST /kyc/bank-verify/confirm — Request
{ "verifyTrNo": "TRX123456", "verifyWord": "기프트" }
```

### 11.2 KCB 본인인증

| Method | Path | 설명 |
|--------|------|------|
| **POST** | `/api/v1/kyc/kcb/start` | 인증 세션 시작 |
| **GET** | `/api/v1/kyc/kcb/check-status` | 인증 상태 확인 |
| **POST** | `/api/v1/kyc/kcb/complete` | 인증 완료 |

```json
// POST /kyc/kcb/start — Response
{ "authId": "kcb-auth-id", "popupUrl": "https://..." }

// GET /kyc/kcb/check-status — Query
?kcbAuthId=kcb-auth-id

// POST /kyc/kcb/complete — Request
{ "kcbAuthId": "kcb-auth-id", "name": "홍길동", "phone": "01012345678", "ci": "..." }
```

---

## 12. 회원 (Users)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| **DELETE** | `/api/v1/users/me` | 회원 탈퇴 | JWT 필수 |

```json
// DELETE /users/me — Request
{ "password": "current-password" }
```

---

## 13. 1:1 문의 (Inquiries)

> 모든 API JWT 인증 필수

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/api/v1/inquiries` | 내 문의 목록 (페이징) |
| **POST** | `/api/v1/inquiries` | 문의 등록 |
| **PATCH** | `/api/v1/inquiries/:id` | 문의 수정 (PENDING만) |
| **DELETE** | `/api/v1/inquiries/:id` | 문의 삭제 (PENDING만) |

```json
// POST /inquiries — Request
{ "category": "ORDER", "subject": "주문 문의", "content": "상세 내용..." }
```

---

## 14. 관리자 API (Admin)

> 모든 Admin API는 **JWT 인증 + ADMIN 역할** 필수
> Base Path: `/api/v1/admin`

### 14.1 대시보드

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/stats` | 대시보드 통계 |

```json
// Response 200
{
  "userCount": 1500,
  "productCount": 25,
  "orderCount": 3200,
  "pendingOrderCount": 12,
  "tradeInCount": 450,
  "pendingKycCount": 3,
  "pendingTradeInCount": 8,
  "availableVouchers": 520
}
```

### 14.2 회원 관리

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/users` | 회원 목록 (kycStatus, role 필터) |
| **GET** | `/admin/users/:id` | 회원 상세 |
| **POST** | `/admin/users` | 회원 생성 |
| **PATCH** | `/admin/users/:id` | 회원 수정 |
| **DELETE** | `/admin/users/:id` | 회원 삭제 (소프트) |
| **PATCH** | `/admin/users/:id/kyc` | KYC 상태 변경 |
| **PATCH** | `/admin/users/:id/role` | 역할 변경 |
| **PATCH** | `/admin/users/:id/password` | 비밀번호 초기화 |

```json
// PATCH /admin/users/:id/kyc — Request
{ "status": "VERIFIED" }  // NONE | PENDING | VERIFIED

// PATCH /admin/users/:id/role — Request
{ "role": "PARTNER" }  // USER | PARTNER | ADMIN

// PATCH /admin/users/:id/password — Request
{ "password": "newpass123" }  // min 8자
```

### 14.3 세션/감사 관리

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/sessions` | 활성 세션 목록 |
| **DELETE** | `/admin/sessions/:id` | 세션 삭제 (자기 자신 불가) |
| **DELETE** | `/admin/sessions/user/:userId` | 특정 회원 전체 세션 삭제 |
| **GET** | `/admin/audit-logs` | 감사 로그 목록 |
| **GET** | `/admin/audit-logs/:id` | 감사 로그 상세 |

### 14.4 브랜드 관리

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/brands` | 목록 |
| **POST** | `/admin/brands` | 생성 |
| **PATCH** | `/admin/brands/:code` | 수정 |
| **DELETE** | `/admin/brands/:code` | 삭제 (상품 참조 시 불가) |

```json
// POST /admin/brands — Request
{
  "code": "SHINSEGAE",
  "name": "신세계",
  "color": "#FF5733",
  "order": 1,
  "description": "신세계 백화점 상품권",
  "isActive": true
}
```

### 14.5 상품 관리

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/products` | 목록 (Brand Preload) |
| **POST** | `/admin/products` | 생성 (BuyPrice 자동 계산) |
| **PATCH** | `/admin/products/:id` | 수정 (BuyPrice 재계산) |
| **DELETE** | `/admin/products/:id` | 삭제 |

```json
// POST /admin/products — Request
{
  "brandCode": "SHINSEGAE",
  "name": "5만원권",
  "price": 50000,
  "discountRate": 3.5,
  "tradeInRate": 5.0,
  "type": "PHYSICAL",
  "shippingMethod": "DELIVERY"
}
// buyPrice = 50000 × (100 - 3.5) / 100 = 48250 (자동 계산)
```

### 14.6 주문 관리

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/orders` | 목록 (status 필터) |
| **GET** | `/admin/orders/:id` | 상세 (OrderItems, User Preload) |
| **PATCH** | `/admin/orders/:id/status` | 상태 변경 (상태 머신 검증) |

```json
// PATCH /admin/orders/:id/status — Request
{ "status": "DELIVERED" }
```

### 14.7 매입 관리

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/trade-ins` | 목록 (status 필터) |
| **GET** | `/admin/trade-ins/:id` | 상세 (User, Product Preload) |
| **PATCH** | `/admin/trade-ins/:id/status` | 상태 변경 + 관리자 메모 |

```json
// PATCH /admin/trade-ins/:id/status — Request
{ "status": "VERIFIED", "adminNote": "PIN 확인 완료" }
```

### 14.8 바우처 관리

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/vouchers` | 목록 (status, productId 필터) |
| **GET** | `/admin/vouchers/:id` | 상세 |
| **PATCH** | `/admin/vouchers/:id` | 수정 (상태 머신 검증) |
| **DELETE** | `/admin/vouchers/:id` | 삭제 (AVAILABLE/EXPIRED만) |
| **GET** | `/admin/vouchers/stock/:productId` | 상품별 재고 수량 |
| **GET** | `/admin/vouchers/inventory` | 전체 재고 현황 |
| **POST** | `/admin/vouchers/bulk` | 일괄 업로드 (PIN 암호화) |

```json
// PATCH /admin/vouchers/:id — Request
{ "status": "AVAILABLE", "securityCode": "1234", "giftNumber": "9876" }

// POST /admin/vouchers/bulk — Request
[
  { "productId": 1, "pinCode": "1234-5678-9012" },
  { "productId": 1, "pinCode": "2345-6789-0123" }
]

// GET /admin/vouchers/stock/:productId — Response
{ "productId": 1, "available": 15, "total": 50 }
```

**바우처 상태 흐름**:
```
AVAILABLE → RESERVED → SOLD → USED
    ↓          ↓
 EXPIRED    AVAILABLE (주문 취소)
```

### 14.9 환불 관리

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/refunds` | 목록 (Order, User Preload) |
| **GET** | `/admin/refunds/:id` | 상세 |
| **POST** | `/admin/refunds/:id/approve` | 승인 (REQUESTED만) |
| **POST** | `/admin/refunds/:id/reject` | 거부 (REQUESTED만) |

### 14.10 선물 관리

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/gifts` | 목록 (Sender, Receiver, Order Preload) |
| **GET** | `/admin/gifts/:id` | 상세 |
| **GET** | `/admin/gifts/stats` | 통계 (total, sent, claimed, expired) |

### 14.11 콘텐츠 관리 (공지/FAQ/이벤트)

**공지사항**:

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/notices` | 목록 |
| **GET** | `/admin/notices/:id` | 상세 |
| **POST** | `/admin/notices` | 생성 |
| **PATCH** | `/admin/notices/:id` | 수정 |
| **DELETE** | `/admin/notices/:id` | 삭제 |

**FAQ**:

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/faqs` | 목록 |
| **GET** | `/admin/faqs/:id` | 상세 |
| **POST** | `/admin/faqs` | 생성 |
| **PATCH** | `/admin/faqs/:id` | 수정 |
| **DELETE** | `/admin/faqs/:id` | 삭제 |

**이벤트**:

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/events` | 목록 |
| **GET** | `/admin/events/:id` | 상세 |
| **POST** | `/admin/events` | 생성 |
| **PATCH** | `/admin/events/:id` | 수정 |
| **DELETE** | `/admin/events/:id` | 삭제 |

### 14.12 문의 관리

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/inquiries` | 목록 (User Preload) |
| **GET** | `/admin/inquiries/:id` | 상세 |
| **PATCH** | `/admin/inquiries/:id/answer` | 답변 등록 |
| **PATCH** | `/admin/inquiries/:id/close` | 종료 (ANSWERED만) |
| **DELETE** | `/admin/inquiries/:id` | 삭제 |

```json
// PATCH /admin/inquiries/:id/answer — Request
{ "answer": "안녕하세요, 문의 주셔서 감사합니다..." }
```

**문의 상태 흐름**:
```
PENDING → ANSWERED → CLOSED
```

### 14.13 리포트

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/reports/bank-transactions` | 결제 수단/상태별 통계 |
| **GET** | `/admin/reports/trade-in-payouts` | 매입 지급 현황 |
| **GET** | `/admin/reports/user-transactions/:userId` | 특정 회원 거래 내보내기 |

```json
// Query Parameters (공통)
?startDate=2026-01-01&endDate=2026-03-22
```

### 14.14 장바구니 관리

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/carts` | 전체 장바구니 목록 |
| **GET** | `/admin/carts/user/:userId` | 특정 회원 장바구니 |
| **DELETE** | `/admin/carts/:id` | 항목 삭제 |
| **DELETE** | `/admin/carts/user/:userId/all` | 특정 회원 장바구니 전체 비우기 |

### 14.15 사이트 설정

| Method | Path | 설명 |
|--------|------|------|
| **GET** | `/admin/site-configs` | 전체 설정 목록 |
| **GET** | `/admin/site-configs/:id` | 설정 상세 |
| **POST** | `/admin/site-configs` | 설정 생성 |
| **PATCH** | `/admin/site-configs/:key` | 설정 값 수정 |
| **DELETE** | `/admin/site-configs/:id` | 설정 삭제 |

```json
// POST /admin/site-configs — Request
{
  "key": "PURCHASE_LIMIT_DAILY",
  "value": "1000000",
  "type": "NUMBER",
  "description": "일일 최대 구매 한도 (원)"
}

// PATCH /admin/site-configs/:key — Request
{ "value": "2000000" }
```

---

## 부록: 미들웨어 체인

### 전역 미들웨어 (모든 요청)

| 순서 | 미들웨어 | 설명 |
|------|----------|------|
| 1 | RequestLogger | 요청/응답 로깅 |
| 2 | CustomRecovery | 패닉 복구 |
| 3 | BotBlocker | 봇 차단 |
| 4 | SecurityHeaders | 보안 헤더 (CSP, HSTS 등) |
| 5 | TraceID | X-Trace-Id 생성 |
| 6 | HPPGuard | HTTP 파라미터 오염 방지 |
| 7 | MaxBodySize | 요청 본문 크기 제한 (2MB) |
| 8 | Gzip | 응답 압축 |
| 9 | CORS | 교차 출처 허용 |
| 10 | IPBlacklist | IP 블랙리스트 |
| 11 | RateLimiter | 분당 100회 제한 |
| 12 | AuditMiddleware | 감사 로그 기록 |

### 경로별 미들웨어

| 경로 | 미들웨어 | 설명 |
|------|----------|------|
| `/auth/login,register,...` | LoginBruteForceGuard | 브루트포스 방어 |
| `/auth/me`, Protected 등 | JWTAuth | JWT 토큰 검증 |
| `/admin/*` | JWTAuth + AdminOnly | 관리자 권한 |
| `POST /orders` | TransactionThrottle | 거래 속도 제한 |
| `POST /trade-ins` | TransactionThrottle | 거래 속도 제한 |

---

## 부록: 엔드포인트 총 개수

| 영역 | 개수 |
|------|------|
| 시스템 (health, sitemap, docs) | 3 |
| 인증 (Auth + MFA + Sessions) | 17 |
| 브랜드/상품 (공개) | 7 |
| 콘텐츠 (공개) | 14 |
| 장바구니 | 7 |
| 결제 | 2 |
| 주문 | 7 |
| 선물 | 5 |
| 매입 | 3 |
| KYC | 8 |
| 회원 탈퇴 | 1 |
| 문의 (사용자) | 4 |
| **Admin** | **60** |
| **합계** | **138** |
