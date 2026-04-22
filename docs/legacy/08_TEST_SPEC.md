# 08. E2E 테스트 명세서

## 1. 개요

### 1.1 테스트 스택
| 항목 | 기술 |
|------|------|
| 테스트 프레임워크 | Jest |
| HTTP 클라이언트 | Supertest |
| 환경 | NestJS TestingModule |

### 1.2 테스트 실행 명령어

```bash
# 전체 E2E 테스트 실행
pnpm --filter server test:e2e

# 특정 파일 실행
pnpm --filter server test -- --testPathPattern=auth.e2e

# 시나리오 테스트만 실행
pnpm --filter server test -- --testPathPattern=scenarios

# 체크리스트 테스트만 실행
pnpm --filter server test -- --testPathPattern=checklist

# 커버리지 포함
pnpm --filter server test:cov
```

### 1.3 테스트 환경 설정

테스트는 실제 데이터베이스에 연결하여 실행됩니다. `server/.env` 파일의 `DATABASE_URL` 사용.

**ValidationPipe 설정:**
```typescript
app.useGlobalPipes(new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
}));
```

---

## 2. 테스트 구조

### 2.1 디렉토리 구조

```
server/test/
├── helpers/                      # 테스트 유틸리티
│   ├── test-setup.ts            # 앱 생성, HTTP 상태 코드
│   ├── test-users.ts            # 사용자 생성/로그인 헬퍼
│   └── test-data.ts             # 테스트 데이터 팩토리
├── scenarios/                    # 시나리오 기반 E2E (4개)
│   ├── complete-purchase-flow.e2e-spec.ts
│   ├── complete-tradein-flow.e2e-spec.ts
│   ├── admin-user-management.e2e-spec.ts
│   └── inventory-management.e2e-spec.ts
├── checklist/                    # QA 체크리스트 E2E (7개)
│   ├── auth.checklist.e2e-spec.ts
│   ├── products.checklist.e2e-spec.ts
│   ├── cart.checklist.e2e-spec.ts
│   ├── orders.checklist.e2e-spec.ts
│   ├── trade-in.checklist.e2e-spec.ts
│   ├── admin.checklist.e2e-spec.ts
│   └── vouchers.checklist.e2e-spec.ts
├── *.e2e-spec.ts                 # 모듈별 E2E (9개)
└── jest-e2e.json                 # Jest 설정
```

### 2.2 테스트 파일 목록 (21개)

| 카테고리 | 파일명 | 테스트 수 |
|---------|--------|----------|
| 시나리오 | complete-purchase-flow.e2e-spec.ts | 12 |
| 시나리오 | complete-tradein-flow.e2e-spec.ts | 10 |
| 시나리오 | admin-user-management.e2e-spec.ts | 8 |
| 시나리오 | inventory-management.e2e-spec.ts | 13 |
| 체크리스트 | auth.checklist.e2e-spec.ts | 11 |
| 체크리스트 | products.checklist.e2e-spec.ts | 8 |
| 체크리스트 | cart.checklist.e2e-spec.ts | 10 |
| 체크리스트 | orders.checklist.e2e-spec.ts | 10 |
| 체크리스트 | trade-in.checklist.e2e-spec.ts | 8 |
| 체크리스트 | admin.checklist.e2e-spec.ts | 15 |
| 체크리스트 | vouchers.checklist.e2e-spec.ts | 5 |
| 모듈 | auth.e2e-spec.ts | 15 |
| 모듈 | products.e2e-spec.ts | 10 |
| 모듈 | orders.e2e-spec.ts | 12 |
| 모듈 | trade-in.e2e-spec.ts | 10 |
| 모듈 | vouchers.e2e-spec.ts | 8 |
| 모듈 | site-config.e2e-spec.ts | 8 |
| 모듈 | admin.e2e-spec.ts | 12 |
| 모듈 | buying-flow.e2e-spec.ts | 3 |
| 기본 | app.e2e-spec.ts | 1 |
| 도구 | manual-login.e2e-spec.ts | - |

**총 테스트: 약 216개**

---

## 3. 시나리오 테스트 상세

### 3.1 Complete Purchase Flow (구매 플로우)

**파일:** `scenarios/complete-purchase-flow.e2e-spec.ts`

**시나리오:**
1. 신규 사용자 회원가입
2. 로그인하여 토큰 획득
3. 상품 목록 조회
4. 장바구니에 상품 추가
5. 장바구니 조회
6. 주문 생성
7. 주문 상세 조회 - PIN 코드 확인
8. 재고 차감 확인

