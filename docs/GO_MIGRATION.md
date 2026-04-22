# Go Server → NestJS Server 완전 대체 가능성 검증 보고서

> **검증일**: 2026-03-21
> **검증 방법**: Go 서버(`go-server/`) 소스코드와 클라이언트(`client/src/`) API 호출 코드를 1:1 대조 분석
> **대상 파일**: `go-server/cmd/api/main.go`, `go-server/internal/app/services/auth_service.go`, `client/src/lib/axios.ts`, `client/src/api/manual.ts`, `client/src/store/useAuthStore.ts`, `server/src/main.ts`

---

## 결론: 대체 불가 (현재 상태)

Go 서버는 NestJS 서버를 **대체할 수 없습니다.** 5개의 SHOWSTOPPER급 문제와 다수의 누락 엔드포인트가 있습니다.

---

## 1. SHOWSTOPPER — 즉시 장애 발생 (5건)

### 1-1. 로그인 응답 필드명 불일치

| | NestJS (정상) | Go (불일치) |
|--|--|--|
| 토큰 필드 | `access_token` (snake_case) | `accessToken` (camelCase) |
| 리프레시 | HttpOnly 쿠키로 전달 | JSON body로 `refreshToken` 반환 |

**근거 코드:**
- Go 서버 (`auth_service.go:46`):
  ```go
  type LoginResponse struct {
      AccessToken  string `json:"accessToken"`     // camelCase
      RefreshToken string `json:"refreshToken"`
      User         domain.User `json:"user"`
  }
  ```
- 클라이언트 (`useAuthStore.ts:118`):
  ```typescript
  const { access_token, user } = response.data;  // snake_case 기대
  ```

**결과**: 로그인 성공해도 토큰이 `undefined` → 모든 인증 API 호출 실패

### 1-2. Refresh Token 아키텍처 불일치

- **NestJS**: HttpOnly 쿠키에 refresh token 저장 → `POST /auth/refresh`에서 쿠키 읽기
- **Go**: 쿠키 미사용 — `RefreshToken()` 메서드가 JSON body의 `refreshToken` 문자열을 받음 (`auth_service.go:121`)
- **클라이언트** (`axios.ts:15`): `withCredentials: true`로 쿠키 전송, body 없음
  ```typescript
  // manual.ts:254 — body 없이 POST 호출
  refresh: async () => {
      const response = await axiosInstance.post<AuthTokenResponse>('/auth/refresh');
      return response;
  },
  ```

**결과**: Access token 만료 시 갱신 불가 → 토큰 수명 후 전원 로그아웃

### 1-3. 라우트 경로 불일치: `/trade-in` vs `/trade-ins`

- **클라이언트**: `POST /trade-ins`, `GET /trade-ins/my` 호출 (hooks/useMyTradeIns.ts, hooks/mutations/useCreateTradeIn.ts)
- **Go 서버**: `/trade-in` (단수형, `main.go:282`)
  ```go
  tradeIn := protected.Group("/trade-in")  // 단수형
  ```

**결과**: 매입 기능 전체 404 에러

### 1-4. 정적 파일 서빙 없음 (웹 프론트엔드)

- **NestJS**: `ServeStaticModule`로 빌드된 React 앱 서빙 (`app.module.ts:90`)
- **Go**: Wails GUI에 프론트엔드 임베딩 (`//go:embed all:frontend/dist`, `main.go:28`), HTTP 정적 파일 서빙 없음

**결과**: `https://wowgift.co.kr` 접속 시 빈 페이지

### 1-5. Wails GUI 의존성 (헤드리스 운영 불가)

```go
// main.go:47-64
go startAPIServer(cfg)        // API 서버는 백그라운드 goroutine
err = wails.Run(&options.App{ // GUI가 메인 스레드를 블로킹
    Title: "Wow Gift Admin Console",
    ...
})
```

- 서버는 `go startAPIServer(cfg)`로 백그라운드 goroutine 실행
- `wails.Run()`이 GUI 윈도우 실행 후 메인 스레드 블로킹

**결과**: GUI 없는 서버 환경(Linux, headless Windows)에서 실행 불가, PM2 관리 불가

---

## 2. 누락 엔드포인트 — 클라이언트 기능 장애

### Tier A: 클라이언트가 실제 호출하는 엔드포인트 (13건)

