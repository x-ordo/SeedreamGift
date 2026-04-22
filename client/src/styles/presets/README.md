# 테마 프리셋

사이트 브랜드 색상을 빠르게 변경할 수 있는 CSS 프리셋 파일입니다.

## 사용법

### 1. 프리셋 파일 import

`client/src/styles/tokens.css` 최상단에 추가:

```css
@import './presets/theme-red.css';
```

### 2. daisyUI 테마 동기화

`client/src/index.css`의 `@plugin "daisyui/theme"` 블록에서 primary oklch 값을 맞춰야 합니다.

hex → oklch 변환: https://oklch.com

### 3. 빌드

```bash
pnpm build
```

## 프리셋 목록

| 파일 | Primary | Point | 톤 |
|------|---------|-------|-----|
| `default.css` | #3182f6 (Blue) | #ffc342 (Gold) | 신뢰/금융 |
| `theme-red.css` | #dc2626 (Red) | #f59e0b (Amber) | 강렬/프리미엄 |
| `theme-green.css` | #059669 (Green) | #f43f5e (Coral) | 자연/친환경 |

## 커스텀 프리셋 만들기

1. 기존 프리셋 파일 복사
2. `--color-primary` 계열 5개 변수 변경
3. `--color-point` 계열 3개 변수 변경
4. `--shadow-primary`, `--shadow-point` rgba 값 맞추기
5. `--gradient-primary`, `--gradient-point` 그라데이션 업데이트
