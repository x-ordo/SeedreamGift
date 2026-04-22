> **[Legacy] 레거시 참조용** — 이 문서는 구 W Gift(wowgift.co.kr) 시절 작성되었으며 역사 보존 목적으로만 유지됩니다. 현재 시스템은 Seedream Gift(seedreamgift.com)입니다.

# 07. Design System

## 1. 디자인 철학: Swift Trust (신속한 신뢰)

> **신뢰는 화려한 그래픽이 아니라 "끊김 없는 속도"에서 나옵니다.**

Toss Design System(TDS)의 '간결함'과 '속도감'을 벤치마킹하여, 사용자가 고민 없이 즉각적으로 행동하게 만드는 데 초점을 맞춥니다.

### 1.1 핵심 원칙

| 원칙 | 설명 | 적용 |
|------|------|------|
| **One Screen, One Action** | 한 화면에서 하나의 핵심 액션에만 집중 | 결제 화면에는 결제 버튼만 강조 |
| **Invisible Tech** | 복잡한 기술은 숨기고 결과만 전달 | "처리 중" 대신 Lottie 애니메이션 |
| **Toss-like Clarity** | 텍스트 최소화, 큰 폰트와 직관적 아이콘 | 설명 없이도 사용법 파악 가능 |

### 1.2 The 60-Second Loop

사용자의 구매 여정을 **60초 이내**로 단축하는 설계

```
로그인 (5초) → 상품 선택 (15초) → 결제 (30초) → PIN 확인 (10초)
     ↓              ↓               ↓              ↓
  생체인증      큐레이션 카드     간편결제       즉시 노출
```

---

## 2. Visual Foundation

### 2.1 Color: "Vivid Trust"

Toss 스타일의 고채도 블루를 핵심 컬러로 채택

#### Primary Colors
```css
/* Wow Blue - 신뢰와 활기 */
--color-primary: #3182F6;
--color-primary-hover: #1B64DA;
--color-primary-active: #0F52BA;
--color-primary-light: rgba(49, 130, 246, 0.1);
```

#### Point Colors (수익 관련 액션)
```css
/* Action Yellow - 구매, 매입 버튼 */
--color-point: #FFBB00;
--color-point-hover: #E5A800;
--color-point-active: #CC9600;
--color-point-light: rgba(255, 187, 0, 0.15);
```

#### Status Colors
```css
/* Vivid Green - PIN 발송 완료, 입금 완료 */
--color-success: #2ECC71;
--color-success-light: rgba(46, 204, 113, 0.15);

/* Warning - 주의 필요 상태 */
--color-warning: #FF9500;
--color-warning-light: rgba(255, 149, 0, 0.15);

/* Error - 오류, 실패 */
--color-error: #E74C3C;
--color-error-light: rgba(231, 76, 60, 0.15);

/* Info - 정보 안내 */
--color-info: #17A2B8;
--color-info-light: rgba(23, 162, 184, 0.15);
```

#### Background (TDS 스타일)
```css
/* 연한 회색 배경으로 컴포넌트 시인성 확보 */
--color-bg-primary: #F2F4F6;
--color-bg-secondary: #FFFFFF;
--color-bg-elevated: #FFFFFF;
```

#### Neutral Scale
```css
--color-neutral-50: #F9FAFB;
--color-neutral-100: #F2F4F6;  /* TDS 배경 */
--color-neutral-200: #E5E8EB;
--color-neutral-300: #D1D6DB;
--color-neutral-400: #B0B8C1;
--color-neutral-500: #8B95A1;
--color-neutral-600: #6B7684;
--color-neutral-700: #4E5968;
--color-neutral-800: #333D4B;
--color-neutral-900: #191F28;
```

### 2.2 Typography: "Bold & Readable"

#### Font Family
```css
/* 시스템 폰트 활용으로 로딩 속도 최적화 */
--font-family-base: 'Pretendard', -apple-system, 'Apple SD Gothic Neo',
                    'Noto Sans KR', sans-serif;

/* 숫자/금액용 - Tabular Figures 적용 */
--font-family-numeric: 'Pretendard', 'SF Mono', monospace;
```

