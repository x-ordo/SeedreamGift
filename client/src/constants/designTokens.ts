/**
 * @file designTokens.ts
 * @description TypeScript 디자인 토큰 - CSS Variables와 동기화
 * @module constants/designTokens
 *
 * 사용법:
 * - 런타임에서 디자인 토큰 값 접근
 * - 동적 스타일 계산
 * - 테마 검증
 *
 * CSS Variables (index.css)와 동기화 유지 필수
 */

// ============================================
// 1. COLOR TOKENS
// ============================================

export const COLORS = {
  // Primary
  primary: '#3182F6',
  primaryHover: '#1B64DA',
  primaryActive: '#0F52BA',
  primaryLight: 'rgba(49, 130, 246, 0.06)',

  // Point (Gold Accent)
  point: '#FFBB00',
  pointHover: '#E5A800',
  pointActive: '#CC9600',
  pointLight: 'rgba(255, 187, 0, 0.15)',

  // Semantic
  success: '#2ECC71',
  successLight: 'rgba(46, 204, 113, 0.15)',
  error: '#E74C3C',
  errorLight: 'rgba(231, 76, 60, 0.15)',
  warning: '#FF9500',
  warningLight: 'rgba(255, 149, 0, 0.15)',
  info: '#17A2B8',
  infoLight: 'rgba(23, 162, 184, 0.15)',

  // Background
  bgPrimary: '#F2F4F6',
  bgSecondary: '#FFFFFF',

  // Grey Scale
  grey50: '#F9FAFB',
  grey100: '#F2F4F6',
  grey200: '#E5E8EB',
  grey300: '#D1D6DB',
  grey400: '#B0B8C1',
  grey500: '#8B95A1',
  grey600: '#6B7684',
  grey700: '#4E5968',
  grey800: '#333D4B',
  grey900: '#191F28',
} as const;

// ============================================
// 2. SPACING TOKENS (8pt Grid)
// ============================================

export const SPACING = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
} as const;

// Numeric values for calculations
export const SPACING_VALUES = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

// ============================================
// 2.1. LAYOUT CONTAINER TOKENS
// ============================================

export const CONTAINERS = {
  sm: '640px',
  md: '800px',
  lg: '1200px',
  xl: '1400px',
} as const;

export const CONTAINER_VALUES = {
  sm: 640,
  md: 800,
  lg: 1200,
  xl: 1400,
} as const;

// ============================================
// 3. RADIUS TOKENS
// ============================================

export const RADIUS = {
  xs: '4px',
  sm: '8px',
  md: '14px',
  lg: '18px',
  xl: '24px',
  full: '9999px',
} as const;

export const RADIUS_VALUES = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

// ============================================
// 4. TYPOGRAPHY TOKENS
// ============================================

export const TYPOGRAPHY = {
  fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif",
  lineHeight: 1.5,
  letterSpacing: '-0.015em',

  // Font Sizes
  sizes: {
    caption: '12px',
    body: '14px',
    bodyLg: '16px',
    title: '18px',
    headline: '20px',
    display: '24px',
    hero: '32px',
    jumbo: '40px',
  },

  // Font Weights
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
} as const;

// Icon Sizes
export const ICON_SIZES = {
  sm: '16px',
  md: '20px',
  lg: '24px',
  xl: '28px',
} as const;

export const ICON_SIZE_VALUES = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

// Component Touch Target Sizes
export const COMPONENT_SIZES = {
  touchSm: '36px',
  touchMd: '44px',
  touchLg: '48px',
} as const;

export const COMPONENT_SIZE_VALUES = {
  touchSm: 36,
  touchMd: 44,
  touchLg: 48,
} as const;

// Component Variant Sizes (표준화)
export const BUTTON_SIZES = {
  sm: { height: 32, padding: '0 12px', fontSize: '13px' },
  md: { height: 40, padding: '0 16px', fontSize: '14px' },
  lg: { height: 48, padding: '0 20px', fontSize: '15px' },
  xl: { height: 56, padding: '0 24px', fontSize: '16px' },
} as const;

export const INPUT_SIZES = {
  sm: { height: 36, padding: '0 12px', fontSize: '14px' },
  md: { height: 44, padding: '0 14px', fontSize: '15px' },
  lg: { height: 52, padding: '0 16px', fontSize: '16px' },
} as const;

