# 프론트엔드 (React + Vite) 재사용 가이드

> 백엔드 모듈 재사용 가이드(`docs/12_MODULE_REUSE_GUIDE.md`)에 이어, 프론트엔드 코드베이스의 재사용 가능 여부를 검증한 결과입니다.

---

## 1. 종합 점수: 8.7 / 10

| 영역 | 점수 | 판정 |
|------|:----:|------|
| **Design System** (atoms/molecules/layout) | 9.2/10 | 즉시 재사용 가능 |
| **Custom Hooks** | 8.5/10 | 대부분 재사용 가능 |
| **API Layer** (axios + OpenAPI) | 9.0/10 | 백엔드 독립적 |
| **Build Config** (Vite + TS) | 9.0/10 | 표준 설정 |
| **Contexts** (Toast, Modal) | 8.5/10 | 인프라 수준 재사용 |
| **Routing** | 7.5/10 | 하드코딩된 라우트 |
| **Constants** | 5.0/10 | 비즈니스 로직 혼재 |
| **Pages/Components** | 6.0/10 | 프로젝트 종속적 |

---

## 2. 상세 분석

### 2.1 Design System — 9.2/10

**구조**: Atomic Design (17 atoms + 18 molecules + 7 animations + 5 layouts)

**강점**:
- 모든 컴포넌트가 비즈니스 로직 **제로** — 순수 프레젠테이션
- Native HTML 속성 확장 (`extends ButtonHTMLAttributes`, `HTMLDivElement`)
- CSS Variables 사용 (하드코딩 없음)
- CSS Modules로 스타일 충돌 방지
- WCAG 2.1 AA 접근성 준수 (focus trap, aria, prefers-reduced-motion)
- Compound 컴포넌트 패턴 (TextField.Clearable, Overlay.Processing)

**주요 컴포넌트 재사용성**:

| 컴포넌트 | API 의존 | Context 의존 | 비즈니스 로직 | 점수 |
|----------|:--------:|:----------:|:----------:|:----:|
| Button | - | - | - | 9/10 |
| Card | - | - | - | 9/10 |
| TextField | - | - | - | 9/10 |
| Modal | - | - | - | 9/10 |
| Stack/PageContainer | - | - | - | 10/10 |
| Accordion | - | - | - | 9/10 |

**결론**: `client/src/design-system/` 전체를 별도 패키지로 즉시 추출 가능

### 2.2 Custom Hooks — 8.5/10

| Hook | 분류 | 외부 의존성 |
|------|------|-----------|
| `useAsync` | REUSABLE | 없음 |
| `useDebounce` | REUSABLE | 없음 |
| `useCountUp` | REUSABLE | 없음 |
| `useForm` | REUSABLE | 없음 |
| `useStepForm` | REUSABLE | 없음 |
| `useMediaQuery` | REUSABLE | 없음 |
| `useCopyToClipboard` | REUSABLE | ToastContext 선택적 사용 (Provider 없이 동작) |
| `useCopyMultiple` | REUSABLE | ToastContext 선택적 사용 (Provider 없이 동작) |
| `useBrands` | PROJECT-SPECIFIC | axiosInstance, types |
| `useCart` | PROJECT-SPECIFIC | CartStore, Auth, Toast, Router |

### 2.3 API Layer — 9.0/10

**아키텍처**: 2계층 추상화
1. `api/generated/` — OpenAPI Generator 자동 생성 (28+ API 클래스)
2. `api/manual.ts` — Swagger 미지원 엔드포인트용 수동 래퍼

**강점**:
- `lib/axios.ts`가 환경변수(`VITE_API_URL`) 기반 — 백엔드 교체 용이
- Bearer 토큰 자동 주입 (Zustand에서)
- 401 리프레시 + 동시 요청 큐잉 패턴 — 재사용 가치 높음
- `api/index.ts` 배럴 export — 컴포넌트가 generated/ 직접 참조 안 함

### 2.4 Build Config — 9.0/10

- `vite.config.ts`: 표준 설정, `@` 경로 alias, 라이브러리별 코드 스플리팅
- `tsconfig.app.json`: strict 모드, ES2022 타겟, bundler 모듈 해석
- proxy target: `VITE_API_TARGET` 환경변수로 파라미터화
- 의존성: react@18, react-router@6, tanstack-query@4, zustand@4, axios@1 (업계 표준)

### 2.5 Contexts — 8.5/10

| Context | 분류 | 설명 |
|---------|------|------|
| `ToastContext` | REUSABLE | 스택 관리, auto-dismiss, 접근성, haptic |
| `ModalContext` | REUSABLE | Focus trap, ESC, aria-modal |
| `AuthContext` | PROJECT-SPECIFIC | useAuthStore + API 종속 |