**테스트 케이스:**
- ✅ 정상 회원가입
- ✅ JWT 토큰 발급
- ✅ 상품 목록 조회
- ✅ 상품 상세 조회 (가격 검증)
- ✅ 장바구니 추가
- ✅ 장바구니 조회 (상품 정보 포함)
- ✅ 주문 생성
- ✅ 주문 상세 조회 (PIN 포함)
- ✅ 내 주문 목록 조회
- ✅ 재고 차감 확인
- ✅ 비인증 주문 실패 (401)
- ✅ 타인 주문 접근 불가 (403/404)

### 3.2 Complete Trade-In Flow (매입 플로우)

**파일:** `scenarios/complete-tradein-flow.e2e-spec.ts`

**시나리오:**
1. 사용자 회원가입 + 로그인
2. KYC 인증 상태 확인
3. 매입 신청
4. 매입 내역 조회
5. [관리자] 매입 상태 변경
6. 사용자: 상태 변경 확인

**테스트 케이스:**
- ✅ KYC 인증 사용자 매입 신청
- ✅ 매입 내역 조회
- ✅ 매입 상세 조회
- ✅ 관리자 매입 상태 변경
- ✅ KYC 미인증 시 매입 실패 (403)
- ✅ 중복 PIN 매입 실패 (409)
- ✅ 필수 필드 누락 실패 (400)
- ✅ 타인 매입 조회 불가

### 3.3 Admin User Management (사용자 관리)

**파일:** `scenarios/admin-user-management.e2e-spec.ts`

**시나리오:**
1. 관리자 로그인
2. 사용자 목록 조회
3. KYC 대기 사용자 조회
4. KYC 승인
5. 역할 변경 (USER → PARTNER)
6. 변경 확인

**테스트 케이스:**
- ✅ 사용자 목록 조회
- ✅ KYC 대기 사용자 필터
- ✅ KYC 승인
- ✅ KYC 거절 (사유 포함)
- ✅ 역할 변경
- ✅ 일반 사용자 관리자 API 접근 불가 (403)

### 3.4 Inventory Management (재고 관리)

**파일:** `scenarios/inventory-management.e2e-spec.ts`

**시나리오:**
1. 관리자 로그인
2. PIN 코드 일괄 등록
3. 재고 확인
4. 사용자: 구매 진행
5. 재고 감소 확인
6. PIN 상태 변경 확인 (AVAILABLE → SOLD)

**테스트 케이스:**
- ✅ PIN 일괄 등록 (bulk)
- ✅ 빈 배열 등록 거부/허용
- ✅ 중복 PIN 등록 처리
- ✅ 상품별 재고 조회
- ✅ 바우처 목록 조회 (status 포함)
- ✅ 구매 후 재고 감소 확인
- ✅ PIN 상태 SOLD 변경 확인
- ✅ 재고 없는 상품 조회 (available: 0)
- ✅ 비관리자 일괄 등록 불가 (403)
- ✅ 존재하지 않는 상품 재고 조회
- ✅ 재고 부족 시 주문 실패

---

## 4. 체크리스트 테스트 상세

### 4.1 인증 체크리스트 (11개)

| ID | 테스트 | 예상 결과 |
|----|-------|----------|
| AUTH-001 | 정상 회원가입 | 201, 사용자 정보 |
| AUTH-002 | 중복 이메일 회원가입 | 409 Conflict |
| AUTH-003 | 약한 비밀번호 회원가입 | 400 Bad Request |
| AUTH-004 | 정상 로그인 | 200, access_token |
| AUTH-005 | 잘못된 비밀번호 로그인 | 401 Unauthorized |
| AUTH-006 | 존재하지 않는 이메일 | 401 Unauthorized |
| AUTH-007 | 토큰으로 내 정보 조회 | 200, 사용자 정보 |
| AUTH-008 | 만료된 토큰 요청 | 401 Unauthorized |
| AUTH-009 | 리프레시 토큰 갱신 | 200, 새 토큰 |
| AUTH-010 | 로그아웃 | 200 |
| AUTH-011 | Rate Limit 확인 | 429 Too Many Requests |

### 4.2 상품 체크리스트 (8개)