#### Font Scale
| Token | Size | Weight | Use Case |
|-------|------|--------|----------|
| `--text-caption` | 12px | 400 | 메타 정보, 라벨 |
| `--text-body` | 14px | 400 | 본문 |
| `--text-body-lg` | 16px | 500 | 기본 정보 |
| `--text-title` | 18px | 600 | 카드 제목 |
| `--text-headline` | 20px | 700 | 금액 강조 |
| `--text-display` | 24px | 700 | 페이지 제목 |
| `--text-hero` | 32px | 800 | PIN 번호 표시 |

#### Font Weight
```css
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
--font-weight-extrabold: 800;
```

### 2.3 Spacing (8pt Grid)

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### 2.4 Shadows

```css
/* TDS 스타일 - 부드럽고 깊은 그림자 */
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 28px rgba(0, 0, 0, 0.12);
--shadow-xl: 0 16px 40px rgba(0, 0, 0, 0.16);

/* Colored Shadows */
--shadow-primary: 0 4px 16px rgba(49, 130, 246, 0.3);
--shadow-point: 0 4px 16px rgba(255, 187, 0, 0.3);
--shadow-success: 0 4px 16px rgba(46, 204, 113, 0.3);
```

### 2.5 Border Radius

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-2xl: 24px;
--radius-full: 9999px;
```

### 2.6 Transitions

```css
/* 빠르고 자연스러운 전환 */
--transition-fast: 120ms ease-out;
--transition-normal: 200ms ease-out;
--transition-slow: 300ms ease-out;
--transition-spring: 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

---

## 3. Core Components

### 3.1 Adaptive Purchase Card (적응형 구매 카드)

**목적**: 상세 페이지 없이 메인에서 바로 구매 가능

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐   │
│  │      [상품권 이미지]         │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  신세계                             │
│  ──────────────────────────────    │
│  10만원권                           │
│                                     │
│  ₩97,500  ───  ₩100,000  -2.5%    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │     🛒 바로 구매하기         │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**스타일:**
```css
.purchase-card {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-md);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  cursor: pointer;
}

.purchase-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.purchase-card:active {
  transform: translateY(-2px);
}

.purchase-card__price {
  font-family: var(--font-family-numeric);
  font-size: var(--text-headline);
  font-weight: var(--font-weight-bold);
  font-feature-settings: 'tnum' 1; /* Tabular Figures */
}

.purchase-card__discount {
  color: var(--color-error);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-bold);
}
```

### 3.2 Sticky Action Bar (하단 고정 버튼)

**목적**: 모바일 화면 하단에 항상 노출, 동적으로 변화

**상태별 변화:**
| 상태 | 버튼 텍스트 | 색상 |
|------|------------|------|
| 비로그인 | 로그인하고 시작하기 | Primary |
| 상품 선택됨 | ₩97,500 결제하기 | Point (Yellow) |
| 매입 신청 | 내 상품권 팔기 | Success (Green) |

```css
.sticky-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
  z-index: 100;
}

.sticky-action-bar__btn {
  width: 100%;
  height: 56px;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-body-lg);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sticky-action-bar__btn--primary {
  background: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-primary);
}

.sticky-action-bar__btn--point {
  background: var(--color-point);
  color: var(--color-neutral-900);
  box-shadow: var(--shadow-point);
}

.sticky-action-bar__btn--success {
  background: var(--color-success);
  color: white;
  box-shadow: var(--shadow-success);
}

/* iOS Safe Area */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .sticky-action-bar {
    padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
  }
}
```

### 3.3 Fast PIN Display (즉시 확인 영역)

**목적**: 결제 완료 즉시 PIN을 가장 크게 표시

```
┌─────────────────────────────────────┐
│                                     │
│          ✓ 결제 완료                │
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │   1234-5678-9012-3456      │   │
│  │                             │   │
│  │         [복사하기]          │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  신세계 상품권 10만원권              │
│  사용처: 신세계백화점, 이마트 전 지점  │
│                                     │
│  ─────────────────────────────     │
│                                     │
│       [홈으로]    [더 구매하기]      │
│                                     │
└─────────────────────────────────────┘
```

