> **[Legacy] 레거시 참조용** — 이 문서는 구 W Gift(wowgift.co.kr) 시절 작성되었으며 역사 보존 목적으로만 유지됩니다. 현재 시스템은 Seedream Gift(seedreamgift.com)입니다.

# 05. API Specification

## 1. 개요

### 1.1 기본 정보
| 항목 | 값 |
|------|-----|
| Base URL | `https://api.wowgift.kr/api` |
| 인증 방식 | Bearer Token (JWT) |
| Content-Type | `application/json` |
| API 문서 | `/api/docs` (Swagger UI) |

### 1.2 응답 형식

**성공 응답:**
```json
{
  "data": { ... },
  "message": "Success"
}
```

**에러 응답:**
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

### 1.3 인증 및 권한

#### 인증 헤더
```
Authorization: Bearer <access_token>
```

#### 인증/권한 범례
| 표기 | 설명 |
|------|------|
| 🔓 PUBLIC | 인증 없이 접근 가능 |
| 🔐 AUTH | JWT 인증 필요 |
| 👑 ADMIN | ADMIN 역할 필요 |
| 🚦 THROTTLE | Rate Limit 적용 |

### 1.4 Security Guards 적용 현황

| 모듈 | 인증 | 역할 | 비고 |
|------|------|------|------|
| Auth | 일부 | - | 로그인/회원가입에 Rate Limit |
| Products | GET 공개, CUD 보호 | ADMIN | 목록/상세 조회는 공개 |
| Cart | 전체 | - | 모든 엔드포인트 인증 필요 |
| Orders | 전체 | - | 모든 엔드포인트 인증 필요 |
| Trade-In | 일부 | - | 신청/조회 인증 필요 |
| Vouchers | 전체 | ADMIN | 목록/등록/재고 확인 모두 관리자 |
| Site-Config | GET 공개, CUD 보호 | ADMIN | 목록 조회는 공개 |
| Users | 일부 | ADMIN | 목록/수정/삭제는 관리자 |
| Admin | 전체 | ADMIN | 클래스 레벨 ADMIN 제한 |
| Notice | GET 공개, CUD 보호 | ADMIN | 공지사항 관리 |
| KYC | request/confirm 공개 | - | Rate Limit 5/분, bank-account는 인증 필요 |
| Payment | 일부 | - | 결제 관련 인증 필요 |

---

## 2. 인증 API (`/auth`)

### 2.1 회원가입 🔓 🚦
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "홍길동",
  "phone": "010-1234-5678"
}
```

**Response (201):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "홍길동",
  "role": "USER",
  "kycStatus": "NONE",
  "createdAt": "2025-01-29T00:00:00.000Z"
}
```

### 2.2 로그인 🔓 🚦
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "홍길동",
    "role": "USER",
    "kycStatus": "VERIFIED"
  }
}
```

### 2.3 토큰 갱신 🔓
```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 2.4 내 정보 조회 🔐
```http
GET /auth/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "홍길동",
  "phone": "010-1234-5678",
  "role": "USER",
  "kycStatus": "VERIFIED",
  "customLimitPerTx": null,
  "customLimitPerDay": null,
  "createdAt": "2025-01-29T00:00:00.000Z"
}
```