export const CARD_VARIANTS = {
  compact: { padding: '12px' },
  default: { padding: '16px' },
  expanded: { padding: '24px' },
} as const;

// ============================================
// 5. SHADOW TOKENS
// ============================================

export const SHADOWS = {
  // Colored Shadows (버튼용)
  primary: '0 4px 16px rgba(49, 130, 246, 0.3)',
  point: '0 4px 16px rgba(255, 187, 0, 0.3)',
  success: '0 4px 16px rgba(46, 204, 113, 0.3)',
  error: '0 4px 16px rgba(231, 76, 60, 0.3)',

  // Neutral Shadows
  sm: '0 2px 8px rgba(0, 0, 0, 0.04)',
  md: '0 4px 12px rgba(0, 0, 0, 0.08)',
  lg: '0 12px 32px rgba(0, 0, 0, 0.08)',
  xl: '0 20px 60px rgba(0, 0, 0, 0.2)',
} as const;

// ============================================
// 6. TRANSITION TOKENS
// ============================================

export const TRANSITIONS = {
  // Duration
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',

  // Easing
  easeOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// ============================================
// 7. ACCESSIBILITY TOKENS
// ============================================

export const A11Y = {
  // Focus Ring
  focusRing: {
    color: COLORS.primary,
    width: '3px',
    offset: '2px',
    shadow: `0 0 0 2px ${COLORS.primaryLight}, 0 0 0 5px ${COLORS.primary}`,
  },

  // Touch Targets (WCAG 2.5.5)
  touchTarget: {
    min: '44px',
    recommended: '48px',
    small: '32px',
    minValue: 44,
    recommendedValue: 48,
    smallValue: 32,
  },

  // Transition Duration (동작 감소 모드 지원)
  transition: {
    duration: '200ms',
    reducedMotionDuration: '0.01ms',
  },

  // Color Contrast (WCAG 2.1 AA)
  contrast: {
    minNormalText: 4.5,      // 일반 텍스트
    minLargeText: 3,         // 대형 텍스트 (18pt+, 14pt bold+)
    minUIComponent: 3,       // UI 컴포넌트
    minGraphics: 3,          // 그래픽 요소
  },

  // Text Size (WCAG 2.1 AA)
  textSize: {
    minBody: '14px',
    minCaption: '12px',
    largeTextThreshold: '18px',
  },

  // Timing (WCAG 2.2.1)
  timing: {
    minTimeout: 20000,       // 최소 타임아웃 (20초)
    flashThreshold: 3,       // 초당 최대 깜빡임 횟수
  },

  // Legacy flat properties (backward compatibility)
  focusRingColor: COLORS.primary,
  focusRingWidth: '3px',
  focusRingOffset: '2px',
  touchTargetMin: '44px',
  touchTargetRecommended: '48px',
  touchTargetSmall: '32px',
  touchTargetMinValue: 44,
  touchTargetRecommendedValue: 48,
  touchTargetSmallValue: 32,
  transitionDuration: '200ms',
} as const;

// ============================================
// 8. BREAKPOINTS
// ============================================

export const BREAKPOINTS = {
  xs: '0px',
  sm: '576px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

export const BREAKPOINT_VALUES = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

// ============================================
// 9. Z-INDEX LAYERS
// ============================================

export const Z_INDEX = {
  base: 0,
  dropdown: 100,
  sticky: 500,
  fixed: 1000,
  modalBackdrop: 10000,
  modal: 11000,
  tooltip: 12000,
  toast: 13000,
} as const;

// ============================================
// 10. UTILITY FUNCTIONS
// ============================================

/**
 * CSS 변수값을 가져옴
 *
 * @param name - CSS 변수 이름 (-- prefix 제외)
 * @returns CSS 변수값 (트림됨)
 *
 * @example
 * const primaryColor = getCssVariable('color-primary'); // '#3182F6'
 */
export function getCssVariable(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--${name}`)
    .trim();
}

/**
 * CSS 변수 설정
 *
 * @param name - CSS 변수 이름 (-- prefix 제외)
 * @param value - 설정할 값
 *
 * @example
 * setCssVariable('color-primary', '#FF0000'); // 테마 변경
 */
export function setCssVariable(name: string, value: string): void {
  if (typeof window === 'undefined') return;
  document.documentElement.style.setProperty(`--${name}`, value);
}

/**
 * 미디어 쿼리 매칭 확인
 *
 * @param breakpoint - 브레이크포인트 키 ('xs' | 'sm' | 'md' | 'lg' | 'xl')
 * @returns 해당 브레이크포인트 이상이면 true
 *
 * @example
 * if (matchesBreakpoint('md')) {
 *   // 태블릿 이상 화면
 * }
 */
export function matchesBreakpoint(
  breakpoint: keyof typeof BREAKPOINT_VALUES
): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(
    `(min-width: ${BREAKPOINTS[breakpoint]})`
  ).matches;
}

// ============================================
// 11. TYPE EXPORTS
// ============================================

export type ColorKey = keyof typeof COLORS;
export type SpacingKey = keyof typeof SPACING;
export type ContainerKey = keyof typeof CONTAINERS;
export type RadiusKey = keyof typeof RADIUS;
export type ShadowKey = keyof typeof SHADOWS;
export type BreakpointKey = keyof typeof BREAKPOINTS;
export type ZIndexKey = keyof typeof Z_INDEX;
export type IconSizeKey = keyof typeof ICON_SIZES;
export type ComponentSizeKey = keyof typeof COMPONENT_SIZES;

// ============================================
// 12. SWITCH COMPONENT TOKENS
// ============================================

export const SWITCH = {
  track: {
    width: '52px',
    height: '32px',
    radius: RADIUS.full,
    bgOff: COLORS.grey300,
    bgOn: COLORS.primary,
    bgDisabled: COLORS.grey200,
    widthValue: 52,
    heightValue: 32,
  },
  thumb: {
    size: '26px',
    offset: '3px',
    bg: 'white',
    shadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    sizeValue: 26,
    offsetValue: 3,
  },
  transition: `${TRANSITIONS.fast} ${TRANSITIONS.easeOut}`,
} as const;

// ============================================
// 13. ACCORDION COMPONENT TOKENS
// ============================================

export const ACCORDION = {
  trigger: {
    padding: SPACING[4],
    bg: 'transparent',
    bgHover: COLORS.grey100,
    fontWeight: 600,
    color: COLORS.grey900,
    iconColor: COLORS.grey500,
  },
  panel: {
    padding: SPACING[4],
    bg: '#F9FAFB', // neutral-50
    borderRadius: `0 0 ${RADIUS.md} ${RADIUS.md}`,
  },
  border: {
    color: COLORS.grey200,
    radius: RADIUS.md,
  },
  transition: `${TRANSITIONS.normal} ${TRANSITIONS.easeOut}`,
} as const;

// ============================================
// 14. BORDER/DIVIDER COMPONENT TOKENS
// ============================================

export const BORDER = {
  color: COLORS.grey200,
  colorLight: COLORS.grey100,
  sectionBg: COLORS.grey100,
  width: '1px',
  sectionHeight: '16px',
  paddingHorizontal: '24px',
  widthValue: 1,
  sectionHeightValue: 16,
  paddingHorizontalValue: 24,
} as const;

// Combined Design Tokens Object
export const DESIGN_TOKENS = {
  colors: COLORS,
  spacing: SPACING,
  spacingValues: SPACING_VALUES,
  containers: CONTAINERS,
  containerValues: CONTAINER_VALUES,
  radius: RADIUS,
  radiusValues: RADIUS_VALUES,
  typography: TYPOGRAPHY,
  iconSizes: ICON_SIZES,
  iconSizeValues: ICON_SIZE_VALUES,
  componentSizes: COMPONENT_SIZES,
  componentSizeValues: COMPONENT_SIZE_VALUES,
  buttonSizes: BUTTON_SIZES,
  inputSizes: INPUT_SIZES,
  cardVariants: CARD_VARIANTS,
  shadows: SHADOWS,
  transitions: TRANSITIONS,
  a11y: A11Y,
  breakpoints: BREAKPOINTS,
  breakpointValues: BREAKPOINT_VALUES,
  zIndex: Z_INDEX,
  switch: SWITCH,
  accordion: ACCORDION,
  border: BORDER,
} as const;

export default DESIGN_TOKENS;