**스타일:**
```css
.pin-display {
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-8) var(--space-6);
  text-align: center;
}

.pin-display__number {
  font-family: var(--font-family-numeric);
  font-size: var(--text-hero);
  font-weight: var(--font-weight-extrabold);
  letter-spacing: 2px;
  color: var(--color-neutral-900);
  margin-bottom: var(--space-4);
  font-feature-settings: 'tnum' 1;
}

.pin-display__copy-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pin-display__copy-btn:hover {
  background: var(--color-primary-hover);
  transform: scale(1.02);
}

.pin-display__copy-btn.copied {
  background: var(--color-success);
}
```

### 3.4 Button

#### Variants
| Variant | 배경 | 텍스트 | Use Case |
|---------|------|--------|----------|
| `primary` | Wow Blue | White | 일반 CTA |
| `point` | Action Yellow | Dark | 구매/결제 (수익 관련) |
| `success` | Vivid Green | White | 완료 확인 |
| `secondary` | White | Neutral-700 | 보조 액션 |
| `ghost` | Transparent | Primary | 텍스트 버튼 |

#### Sizes
| Size | Height | Font | Use Case |
|------|--------|------|----------|
| `sm` | 36px | 14px | 인라인 액션 |
| `md` | 44px | 15px | 기본 |
| `lg` | 52px | 16px | 강조 |
| `xl` | 56px | 17px | Sticky CTA |

### 3.5 Skeleton Screen

데이터 로딩 중 '빠르게 반응 중'이라는 느낌 유지

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-neutral-200) 0%,
    var(--color-neutral-100) 50%,
    var(--color-neutral-200) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 3.6 Switch (토글 스위치)

설정 화면에서 On/Off 상태를 전환하는 컴포넌트

**파일 위치**: `client/src/design-system/atoms/Switch/`

```tsx
import { Switch } from '@/design-system';

<Switch
  checked={notificationsEnabled}
  onChange={setNotificationsEnabled}
  label="알림 받기"
  disabled={false}
/>
```

**스타일:**
```css
.switch-track {
  width: 44px;
  height: 24px;
  background: var(--color-neutral-200);
  border-radius: 12px;
  transition: background-color var(--transition-fast);
}

.switch-track.on {
  background: var(--color-primary);
}

.switch-thumb {
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.switch-track.on .switch-thumb {
  transform: translateX(20px);
}
```

**접근성:**
- `role="switch"` + `aria-checked`
- Space/Enter 키로 토글
- 포커스 링 스타일 적용
- 비활성화 시 `aria-disabled`

### 3.7 Accordion (아코디언)

FAQ, 설정 그룹 등에서 콘텐츠를 펼치고 접을 수 있는 컴포넌트

**파일 위치**: `client/src/design-system/molecules/Accordion/`

**Option A: HTML5 details/summary (권장)**
```tsx
import { Accordion, AccordionItem } from '@/design-system';

<Accordion>
  <AccordionItem title="결제는 어떻게 하나요?" defaultOpen>
    계좌이체, 카드 결제가 가능합니다.
  </AccordionItem>
  <AccordionItem title="환불 정책은 어떻게 되나요?">
    미사용 상품권은 7일 이내 환불 가능합니다.
  </AccordionItem>
</Accordion>
```

**Option B: ARIA 기반 (커스텀 애니메이션)**
```tsx
import { AccordionItemControlled } from '@/design-system';

<AccordionItemControlled
  title="섹션 제목"
  isOpen={isOpen}
  onToggle={setIsOpen}
  id="faq-1"
>
  내용
</AccordionItemControlled>
```

**스타일:**
```css
.accordion-item {
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  background: white;
  overflow: hidden;
}

.accordion-trigger {
  width: 100%;
  padding: var(--space-4);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  background: none;
  border: none;
  cursor: pointer;
}

.accordion-trigger:hover {
  background: var(--color-neutral-50);
}

.accordion-panel {
  padding: 0 var(--space-4) var(--space-4);
  color: var(--color-neutral-600);
  border-top: 1px solid var(--color-neutral-200);
}

.accordion-icon {
  transition: transform var(--transition-normal);
}

[aria-expanded="true"] .accordion-icon {
  transform: rotate(180deg);
}
```

