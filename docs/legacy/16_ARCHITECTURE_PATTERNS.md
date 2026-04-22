> **[Legacy] 레거시 참조용** — 이 문서는 구 W Gift(wowgift.co.kr) 시절 작성되었으며 역사 보존 목적으로만 유지됩니다. 현재 시스템은 Seedream Gift(seedreamgift.com)입니다.

# W기프트 아키텍처 & 디자인 패턴 가이드

> 최종 갱신: 2026-02-20
> 대상 독자: 신규 개발자 온보딩, 코드 리뷰어, 아키텍처 의사결정 참조

---

## 목차

1. [전체 아키텍처 개요](#1-전체-아키텍처-개요)
2. [서버 아키텍처](#2-서버-아키텍처)
   - [모듈 구조](#21-모듈-구조-16개-비즈니스-모듈)
   - [공유 인프라 계층](#22-공유-인프라-계층-shared)
   - [Generic CRUD 상속](#23-generic-crud-상속-template-method-pattern)
   - [의존성 역전 원칙 (DIP)](#24-의존성-역전-원칙-dip)
   - [Facade 패턴 — Admin 모듈](#25-facade-패턴--admin-모듈)
   - [Request/Response 파이프라인](#26-requestresponse-파이프라인)
   - [인증 및 보안 흐름](#27-인증-및-보안-흐름)
   - [설정 시스템](#28-설정-시스템)
3. [클라이언트 아키텍처](#3-클라이언트-아키텍처)
   - [앱 진입점과 라우팅](#31-앱-진입점과-라우팅)
   - [3-Layer 상태 관리](#32-3-layer-상태-관리-전략)
   - [API 계층 (Two-Tier)](#33-api-계층-two-tier)
   - [React Query 훅 패턴](#34-react-query-훅-패턴)
   - [낙관적 장바구니 패턴](#35-낙관적-장바구니-패턴-optimistic-cart)
   - [디자인 시스템 (Swift Trust)](#36-디자인-시스템-swift-trust)
4. [데이터 모델](#4-데이터-모델)
   - [ER 다이어그램](#41-er-다이어그램)
   - [인덱스 전략](#42-인덱스-전략)
   - [삭제 정책](#43-삭제-정책)
   - [암호화 필드](#44-암호화-필드)
5. [적용 디자인 패턴 정리](#5-적용-디자인-패턴-정리)
6. [핵심 파일 경로 참조표](#6-핵심-파일-경로-참조표)

---

## 1. 전체 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Vite + React 18)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  Pages   │  │  Design  │  │  Hooks   │  │   Stores    │ │
│  │  (lazy)  │→ │  System  │  │  (RQ)    │  │  (Zustand)  │ │
│  └────┬─────┘  └──────────┘  └────┬─────┘  └──────┬──────┘ │
│       │                           │                │        │
│       └───────────────┬───────────┘                │        │
│                  ┌────▼────┐                       │        │
│                  │ API Layer│◄──────────────────────┘        │
│                  │ (Axios)  │                                │
│                  └────┬─────┘                                │
└───────────────────────┼─────────────────────────────────────┘
                        │ /api/v1 (Vite proxy)
┌───────────────────────▼─────────────────────────────────────┐
│                   Server (NestJS 11)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │Middleware │→ │  Guards  │→ │  Pipes   │→ │Controllers │  │
│  │Trace/Log │  │JWT/Roles │  │Validation│  │BaseCrud 상속│  │
│  └──────────┘  └──────────┘  └──────────┘  └─────┬──────┘  │
│                                                   │         │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────▼──────┐  │
│  │ Interceptors │  │  Filters │  │     Services          │  │
│  │Transform/Audit│  │Exception │  │  BaseCrudService 상속 │  │
│  └──────────────┘  └──────────┘  └────────────┬──────────┘  │
│                                               │              │
│                                    ┌──────────▼──────────┐   │
│                                    │   PrismaService     │   │
│                                    │   (@Global)         │   │
│                                    └──────────┬──────────┘   │
└───────────────────────────────────────────────┼──────────────┘
                                                │
                                       ┌────────▼────────┐
                                       │     MSSQL       │
                                       │  (14 테이블)     │
                                       └─────────────────┘
```

**기술 스택 요약**

| 계층 | 기술 | 역할 |
|------|------|------|
| 프론트엔드 | Vite + React 18 + TypeScript | SPA, 코드 스플리팅 |
| 상태 관리 | Zustand + React Query + Context | 3-layer 상태 분리 |
| 디자인 시스템 | CSS Variables + CSS Modules | Swift Trust (Toss 스타일) |
| 백엔드 | NestJS 11 + TypeScript | REST API, JWT 인증 |
| ORM | Prisma 7 | MSSQL 연결, 타입 안전 쿼리 |
| DB | MSSQL (SQL Server) | 트랜잭션, 행 잠금 |
| 패키지 관리 | pnpm workspace | 모노레포 |

---

## 2. 서버 아키텍처

### 2.1 모듈 구조 (16개 비즈니스 모듈)

```
server/src/
├── main.ts                      # 부트스트랩
├── app.module.ts                # 루트 모듈
├── base/                        # Generic CRUD 기반 클래스
├── config/                      # 타입 안전 설정 팩토리
├── modules/                     # 비즈니스 도메인 모듈
│   ├── admin/                   #   관리자 (Facade → 9개 서브서비스)
│   ├── brand/                   #   브랜드 마스터
│   ├── cart/                    #   장바구니
│   ├── event/                   #   이벤트
│   ├── faq/                     #   FAQ
│   ├── gift/                    #   선물하기
│   ├── inquiry/                 #   1:1 문의
│   ├── kyc/                     #   본인인증 (1원 인증)
│   ├── notice/                  #   공지사항
│   ├── orders/                  #   주문
│   ├── product/                 #   상품
│   ├── refund/                  #   환불
│   ├── site-config/             #   사이트 설정 (동적 key-value)
│   ├── trade-in/                #   매입 (상품권 판매)
│   ├── users/                   #   회원
│   └── voucher/                 #   바우처 PIN 재고
└── shared/                      # 전역 인프라 모듈
    ├── auth/                    #   인증 (JWT, Passport, MFA)
    ├── crypto/                  #   암호화 (AES-256-CBC)
    ├── filters/                 #   전역 예외 필터
    ├── interceptors/            #   응답 변환, 감사 로그, Decimal 직렬화
    ├── logger/                  #   Winston 구조화 로깅
    ├── middleware/               #   TraceId, 요청 로깅
    ├── notifications/           #   Telegram 5xx 알림
    ├── prisma/                  #   DB 연결, 재시도 로직
    └── seo/                     #   동적 sitemap 생성
```

**모듈 간 의존 관계**

| 모듈 | 주요 의존 | 보호 수준 |
|------|-----------|----------|
| Products | (없음 — PrismaModule 전역) | GET 공개, CUD ADMIN |
| Cart | (없음) | 전체 JWT 필수 |
| Orders | VoucherModule, SiteConfigModule | 전체 JWT 필수 |
| Voucher | CryptoModule | 전체 ADMIN |
| KYC | HttpModule (Coocon API) | Rate Limit 5/분 |
| Admin | 거의 모든 모듈 import | 클래스 레벨 ADMIN |
| Users | (없음) | JWT 필수 |
| Refund | PrismaModule | ADMIN |

대부분의 모듈은 `PrismaModule`이 `@Global()`로 선언되어 있어 명시적 import 없이 `PrismaService`를 주입받습니다.

---

### 2.2 공유 인프라 계층 (Shared)

#### 전역 모듈 (`@Global()`)

| 모듈 | 내보내는 서비스 | 역할 |
|------|---------------|------|
| PrismaModule | `PrismaService` | DB 연결 풀, 재시도 로직, 정상 종료 |
| CryptoModule | `CryptoService` | AES-256-CBC 암호화/복호화, SHA-256 해시 |
| PasswordModule | `PasswordService` | bcryptjs 해시/비교, salt rounds 중앙 관리 |
| AuditModule | `AuditService` | 감사 로그 기록 |
| NotificationsModule | `TelegramAlertService` | 5xx 에러 Telegram 알림 |

#### 명시적 import 모듈

| 모듈 | 내보내는 서비스 | 역할 |
|------|---------------|------|
| AuthModule | `AuthService`, `MfaService` | JWT, 로그인/가입, 토큰 갱신, MFA |
| HealthModule | — | GET /health 헬스체크 |
| LoggerModule | WinstonModule | 일별 로그 파일 로테이션 |
| SeoModule | — | 동적 sitemap.xml 생성 |

---

### 2.3 Generic CRUD 상속 (Template Method Pattern)

**패턴 설명**: `BaseCrudService`와 `BaseCrudController`가 모든 CRUD 작업의 공통 로직을 제공하고, 각 도메인 서비스/컨트롤러가 이를 상속하여 도메인 특화 메서드만 추가합니다.

```
BaseCrudService<T, CreateDto, UpdateDto>
│
│  생성자: constructor(delegate: CrudDelegate<T>)
│  ── delegate는 Prisma 모델 (예: prisma.product, prisma.order)
│
├── create(dto)             → delegate.create()
├── findAll()               → delegate.findMany() + softDeleteFilter 자동 적용
├── findAllPaginated()      → findMany + count 병렬 실행 → { items, meta }
├── findOne(id)             → delegate.findUnique() + NotFoundException
├── update(id, dto)         → delegate.update() + P2025 → NotFoundException
├── remove(id)              → delegate.delete() + P2025 → NotFoundException
└── count()                 → delegate.count()

    ▼ 상속

ProductService extends BaseCrudService<Product, CreateProductDto, UpdateProductDto>
│   +findByBrand()
│   +updateStock()
│   +calculateBuyPrice()
└── constructor: super(prisma.product)
```

**BaseCrudController 제공 엔드포인트** (자동 상속)

| HTTP | 경로 | 설명 |
|------|------|------|
| POST | `/` | 생성 |
| GET | `/` | 페이지네이션 목록 (page, limit, sort, order) |
| GET | `/:id` | 단건 조회 |
| PATCH | `/:id` | 수정 |
| DELETE | `/:id` | 삭제 |

**PaginationQueryDto 기본값**: page=1, limit=20(최대 100), sort=createdAt, order=desc

---

### 2.4 의존성 역전 원칙 (DIP)

프로젝트에서 **4개의 Symbol 기반 인터페이스**를 사용하여 모듈 간 결합을 인터페이스 수준으로 제한합니다.

#### (1) USER_AUTH_REPOSITORY

```
AuthService ──(@Inject)──▶ IUserAuthRepository (Symbol)
JwtStrategy ──(@Inject)──▶ IUserAuthRepository (Symbol)
                                    ▲
                                    │ implements
                          UserAuthRepositoryImpl
                          (UsersModule에서 provide)
```

- **정의**: `shared/auth/interfaces/user-auth.repository.ts`
- **메서드**: `findById`, `findByEmail`, `findByPhone`, `create`, `updatePassword`, `updateProfile`
- **구현체**: `modules/users/user-auth.repository.impl.ts`
- **바인딩**: `UsersModule`에서 `{ provide: USER_AUTH_REPOSITORY, useClass: UserAuthRepositoryImpl }`

#### (2) VOUCHER_REPOSITORY

```
VoucherService ──(@Inject)──▶ IVoucherRepository (Symbol)
                                      ▲
                                      │ implements
                            PrismaVoucherRepository
                            (UPDLOCK/ROWLOCK SQL 힌트 사용)
```

- **정의**: `modules/voucher/interfaces/voucher-repository.interface.ts`
- **메서드**: `bulkCreate`, `findAvailableByProductId`, `markAsSold`, `releaseByOrderId`, `assignToOrder`
- **구현체**: `modules/voucher/prisma-voucher.repository.ts`
- **특이점**: Raw SQL `$queryRaw`로 MSSQL `UPDLOCK/ROWLOCK` 힌트 사용 → 바우처 원자적 할당

#### (3) VOUCHER_ASSIGNER

```
OrdersService ──(@Inject)──▶ IVoucherAssigner (Symbol)
                                     ▲
                                     │ useExisting
                              VoucherService (이미 인스턴스화된 것 재사용)
```

- **정의**: `modules/orders/interfaces/voucher-assigner.interface.ts`
- **메서드**: `assignVouchersToOrder`, `releaseVouchersFromOrder`
- **바인딩**: `{ provide: VOUCHER_ASSIGNER, useExisting: VoucherService }`
- **목적**: `OrdersService`가 `VoucherService`를 직접 의존하지 않음

#### (4) PAYMENT_PROVIDER

```
OrdersService ──(@Inject)──▶ IPaymentProvider (Symbol)
                                     ▲
                                     │ implements
                              MockPaymentProvider (현재)
                              TossPaymentProvider (향후 교체 가능)
```

- **정의**: `modules/orders/interfaces/payment-provider.interface.ts`
- **메서드**: `verifyPayment`, `refundPayment`
- **현재 바인딩**: `{ provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider }`
- **설계 의도**: 코드 변경 없이 결제 공급자 교체 가능 (전략 패턴)

#### TypeScript Import 규칙

`isolatedModules` + `emitDecoratorMetadata` 환경에서 인터페이스와 Symbol 토큰의 import를 분리해야 합니다:

```typescript
// 올바른 패턴
import type { IVoucherAssigner } from './interfaces/voucher-assigner.interface';  // 타입만
import { VOUCHER_ASSIGNER } from './interfaces/voucher-assigner.interface';       // 런타임 값
```

---

### 2.5 Facade 패턴 — Admin 모듈

`AdminService`는 **9개의 세부 서비스**를 하나의 진입점으로 통합하는 Facade입니다.

```
AdminController
    │
    ▼
AdminService (Facade)
    ├── AdminDashboardService   ── 통계, 감사 로그 조회
    ├── AdminUsersService       ── 회원 CRUD, KYC, 역할, 세션, 비밀번호 초기화
    ├── AdminProductsService    ── 상품/브랜드 CRUD
    ├── AdminVouchersService    ── 바우처 CRUD, 대량 생성, 재고
    ├── AdminOrdersService      ── 주문 관리, 장바구니 관리
    ├── AdminTradeInService     ── 매입 상태 관리, PIN 복호화
    ├── AdminContentService     ── 공지, 이벤트, FAQ, 문의
    ├── AdminGiftsService       ── 선물 관리
    ├── AdminConfigService      ── 사이트 설정 key-value 관리
    └── RefundService           ── 환불 생성/승인/거절 (RefundModule에서 주입)
```

**보호**: 클래스 레벨 `@Roles('ADMIN')` + `@UseGuards(JwtAuthGuard, RolesGuard)`로 모든 엔드포인트 일괄 보호

---

### 2.6 Request/Response 파이프라인

모든 HTTP 요청이 거치는 전체 흐름:

```
📥 HTTP 요청 수신
│
│ [Middleware 계층]
├── TraceIdMiddleware        UUID 생성 → req.traceId에 할당, x-trace-id 응답 헤더 설정
├── LoggerMiddleware         응답 완료 후: [traceId] POST /api/v1/orders 201 42ms 로그
│
│ [Guard 계층]
├── ThrottlerGuard           Rate Limit 검사 (기본: 100회/60초, KYC: 5회/분)
├── JwtAuthGuard             Bearer 토큰 검증, 사용자 존재 확인, 계정 잠금 체크
├── RolesGuard               @Roles() 데코레이터 기반 RBAC 역할 검사
│
│ [Pipe 계층]
├── ValidationPipe           whitelist=true, forbidNonWhitelisted, transform, stopAtFirstError
│
│ [Controller → Service]
├── Route Handler            비즈니스 로직 실행
│
│ [Interceptor 계층] (역순 실행)
├── DecimalSerializerInterceptor   Prisma Decimal 객체 → JavaScript number 변환
├── AuditInterceptor               POST/PATCH/DELETE 감사 로그 (fire-and-forget, 비차단)
├── TransformInterceptor           성공 응답 래핑: { success, statusCode, data, timestamp, traceId }
│
📤 HTTP 응답 전송

│ [예외 발생 시]
└── HttpExceptionFilter      에러 응답: { success: false, error: { statusCode, message, code, timestamp, path, traceId } }
                             5xx 에러: Telegram 알림 발송
```

**Interceptor 등록 규칙**:
- `APP_INTERCEPTOR` (app.module.ts): DI 필요한 인터셉터 → `AuditInterceptor`, `TransformInterceptor`
- `useGlobalInterceptors` (main.ts): DI 불필요 → `DecimalSerializerInterceptor`
- 하나의 인터셉터를 **두 곳에 등록하면 이중 래핑** 발생 (과거 버그 경험)

---

### 2.7 인증 및 보안 흐름

#### JWT 토큰 구조

| 토큰 | 알고리즘 | 만료 | 저장 위치 | 페이로드 |
|------|---------|------|----------|---------|
| Access Token | HS256 | 15분 (설정 가능) | 클라이언트 메모리 (Zustand) | `{ email, sub, role, iss, aud }` |
| Refresh Token | — (opaque) | 7일 | DB (SHA-256 해시), HTTP-only 쿠키 | `crypto.randomBytes(32)` |

#### 인증 플로우

```
1. 로그인 요청 (POST /auth/login)
   │
   ├── 이메일 존재 확인 (timing attack 방지: 없어도 bcrypt 비교 실행)
   ├── 계정 잠금 확인 (lockedUntil > now → 거부)
   ├── 비밀번호 bcryptjs 비교
   ├── 실패 시: failedLoginAttempts++ (5회 → 15분 잠금)
   │
   ├── MFA 활성화 확인
   │   ├── MFA 비활성: Access Token + Refresh Token 즉시 발급
   │   └── MFA 활성:  { mfa_required: true, mfa_token: '5분 JWT' } 반환
   │                  └── POST /auth/mfa/verify (TOTP 코드 검증 후 토큰 발급)
   │
   └── Refresh Token 관리
       ├── 사용자당 최대 5개 동시 세션 (초과 시 가장 오래된 토큰 삭제)
       └── 토큰 갱신 시 Rotation: 기존 토큰 삭제 → 새 토큰 발급

2. 인증 요청 (모든 보호 엔드포인트)
   │
   ├── JwtStrategy: Authorization 헤더에서 Bearer 토큰 추출
   ├── 서명 검증 (HS256, issuer: 'w-gift', audience: 'w-gift-client')
   ├── DB에서 사용자 조회 (매 요청마다)
   ├── lockedUntil 체크
   └── password 필드 제거 후 request.user에 설정

3. 토큰 갱신 (POST /auth/refresh)
   │
   ├── HTTP-only 쿠키에서 Refresh Token 추출
   ├── SHA-256 해시 후 DB 조회
   ├── 만료 확인
   ├── 기존 토큰 삭제 (Rotation)
   └── 새 Access Token + Refresh Token 발급
```

#### KYC (1원 인증) 플로우

```
1. POST /kyc/bank-verify/request
   ├── Coocon API: 1원 입금 요청
   ├── KycVerifySession 생성 (verifyTrNo 저장)
   └── Rate Limit: 5회/분

2. POST /kyc/bank-verify/confirm
   ├── 입금자명 확인 (Coocon API 검증)
   ├── User.kycStatus = 'VERIFIED'
   ├── User.bankVerifiedAt = now()
   └── 계좌 정보 AES-256 암호화 저장
```

#### 비밀번호 변경 보안

`changePassword()`는 `user.bankVerifiedAt`이 **최근 10분 이내**인지 검증합니다. 민감한 작업을 최근 KYC 인증에 연결하는 추가 보안 계층입니다.

---

### 2.8 설정 시스템

`ConfigModule.forRoot()`에서 3개의 타입 안전 설정 네임스페이스를 로드합니다:

| 설정 팩토리 | 네임스페이스 | 주요 환경변수 |
|------------|------------|-------------|
| `authConfig` | `auth` | `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY_DAYS`, `BCRYPT_SALT_ROUNDS` |
| `rateLimitConfig` | `rateLimit` | `THROTTLE_TTL`, `THROTTLE_LIMIT` |
| `paginationConfig` | `pagination` | `PAGINATION_DEFAULT`, `PAGINATION_MAX` |

Joi `envValidationSchema`로 애플리케이션 시작 시 필수 환경변수를 검증합니다 (`abortEarly: false` → 누락된 변수 모두 한 번에 표시).

---

## 3. 클라이언트 아키텍처

### 3.1 앱 진입점과 라우팅

#### Provider 트리 (바깥 → 안쪽)

```
React.StrictMode
  └── HelmetProvider           ── 페이지별 <head> 관리
      └── QueryClientProvider  ── React Query (refetchOnWindowFocus: false, retry: 1)
          └── BrowserRouter    ── HTML5 History 라우팅
              └── AuthProvider         ── 인증 상태
                  └── ModalProvider    ── 모달 상태
                      └── ToastProvider    ── 토스트 알림
                          └── Suspense (LoaderOverlay)
                              └── ErrorBoundary
                                  └── Routes
                                      └── KakaoFloatingButton (항상 표시)
```

#### 라우트 구조

| 경로 | 가드 | 페이지 | 설명 |
|------|------|--------|------|
| `/` | 없음 | HomePage | 메인 페이지 |
| `/products` | 없음 | ProductListPage | 상품 목록 |
| `/products/:id` | 없음 | ProductDetailPage | 상품 상세 |
| `/cart` | 없음 | CartPage | 장바구니 |
| `/checkout` | ProtectedRoute | CheckoutPage | 결제 |
| `/mypage` | ProtectedRoute | MyPage | 마이페이지 |
| `/login`, `/register` | 없음 | Auth 페이지 | 로그인/회원가입 |
| `/trade-in` | 없음 | ProductListPage(sell) | 매입 |
| `/support` | 없음 | SupportHubPage | 고객센터 |
| `/admin/*` | AdminRoute | AdminPage | 관리자 (독립 레이아웃) |

모든 사용자 페이지는 `React.lazy()`로 코드 스플리팅됩니다. Admin 페이지는 `MainLayout` 바깥에서 독립 렌더링됩니다.

---

### 3.2 3-Layer 상태 관리 전략

```
┌──────────────────────────────────────────────────────────┐
│             Layer 1: Server State (React Query)           │
│                                                          │
│  useProducts()     ── staleTime: 10분                    │
│  useBrands()       ── staleTime: 1시간                   │
│  useSiteConfig()   ── staleTime: 1시간                   │
│  useMyOrders()     ── staleTime: 2분                     │
│  useLiveRates()    ── staleTime: 1분                     │
│                                                          │
│  → 서버 데이터 캐싱, 자동 재검증, 백그라운드 갱신         │
├──────────────────────────────────────────────────────────┤
│           Layer 2: Global Client State (Zustand)          │
│                                                          │
│  useAuthStore      ── 토큰 메모리 저장 (XSS 방지)        │
│  useCartStore      ── localStorage 영속 (persist 미들웨어)│
│  useCheckoutStore  ── sessionStorage (탭 닫으면 초기화)    │
│                                                          │
│  → 클라이언트 전용 상태, 영속성 레벨별 분리               │
├──────────────────────────────────────────────────────────┤
│              Layer 3: UI State (React Context)            │
│                                                          │
│  ToastContext      ── 큐 기반, 최대 3개 동시 표시         │
│  ModalContext      ── 단일 모달, focus trap, a11y         │
│  BrandThemeContext ── 정적 브랜드 색상 맵                  │
│                                                          │
│  → 일시적 UI 상태, 컴포넌트 트리 범위 제한               │
└──────────────────────────────────────────────────────────┘
```

#### 각 Store 상세

**useAuthStore** (Zustand — 메모리 전용)
- `token`: Access Token (메모리만, localStorage 저장 안 함)
- `user`: 현재 사용자 정보
- `login()`, `register()`, `logout()`, `refresh()`, `checkAuth()`
- Silent Refresh: 모듈 레벨 `refreshPromise` 캐시로 동시 갱신 요청 방지
- `logout()` 시 `useCartStore.getState().clearCart()` 직접 호출 (cross-store 연동)

**useCartStore** (Zustand — localStorage 영속)
- `persist` 미들웨어, 키: `wow-gift-cart:v1`
- 이중 인덱스: `items` 배열 + `itemsMap: Map<number, CartItem>` (O(1) 조회)
- `Map`은 직렬화 제외, `onRehydrateStorage`에서 `items`로부터 재구축

**useCheckoutStore** (Zustand — sessionStorage)
- 탭 닫으면 자동 초기화
- `checkoutItems`, `giftTarget`, `shippingInfo`
- "바로 구매" (장바구니 미경유)와 "장바구니 결제" 모두 동일 흐름 지원

---

### 3.3 API 계층 (Two-Tier)

| 계층 | 소스 | 대상 |
|------|------|------|
| Generated | `pnpm api:generate` (Swagger → TypeScript) | 타입 안전 API 호출 (`AuthApi`, `ProductsApi` 등) |
| Manual | `client/src/api/manual.ts` | 생성기 미지원 엔드포인트 (~40개 admin 메서드 등) |

#### Axios 인스턴스 (`client/src/lib/axios.ts`)

**Request 인터셉터**:
- `useAuthStore.getState().token`에서 토큰 읽기 (React 외부에서 Zustand 직접 접근)
- `Authorization: Bearer <token>` 헤더 주입

**Response 인터셉터**:
1. `{ success: true, data: X }` 래핑 자동 해제 → 호출자는 `X`를 직접 수신
2. **401 처리**: 큐 기반 토큰 갱신
   - 첫 401 → `refresh()` 호출
   - 동시 발생 401 → 큐에 대기, 갱신 완료 후 재실행
   - 갱신 실패 → `session-expired` CustomEvent dispatch → `logout()`
3. 4xx/5xx (401 제외) → `api-error` CustomEvent dispatch

#### Cross-Layer 이벤트 버스

```
Axios 인터셉터 (React 외부)
    │
    ├── dispatchEvent('session-expired')  ──▶  ToastContext (React 내부)
    └── dispatchEvent('api-error')        ──▶  ToastContext (React 내부)
```

React 컴포넌트 트리 외부(Axios)와 내부(Context) 간의 유일한 통신 채널입니다. DOM CustomEvent를 사용하여 결합을 최소화합니다.

---

### 3.4 React Query 훅 패턴

모든 쿼리 훅이 따르는 공통 패턴:

```typescript
export const useProducts = () => useQuery<Product[]>({
  queryKey: ['products'],
  queryFn: async () => {
    const { data } = await axiosInstance.get('/products');
    return extractListData<Product>(data);  // 3가지 응답 형태 정규화
  },
  staleTime: 1000 * 60 * 10,  // 10분 캐시
});
```

**`extractListData` 정규화** (`hooks/queryHelpers.ts`):

서버 응답이 3가지 형태로 올 수 있어 방어적으로 처리합니다:
1. 순수 배열: `[...]` → 그대로 반환
2. 페이지네이션: `{ items: [...] }` → `items` 추출
3. 래핑: `{ data: [...] }` → `data` 추출

**Mutation 훅**:

| 훅 | 엔드포인트 | 성공 시 무효화 |
|----|-----------|--------------|
| `useCreateOrder` | `ordersApi.create()` | `['my-orders']`, `['my-gifts']` |
| `useCancelOrder` | `POST /orders/:id/cancel` | `['my-orders']` |
| `useCreateTradeIn` | `POST /trade-ins` | `['my-tradeins']` |

---

### 3.5 낙관적 장바구니 패턴 (Optimistic Cart)

```
사용자 클릭: "장바구니 담기"
    │
    ▼
useCart.addToCart(product, qty)
    │
    ├── [즉시] Zustand 로컬 상태 업데이트 → UI 즉각 반영
    │
    └── [비동기] POST /api/v1/cart (fire-and-forget)
        ├── 성공: 아무 작업 없음 (이미 로컬 반영)
        └── 실패: 로컬 상태 유지 (다음 로그인 시 서버와 동기화)

로그인 시점:
    │
    ├── GET /api/v1/cart (서버 장바구니 조회)
    └── merge(localCart, serverCart)
        └── 충돌 시 로컬 수량 우선
```

**`useCart` 훅**: 프로젝트에서 가장 복잡한 훅. 5개 의존성을 조합합니다:
- `useCartStore` (로컬 상태) + `useCheckoutStore` (결제 상태) + `useAuth` (인증 확인) + `useToast` (피드백) + `useNavigate` (라우팅)

---

### 3.6 디자인 시스템 (Swift Trust)

Toss 디자인 시스템에서 영감받은 **Atomic Design** 구조입니다.

#### 계층 구조

```
design-system/
├── atoms/       (19개) ── 최소 단위 컴포넌트
│   ├── Button        ── 7 variants, 4 sizes, ripple, loading
│   ├── TextField     ── 4 variants (box/line/big/hero), .Clearable/.Password/.Button
│   ├── Card          ── interactive, padding, shadow, radius
│   ├── ListRow       ── Compound: .AssetIcon/.Texts/.IconButton/.Loader
│   ├── Badge         ── 6 colors, 4 sizes, fill/weak
│   ├── StatusBadge   ── 도메인 인지: order/tradein/kyc/role 상태 → 스타일 매핑
│   ├── Loader        ── brand 타입 (W-로고 애니메이션), .Overlay
│   └── ...           ── Input, Select, Switch, Checkbox, Radio, NumericSpinner 등
│
├── molecules/   (19개) ── 조합 컴포넌트
│   ├── Modal         ── createPortal, motion/react 스와이프, focus trap, 3 sizes
│   ├── BottomSheet   ── Compound: .Header/.CTA/.DoubleCTA
│   ├── Accordion     ── HTML5 <details> 비제어 + ARIA 제어 버전
│   ├── TabNavigation ── 4 styles, WCAG 2.1 AA
│   ├── Skeleton      ── Card/List/Text/ProductCard 변형
│   ├── EmptyState    ── search/cart/order/error/custom
│   └── ...           ── Result, StepIndicator, Dropdown, Overlay 등
│
└── layout/      (5개) ── 레이아웃 프리미티브
    ├── Stack         ── 수직 flex
    ├── Inline        ── 수평 flex
    ├── PageContainer ── 반응형 max-width
    ├── TwoColumn     ── 2열 레이아웃
    └── Center        ── 중앙 정렬
```

#### 토큰 시스템

| 카테고리 | CSS 변수 | 예시 |
|---------|---------|------|
| 색상 | `--color-*` | `--color-primary: #3182F6`, `--color-point: #FFBB00` |
| 간격 | `--space-*` | `--space-1: 4px` ~ `--space-20: 80px` (8pt 그리드) |
| 모서리 | `--radius-*` | `--radius-sm: 8px`, `--radius-md: 14px` |
| 타이포 | `--text-*` | `--text-caption: 12px`, `--text-body: 14px`, `--text-hero: 32px` |

#### CSS 규칙

| 금지 | 올바른 사용 |
|------|-----------|
| `transition: all` | `transition: background 0.2s ease, transform 0.2s ease` |
| `outline: none` 단독 | `:focus-visible` 대체 스타일 필수 |
| `left`/`top` 애니메이션 | `transform`, `opacity`만 (compositor-friendly) |

#### 브랜드 테마

`data-brand="SHINSEGAE"` HTML 속성으로 브랜드별 색상 오버라이드:
```css
[data-brand="SHINSEGAE"] { --brand-primary: #1A1A1A; --brand-accent: #C8A96E; }
[data-brand="LOTTE"]     { --brand-primary: #E60012; --brand-accent: #FFFFFF; }
```

---

## 4. 데이터 모델

### 4.1 ER 다이어그램

```
User (회원)
├──1:N──▶ Order (주문)
│         ├──1:N──▶ OrderItem (주문상품)
│         ├──1:N──▶ VoucherCode (할당된 PIN)
│         ├──1:1──▶ Gift (선물)
│         └──1:1──▶ Refund (환불)
├──1:N──▶ TradeIn (매입)
├──1:N──▶ CartItem (장바구니) ◄──N:1── Product
├──1:N──▶ RefreshToken (세션)
├──1:N──▶ Gift (보낸 선물 / 받은 선물)
├──1:N──▶ Inquiry (1:1 문의)
└──1:N──▶ AuditLog (감사 로그)

Brand (브랜드)
└──1:N──▶ Product (상품)
          ├──1:N──▶ VoucherCode (PIN 재고)
          ├──1:N──▶ OrderItem
          ├──1:N──▶ CartItem
          └──1:N──▶ TradeIn

독립 모델: SiteConfig, Notice, Event, Faq, KycVerifySession
```

**14개 모델**, 관계 유형:
- **1:1**: Gift↔Order, Refund↔Order
- **1:N**: User→Orders, Product→VoucherCodes 등
- **Self-referential**: Gift에서 User를 Sender/Receiver로 이중 참조

### 4.2 인덱스 전략

**18개 이상의 복합 인덱스** — 쿼리 패턴에 최적화:

| 모델 | 인덱스 컬럼 | 목적 |
|------|-----------|------|
| Product | `(brandCode, isActive, deletedAt)` | 브랜드별 활성 상품 (소프트 삭제 제외) |
| VoucherCode | `(productId, status, id)` | 상품별 이용 가능 PIN 페이지네이션 |
| Order | `(userId, status, createdAt)` | 사용자 주문 이력 (상태별) |
| Order | `(idempotencyKey)` | 멱등성 키 조회 (결제 중복 방지) |
| TradeIn | `(status, createdAt)` | 매입 상태별 이력 |
| AuditLog | `(resource, resourceId)` | 리소스별 변경 추적 |

**전략**: FK 관계, 상태 필드, 시간 필드, 복합 조회에 집중 인덱싱

### 4.3 삭제 정책

| 정책 | 대상 | 설명 |
|------|------|------|
| **Cascade** | RefreshToken→User, OrderItem→Order, CartItem→User, Gift→Order | 부모 삭제 시 자식 자동 삭제 |
| **SetNull** | VoucherCode→Order, AuditLog→User | FK를 NULL로 설정 (이력 보존) |
| **NoAction (Restrict)** | Order→User, VoucherCode→Product, TradeIn→User, Refund→Order | 자식 존재 시 부모 삭제 차단 |

**설계 철학**: 데이터 무결성 우선. User와 Product는 "끈끈한(sticky)" 엔티티 — 연관 데이터가 있으면 삭제 불가. 소프트 삭제(`deletedAt`)로 논리적 삭제 처리.

### 4.4 암호화 필드

| 모델 | 필드 | 암호화 방식 |
|------|------|-----------|
| User | `accountNumber` | AES-256-CBC (CryptoService) |
| VoucherCode | `pinCode` | AES-256-CBC + SHA-256 해시(`pinHash`) |
| TradeIn | `pinCode`, `accountNum` | AES-256-CBC |

`pinHash`는 중복 검사용, `pinCode`는 복호화가 필요한 실제 값입니다.

---

## 5. 적용 디자인 패턴 정리

| 패턴 | 적용 위치 | 목적 |
|------|-----------|------|
| **Template Method** | `BaseCrudService`, `BaseCrudController` | 공통 CRUD → 서브클래스가 도메인 특화 메서드 추가 |
| **Dependency Inversion (DIP)** | `IVoucherAssigner`, `IPaymentProvider`, `IUserAuthRepository`, `IVoucherRepository` | Symbol 토큰 기반 인터페이스 주입, 모듈 간 결합 최소화 |
| **Facade** | `AdminService` → 9개 sub-service | 복잡한 Admin 도메인을 단일 진입점으로 통합 |
| **Repository** | `PrismaVoucherRepository`, `UserAuthRepositoryImpl` | DB 접근 추상화, 테스트 용이성 |
| **Strategy** | `IPaymentProvider` → Mock/Real 교체 | 결제 공급자를 코드 변경 없이 교체 가능 |
| **Observer (Event Bus)** | Axios → `CustomEvent` → `ToastContext` | React/non-React 간 느슨한 결합 통신 |
| **Compound Component** | `ListRow.*`, `BottomSheet.*`, `TextField.*` | 관련 서브 컴포넌트를 네임스페이스로 묶음 |
| **Optimistic Update** | `useCart` 훅 | 로컬 즉시 반영 + 서버 비동기 동기화 |
| **Keep-Mounted** | Admin 탭 | 방문한 탭을 `display:none`으로 유지 (상태 보존) |
| **Token Rotation** | `AuthService` | Refresh 시 old 토큰 삭제 + new 발급 (탈취 방지) |
| **Atomic Design** | Design System | Atoms → Molecules → Layout → Pages 계층 |
| **Middleware Pipeline** | NestJS 요청 처리 | Middleware → Guard → Pipe → Handler → Interceptor → Filter |
| **Singleton** | `PrismaService` (`@Global()`) | 전체 앱에서 단일 DB 연결 인스턴스 |

---

## 6. 핵심 파일 경로 참조표

### 서버 (server/src/)

| 분류 | 파일 | 설명 |
|------|------|------|
| **부트스트랩** | `main.ts` | 앱 시작, 전역 파이프/필터/인터셉터 |
| **루트 모듈** | `app.module.ts` | 모듈 등록, APP_INTERCEPTOR 바인딩 |
| **기반 클래스** | `base/base-crud.service.ts` | Generic CRUD 서비스 |
| | `base/base-crud.controller.ts` | Generic CRUD 컨트롤러 |
| | `base/pagination.dto.ts` | 페이지네이션 DTO |
| **인증** | `shared/auth/auth.service.ts` | JWT 발급, 로그인/가입 |
| | `shared/auth/jwt.strategy.ts` | Passport JWT 전략 |
| | `shared/auth/jwt-auth.guard.ts` | JWT 인증 가드 |
| | `shared/auth/roles.guard.ts` | RBAC 역할 가드 |
| | `shared/auth/password.service.ts` | bcryptjs 해시 |
| | `shared/auth/interfaces/user-auth.repository.ts` | IUserAuthRepository 정의 |
| **인프라** | `shared/prisma/prisma.service.ts` | DB 연결, 풀, 재시도 |
| | `shared/crypto/crypto.service.ts` | AES-256 암호화 |
| | `shared/interceptors/transform.interceptor.ts` | 응답 래핑 |
| | `shared/interceptors/audit.interceptor.ts` | 감사 로그 |
| | `shared/interceptors/decimal-serializer.interceptor.ts` | Decimal 변환 |
| | `shared/filters/http-exception.filter.ts` | 전역 예외 필터 |
| | `shared/middleware/trace-id.middleware.ts` | 요청 추적 ID |
| **DIP 인터페이스** | `modules/orders/interfaces/voucher-assigner.interface.ts` | IVoucherAssigner |
| | `modules/orders/interfaces/payment-provider.interface.ts` | IPaymentProvider |
| | `modules/voucher/interfaces/voucher-repository.interface.ts` | IVoucherRepository |
| **Admin** | `modules/admin/admin.service.ts` | Facade 서비스 |
| | `modules/admin/admin.controller.ts` | Admin 컨트롤러 |

### 클라이언트 (client/src/)

| 분류 | 파일 | 설명 |
|------|------|------|
| **진입점** | `main.tsx` | Provider 트리, QueryClient |
| | `App.tsx` | 라우팅, 레이아웃 |
| **API** | `api/index.ts` | API 인스턴스 배럴 export |
| | `api/manual.ts` | 수동 API 클라이언트 |
| | `lib/axios.ts` | Axios 인스턴스, 인터셉터 |
| **스토어** | `store/useAuthStore.ts` | 인증 (메모리 토큰) |
| | `store/useCartStore.ts` | 장바구니 (localStorage) |
| | `store/useCheckoutStore.ts` | 결제 (sessionStorage) |
| **컨텍스트** | `contexts/AuthContext.tsx` | 인증 Context 브릿지 |
| | `contexts/ToastContext.tsx` | 토스트 알림 |
| | `contexts/ModalContext.tsx` | 모달 |
| **훅** | `hooks/index.ts` | 훅 배럴 export |
| | `hooks/useCart.ts` | 장바구니 (가장 복잡한 훅) |
| | `hooks/queryHelpers.ts` | extractListData 정규화 |
| | `hooks/mutations/` | useCancelOrder 등 |
| **디자인 시스템** | `design-system/atoms/` | Button, Input, Card 등 |
| | `design-system/molecules/` | Modal, Accordion 등 |
| | `design-system/layout/` | Stack, PageContainer 등 |
| **스타일** | `index.css` | 전역 CSS 변수 |
| | `styles/tokens.css` | 디자인 토큰 |

---

> **문서 관련 질문이나 수정 요청**은 이슈를 생성하거나 `docs/16_ARCHITECTURE_PATTERNS.md`를 직접 편집해주세요.