### 2.5 KYC 서류 제출 🔐
```http
POST /auth/kyc
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
```
idImage: [File] 신분증 이미지
realName: "홍길동"
```

**Response (200):**
```json
{
  "message": "KYC 서류가 제출되었습니다.",
  "kycStatus": "PENDING"
}
```

---

## 3. KYC API (`/kyc`)

> **1원 인증을 통한 은행 계좌 소유 확인 (Coocon API 연동)**

### 3.1 1원 인증 발송 요청 🔓 🚦
```http
POST /kyc/bank-verify/request
```

**Rate Limit:** 5회/분

**Request Body:**
```json
{
  "bankCode": "004",
  "bankName": "국민은행",
  "accountNumber": "1234567890123",
  "accountHolder": "홍길동"
}
```

**Response (201):**
```json
{
  "verifyTrDt": "20250129",
  "verifyTrNo": "123456789"
}
```

### 3.2 1원 인증 확인 🔓 🚦
```http
POST /kyc/bank-verify/confirm
```

**Rate Limit:** 5회/분

**Request Body:**
```json
{
  "verifyTrDt": "20250129",
  "verifyTrNo": "123456789",
  "verifyVal": "123",
  "bankCode": "004",
  "bankName": "국민은행",
  "accountNumber": "1234567890123",
  "accountHolder": "홍길동"
}
```

**Response (200):**
```json
{
  "success": true
}
```

### 3.3 내 계좌 정보 조회 🔐
```http
GET /kyc/bank-account
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "bankName": "국민은행",
  "bankCode": "004",
  "accountNumber": "123***890",
  "accountHolder": "홍길동",
  "bankVerifiedAt": "2025-01-29T00:00:00.000Z"
}
```

### 3.4 계좌 변경 (1원 인증 필수) 🔐
```http
POST /kyc/bank-account
Authorization: Bearer <token>
```

**Request Body:** (3.2와 동일)

**Response (200):**
```json
{
  "success": true
}
```

---

## 4. 상품 API (`/products`)

### 4.1 상품 목록 조회 🔓
```http
GET /products
GET /products?brand=SHINSEGAE&isActive=true&page=1&limit=20
```

**Query Parameters:**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `brand` | string | 브랜드 필터 |
| `isActive` | boolean | 활성화 상품만 |
| `page` | number | 페이지 번호 (기본: 1) |
| `limit` | number | 페이지 크기 (기본: 20) |

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "brand": "SHINSEGAE",
      "name": "신세계 상품권 10만원권",
      "description": "전국 신세계백화점 및 이마트에서 사용 가능",
      "price": 100000,
      "discountRate": 2.5,
      "buyPrice": 97500,
      "tradeInRate": 5.0,
      "allowTradeIn": true,
      "imageUrl": "/images/shinsegae-100k.jpg",
      "isActive": true
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### 4.2 상품 상세 조회 🔓
```http
GET /products/:id
```

**Response (200):**
```json
{
  "id": 1,
  "brand": "SHINSEGAE",
  "name": "신세계 상품권 10만원권",
  "description": "전국 신세계백화점 및 이마트에서 사용 가능",
  "price": 100000,
  "discountRate": 2.5,
  "buyPrice": 97500,
  "tradeInRate": 5.0,
  "allowTradeIn": true,
  "imageUrl": "/images/shinsegae-100k.jpg",
  "isActive": true,
  "stockCount": 50,
  "createdAt": "2025-01-29T00:00:00.000Z"
}
```

### 4.3 브랜드별 상품 조회 🔓
```http
GET /products/brand/:brand
GET /products/brand/SHINSEGAE
```

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "brand": "SHINSEGAE",
      "name": "신세계 상품권 5만원권",
      "price": 50000,
      "buyPrice": 48750
    },
    {
      "id": 2,
      "brand": "SHINSEGAE",
      "name": "신세계 상품권 10만원권",
      "price": 100000,
      "buyPrice": 97500
    }
  ]
}
```

### 4.4 상품 생성 👑
```http
POST /products
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "brand": "SHINSEGAE",
  "name": "신세계 상품권 30만원권",
  "price": 300000,
  "discountRate": 3.0,
  "tradeInRate": 5.5
}
```

**필수 필드:** `brand`, `name`, `price`, `discountRate`, `tradeInRate`

**Response (201):**
```json
{
  "id": 5,
  "brand": "SHINSEGAE",
  "name": "신세계 상품권 30만원권",
  "price": 300000,
  "discountRate": 3.0,
  "buyPrice": 291000,
  "tradeInRate": 5.5,
  "isActive": true,
  "createdAt": "2025-01-29T00:00:00.000Z"
}
```

### 4.5 상품 수정 👑
```http
PATCH /products/:id
Authorization: Bearer <token>
```

**Request Body (모든 필드 선택적):**
```json
{
  "price": 350000,
  "discountRate": 2.5,
  "isActive": false
}
```

### 4.6 상품 삭제 👑
```http
DELETE /products/:id
Authorization: Bearer <token>
```

---

## 5. 장바구니 API (`/cart`) 🔐

> **모든 장바구니 API는 JWT 인증이 필요합니다**

### 5.1 장바구니 조회
```http
GET /cart
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "items": [
    {
      "id": 1,
      "productId": 1,
      "product": {
        "id": 1,
        "name": "신세계 상품권 10만원권",
        "brand": "SHINSEGAE",
        "buyPrice": 97500,
        "imageUrl": "/images/shinsegae-100k.jpg"
      },
      "quantity": 2,
      "subtotal": 195000
    }
  ],
  "total": 195000,
  "itemCount": 2
}
```

### 5.2 상품 추가
```http
POST /cart
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "productId": 1,
  "quantity": 2
}
```