**접근성:**
- HTML5 `<details>/<summary>` 사용 시 브라우저 네이티브 지원
- ARIA 버전: `aria-expanded`, `aria-controls`, `role="region"`, `aria-labelledby`
- Enter/Space 키로 펼치기/접기

---

## 4. Interaction & Feedback

### 4.1 Micro-feedback (Haptic + Visual)

버튼 클릭 시 즉각적인 피드백으로 신뢰 형성

```javascript
// 햅틱 진동
const haptic = {
  light: () => navigator.vibrate?.(10),
  medium: () => navigator.vibrate?.(20),
  success: () => navigator.vibrate?.([10, 50, 20]),
  error: () => navigator.vibrate?.([50, 30, 50]),
};

// 버튼 클릭 시
const handleClick = () => {
  haptic.light();
  // 시각적 피드백 (scale down)
};
```

```css
.btn {
  transition: all var(--transition-fast);
}

.btn:active {
  transform: scale(0.97);
}
```

### 4.2 Lottie Animation

결제 중/PIN 발송 대기 시 체감 대기 시간 감소

**사용 위치:**
- 결제 처리 중 (3-5초)
- PIN 발송 중 (1-2초)
- 본인인증 처리 중

```tsx
import Lottie from 'lottie-react';
import loadingAnimation from './animations/loading.json';

<Lottie
  animationData={loadingAnimation}
  loop
  style={{ width: 120, height: 120 }}
/>
```

### 4.3 Toast Notification

```css
.toast {
  position: fixed;
  bottom: calc(var(--space-6) + 72px); /* Sticky bar 위 */
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: var(--color-neutral-800);
  color: white;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-medium);
  opacity: 0;
  transition: all var(--transition-spring);
}

.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.toast.success {
  background: var(--color-success);
}
```

---

## 5. UX Writing Guide

### 5.1 용어 변환표

| 공급자 용어 | 사용자 용어 |
|------------|------------|
| KYC | 본인 확인 |
| Trade-In | 내 상품권 팔기 |
| Order | 구매 내역 |
| Voucher Code | 상품권 번호 |
| Transaction | 거래 내역 |
| Verification | 확인 |

### 5.2 버튼/CTA 문구

| 기존 | 개선 |
|------|------|
| 확인 | 완료 |
| 제출 | 신청하기 |
| 다음 | 계속하기 |
| 결제하기 | ₩97,500 결제하기 |
| 취소 | 뒤로 |

### 5.3 톤 & 매너

- **짧게**: 핵심만 (3-5단어)
- **친근하게**: 경어체, 이모지 적절히 사용
- **결과 중심**: "~되었습니다" → "완료!"

```
❌ "결제가 정상적으로 완료되었습니다.
    주문 내역은 마이페이지에서 확인하실 수 있습니다."

✅ "결제 완료! 👇 PIN 번호를 확인하세요"
```

### 5.4 KYC 안내 문구

```
"한 번만 인증하면 평생 광속 구매 가능해요 ⚡"
```

---

## 6. Layout Patterns

### 6.1 Mobile-First Grid

```css
.product-grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(2, 1fr);
}

@media (min-width: 768px) {
  .product-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .product-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-6);
  }
}
```

### 6.2 Page Layout (TDS 스타일)

```css
.page {
  min-height: 100vh;
  background: var(--color-bg-primary);
  padding-bottom: 80px; /* Sticky bar 공간 */
}

.page__header {
  background: var(--color-bg-secondary);
  padding: var(--space-4) var(--space-5);
  position: sticky;
  top: 0;
  z-index: 50;
}

.page__content {
  padding: var(--space-5);
  max-width: 640px; /* 모바일 최적화 너비 */
  margin: 0 auto;
}

@media (min-width: 1024px) {
  .page__content {
    max-width: 1200px;
  }
}
```

---