| ID | 테스트 | 예상 결과 |
|----|-------|----------|
| PROD-001 | 상품 목록 조회 | 200, 배열 |
| PROD-002 | 브랜드별 필터 | 200, 필터된 목록 |
| PROD-003 | 상품 상세 조회 | 200, 상품 정보 |
| PROD-004 | 비활성 상품 목록 제외 | 목록에 미포함 |
| PROD-005 | 없는 상품 조회 | 404 Not Found |
| PROD-006 | [Admin] 상품 생성 | 201 Created |
| PROD-007 | [Admin] 상품 수정 | 200 OK |
| PROD-008 | [Admin] 상품 비활성화 | 200 OK |

### 4.3 장바구니 체크리스트 (7개)

| ID | 테스트 | 예상 결과 |
|----|-------|----------|
| CART-001 | 장바구니 상품 추가 | 201 Created |
| CART-002 | 장바구니 조회 | 200, items 배열 |
| CART-003 | 수량 변경 | 200 OK |
| CART-004 | 상품 삭제 | 200/204 |
| CART-005 | 장바구니 비우기 | 200/204 |
| CART-006 | 비로그인 접근 불가 | 401 Unauthorized |
| CART-007 | 재고 초과 수량 추가 | 400 또는 201 |

### 4.4 주문 체크리스트 (10개)

| ID | 테스트 | 예상 결과 |
|----|-------|----------|
| ORD-001 | 정상 주문 생성 | 201, 주문 정보 |
| ORD-002 | 내 주문 목록 | 200, 배열 |
| ORD-003 | 주문 상세 (PIN 포함) | 200, items.vouchers |
| ORD-004 | 재고 부족 주문 | 400 Bad Request |
| ORD-005 | 일일 한도 초과 | 400/403 |
| ORD-006 | 월간 한도 초과 | 400/403 |
| ORD-007 | 건당 한도 초과 | 400/403 |
| ORD-008 | KYC 미인증 고액 주문 | 403 Forbidden |
| ORD-009 | 주문 시 재고 차감 | available 감소 |
| ORD-010 | 타인 주문 조회 불가 | 403/404 |

### 4.5 매입 체크리스트 (8개)

| ID | 테스트 | 예상 결과 |
|----|-------|----------|
| TRD-001 | 정상 매입 신청 | 201 Created |
| TRD-002 | 내 매입 목록 | 200, 배열 |
| TRD-003 | KYC 미인증 매입 | 403 Forbidden |
| TRD-004 | 중복 PIN 매입 | 409 Conflict |
| TRD-005 | 필수 필드 누락 | 400 Bad Request |
| TRD-006 | PIN 암호화 저장 | DB에 암호화됨 |
| TRD-007 | 계좌번호 마스킹 | ***-***-**1234 |
| TRD-008 | 타인 매입 조회 불가 | 403/404 |

### 4.6 관리자 체크리스트 (15개)

| ID | 테스트 | 예상 결과 |
|----|-------|----------|
| ADM-001 | 대시보드 통계 조회 | 200, stats |
| ADM-002 | 사용자 목록 조회 | 200, 배열 |
| ADM-003 | KYC 대기 사용자 조회 | 200, PENDING 필터 |
| ADM-004 | KYC 승인 | 200, VERIFIED |
| ADM-005 | KYC 거절 | 200, REJECTED |
| ADM-006 | 역할 변경 USER→PARTNER | 200, role 변경 |
| ADM-007 | 주문 목록 조회 (필터) | 200, items |
| ADM-008 | 주문 상태 변경 | 200 OK |
| ADM-009 | 매입 목록 조회 | 200, items |
| ADM-010 | 매입 승인 (PAID) | 200 OK |
| ADM-011 | 매입 거절 + 사유 | 200 OK |
| ADM-012 | PIN 일괄 등록 | 201, count |
| ADM-013 | 재고 현황 조회 | 200, available |
| ADM-014 | 일반 사용자 접근 불가 | 403 Forbidden |
| ADM-015 | 시스템 설정 변경 | 201/200 |

### 4.7 바우처 체크리스트 (5개)

| ID | 테스트 | 예상 결과 |
|----|-------|----------|
| VOU-001 | PIN 일괄 등록 | 201, count |
| VOU-002 | 상품별 재고 조회 | 200, available |
| VOU-003 | 중복 PIN 등록 실패 | 400/409/500 |
| VOU-004 | 구매 후 PIN SOLD | status 변경 |
| VOU-005 | PIN 복호화 확인 | 주문에 포함 |

