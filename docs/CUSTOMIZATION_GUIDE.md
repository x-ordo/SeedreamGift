# 씨드림기프트 사이트 커스터마이징 가이드

> 외주 납품 시 이 문서를 따라 브랜드 변경 및 사이트 세팅을 진행합니다.

## 1. 브랜드 색상 변경

### 1-1. 디자인 토큰 (`client/src/styles/tokens.css`)

```css
/* Primary — 메인 색상 (버튼, 링크, 강조) */
--color-primary: #3182f6;           /* ← 변경 */
--color-primary-hover: #2272eb;     /* ← primary보다 어둡게 */
--color-primary-active: #1b64da;    /* ← hover보다 어둡게 */
--color-primary-light: #e8f3ff;     /* ← primary 5% 투명도 배경 */

/* Point — CTA 골드 액센트 */
--color-point: #ffc342;             /* ← 변경 (선택) */

/* Colored Shadows — primary에 맞게 */
--shadow-primary: 0 8px 24px rgba(49, 130, 246, 0.2);  /* ← rgba 값 맞추기 */
```

### 1-2. daisyUI 테마 (`client/src/index.css`)

`@plugin "daisyui/theme"` 블록에서 oklch 값 동기화:

```css
--color-primary: oklch(0.62 0.214 259);   /* ← oklch 변환기 사용 */
--color-primary-content: oklch(1 0 0);    /* 흰색 (보통 유지) */
```

> oklch 변환: https://oklch.com 에서 hex → oklch 변환

### 1-3. 브랜드별 테마 색상 (상품권 브랜드)

```css
/* tokens.css 하단의 [data-brand="..."] 블록 */
[data-brand="SHINSEGAE"] {
  --brand-primary: #E4002B;
  --brand-gradient: linear-gradient(135deg, #E4002B 0%, #8B0000 100%);
}
```

---

## 2. 폰트 변경

### 2-1. 웹폰트 로드 (`client/src/styles/typography.css`)

```css
@font-face {
  font-family: 'YourFont';
  src: url('/fonts/YourFont-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}
```

### 2-2. 토큰 변경 (`client/src/styles/tokens.css`)

```css
--font-family-base: 'YourFont', -apple-system, BlinkMacSystemFont, sans-serif;
--default-font: 'YourFont', -apple-system, BlinkMacSystemFont, sans-serif;
```

> 한국어 서비스는 Pretendard Variable 권장 (무료, 한글 최적화)

---

## 3. 로고/브랜드 이미지

| 파일 | 용도 | 권장 사양 |
|------|------|----------|
| `client/public/logo.svg` | 헤더 로고 | SVG, 높이 32px |
| `client/public/favicon.ico` | 파비콘 | 32x32, 16x16 ICO |
| `client/public/og-image.png` | SNS 공유 이미지 | 1200x630 PNG |

---

## 4. 사업자 정보 변경

### `client/src/constants/site.ts`

```typescript
export const COMPANY_INFO = {
  name: '주식회사 OOO',
  owner: '홍길동',
  licenseNo: '000-00-00000',
  address: '서울시 강남구 ...',
};

export const SUPPORT_CONTACT = {
  phone: '02-0000-0000',
  kakao: '@회사명',
  email: 'support@company.com',
};
```

---

## 5. 취급 브랜드 변경

### 5-1. DB 관리
- Go 서버 관리 콘솔 또는 DB 직접 수정
- `brands` 테이블에서 브랜드 추가/삭제

### 5-2. 프론트엔드 매핑

`client/src/constants/brandTheme.ts`:
```typescript
export const BRAND_NAMES: Record<string, string> = {
  SHINSEGAE: '신세계',
  HYUNDAI: '현대',
  // 추가/삭제
};
```

`client/src/styles/tokens.css`에 `[data-brand="NEW_BRAND"]` 블록 추가.

---

## 6. 서버/배포 설정

### 6-1. Go 서버 환경변수 (`go-server/.env.production`)

```env
DATABASE_URL=sqlserver://user:pass@host:1433?database=dbname
JWT_SECRET=고유한_비밀키
ENCRYPTION_KEY=32바이트_AES_키
FRONTEND_URL=https://yourdomain.com
COOKIE_DOMAIN=.yourdomain.com
```

### 6-2. Nginx (`config/nginx/nginx.conf`)

- `server_name` → 고객 도메인
- SSL 인증서 경로
- upstream `goapi` → Go 서버 IP:Port

### 6-3. 프론트엔드 (`client/.env.production`)

```env
VITE_API_TARGET=http://api-server-ip:52201
```

---

## 7. 페이지 구조

```
client/src/
├── pages/           ← 각 페이지 독립
│   ├── CartPage.tsx
│   ├── CheckoutPage.tsx
│   ├── MyPage.tsx
│   └── Product/ProductListPage.tsx
├── components/
│   ├── home/        ← 홈 섹션들 (HeroSection, HowToGuide 등)
│   └── layout/      ← Header, Footer
└── styles/
    ├── tokens.css   ← 디자인 토큰 (색상, 간격, 반지름 등)
    └── presets/     ← 테마 프리셋
```

---

## 8. 디자인 시스템 토큰 참조

| 토큰 | 용도 | 기본값 |
|------|------|--------|
| `--color-primary` | 메인 색상 | #3182f6 (파란색) |
| `--color-point` | CTA 골드 | #ffc342 |
| `--color-success` | 성공/완료 | green-600 |
| `--color-error` | 오류/취소 | red-600 |
| `--radius-sm` ~ `--radius-xl` | 둥글기 | 10px ~ 28px |
| `--shadow-sm` ~ `--shadow-xl` | 그림자 | 4단계 |
| `--space-1` ~ `--space-12` | 간격 (8pt 그리드) | 4px ~ 48px |

---

## 9. 테마 프리셋 사용

`client/src/styles/presets/` 에 미리 준비된 색상 프리셋:

```css
/* index.css 또는 tokens.css 상단에 추가 */
@import './styles/presets/example-red.css';
```

프리셋은 `--color-primary` 계열만 오버라이드하므로 나머지 토큰은 그대로 유지됩니다.