| # | 누락 엔드포인트 | 클라이언트 사용처 | 영향 |
|---|---|---|---|
| 1 | `GET /products/live-rates` | `LiveDashboard.tsx`, `useLiveRates.ts` | 홈 시세 대시보드 미표시 (Go는 `/products/rates` — 경로 다름) |
| 2 | `POST /orders/:id/cancel` | `useCancelOrder.ts`, `MyPage.tsx` | 주문 취소 불가 |
| 3 | `GET /orders/my-gifts` | `useMyGifts.ts` | 받은 선물 페이지 404 (Go는 `/gifts/received` — 경로 다름) |
| 4 | `POST /kyc/kcb/start` | `KycVerification.tsx:189` | KCB PASS 본인인증 불가 |
| 5 | `GET /kyc/kcb/check-status` | `KycVerification.tsx:149` | 인증 진행 확인 불가 |
| 6 | `POST /kyc/kcb/complete` | `KycVerification.tsx:95` | 인증 완료 처리 불가 |
| 7 | `POST /kyc/bank-account` | `SettingsTab.tsx` | 마이페이지 계좌 변경/재인증 불가 (Go는 GET만 제공) |
| 8 | `PATCH /auth/profile` | `SettingsTab.tsx:109,125` | 프로필(이름/전화) 수정 불가 |
| 9 | `DELETE /users/me` | `SettingsTab.tsx:150` | 회원 탈퇴 불가 |
| 10 | `GET /admin/products` (목록) | `manual.ts:353` | 관리자 상품 목록 조회 불가 (Go에 CUD만 있고 R 없음) |
| 11 | `POST /gifts/check-receiver` | generated API client | 선물 수신자 확인 불가 |
| 12 | `GET /gifts/search` | `GiftTargetModal.tsx` | 수신자 검색/자동완성 불가 |
| 13 | `GET /health` | NestJS `HealthModule` | 헬스체크 모니터링 불가 |

### Tier B: NestJS에 존재하나 클라이언트 미호출 (현재) (7건)

| # | 누락 엔드포인트 | 비고 |
|---|---|---|
| 14 | `POST /auth/login/mfa` | MFA 로그인 2단계 (클라이언트 미구현) |
| 15 | `GET/DELETE /auth/sessions` | 사용자 세션 관리 (admin만 구현됨) |
| 16 | `POST /auth/mfa/disable` | MFA 비활성화 |
| 17 | `GET /auth/mfa/status` | MFA 상태 확인 |
| 18 | `GET /orders/my/stats` | 마이페이지 통계 (클라이언트 미호출) |
| 19 | `GET /trade-ins/my/stats` | 매입 통계 (클라이언트 미호출) |
| 20 | `GET /sitemap.xml` | SEO 사이트맵 (NestJS `SeoModule`) |

---

## 3. 보안/미들웨어 격차 (10건)

| # | NestJS 기능 | Go 상태 | 위험도 |
|---|---|---|---|
| 1 | `helmet` (CSP, HSTS, X-Frame-Options) | 없음 | **높음** — 클릭재킹, MIME 스니핑 취약 |
| 2 | `compression` (gzip/brotli) | 없음 | 중간 — 응답 크기 증가, 로딩 느림 |
| 3 | `cookieParser` | 없음 | **높음** — 쿠키 기반 인증 불가 (SHOWSTOPPER 1-2 연관) |
| 4 | `ValidationPipe` (whitelist + forbidNonWhitelisted) | 없음 | **높음** — 허용되지 않은 필드 주입 가능 |
| 5 | `TrimStringsPipe` | 없음 | 낮음 — 입력 앞뒤 공백 미제거 |
| 6 | `DecimalSerializerInterceptor` | 없음 | 중간 — MSSQL Decimal 문자열 반환 문제 |
| 7 | `TraceIdMiddleware` (x-trace-id) | 없음 | 낮음 — 요청 추적 불가 |
| 8 | `HttpExceptionFilter` + Telegram 알림 | 없음 | 중간 — 5xx 에러 관리자 알림 없음 |
| 9 | `trust proxy` (X-Forwarded-For) | 없음 | 중간 — nginx 뒤 실제 IP 확인 불가 |
| 10 | `hpp` (HTTP Parameter Pollution) | 없음 | 낮음 |

**NestJS 보안 미들웨어 참조** (`server/src/main.ts:56-190`):
```typescript
app.use(helmet({ ... }));           // HTTP 보안 헤더
app.use(hpp());                      // 파라미터 오염 방지
app.use(compression());              // 응답 압축
app.use(cookieParser());             // 쿠키 파싱
app.useGlobalPipes(
  new TrimStringsPipe(),
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
);
```

---

## 4. Swagger / API 클라이언트 생성 파이프라인 단절

- **NestJS**: `/docs`에서 자동 생성 Swagger → `pnpm api:generate` → `client/src/api/generated/`
- **Go**: `docs/docs.go`의 Swagger 템플릿이 비어있음:
  ```go
  "paths": {}  // docs.go:17
  ```

