/**
 * @file a11y.ts
 * @description 접근성(Accessibility) 관련 상수
 * @module constants
 *
 * WCAG 2.1 AA 수준 준수를 위한 상수 정의
 * - ARIA 역할 및 속성
 * - 키보드 인터랙션
 * - 상태 레이블
 * - 터치 타겟 크기
 */

/**
 * ARIA 역할 (Role) 상수
 */
export const ARIA_ROLES = {
  /** 버튼 역할 */
  BUTTON: 'button',
  /** 링크 역할 */
  LINK: 'link',
  /** 탭 목록 */
  TABLIST: 'tablist',
  /** 탭 */
  TAB: 'tab',
  /** 탭 패널 */
  TABPANEL: 'tabpanel',
  /** 상태 알림 (비긴급) */
  STATUS: 'status',
  /** 경고 알림 (긴급) */
  ALERT: 'alert',
  /** 대화상자 */
  DIALOG: 'dialog',
  /** 모달 대화상자 */
  ALERTDIALOG: 'alertdialog',
  /** 그룹 */
  GROUP: 'group',
  /** 목록 */
  LIST: 'list',
  /** 목록 항목 */
  LISTITEM: 'listitem',
  /** 메뉴 */
  MENU: 'menu',
  /** 메뉴 항목 */
  MENUITEM: 'menuitem',
  /** 네비게이션 */
  NAVIGATION: 'navigation',
  /** 검색 */
  SEARCH: 'search',
  /** 프로그레스바 */
  PROGRESSBAR: 'progressbar',
  /** 이미지 */
  IMG: 'img',
  /** 프레젠테이션 (장식용) */
  PRESENTATION: 'presentation',
  /** 없음 (장식용) */
  NONE: 'none',
  /** 스위치 (토글) */
  SWITCH: 'switch',
  /** 영역 (아코디언 패널) */
  REGION: 'region',
} as const;

/**
 * ARIA Live Region 설정
 */
export const ARIA_LIVE = {
  /** 정중한 알림 (현재 작업 완료 후 읽음) */
  POLITE: 'polite',
  /** 긴급 알림 (즉시 읽음) */
  ASSERTIVE: 'assertive',
  /** 비활성 */
  OFF: 'off',
} as const;

/**
 * 키보드 키 코드
 */
export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const;

/**
 * 터치 타겟 크기는 designTokens.ts의 A11Y 객체를 사용합니다.
 * @see designTokens.ts A11Y.touchTargetMin, A11Y.touchTargetRecommended
 */

/**
 * 포커스 링 스타일 토큰
 */
export const FOCUS_RING = {
  /** 기본 포커스 링 색상 */
  COLOR: 'var(--color-primary)',
  /** 포커스 링 오프셋 */
  OFFSET: '2px',
  /** 포커스 링 너비 */
  WIDTH: '3px',
  /** 포커스 링 그림자 */
  SHADOW: '0 0 0 3px var(--color-primary-light)',
} as const;

/**
 * 스크린 리더 전용 텍스트 레이블
 */
export const SR_LABELS = {
  // 네비게이션
  MAIN_NAV: '메인 네비게이션',
  BOTTOM_NAV: '하단 네비게이션',
  BREADCRUMB: '현재 위치',
  PAGINATION: '페이지 네비게이션',

  // 상태 알림
  LOADING: '로딩 중',
  PROCESSING: '처리 중입니다',
  SUCCESS: '성공',
  ERROR: '오류',

  // 액션
  CLOSE: '닫기',
  OPEN_MENU: '메뉴 열기',
  TOGGLE: '토글',
  EXPAND: '펼치기',
  COLLAPSE: '접기',

  // 상품
  ADD_TO_CART: '장바구니에 담기',
  REMOVE_FROM_CART: '장바구니에서 제거',
  VIEW_DETAILS: '상세 보기',

  // 수량
  INCREASE_QUANTITY: '수량 증가',
  DECREASE_QUANTITY: '수량 감소',

  // 복사
  COPY: '복사',
  COPIED: '복사됨',

  // 스위치
  SWITCH_ON: '활성화됨',
  SWITCH_OFF: '비활성화됨',

  // 아코디언
  ACCORDION_EXPAND: '펼치기',
  ACCORDION_COLLAPSE: '접기',

  // 모달
  MODAL_CLOSE: '모달 닫기',
  MODAL_OPEN: '모달 열기',
} as const;

/**
 * 동작 감소 모드 확인
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * 키보드 이벤트 유틸리티
 */