## 7. Tailwind CSS Config

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3182F6',
          hover: '#1B64DA',
          active: '#0F52BA',
          light: 'rgba(49, 130, 246, 0.1)',
        },
        point: {
          DEFAULT: '#FFBB00',
          hover: '#E5A800',
          light: 'rgba(255, 187, 0, 0.15)',
        },
        success: {
          DEFAULT: '#2ECC71',
          light: 'rgba(46, 204, 113, 0.15)',
        },
        warning: {
          DEFAULT: '#F1C40F',
          light: 'rgba(241, 196, 15, 0.15)',
        },
        error: {
          DEFAULT: '#E74C3C',
          light: 'rgba(231, 76, 60, 0.15)',
        },
        neutral: {
          50: '#F9FAFB',
          100: '#F2F4F6',
          200: '#E5E8EB',
          300: '#D1D6DB',
          400: '#B0B8C1',
          500: '#8B95A1',
          600: '#6B7684',
          700: '#4E5968',
          800: '#333D4B',
          900: '#191F28',
        },
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'Apple SD Gothic Neo', 'sans-serif'],
        numeric: ['Pretendard', 'SF Mono', 'monospace'],
      },
      boxShadow: {
        'primary': '0 4px 16px rgba(49, 130, 246, 0.3)',
        'point': '0 4px 16px rgba(255, 187, 0, 0.3)',
        'success': '0 4px 16px rgba(46, 204, 113, 0.3)',
      },
    },
  },
}
```

---

## 8. Implementation Checklist

### 완료된 구현 ✅
- [x] Adaptive Purchase Card 메인 페이지 적용
- [x] Sticky Action Bar (BottomNav)
- [x] Skeleton Screen 모든 로딩 상태
- [x] Lottie Animation 결제/인증 처리 중
- [x] Toast Notification 시스템
- [x] Modal 컴포넌트 (포커스 트랩)
- [x] Switch 컴포넌트 (접근성)
- [x] Accordion 컴포넌트 (HTML5 details)
- [x] TypeScript 디자인 토큰 (`designTokens.ts`)
- [x] 접근성 상수/유틸리티 (`a11y.ts`, `a11yUtils.ts`)
- [x] 번들 최적화 (manualChunks, 미사용 라이브러리 제거)

### 미구현 / 향후 개선
- [ ] Fast PIN Display 결제 완료 화면 개선
- [ ] 생체 인증 / 자동 로그인 유도
- [ ] 간편결제 (토스페이, 카카오페이) 연동
- [ ] 카카오/PASS 간편인증 연동
- [ ] 버튼 클릭 햅틱 피드백
- [ ] Bootstrap Icons → react-icons 마이그레이션 (선택)

---

## 9. Accessibility (접근성)

### 9.1 목표

WCAG 2.1 AA 수준 준수를 목표로 합니다.

### 9.2 접근성 디자인 토큰

#### Focus Ring (포커스 링)
```css
/* 키보드 포커스 시 명확한 시각적 피드백 */
--a11y-focus-ring-color: var(--color-primary);
--a11y-focus-ring-width: 3px;
--a11y-focus-ring-offset: 2px;
--a11y-focus-ring-shadow: 0 0 0 3px var(--color-primary-light), 0 0 0 5px var(--color-primary);
```

#### Touch Target (터치 영역)
```css
/* WCAG 2.5.5 권장 크기 */
--a11y-touch-target-min: 44px;      /* 최소 크기 */
--a11y-touch-target-recommended: 48px;  /* 권장 크기 */
```

#### Reduced Motion (동작 감소)
```css
/* 사용자 설정 존중 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 9.3 컴포넌트별 접근성 패턴

#### Button
```tsx
<Button
  type="button"           // 항상 명시
  aria-label="액션 설명"   // 아이콘 버튼 필수
  disabled={false}
>
  버튼 텍스트
</Button>
```

#### Icon (장식용)
```tsx
<i className="bi bi-cart" aria-hidden="true"></i>
```

#### Icon (의미 있는)
```tsx
<i className="bi bi-check" role="img" aria-label="완료"></i>
```

#### Card (클릭 가능)
```tsx
<Card
  onClick={onClick}
  role="button"
  tabIndex={0}
  aria-label="카드 설명"
/>
```

#### ProductCard (중첩 방지)
```tsx
<article className="product-card">
  {/* 클릭 영역과 버튼 분리 */}
  <div
    onClick={onNavigate}
    role="link"
    tabIndex={0}
    aria-label="상품명 상세 보기"
  >
    <img alt="상품 이미지 설명" />
    <div className="product-info">...</div>
  </div>

  {/* 별도 액션 영역 */}
  <Button onClick={onAddToCart}>장바구니</Button>
