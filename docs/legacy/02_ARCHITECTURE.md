> **[Legacy] 레거시 참조용** — 이 문서는 구 W Gift(wowgift.co.kr) 시절 작성되었으며 역사 보존 목적으로만 유지됩니다. 현재 시스템은 Seedream Gift(seedreamgift.com)입니다.

# 02. System Architecture

## 1. 아키텍처 패턴: Modular Monolith

시스템은 **계층형 모듈 구조**를 따르며, 핵심 서비스를 재사용 가능한 "Asset"으로 추출할 수 있도록 설계됩니다.

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                   React 19 (Vite) - SPA                     │
├─────────────────────────────────────────────────────────────┤
│                        Backend                               │
│                    NestJS - API Server                      │
├──────────────┬──────────────┬──────────────┬───────────────┤
│   Modules    │    Shared    │     Base     │    Prisma     │
│  (Business)  │ (Infra)      │  (Generic)   │   (Data)      │
└──────────────┴──────────────┴──────────────┴───────────────┘
                              ↓
                    MSSQL Database
```

---

## 2. 기술 스택

| Layer | Technology | Role |
|-------|------------|------|
| **Framework** | NestJS | 비즈니스 로직, 보안, 정적 파일 서빙 |
| **Frontend** | React 19 (Vite) | 모던 UI, 재사용 컴포넌트 |
| **Database** | MSSQL + Prisma | 안정적 데이터, Zero-SQL 개발 |
| **API Doc** | Swagger | 자동 문서화 & 클라이언트 생성 |
| **Process** | PM2 | Windows 고가용성 |
| **Auth** | JWT | Access/Refresh Token 인증 |

---

## 3. 디렉토리 구조

```text
/wow-gift
├── client/                          # Frontend (React)
│   ├── src/
│   │   ├── api/generated/           # [Auto] Swagger 기반 API 클라이언트
│   │   ├── components/              # [Asset] 재사용 UI 컴포넌트
│   │   ├── hooks/                   # [Asset] useAuth, useCart 훅
│   │   ├── pages/                   # 페이지 컴포넌트
│   │   └── store/                   # Zustand 상태 관리
│   └── dist/                        # 빌드 출력
│
├── server/                          # Backend (NestJS)
│   ├── src/
│   │   ├── base/                    # [Core] BaseCrudService, BaseEntity
│   │   ├── shared/                  # [Shared] Auth, Prisma, Crypto, Payment
│   │   └── modules/                 # [Business] Users, Product, Order, etc.
│   ├── public/                      # [Deploy] Client 빌드 결과물
│   └── prisma/                      # [DB] Schema
│
├── docs/                            # 프로젝트 문서
├── scripts/                         # [Ops] PowerShell 스크립트
└── ecosystem.config.js              # [Config] PM2 설정
```

---

## 4. 백엔드 모듈 구조

### 4.1 Core Module (`/base`)

**BaseCrudService<T>** - 모든 비즈니스 모듈의 부모 클래스

```typescript
// 제공 메서드
- findAll(options?)    // 목록 조회 (페이징, 필터)
- findOne(id)          // 단일 조회
- create(dto)          // 생성
- update(id, dto)      // 수정
- remove(id)           // 삭제
```

**장점:** 보일러플레이트 90% 감소, API 동작 표준화

### 4.2 Shared Modules (`/shared`)

| Module | 역할 | 주요 파일 |
|--------|------|----------|
| **AuthModule** | JWT 인증, RBAC Guard | `jwt.strategy.ts`, `roles.guard.ts` |
| **PrismaModule** | DB 연결, 트랜잭션 | `prisma.service.ts` |
| **CryptoModule** | PIN 암호화/복호화 | `crypto.service.ts` |
| **PaymentModule** | PG 결제 연동 | `payment.service.ts` (계획) |

### 4.3 Business Modules (`/modules`)

| Module | 역할 | 엔드포인트 |
|--------|------|-----------|
| **UsersModule** | 회원 관리, KYC | `/users`, `/users/kyc` |
| **ProductModule** | 상품권 관리 | `/products` |
| **VoucherModule** | PIN 재고 관리 | `/vouchers` |
| **OrdersModule** | 구매 주문 | `/orders` |
| **CartModule** | 장바구니 | `/cart` |
| **TradeInModule** | 매입 처리 | `/trade-in` (계획) |
| **KycModule** | 1원 인증 (Coocon API) | `/kyc` |
| **AdminModule** | 관리자 기능 | `/admin/*` |

---

## 5. API 엔드포인트 요약

### 5.1 인증 (`/auth`)
```
POST /auth/register     - 회원가입
POST /auth/login        - 로그인 (JWT 발급)
POST /auth/refresh      - 토큰 갱신
GET  /auth/me           - 내 정보 조회
POST /auth/kyc          - KYC 서류 제출
```

### 5.2 KYC (`/kyc`)
```
POST /kyc/bank-verify/request   - 1원 인증 발송 요청 (Rate Limit 5/분)
POST /kyc/bank-verify/confirm   - 인증번호 확인 (Rate Limit 5/분)
GET  /kyc/bank-account          - 내 계좌 조회 (JWT)
POST /kyc/bank-account          - 계좌 변경 (JWT, 1원 인증 필수)
```

### 5.3 상품 (`/products`)
```
GET  /products          - 상품 목록 (필터, 페이징)
GET  /products/:id      - 상품 상세
GET  /products/brand/:brand - 브랜드별 조회
```

### 5.3 장바구니 (`/cart`)
```
GET  /cart              - 장바구니 조회
POST /cart              - 상품 추가
PATCH /cart/:id         - 수량 변경
DELETE /cart/:id        - 상품 삭제
GET  /cart/check-limit  - 한도 확인
```

### 5.4 주문 (`/orders`)
```
POST /orders            - 주문 생성 (결제 후)
GET  /orders            - 내 주문 목록
GET  /orders/:id        - 주문 상세 (PIN 포함)
```

### 5.5 결제 (`/payments`)
```
POST /payments/initiate - 결제 시작 (PG 연동)
GET  /payments/verify   - 결제 검증
POST /payments/webhook  - PG 콜백 처리
```

### 5.6 매입 (`/trade-in`)
```
POST /trade-in          - 매입 신청
GET  /trade-in          - 내 매입 목록
GET  /trade-in/:id      - 매입 상세
```

### 5.7 관리자 (`/admin`)
```
# 대시보드
GET  /admin/stats       - 통계 (매출, 주문, 매입)

# 회원 관리
GET  /admin/users       - 회원 목록
PATCH /admin/users/:id/kyc  - KYC 승인/거절
PATCH /admin/users/:id/role - 역할 변경

# 주문/매입 관리
GET  /admin/orders      - 전체 주문 목록
GET  /admin/trade-ins   - 매입 요청 목록
PATCH /admin/trade-ins/:id - 매입 상태 변경

# 상품/재고 관리
CRUD /admin/products    - 상품 관리
CRUD /admin/vouchers    - PIN 재고 관리

# 설정
CRUD /admin/limits      - 구매 한도 설정
CRUD /admin/configs     - 사이트 설정
```

---

## 6. 프론트엔드 아키텍처

### 6.1 상태 관리 (Zustand)

```typescript
// Auth Store
useAuthStore {
  user: User | null
  token: string | null
  login(credentials)
  logout()
  refreshToken()
}

// Cart Store
useCartStore {
  items: CartItem[]
  addItem(product, quantity)
  removeItem(id)
  updateQuantity(id, quantity)
  clearCart()
  syncWithServer()
}
```

### 6.2 API 클라이언트

- Swagger → OpenAPI Generator → TypeScript 클라이언트 자동 생성
- **규칙:** 수동 axios/fetch 호출 금지
- **위치:** `client/src/api/generated/`

### 6.3 라우팅 구조

```
/ (index)           - 메인 (상품 목록)
├── /login          - 로그인
├── /register       - 회원가입
├── /products       - 상품 목록
│   └── /:id        - 상품 상세
├── /trade-in       - 매입 안내
├── /cart           - 장바구니 (인증)
├── /checkout       - 결제 (인증)
├── /account        - 마이페이지 (인증)
│   ├── /orders     - 주문 내역
│   ├── /trade-ins  - 매입 내역
│   └── /settings   - 정보 수정
├── /admin          - 관리자 (ADMIN)
│   ├── /products   - 상품 관리
│   ├── /vouchers   - 재고 관리
│   ├── /orders     - 주문 관리
│   ├── /trade-ins  - 매입 관리
│   ├── /users      - 회원 관리
│   └── /settings   - 사이트 설정
└── /pages          - 정적 페이지
    ├── /about      - 회사 소개
    ├── /notice     - 공지사항
    ├── /support    - 고객센터
    ├── /tos        - 이용약관
    └── /privacy    - 개인정보처리방침
```

---

## 7. 보안 아키텍처

### 7.1 인증 흐름

```
[Login Request]
    ↓
[Validate Credentials]
    ↓
[Generate JWT Tokens]
    ├── Access Token (1일)
    └── Refresh Token (7일, HttpOnly Cookie)
    ↓
[Return to Client]
    ↓
[Store in Memory/Cookie]
```

### 7.2 Security Guards

#### JwtAuthGuard
JWT 토큰 검증을 담당하는 인증 가드:
```typescript
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@Request() req) {
  return req.user;  // { userId, email, role }
}
```

#### RolesGuard
역할 기반 접근 제어(RBAC):
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  // ADMIN 역할만 접근 가능
}
```

#### ThrottlerGuard
Rate Limiting (DoS 방지):
```typescript
@UseGuards(ThrottlerGuard)
@Post('login')
login(@Body() dto: LoginDto) {
  // 분당 10회 제한
}
```

### 7.3 모듈별 보안 적용 현황

| 모듈 | JwtAuthGuard | RolesGuard | 설명 |
|------|-------------|------------|------|
| **Auth** | 일부 | - | /me만 인증, 로그인/가입에 Rate Limit |
| **Products** | CUD만 | ADMIN | GET은 공개, POST/PATCH/DELETE는 관리자 |
| **Cart** | ✅ 전체 | - | 모든 엔드포인트 인증 필요 |
| **Orders** | ✅ 전체 | - | 모든 엔드포인트 인증 필요 |
| **Trade-In** | 일부 | - | 신청/조회 인증 필요 |
| **Vouchers** | ✅ 전체 | ADMIN | 모든 엔드포인트 관리자 |
| **Site-Config** | CUD만 | ADMIN | GET은 공개, CUD는 관리자 |
| **Users** | 일부 | ADMIN | 목록/수정/삭제는 관리자 |
| **Admin** | ✅ 전체 | ADMIN | 클래스 레벨 ADMIN 제한 |
| **Notice** | CUD만 | ADMIN | GET은 공개, CUD는 관리자 |
| **Payment** | 일부 | - | 결제 관련 인증 필요 |

### 7.4 데이터 암호화

| 대상 | 방식 | 비고 |
|------|------|------|
| 비밀번호 | bcrypt | Salt 자동 생성 |
| PIN 코드 | AES-256-CBC | CryptoService |
| 계좌 정보 | AES-256-CBC | CryptoService |
| JWT | HS256 | 환경변수 JWT_SECRET |

### 7.5 보안 모범 사례

```typescript
// 1. 클래스 레벨 가드 (모든 메서드 보호)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {}

// 2. 메서드 레벨 가드 (특정 메서드만 보호)
@Controller('products')
export class ProductController {
  @Get()          // 공개
  findAll() {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')  // 관리자만
  create() {}
}
```

---

## 8. 빌드 및 배포

### 8.1 빌드 파이프라인

```bash
# 1. 클라이언트 빌드
pnpm build:client    # Vite → client/dist/

# 2. 정적 파일 이동
pnpm build:move      # client/dist/ → server/public/

# 3. 서버 빌드
pnpm build:server    # NestJS → server/dist/

# 4. 단일 명령어
pnpm build           # 위 3단계 순차 실행
```

### 8.2 Integrated Hosting

NestJS가 `ServeStaticModule`을 통해 프론트엔드 정적 파일 서빙:

```typescript
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', 'public'),
  exclude: ['/api*'],
})
```

### 8.3 PM2 프로덕션

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'wgift',
    script: 'dist/main.js',
    cwd: './server',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

---

## 9. 참조 문서

- [01_PRD.md](./01_PRD.md) - 요구사항 정의서
- [03_ERD.md](./03_ERD.md) - 데이터베이스 스키마
- [05_API_SPEC.md](./05_API_SPEC.md) - API 명세서
- [06_PAGE_SPEC.md](./06_PAGE_SPEC.md) - 페이지 명세서
- [07_DESIGN_SYSTEM.md](./07_DESIGN_SYSTEM.md) - 디자인 시스템
- [08_TEST_SPEC.md](./08_TEST_SPEC.md) - E2E 테스트 명세서
- [10_ACCESSIBILITY_AUDIT.md](./10_ACCESSIBILITY_AUDIT.md) - 접근성 감사