export const isActivationKey = (key: string): boolean => {
  return key === KEYBOARD_KEYS.ENTER || key === KEYBOARD_KEYS.SPACE;
};

/**
 * ARIA 속성 생성 헬퍼
 */
export const createAriaProps = {
  /** 버튼 역할 속성 */
  button: (label: string, pressed?: boolean) => ({
    role: ARIA_ROLES.BUTTON,
    'aria-label': label,
    ...(pressed !== undefined && { 'aria-pressed': pressed }),
    tabIndex: 0,
  }),

  /** 탭 속성 */
  tab: (label: string, selected: boolean, controls: string) => ({
    role: ARIA_ROLES.TAB,
    'aria-label': label,
    'aria-selected': selected,
    'aria-controls': controls,
    tabIndex: selected ? 0 : -1,
  }),

  /** 탭 패널 속성 */
  tabPanel: (id: string, labelledBy: string, hidden: boolean) => ({
    role: ARIA_ROLES.TABPANEL,
    id,
    'aria-labelledby': labelledBy,
    hidden,
    tabIndex: 0,
  }),

  /** 상태 알림 속성 */
  status: (label: string, busy = false) => ({
    role: ARIA_ROLES.STATUS,
    'aria-live': ARIA_LIVE.POLITE as string,
    'aria-label': label,
    ...(busy && { 'aria-busy': true }),
  }),

  /** 링크 역할 속성 (div/button을 링크처럼 사용할 때) */
  link: (label: string) => ({
    role: ARIA_ROLES.LINK,
    'aria-label': label,
    tabIndex: 0,
  }),

  /** 그룹 속성 */
  group: (label: string) => ({
    role: ARIA_ROLES.GROUP,
    'aria-label': label,
  }),

  /** 스위치 속성 */
  switch: (label: string, checked: boolean, disabled = false) => ({
    role: ARIA_ROLES.SWITCH,
    'aria-label': label,
    'aria-checked': checked,
    ...(disabled && { 'aria-disabled': true }),
    tabIndex: disabled ? -1 : 0,
  }),

  /** 아코디언 헤더(트리거) 속성 */
  accordionTrigger: (id: string, expanded: boolean, controls: string) => ({
    id,
    'aria-expanded': expanded,
    'aria-controls': controls,
  }),

  /** 아코디언 패널 속성 */
  accordionPanel: (id: string, labelledBy: string, hidden: boolean) => ({
    id,
    role: ARIA_ROLES.REGION,
    'aria-labelledby': labelledBy,
    hidden,
  }),

  /** 모달 대화상자 속성 */
  modal: (titleId: string, descriptionId?: string) => ({
    role: ARIA_ROLES.DIALOG,
    'aria-modal': true,
    'aria-labelledby': titleId,
    ...(descriptionId && { 'aria-describedby': descriptionId }),
  }),
};

/**
 * 상품 카드 aria-label 생성
 */
export const createProductAriaLabel = (
  productName: string,
  action: 'view' | 'add' | 'remove' | 'increase' | 'decrease'
): string => {
  const actions = {
    view: `${productName} 상세 보기`,
    add: `${productName} 장바구니에 담기`,
    remove: `${productName} 삭제`,
    increase: `${productName} 수량 증가`,
    decrease: `${productName} 수량 감소`,
  };
  return actions[action];
};

// ============================================
// ARIA CURRENT VALUES
// ============================================

/**
 * aria-current 속성 값
 * @see https://www.w3.org/TR/wai-aria-1.1/#aria-current
 */
export const ARIA_CURRENT = {
  /** 현재 페이지 */
  PAGE: 'page',
  /** 현재 스텝 */
  STEP: 'step',
  /** 현재 위치 */
  LOCATION: 'location',
  /** 현재 날짜 */
  DATE: 'date',
  /** 현재 시간 */
  TIME: 'time',
  /** 참/거짓 */
  TRUE: 'true',
} as const;

// ============================================
// TABLE ACCESSIBILITY
// ============================================

/**
 * 테이블 접근성 헬퍼
 */
export const createTableAriaProps = {
  /** 테이블 캡션 (시각적으로 숨김 가능) */
  caption: (text: string, visuallyHidden = true) => ({
    text,
    className: visuallyHidden ? 'visually-hidden' : undefined,
  }),

  /** 열 헤더 속성 */
  columnHeader: () => ({
    scope: 'col' as const,
  }),

  /** 행 헤더 속성 */
  rowHeader: () => ({
    scope: 'row' as const,
  }),
};

/**
 * 테이블 캡션 생성
 */