**Response (201):**
```json
{
  "id": 1,
  "productId": 1,
  "quantity": 2,
  "message": "장바구니에 추가되었습니다."
}
```

### 5.3 수량 변경
```http
PATCH /cart/:id
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "quantity": 3
}
```

**Response (200):**
```json
{
  "id": 1,
  "quantity": 3,
  "message": "수량이 변경되었습니다."
}
```

### 5.4 상품 삭제
```http
DELETE /cart/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "장바구니에서 삭제되었습니다."
}
```

### 5.5 구매 한도 확인
```http
GET /cart/check-limit
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "currentCartTotal": 195000,
  "limits": {
    "perOrder": {
      "max": 500000,
      "remaining": 305000
    },
    "daily": {
      "max": 1000000,
      "used": 195000,
      "remaining": 805000
    },
    "monthly": {
      "max": 5000000,
      "used": 500000,
      "remaining": 4500000
    }
  },
  "canProceed": true
}
```

---

## 6. 주문 API (`/orders`) 🔐

> **모든 주문 API는 JWT 인증이 필요합니다**

### 6.1 주문 생성
```http
POST /orders
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 2, "quantity": 1 }
  ],
  "paymentKey": "pg_payment_key_12345"
}
```

**Response (201):**
```json
{
  "id": 1,
  "userId": 1,
  "totalAmount": 292500,
  "status": "PAID",
  "items": [
    {
      "productId": 1,
      "productName": "신세계 상품권 10만원권",
      "quantity": 2,
      "price": 97500
    },
    {
      "productId": 2,
      "productName": "신세계 상품권 5만원권",
      "quantity": 1,
      "price": 48750
    }
  ],
  "createdAt": "2025-01-29T00:00:00.000Z"
}
```

### 6.2 내 주문 목록
```http
GET /orders
GET /orders?status=PAID&page=1&limit=10
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "totalAmount": 292500,
      "status": "DELIVERED",
      "itemCount": 3,
      "createdAt": "2025-01-29T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 10
  }
}
```

### 6.3 주문 상세 (PIN 포함)
```http
GET /orders/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": 1,
  "userId": 1,
  "totalAmount": 292500,
  "status": "DELIVERED",
  "paymentMethod": "CARD",
  "items": [
    {
      "productId": 1,
      "productName": "신세계 상품권 10만원권",
      "quantity": 2,
      "price": 97500,
      "vouchers": [
        { "pinCode": "1234-5678-9012-3456" },
        { "pinCode": "9876-5432-1098-7654" }
      ]
    }
  ],
  "createdAt": "2025-01-29T00:00:00.000Z"
}
```

---

## 7. 결제 API (`/payments`)

### 7.1 결제 시작 🔐
```http
POST /payments/initiate
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "orderId": 1,
  "amount": 292500,
  "method": "CARD"
}
```

**Response (200):**
```json
{
  "paymentKey": "pg_temp_key_12345",
  "orderId": 1,
  "amount": 292500,
  "redirectUrl": "https://pg.example.com/pay?key=..."
}
```

### 7.2 결제 검증 🔐
```http
GET /payments/verify?paymentKey=pg_payment_key_12345&orderId=1
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "verified": true,
  "orderId": 1,
  "amount": 292500,
  "method": "CARD",
  "approvedAt": "2025-01-29T00:00:00.000Z"
}
```

### 7.3 PG 웹훅 🔓
```http
POST /payments/webhook
```

**Request Body (PG사별 상이):**
```json
{
  "paymentKey": "pg_payment_key_12345",
  "orderId": 1,
  "status": "DONE",
  "amount": 292500
}
```

**Response (200):**
```json
{
  "received": true
}
```

---

## 8. 매입 API (`/trade-in`)

### 8.1 매입 신청 🔐
```http
POST /trade-in
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "productId": 1,
  "pinCode": "1234-5678-9012-3456",
  "bankName": "국민은행",
  "accountNum": "123-456-789012",
  "accountHolder": "홍길동"
}
```

**Response (201):**
```json
{
  "id": 1,
  "productId": 1,
  "productName": "신세계 상품권 10만원권",
  "payoutAmount": 95000,
  "status": "REQUESTED",
  "message": "매입 신청이 접수되었습니다. 검증 후 입금됩니다.",
  "createdAt": "2025-01-29T00:00:00.000Z"
}
```