</article>
```

#### Tabs
```tsx
<nav role="tablist" aria-label="탭 메뉴">
  <button
    role="tab"
    aria-selected={isActive}
    aria-controls="panel-id"
    tabIndex={isActive ? 0 : -1}
  >
    탭 제목
  </button>
</nav>

<div
  role="tabpanel"
  id="panel-id"
  aria-labelledby="tab-id"
  hidden={!isActive}
>
  탭 내용
</div>
```

#### Modal
```tsx
<div
  ref={modalRef}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">제목</h2>
  <p id="modal-description">설명</p>
</div>
```

**Modal 접근성 필수 구현:**
- `aria-labelledby`: 제목 ID 연결
- 포커스 트랩: 모달 내부에서만 Tab 순환
- 포커스 복원: 닫을 때 트리거 요소로 복원
- `inert`: 배경 콘텐츠 비활성화
- ESC 키로 닫기

#### Switch (토글)
```tsx
import { Switch } from '@/design-system';

<Switch
  checked={isEnabled}
  onChange={setIsEnabled}
  label="알림 받기"
  disabled={false}
/>
```

**Switch 접근성:**
- `role="switch"` + `aria-checked`
- Space/Enter 키로 토글
- 레이블 연결 (htmlFor/id)

#### Accordion (아코디언)
```tsx
import { Accordion, AccordionItem } from '@/design-system';

// HTML5 details/summary 기반 (권장)
<Accordion>
  <AccordionItem title="자주 묻는 질문 1" defaultOpen>
    답변 내용입니다.
  </AccordionItem>
  <AccordionItem title="자주 묻는 질문 2">
    답변 내용입니다.
  </AccordionItem>
</Accordion>

// ARIA 기반 제어 컴포넌트
<AccordionItemControlled
  title="섹션 제목"
  isOpen={isOpen}
  onToggle={setIsOpen}
>
  내용
</AccordionItemControlled>
```

**Accordion 접근성:**
- HTML5 `<details>/<summary>` 사용 시 네이티브 접근성 지원
- ARIA 버전: `aria-expanded`, `aria-controls`, `role="region"`
- Enter/Space 키로 펼치기/접기

#### Loading/Processing
```tsx
<div
  role="status"
  aria-live="polite"
  aria-busy="true"
  aria-label="처리 중"
>
  <Spinner aria-hidden="true" />
  <span>처리 중입니다...</span>
</div>
```

#### Toast/Alert
```tsx
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {message}
</div>
```

### 9.4 키보드 네비게이션

| 키 | 동작 |
|----|------|
| `Tab` | 다음 포커스 가능 요소로 이동 |
| `Shift+Tab` | 이전 포커스 가능 요소로 이동 |
| `Enter` / `Space` | 버튼/링크 활성화 |
| `Escape` | 모달/드롭다운 닫기 |
| `Arrow Keys` | 탭/메뉴 내 이동 |

### 9.5 색상 대비

| 요소 | 최소 대비 | 현재 대비 |
|------|----------|----------|
| 본문 텍스트 | 4.5:1 | 12.6:1 (`#191F28` on `#F2F4F6`) |
| 큰 텍스트 | 3:1 | 12.6:1 |
| 버튼 텍스트 | 4.5:1 | 8.6:1 (white on `#3182F6`) |

### 9.6 스크린 리더 전용 유틸리티

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### 9.7 접근성 체크리스트

#### 개발 시
- [ ] 모든 이미지에 적절한 `alt` 텍스트
- [ ] 폼 입력에 연결된 `<label>`
- [ ] 버튼에 `type` 속성 명시
- [ ] 아이콘 버튼에 `aria-label`
- [ ] 중첩된 인터랙티브 요소 없음
- [ ] 키보드로 모든 기능 접근 가능
- [ ] 포커스 순서가 논리적

#### 테스트 시
- [ ] 키보드만으로 전체 기능 사용 가능
- [ ] 스크린 리더로 콘텐츠 이해 가능
- [ ] 200% 확대에서 레이아웃 유지
- [ ] 색상 제거 시 정보 손실 없음
- [ ] 애니메이션 비활성화 시 기능 정상