### 2.6 Utils — 7.5/10

| Utility | 분류 | 비고 |
|---------|------|------|
| `a11yUtils.ts` | REUSABLE | 포커스 트랩, 키보드 핸들링, 스크린리더 |
| `errorUtils.ts` | REUSABLE | Axios/NestJS 에러 파싱 |
| `validationRules.ts` | REUSABLE | 이메일, 전화번호, 비밀번호 검증 |
| `dateUtils.ts` | REUSABLE | 날짜 포맷 (로케일 파라미터화 필요) |
| `imageHandlers.ts` | REUSABLE | 이미지 에러 폴백 |
| `priceUtils.ts` | ADAPTABLE | locale/currency 옵션 파라미터화 완료 |
| `hapticUtils.ts` | ADAPTABLE | basePath 옵션 파라미터화 완료 |

### 2.7 Constants — 5.0/10

| 파일 | 분류 |
|------|------|
| `a11y.ts` | REUSABLE |
| `storage.ts` | ADAPTABLE |
| `designTokens.ts` | PROJECT-SPECIFIC |
| `statusMaps.ts` | PROJECT-SPECIFIC |
| `voucherTypes.ts` | PROJECT-SPECIFIC |
| `formConfig.ts` | PROJECT-SPECIFIC |
| `messages.ts` | PROJECT-SPECIFIC |
| `brandTheme.ts` | PROJECT-SPECIFIC |

> `index.ts` 배럴로 관리되어 디렉토리 분리 없이 문서에서만 분류합니다.
>
> `brandTheme.ts`는 원래 `contexts/BrandThemeContext.tsx`에 있었으나, `createContext`를 사용하지 않는 순수 상수 파일이므로 `constants/`로 이동함.

---

## 3. 추출 가능한 패키지 구조

### @wow-gift/design-system (즉시 추출 가능)

```
├── atoms/       (17개: Button, Card, TextField, Switch, Checkbox, Radio, ...)
├── molecules/   (18개: Modal, Accordion, FormField, Skeleton, TabNav, ...)
├── animations/  (7개: Aurora, BlurText, CountUp, FadeIn, Confetti, ...)
├── layout/      (5개: Stack, Inline, PageContainer, TwoColumn, Center)
├── tokens/      (CSS variables from index.css)
└── index.ts     (배럴 export)
```

- **의존성**: `react`, `react-dom`, `motion`
- **비즈니스 로직**: 없음

### @wow-gift/client-utils (즉시 추출 가능)

```
├── hooks/       (6개: useAsync, useDebounce, useForm, useStepForm, useCountUp, useMediaQuery)
├── contexts/    (2개: ToastContext, ModalContext)
├── utils/       (5개: a11yUtils, errorUtils, validationRules, dateUtils, imageHandlers)
└── constants/   (1개: a11y.ts)
```

- **의존성**: `react`
- **비즈니스 로직**: 없음

### @wow-gift/api-core (추출 가능, 약간의 일반화 필요)

```
├── axios.ts     (인터셉터, 토큰 주입, 리프레시 큐잉)
├── types.ts     (공통 API 응답 타입)
└── errorUtils.ts
```

---

## 4. 적용된 개선 사항

### 4.1 priceUtils 로케일 파라미터화

`client/src/utils/priceUtils.ts`

- `formatPrice()` — `locale`, `currencyUnit` 옵션 파라미터 추가 (기본값 `ko-KR`, `원`)
- `formatPriceShort()` — `locale`, `currencyUnit`, `tenThousandSuffix` 옵션 파라미터 추가
- 하위 호환: `formatPrice(100000, false)` 기존 호출 그대로 동작

```typescript
// 기존 (변경 없이 동작)
formatPrice(100000)         // "100,000원"
formatPrice(100000, false)  // "100,000"

// 새 기능
formatPrice(100000, { locale: 'en-US', currencyUnit: '$' })  // "100,000$"
```

### 4.2 hapticUtils 오디오 경로 상수화

`client/src/utils/hapticUtils.ts`

- 하드코딩 `/audio/${type}.mp3` → `DEFAULT_AUDIO_PATHS` 상수 맵으로 추출
- `basePath` 옵션 파라미터 추가
- 하위 호환: `playSound('success', 0.3)` 기존 호출 그대로 동작

```typescript
// 기존 (변경 없이 동작)
playSound('success', 0.3)

// 새 기능
playSound('success', { volume: 0.3, basePath: '/custom-audio' })
```

### 4.3 useCopyToClipboard Toast 강결합 해소

`client/src/hooks/useCopyToClipboard.ts`