export const createTableCaption = (
  tableName: string,
  itemCount?: number
): string => {
  if (itemCount !== undefined) {
    return `${tableName} - 총 ${itemCount}개 항목`;
  }
  return tableName;
};

// ============================================
// STEP INDICATOR ACCESSIBILITY
// ============================================

/**
 * 스텝 인디케이터 ARIA 속성 생성
 */
export const createStepAriaProps = {
  /** 스텝 목록 컨테이너 */
  container: (label: string) => ({
    role: ARIA_ROLES.LIST,
    'aria-label': label,
  }),

  /** 개별 스텝 아이템 */
  item: (
    stepLabel: string,
    currentStep: number,
    thisStep: number
  ) => {
    const isActive = currentStep === thisStep;
    const isCompleted = currentStep > thisStep;

    let statusText = '';
    if (isCompleted) statusText = ' (완료)';
    else if (isActive) statusText = ' (진행 중)';

    return {
      role: ARIA_ROLES.LISTITEM,
      'aria-current': isActive ? (ARIA_CURRENT.STEP as string) : undefined,
      'aria-label': `${stepLabel}${statusText}`,
    };
  },
};

// ============================================
// RATING ACCESSIBILITY
// ============================================

/**
 * 별점 평가 aria-label 생성
 */
export const createRatingAriaLabel = (
  rating: number,
  maxRating = 5,
  reviewCount?: number
): string => {
  const ratingText = `평점: ${rating}점 (${maxRating}점 만점)`;
  if (reviewCount !== undefined) {
    return `${ratingText}, ${reviewCount}개 리뷰`;
  }
  return ratingText;
};

// ============================================
// STATUS BADGE ACCESSIBILITY
// ============================================

/**
 * 상태 배지 ARIA 속성
 */
export const createStatusBadgeAriaProps = (statusLabel: string) => ({
  role: ARIA_ROLES.STATUS,
  'aria-label': `상태: ${statusLabel}`,
});

// ============================================
// COPY BUTTON ACCESSIBILITY
// ============================================

/**
 * 복사 버튼 aria-label 생성
 */
export const createCopyAriaLabel = (
  targetType: string,
  targetValue?: string
): string => {
  if (targetValue) {
    return `${targetType} ${targetValue} 복사하기`;
  }
  return `${targetType} 복사하기`;
};

// ============================================
// FORM ACCESSIBILITY
// ============================================

/**
 * 폼 입력 필드 ARIA 속성 생성
 */
export const createInputAriaProps = (
  id: string,
  options: {
    error?: string;
    helperText?: string;
    required?: boolean;
  }
) => {
  const { error, helperText, required } = options;

  const describedBy: string[] = [];
  if (error) describedBy.push(`${id}-error`);
  else if (helperText) describedBy.push(`${id}-helper`);

  return {
    'aria-invalid': !!error || undefined,
    'aria-describedby': describedBy.length > 0 ? describedBy.join(' ') : undefined,
    'aria-required': required || undefined,
  };
};

/**
 * 에러 메시지 ARIA 속성
 */
export const createErrorAriaProps = (id: string) => ({
  id: `${id}-error`,
  role: ARIA_ROLES.ALERT,
  'aria-live': ARIA_LIVE.ASSERTIVE as string,
});

/**
 * 도움말 텍스트 ARIA 속성
 */
export const createHelperAriaProps = (id: string) => ({
  id: `${id}-helper`,
});

// ============================================
// NAVIGATION ACCESSIBILITY
// ============================================

/**
 * 네비게이션 ARIA 속성
 */
export const NAV_ARIA_LABELS = {
  MAIN: '메인 메뉴',
  MOBILE: '모바일 메뉴',
  FOOTER_SERVICES: '서비스 링크',
  FOOTER_SUPPORT: '고객지원 링크',
  FOOTER_LEGAL: '법적 고지',
  ADMIN: '관리자 메뉴',
  USER_MENU: '사용자 메뉴',
  BREADCRUMB: '현재 위치',
  PAGINATION: '페이지 네비게이션',
  TABS: '탭 메뉴',
  AUTH: '인증 메뉴',
  TRADE_IN_STEPS: '판매 진행 단계',
} as const;

// ============================================
// LANDMARK ROLES
// ============================================

/**
 * 랜드마크 역할
 */
export const LANDMARK_ROLES = {
  BANNER: 'banner',
  NAVIGATION: 'navigation',
  MAIN: 'main',
  COMPLEMENTARY: 'complementary',
  CONTENTINFO: 'contentinfo',
  SEARCH: 'search',
  FORM: 'form',
  REGION: 'region',
} as const;