---

## 10. TypeScript Design Tokens

CSS Variables와 동기화된 TypeScript 디자인 토큰을 제공하여 런타임에서 일관된 스타일 적용을 보장합니다.

### 10.1 파일 위치

```
client/src/constants/designTokens.ts
```

### 10.2 사용 예시

```tsx
import {
  COLORS,
  SPACING,
  SPACING_VALUES,
  RADIUS,
  TYPOGRAPHY,
  SHADOWS,
  TRANSITIONS,
  A11Y,
  BREAKPOINTS,
  Z_INDEX,
  getCssVariable,
  matchesBreakpoint,
} from '@/constants';

// 색상 사용
const buttonStyle = {
  backgroundColor: COLORS.primary,
  color: 'white',
};

// 간격 계산
const totalPadding = SPACING_VALUES[4] * 2; // 32px

// 반응형 체크
if (matchesBreakpoint('md')) {
  // 태블릿 이상
}

// CSS 변수값 동적 접근
const currentPrimary = getCssVariable('color-primary');
```

### 10.3 토큰 카테고리

| 카테고리 | 상수명 | 설명 |
|----------|--------|------|
| 색상 | `COLORS` | Primary, Point, Semantic, Neutral 색상 |
| 간격 | `SPACING`, `SPACING_VALUES` | 8pt 그리드 기반 간격 |
| 모서리 | `RADIUS`, `RADIUS_VALUES` | 둥근 모서리 크기 |
| 타이포그래피 | `TYPOGRAPHY` | 폰트 패밀리, 크기, 굵기 |
| 그림자 | `SHADOWS` | 컬러/뉴트럴 그림자 |
| 전환 | `TRANSITIONS` | 애니메이션 지속 시간, 이징 |
| 접근성 | `A11Y` | 포커스 링, 터치 타겟 |
| 브레이크포인트 | `BREAKPOINTS`, `BREAKPOINT_VALUES` | 반응형 중단점 |
| Z-Index | `Z_INDEX` | 레이어 순서 |

### 10.4 CSS 변수와의 동기화

**중요**: TypeScript 토큰과 CSS 변수(`index.css`)는 항상 동기화 상태를 유지해야 합니다.

#### 동기화 매핑 테이블

| CSS 변수 | TypeScript 토큰 | 값 |
|----------|----------------|-----|
| `--color-primary` | `COLORS.primary` | `#3182F6` |
| `--color-point` | `COLORS.point` | `#FFBB00` |
| `--color-success` | `COLORS.success` | `#2ECC71` |
| `--color-error` | `COLORS.error` | `#E74C3C` |
| `--color-warning` | `COLORS.warning` | `#FF9500` |
| `--space-4` | `SPACING[4]` / `SPACING_VALUES[4]` | `16px` / `16` |
| `--radius-md` | `RADIUS.md` | `14px` |
| `--transition-fast` | `TRANSITIONS.fast` | `150ms` |
| `--a11y-touch-target-min` | `A11Y.touchTargetMin` | `44px` |
| `--z-modal` | `Z_INDEX.modal` | `11000` |

#### 동기화 규칙

1. **CSS 변수 변경 시**: 반드시 `designTokens.ts`도 업데이트
2. **TypeScript 토큰 변경 시**: 반드시 `index.css`도 업데이트
3. **새 토큰 추가 시**: 양쪽 모두에 추가
4. **삭제 시**: 사용처 확인 후 양쪽 모두에서 삭제

### 10.5 유틸리티 함수

```tsx
// CSS 변수값 읽기
getCssVariable('color-primary'); // '#3182F6'

// CSS 변수값 설정 (테마 변경 등)
setCssVariable('color-primary', '#FF0000');

// 브레이크포인트 매칭
matchesBreakpoint('md'); // window.innerWidth >= 768
```

---

## 11. 중앙화된 상수 및 유틸리티

디자인 시스템 관련 코드 응집도 향상을 위해 상수와 유틸리티가 중앙 관리됩니다.

### 11.1 접근성 상수 (`client/src/constants/a11y.ts`)