- **Before**: `useToast()` 직접 호출 → ToastProvider 없으면 throw. `toastFn` 주입해도 Provider 필수라 설계 모순.
- **After**: `useContext(ToastContext)` 직접 사용 (null 허용). Provider 없으면 toast 미표시, 에러 없음.
- `toastFn ?? toastContext?.showToast` fallback 체인으로 유연성 확보
- 분류: ADAPTABLE → **REUSABLE** 상향

```typescript
// ToastProvider 내부 (기존처럼 동작)
const { copy } = useCopyToClipboard();

// ToastProvider 없이 (에러 없이 동작, toast만 미표시)
const { copy } = useCopyToClipboard();

// 외부 토스트 함수 주입 (Provider 불필요)
const { copy } = useCopyToClipboard({
  toastFn: ({ message, type }) => console.log(type, message),
});
```

### 4.4 priceUtils Breakdown 함수 locale 전파

`client/src/utils/priceUtils.ts`

- `getPriceBreakdown()`, `getTradeInBreakdown()`, `getCartTotalBreakdown()`, `formatPriceRange()` — `formatOptions?: FormatPriceOptions` 파라미터 추가
- 내부 `formatPrice()` 호출에 옵션을 전달하여 locale/currency 설정이 Breakdown 결과까지 일관 적용
- 하위 호환: 기존 호출부(파라미터 없이)는 기본값(`ko-KR`, `원`)으로 동작

```typescript
// 기존 (변경 없이 동작)
getPriceBreakdown(100000, 5)  // formattedSale: "95,000원"

// 새 기능 (locale 전파)
getPriceBreakdown(100000, 5, { locale: 'en-US', currencyUnit: '$' })
// formattedSale: "95,000$"
```

### 4.5 BrandThemeContext 위치 이동

- **Before**: `client/src/contexts/BrandThemeContext.tsx` — `createContext` 미사용이지만 `contexts/`에 위치
- **After**: `client/src/constants/brandTheme.ts` — 순수 상수 파일로 `constants/`에 이동
- `constants/index.ts`에서 re-export (`export * from './brandTheme'`)
- import 경로 변경: `@/contexts/BrandThemeContext` → `@/constants`

### 4.6 Design System export 패턴

`client/src/design-system/index.ts`

Animation 모듈(Aurora, BlurText 등)이 `default export`를 사용하므로 `export *`로 re-export 불가. 따라서 명시적 `export { ComponentName } from './path'` 패턴을 사용한다. 이는 의도적 설계이며 일관성 위반이 아님.

```typescript
// atoms — named export만 사용 → export * 가능
export * from './atoms/Button';

// animations — default export 사용 → 명시적 re-export 필수
export { default as Aurora } from './molecules/Aurora';
```

### 4.7 Vite Config 프록시 환경변수화

`client/vite.config.ts`

- 하드코딩 `http://localhost:5137` → `process.env.VITE_API_TARGET || 'http://localhost:5137'`

---

## 5. 재사용 체크리스트

새 프로젝트에서 이 코드베이스를 재사용할 때:

### 즉시 복사 가능 (수정 없음)

- [ ] `client/src/design-system/` 전체
- [ ] `client/src/hooks/useAsync.ts`
- [ ] `client/src/hooks/useDebounce.ts`
- [ ] `client/src/hooks/useForm.ts`
- [ ] `client/src/hooks/useStepForm.ts`
- [ ] `client/src/hooks/useCountUp.ts`
- [ ] `client/src/hooks/useMediaQuery.ts`
- [ ] `client/src/contexts/ToastContext.tsx` + `ToastContext.css`
- [ ] `client/src/contexts/ModalContext.tsx`
- [ ] `client/src/utils/a11yUtils.ts`
- [ ] `client/src/utils/errorUtils.ts`
- [ ] `client/src/utils/validationRules.ts`
- [ ] `client/src/utils/dateUtils.ts`
- [ ] `client/src/utils/imageHandlers.ts`
- [ ] `client/src/constants/a11y.ts`
- [ ] `client/src/hooks/useCopyToClipboard.ts` (ToastProvider 없이 동작)

### 옵션 조정 후 사용

- [ ] `client/src/utils/priceUtils.ts` — `locale`, `currencyUnit` 변경
- [ ] `client/src/utils/hapticUtils.ts` — `basePath` 변경
- [ ] `client/vite.config.ts` — `VITE_API_TARGET` 환경변수 설정

### 프로젝트별 재작성 필요

- [ ] `client/src/pages/` — 비즈니스 페이지
- [ ] `client/src/components/` — 비즈니스 컴포넌트
- [ ] `client/src/constants/statusMaps.ts` — 도메인 상태 코드
- [ ] `client/src/constants/voucherTypes.ts` — 도메인 데이터
- [ ] `client/src/store/` — 상태 관리 (구조는 참고 가능)
- [ ] `client/src/api/generated/` — 새 백엔드 Swagger에서 재생성