**결과**: `pnpm api:generate` 실행 시 빈 API 클라이언트 생성 → 타입 안전성 상실

---

## 5. 스케줄 작업 누락

NestJS의 `@nestjs/schedule` 기반 크론잡 (4개):

| 크론잡 | 파일 | 주기 |
|--------|------|------|
| KYC 세션 만료 정리 | `kyc-cleanup.service.ts` | 매시간 |
| 바우처 만료 처리 | `voucher-expiry.service.ts` | 매일 01:00 |
| 선물 만료 처리 | `gift-expiry.service.ts` | 매일 02:00 |
| 감사 로그 아카이빙 | `audit-archive.service.ts` | 매일 자정 |

Go 서버에는 이러한 스케줄 작업이 **전혀 없음**.

---

## 6. Go 서버의 장점 (NestJS 대비)

| # | 장점 | 상세 |
|---|---|---|
| 1 | 단일 바이너리 배포 | 38MB `.exe` 1개 vs node_modules + Prisma + Node.js 런타임 (수백 MB) |
| 2 | 낮은 메모리 사용 | Go: 20-50MB vs Node.js: 150-512MB (PM2 한도) |
| 3 | 빠른 콜드 스타트 | <100ms vs NestJS 2-5초 |
| 4 | IP 블랙리스트 미들웨어 | 런타임 IP 차단 (`middleware.IPBlacklist()`, main.go:127) |
| 5 | 시스템 모니터링 | CPU/메모리/고루틴 실시간 메트릭 (`monitor.RecordRequest()`, main.go:134) |
| 6 | 데스크톱 관리 콘솔 | Wails GUI로 서버 직접 관리 (main.go:49-64) |
| 7 | 결제 시스템 | `POST /payments/initiate`, `GET /payments/verify` (main.go:234-238) |
| 8 | 구매 한도 확인 | `GET /cart/check-limit` (main.go:219, 결제 전 한도 초과 방지) |
| 9 | 환불 관리 | Admin 환불 CRUD 4개 엔드포인트 (main.go:377-383) |
| 10 | 추가 DB 모델 | Payment, Refund, PasswordResetToken, SmsVerification (models.go) |
| 11 | 감사 로그 미들웨어 | 모든 API 요청 자동 기록 (`middleware.AuditMiddleware`, main.go:129) |
| 12 | 콘텐츠 관리 확장 | FAQ, Event, Inquiry CRUD 완비 (main.go:194-304, 390-414) |

---

## 7. 라우트 매핑 상세 비교

### 일치하는 엔드포인트 (Go ↔ 클라이언트)

| 카테고리 | Go 경로 | 클라이언트 호출 | 상태 |
|----------|---------|-----------------|------|
| Auth | `POST /auth/login` | `authManualApi.login` | OK |
| Auth | `POST /auth/register` | `authManualApi.register` | OK |
| Auth | `POST /auth/refresh` | `authManualApi.refresh` | **응답 구조 불일치** (SHOWSTOPPER) |
| Auth | `POST /auth/logout` | `authManualApi.logout` | OK (구조 다를 수 있음) |
| Auth | `GET /auth/me` | `authManualApi.getMe` | OK |
| Auth | `PATCH /auth/password` | — | OK |
| Brands | `GET /brands` | generated client | OK |
| Products | `GET /products` | generated client | OK |
| Products | `GET /products/:id` | generated client | OK |
| Products | `GET /products/brand/:brand` | generated client | OK |
| Cart | `GET/POST/PATCH/DELETE /cart` | `cartApi.*` | OK |
| Orders | `POST /orders` | — | OK |
| Orders | `GET /orders/my` | — | OK |
| Orders | `GET /orders/:id` | — | OK |
| Notices | `GET /notices`, `/notices/active`, `/notices/:id` | `noticeApi.*` | OK |
| FAQs | `GET /faqs`, `/faqs/active`, `/faqs/categories` | `faqApi.*` | OK |
| Events | `GET /events`, `/events/active`, `/events/featured` | `eventApi.*` | OK |
| Inquiries | `GET/POST/PATCH/DELETE /inquiries` | `inquiryApi.*` | OK |
| Gifts | `POST /gifts/:id/claim` | `giftApi.claimGift` | OK |
| KYC | `POST /kyc/bank-verify/request` | — | OK |
| KYC | `POST /kyc/bank-verify/confirm` | — | OK |
| KYC | `GET /kyc/bank-account` | `SettingsTab.tsx:74` | OK (GET만) |
| Admin | 대부분의 CRUD 엔드포인트 | `adminApi.*` | OK |