```tsx
import {
  // ARIA 역할 및 상태
  ARIA_ROLES,
  ARIA_LIVE,
  ARIA_CURRENT,
  KEYBOARD_KEYS,

  // 기본 속성 생성
  createAriaProps,

  // 테이블 접근성
  createTableAriaProps,
  createTableCaption,

  // 스텝 인디케이터
  createStepAriaProps,

  // 폼 접근성
  createInputAriaProps,
  createErrorAriaProps,
  createHelperAriaProps,

  // 콘텐츠 aria-label 생성
  createRatingAriaLabel,
  createProductAriaLabel,
  createCopyAriaLabel,
  createStatusBadgeAriaProps,

  // 네비게이션 레이블
  NAV_ARIA_LABELS,
  LANDMARK_ROLES,

  // 스크린 리더 전용 레이블
  SR_LABELS,
} from '@/constants';

// 예시: ARIA 역할
ARIA_ROLES.BUTTON        // 'button'
ARIA_ROLES.TABLIST       // 'tablist'
ARIA_CURRENT.STEP        // 'step'
ARIA_CURRENT.PAGE        // 'page'

// 예시: 버튼 ARIA 속성
createAriaProps.button('상세 보기')
// → { role: 'button', tabIndex: 0, 'aria-label': '상세 보기' }

// 예시: 테이블 캡션
createTableCaption('상품 목록', 10)
// → '상품 목록 - 총 10개 항목'

// 예시: 스텝 인디케이터
createStepAriaProps.item('PIN 입력', 2, 2)
// → { role: 'listitem', 'aria-current': 'step', 'aria-label': 'PIN 입력 (진행 중)' }

// 예시: 별점 aria-label
createRatingAriaLabel(4.5, 5, 120)
// → '평점: 4.5점 (5점 만점), 120개 리뷰'

// 예시: 상품 액션 aria-label
createProductAriaLabel('신세계 5만원권', 'add')
// → '신세계 5만원권 장바구니에 담기'

// 예시: 복사 버튼 aria-label
createCopyAriaLabel('계좌번호', '123-456-789')
// → '계좌번호 123-456-789 복사하기'

// 예시: 폼 입력 필드
createInputAriaProps('email', { error: '필수 항목' })
// → { 'aria-invalid': true, 'aria-describedby': 'email-error' }

// 예시: 네비게이션 레이블
NAV_ARIA_LABELS.MAIN           // '메인 메뉴'
NAV_ARIA_LABELS.MOBILE         // '모바일 메뉴'
NAV_ARIA_LABELS.TRADE_IN_STEPS // '매입 진행 단계'
```

### 11.2 접근성 유틸리티 (`client/src/utils/a11yUtils.ts`)

```tsx
import {
  createKeyboardHandler,
  announceToScreenReader,
  isKeyboardEvent,
  createLiveRegion,
} from '@/utils';

// 키보드 이벤트 핸들러 생성
const handleKeyDown = createKeyboardHandler(onClick);
<div onKeyDown={handleKeyDown} />

// 스크린 리더 알림
announceToScreenReader('결제가 완료되었습니다');

// 키보드 이벤트 판별
if (isKeyboardEvent(event, 'enter')) {
  // Enter 키 처리
}
```

### 11.3 기타 유틸리티

| 파일 | 함수 | 용도 |
|------|------|------|
| `imageHandlers.ts` | `handleImageError`, `getValidImageUrl` | 이미지 에러 폴백 |
| `priceUtils.ts` | `formatPrice`, `calculateDiscountedPrice` | 가격 포맷/계산 |
| `dateUtils.ts` | `formatDate`, `formatDateTime` | 날짜 포맷팅 |

---

## 12. 참조 문서

**내부 문서:**
- [01_PRD.md](./01_PRD.md) - 요구사항 정의서
- [06_PAGE_SPEC.md](./06_PAGE_SPEC.md) - 페이지 명세서
- [10_ACCESSIBILITY_AUDIT.md](./10_ACCESSIBILITY_AUDIT.md) - 접근성 감사 보고서

**외부 참조:**
- [Toss Design System](https://toss.im/design) - 벤치마킹 참조
- [WCAG 2.1](https://www.w3.org/TR/WCAG21/) - 웹 접근성 가이드라인
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) - ARIA 패턴 가이드
- [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) - ARIA 명세