---

## 5. 테스트 헬퍼 함수

### 5.1 test-setup.ts

```typescript
// 앱 생성
export async function createTestApp(): Promise<INestApplication>

// 앱 종료
export async function closeTestApp(app: INestApplication): Promise<void>

// 고유 접미사 생성
export function generateUniqueSuffix(): string

// HTTP 상태 코드 상수
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
}
```

### 5.2 test-users.ts

```typescript
// 사용자 인터페이스
interface AuthenticatedUser {
  user: { email: string; role: string; ... };
  token: string;
  cookies?: string[];
  userId?: number;
}

// 사용자 생성 및 로그인
export async function createAndLoginUser(
  app: INestApplication,
  prefix: string,
  role?: 'USER' | 'ADMIN' | 'PARTNER'
): Promise<AuthenticatedUser>

// 시드 사용자 로그인
export async function loginAsSeededUser(
  app: INestApplication,
  type: 'admin' | 'user' | 'partner'
): Promise<AuthenticatedUser>
```

### 5.3 test-data.ts

```typescript
// 테스트 상품 생성
export async function createTestProduct(
  app: INestApplication,
  token: string,
  data: Partial<CreateProductDto>
): Promise<Product>

// 테스트 바우처 생성
export async function createTestVouchers(
  app: INestApplication,
  token: string,
  productId: number,
  count: number
): Promise<{ count: number }>

// 재고 조회
export async function getVoucherStock(
  app: INestApplication,
  token: string,
  productId: number
): Promise<{ available: number; sold: number }>
```

---

## 6. 주의사항

### 6.1 CreateProductDto 필수 필드

상품 생성 시 다음 필드가 **필수**입니다:

```typescript
{
  brand: 'SHINSEGAE',    // 필수
  name: '상품명',         // 필수
  price: 50000,          // 필수
  discountRate: 3,       // 필수
  tradeInRate: 5,        // 필수
}
```

> ⚠️ `isActive`는 CreateProductDto에 없습니다. 생성 후 PATCH로 변경하세요.

### 6.2 응답 형식 차이

**장바구니 (Cart):**
```json
{
  "items": [...],
  "itemCount": 2,
  "totalAmount": 195000
}
```

**관리자 주문/매입 목록:**
```json
{
  "items": [...],
  "meta": { "total": 10, "page": 1 }
}
```

**일반 목록 (배열):**
```json
[{ ... }, { ... }]
```

### 6.3 Decimal 필드

Prisma MSSQL에서 Decimal 필드는 **문자열**로 반환됩니다:
```typescript
// 잘못된 비교
expect(res.body.price).toBe(50000);  // ❌ "50000" !== 50000

// 올바른 비교
expect(Number(res.body.price)).toBe(50000);  // ✅
```

### 6.4 보안 Guard 요구사항

| 모듈 | 필요한 인증 |
|------|------------|
| Products (CUD) | ADMIN 역할 JWT |
| Vouchers | ADMIN 역할 JWT |
| Site-Config (CUD) | ADMIN 역할 JWT |
| Users (CUD) | ADMIN 역할 JWT |
| Cart | JWT 인증 |
| Orders | JWT 인증 |
| Trade-In | JWT 인증 |

---

## 7. CI/CD 통합

### 7.1 GitHub Actions 예시

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest

    services:
      mssql:
        image: mcr.microsoft.com/mssql/server:2019-latest
        env:
          ACCEPT_EULA: Y
          SA_PASSWORD: TestPassword123!
        ports:
          - 1433:1433

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Generate Prisma Client
        run: pnpm --filter server prisma generate

      - name: Push DB schema
        run: pnpm --filter server prisma db push
        env:
          DATABASE_URL: sqlserver://localhost:1433;...

      - name: Run E2E tests
        run: pnpm --filter server test:e2e
        env:
          DATABASE_URL: sqlserver://localhost:1433;...
          JWT_SECRET: test-secret
          ENCRYPTION_KEY: test-encryption-key-32bytes
```

---

## 8. 참조 문서

- [01_PRD.md](./01_PRD.md) - 요구사항 정의서
- [02_ARCHITECTURE.md](./02_ARCHITECTURE.md) - 시스템 아키텍처
- [05_API_SPEC.md](./05_API_SPEC.md) - API 명세서
- [09_USE_CASES.md](./09_USE_CASES.md) - 유즈케이스 정의