### 불일치하는 엔드포인트

| 클라이언트 기대 경로 | Go 서버 경로 | 불일치 유형 |
|---------------------|-------------|------------|
| `GET /products/live-rates` | `GET /products/rates` | 경로명 차이 |
| `POST/GET /trade-ins/*` | `POST/GET /trade-in/*` | 복수/단수 |
| `GET /orders/my-gifts` | `GET /gifts/received` | 완전히 다른 경로 |
| `POST /auth/refresh` (쿠키) | `POST /auth/refresh` (body) | 인증 방식 차이 |

---

## 8. 대체를 위한 필수 작업 (우선순위순)

### P0: SHOWSTOPPER 해결
1. `auth_service.go` — JSON 태그 `accessToken` → `access_token` 변경
2. 쿠키 기반 refresh token 플로우 구현 (cookieParser, HttpOnly 쿠키 설정/읽기)
3. `/trade-in` → `/trade-ins` 라우트 변경
4. Gin에 정적 파일 서빙 추가 (`r.NoRoute()`로 SPA fallback)
5. Wails 의존성 제거, 헤드리스 모드 지원 (main.go 분리 — `cmd/api/` vs `cmd/gui/`)

### P1: 누락 엔드포인트 구현 (Tier A 13건)
6. 위 Tier A 표의 13개 엔드포인트 전부 구현 (클라이언트가 실제 호출)

### P2: 보안/미들웨어 보강
7. HTTP 보안 헤더 (helmet 동등 — Gin 미들웨어로 구현)
8. gzip 압축 (`gin.DefaultWriter` 또는 `gzip` 미들웨어)
9. 입력 검증 (Go struct tags `binding:"required"` + whitelist 로직)
10. 요청 추적 (x-trace-id 미들웨어)
11. trust proxy 설정

### P3: 인프라
12. Swagger 스펙 완성 (`swag init` 실행 또는 OpenAPI 3.0 수동 작성)
13. 크론잡 구현 (KYC/바우처/선물 만료, 감사 로그 아카이빙)
14. PM2 또는 Windows Service로 운영 가능하게 변경

### 예상 소요: 3-4주 (풀타임 1인 기준)

---

## 9. 검증 방법

현재 상태에서 Go 서버로 교체 테스트하려면:

1. `VITE_API_TARGET=http://localhost:{GO_PORT}`로 Go 서버 연결
2. `pnpm dev:client`로 프론트엔드 실행
3. 아래 시나리오 순서대로 테스트:
   - [ ] 로그인 → 토큰 저장 확인 (`access_token` 필드)
   - [ ] 페이지 새로고침 → 토큰 갱신 확인 (쿠키 기반 refresh)
   - [ ] 상품 목록 조회
   - [ ] 실시간 시세 대시보드 (`/products/live-rates`)
   - [ ] 장바구니 추가/삭제
   - [ ] 주문 생성 → 취소
   - [ ] 매입 신청 (`/trade-ins`)
   - [ ] KCB 본인인증 → 계좌 등록
   - [ ] 관리자 대시보드
   - [ ] 관리자 상품 목록/주문/매입 관리

**현재는 시나리오 1(로그인)에서 즉시 실패합니다.** (`accessToken` vs `access_token`)

---

## 10. 핵심 파일 참조

| 파일 | 역할 |
|---|---|
| `go-server/cmd/api/main.go` | 전체 라우트 정의 (453줄), Wails 부트스트랩 |
| `go-server/internal/app/services/auth_service.go` | 로그인 응답 구조체 (`LoginResponse`, JSON 태그 불일치) |
| `go-server/pkg/response/response.go` | 응답 포맷 (`Response` struct — NestJS `TransformInterceptor`와 유사하나 `timestamp` 없음) |
| `go-server/internal/domain/models.go` | 20개 GORM 모델 정의 (NestJS Prisma 스키마와 대응) |
| `go-server/docs/docs.go` | Swagger 스펙 — `"paths": {}` (비어있음) |
| `client/src/lib/axios.ts` | 클라이언트 API 계약 (응답 언래핑, 쿠키 기반 토큰 갱신) |
| `client/src/api/manual.ts` | 수동 API 호출 (50+ 엔드포인트 정의) |
| `client/src/store/useAuthStore.ts` | 인증 상태 관리 (`access_token` 참조) |
| `server/src/main.ts` | NestJS 부트스트랩 (보안 미들웨어 10종) |
| `server/src/app.module.ts` | NestJS 모듈 구성 (`ScheduleModule`, `ServeStaticModule`, `SeoModule` 등) |