### 8.2 내 매입 목록 🔐
```http
GET /trade-in/my
GET /trade-in/my?status=PAID&page=1&limit=10
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "productName": "신세계 상품권 10만원권",
      "payoutAmount": 95000,
      "status": "PAID",
      "createdAt": "2025-01-29T00:00:00.000Z",
      "paidAt": "2025-01-29T12:00:00.000Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 10
  }
}
```

### 8.3 매입 상세 🔐
```http
GET /trade-in/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": 1,
  "productId": 1,
  "productName": "신세계 상품권 10만원권",
  "payoutAmount": 95000,
  "status": "PAID",
  "bankName": "국민은행",
  "accountNum": "***-***-**9012",
  "accountHolder": "홍길동",
  "adminNote": null,
  "createdAt": "2025-01-29T00:00:00.000Z",
  "updatedAt": "2025-01-29T12:00:00.000Z"
}
```

---

## 9. 관리자 API (`/admin`) 👑

> **모든 관리자 API는 ADMIN 역할 JWT 인증이 필요합니다**

### 9.1 대시보드 통계
```http
GET /admin/stats
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "today": {
    "sales": 1500000,
    "orders": 15,
    "tradeIns": 3,
    "newUsers": 5
  },
  "month": {
    "sales": 45000000,
    "orders": 450,
    "tradeIns": 50,
    "newUsers": 120
  },
  "pendingKyc": 10,
  "pendingTradeIns": 5,
  "lowStockProducts": 3
}
```

### 9.2 회원 목록
```http
GET /admin/users
GET /admin/users?role=USER&kycStatus=PENDING&page=1&limit=20
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "name": "홍길동",
      "role": "USER",
      "kycStatus": "PENDING",
      "orderCount": 5,
      "totalSpent": 500000,
      "createdAt": "2025-01-29T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

### 9.3 KYC 승인/거절
```http
PATCH /admin/users/:id/kyc
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "status": "VERIFIED",
  "note": "신분증 확인 완료"
}
```

**Response (200):**
```json
{
  "id": 1,
  "kycStatus": "VERIFIED",
  "message": "KYC 상태가 변경되었습니다."
}
```

### 9.4 역할 변경
```http
PATCH /admin/users/:id/role
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "role": "PARTNER"
}
```

**Response (200):**
```json
{
  "id": 1,
  "role": "PARTNER",
  "message": "역할이 변경되었습니다."
}
```

### 9.5 전체 주문 조회
```http
GET /admin/orders
GET /admin/orders?status=PAID&from=2025-01-01&to=2025-01-31
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "user": {
        "id": 1,
        "email": "user@example.com",
        "name": "홍길동"
      },
      "totalAmount": 292500,
      "status": "DELIVERED",
      "itemCount": 3,
      "createdAt": "2025-01-29T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 450,
    "page": 1,
    "limit": 20
  }
}
```

### 9.6 매입 요청 목록
```http
GET /admin/trade-ins
GET /admin/trade-ins?status=REQUESTED
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "user": {
        "id": 1,
        "email": "user@example.com",
        "name": "홍길동"
      },
      "productName": "신세계 상품권 10만원권",
      "payoutAmount": 95000,
      "status": "REQUESTED",
      "createdAt": "2025-01-29T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1
  }
}
```

### 9.7 매입 상태 변경
```http
PATCH /admin/trade-ins/:id
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "status": "VERIFIED",
  "adminNote": "PIN 확인 완료, 지급 예정"
}
```

**Response (200):**
```json
{
  "id": 1,
  "status": "VERIFIED",
  "message": "매입 상태가 변경되었습니다."
}
```

### 9.8 상품 관리 (CRUD)

**생성:**
```http
POST /admin/products
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "brand": "SHINSEGAE",
  "name": "신세계 상품권 30만원권",
  "description": "전국 신세계백화점 이용 가능",
  "price": 300000,
  "discountRate": 3.0,
  "tradeInRate": 5.5,
  "allowTradeIn": true,
  "imageUrl": "/images/shinsegae-300k.jpg"
}
```

**수정:**
```http
PATCH /admin/products/:id
Authorization: Bearer <token>
```

**삭제:**
```http
DELETE /admin/products/:id
Authorization: Bearer <token>
```

### 9.9 재고 관리 (PIN 등록)

**대량 등록:**
```http
POST /admin/vouchers/bulk
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
```
productId: 1
file: [CSV File]
```

**CSV 형식:**
```csv
pinCode
1234-5678-9012-3456
9876-5432-1098-7654
```

**Response (201):**
```json
{
  "registered": 50,
  "duplicates": 2,
  "errors": 0,
  "message": "50개의 PIN이 등록되었습니다."
}
```

### 9.10 구매 한도 설정

**조회:**
```http
GET /admin/limits
Authorization: Bearer <token>
```

**생성/수정:**
```http
POST /admin/limits
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "role": "ALL",
  "limitType": "PER_ORDER",
  "maxAmount": 500000,
  "isActive": true
}
```

### 9.11 사이트 설정

**조회:**
```http
GET /admin/configs
Authorization: Bearer <token>
```

**수정:**
```http
PATCH /admin/configs/:key
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "value": "신규 이벤트 진행 중!",
  "type": "STRING"
}
```

---

## 10. 재고/바우처 API (`/vouchers`) 👑

> **모든 바우처 API는 ADMIN 역할 JWT 인증이 필요합니다**

### 10.1 바우처 목록 조회
```http
GET /vouchers
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "id": 1,
    "productId": 1,
    "pin": "****-****-****-3456",
    "status": "AVAILABLE",
    "createdAt": "2025-01-29T00:00:00.000Z"
  }
]
```

### 10.2 PIN 코드 일괄 등록
```http
POST /vouchers/bulk
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "productId": 1,
  "pinCodes": [
    "1234-5678-9012-3456",
    "9876-5432-1098-7654"
  ]
}
```

**Response (201):**
```json
{
  "count": 2,
  "message": "2개의 PIN이 등록되었습니다."
}
```

### 10.3 상품별 재고 조회
```http
GET /vouchers/stock/:productId
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "productId": 1,
  "available": 50,
  "sold": 120,
  "total": 170
}
```

---

## 11. 사이트 설정 API (`/site-configs`)

### 11.1 설정 목록 조회 🔓
```http
GET /site-configs
```

**Response (200):**
```json
[
  {
    "id": 1,
    "key": "DAILY_LIMIT",
    "value": "5000000",
    "type": "NUMBER",
    "description": "일일 구매 한도"
  }
]
```

### 11.2 설정 생성 👑
```http
POST /site-configs
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "key": "DAILY_LIMIT",
  "value": "5000000",
  "type": "NUMBER",
  "description": "일일 구매 한도"
}
```

### 11.3 설정 수정 👑
```http
PATCH /site-configs/:id
Authorization: Bearer <token>
```

### 11.4 설정 삭제 👑
```http
DELETE /site-configs/:id
Authorization: Bearer <token>
```

---

## 12. 공지사항 API (`/notices`)

### 12.1 공지사항 목록 조회 🔓
```http
GET /notices
GET /notices?type=NOTICE&page=1&limit=10
```

**Response (200):**
```json
[
  {
    "id": 1,
    "type": "NOTICE",
    "title": "서비스 점검 안내",
    "content": "2025년 2월 1일 서비스 점검이 예정되어 있습니다.",
    "isPinned": true,
    "createdAt": "2025-01-29T00:00:00.000Z"
  }
]
```

### 12.2 공지사항 상세 조회 🔓
```http
GET /notices/:id
```

### 12.3 공지사항 생성 👑
```http
POST /notices
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "type": "NOTICE",
  "title": "서비스 점검 안내",
  "content": "점검 내용...",
  "isPinned": false
}
```

### 12.4 공지사항 수정 👑
```http
PATCH /notices/:id
Authorization: Bearer <token>
```

### 12.5 공지사항 삭제 👑
```http
DELETE /notices/:id
Authorization: Bearer <token>
```

---

## 13. 에러 코드

| 코드 | 설명 |
|------|------|
| 400 | Bad Request - 잘못된 요청 |
| 401 | Unauthorized - 인증 필요 |
| 403 | Forbidden - 권한 없음 |
| 404 | Not Found - 리소스 없음 |
| 409 | Conflict - 중복/충돌 |
| 422 | Unprocessable Entity - 검증 실패 |
| 429 | Too Many Requests - 요청 제한 |
| 500 | Internal Server Error - 서버 오류 |

**에러 응답 예시:**
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password is too short"],
  "error": "Bad Request"
}
```

---

## 14. 참조 문서

- [01_PRD.md](./01_PRD.md) - 요구사항 정의서
- [02_ARCHITECTURE.md](./02_ARCHITECTURE.md) - 시스템 아키텍처
- [03_ERD.md](./03_ERD.md) - 데이터베이스 스키마
- [06_PAGE_SPEC.md](./06_PAGE_SPEC.md) - 페이지 명세서
- [08_TEST_SPEC.md](./08_TEST_SPEC.md) - E2E 테스트 명세서
