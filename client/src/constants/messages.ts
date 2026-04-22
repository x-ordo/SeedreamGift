/**
 * @file messages.ts
 * @description 중앙화된 사용자 메시지 상수
 * @module constants
 *
 * i18n 대비 및 일관성 유지를 위해 모든 사용자 메시지를 한 곳에서 관리
 *
 * 사용 예시:
 * ```tsx
 * import { MESSAGES, TOAST_MESSAGES, ERROR_MESSAGES } from '@/constants/messages';
 *
 * showToast({ message: TOAST_MESSAGES.COPY_SUCCESS, type: 'success' });
 * ```
 */

// ============================================================================
// Toast Messages
// ============================================================================

/**
 * 토스트 알림 메시지
 */
export const TOAST_MESSAGES = {
  // 복사 관련
  COPY_SUCCESS: '복사되었습니다.',
  COPY_PIN_SUCCESS: 'PIN 번호가 복사되었어요!',
  COPY_ACCOUNT_SUCCESS: '계좌번호가 복사되었어요.',
  COPY_FAILED: '복사에 실패했습니다.',

  // 인증 관련
  LOGIN_REQUIRED: '로그인 후 이용 가능해요.',
  LOGIN_SUCCESS: '로그인되었습니다.',
  LOGOUT_SUCCESS: '로그아웃 되었습니다.',
  REGISTER_SUCCESS: '회원가입이 완료되었습니다.',

  // 장바구니 관련
  CART_ADD_SUCCESS: '장바구니에 담았어요.',
  CART_REMOVE_SUCCESS: '장바구니에서 삭제했어요.',
  CART_UPDATE_SUCCESS: '수량이 변경되었어요.',
  CART_EMPTY: '장바구니가 비어있어요.',

  // 주문 관련
  ORDER_SUCCESS: '주문이 완료되었습니다.',
  ORDER_FAILED: '주문에 실패했습니다.',
  PAYMENT_SUCCESS: '결제가 완료되었습니다.',
  PAYMENT_FAILED: '결제에 실패했습니다.',

  // 판매 관련
  TRADEIN_SUCCESS: '판매 신청이 완료되었습니다.',
  TRADEIN_FAILED: '판매 신청에 실패했습니다.',

  // 일반
  SAVE_SUCCESS: '저장되었습니다.',
  DELETE_SUCCESS: '삭제되었습니다.',
  UPDATE_SUCCESS: '수정되었습니다.',
  NETWORK_ERROR: '네트워크 오류가 발생했습니다.',
  UNKNOWN_ERROR: '오류가 발생했습니다.',
} as const;

// ============================================================================
// Error Messages
// ============================================================================

/**
 * 에러 메시지
 */
export const ERROR_MESSAGES = {
  // 네트워크/서버
  NETWORK_ERROR: '네트워크 연결을 확인해주세요.',
  SERVER_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  TIMEOUT_ERROR: '요청 시간이 초과되었습니다.',

  // 인증
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  SESSION_EXPIRED: '세션이 만료되었습니다. 다시 로그인해주세요.',
  UNAUTHORIZED: '권한이 없습니다.',
  EMAIL_EXISTS: '이미 사용 중인 이메일입니다.',

  // 주문
  OUT_OF_STOCK: '재고가 부족합니다.',
  DAILY_LIMIT_EXCEEDED: '일일 구매 한도를 초과했습니다.',
  ORDER_NOT_FOUND: '주문을 찾을 수 없습니다.',

  // 판매
  PRODUCT_NOT_TRADEABLE: '판매가 불가능한 상품입니다.',
  INVALID_PIN: '유효하지 않은 PIN 번호입니다.',

  // 폼 검증
  REQUIRED_FIELD: '필수 입력 항목입니다.',
  INVALID_EMAIL: '올바른 이메일 형식이 아닙니다.',
  INVALID_PHONE: '올바른 전화번호 형식이 아닙니다.',
  PASSWORD_TOO_SHORT: '비밀번호는 8자 이상이어야 합니다.',
  PASSWORD_MISMATCH: '비밀번호가 일치하지 않습니다.',
} as const;

// ============================================================================
// Confirmation Messages
// ============================================================================

/**
 * 확인 메시지 (모달/다이얼로그용)
 */
export const CONFIRM_MESSAGES = {
  DELETE_ITEM: '정말 삭제하시겠어요?',
  CLEAR_CART: '장바구니를 비우시겠어요?',
  CANCEL_ORDER: '주문을 취소하시겠어요?',
  LOGOUT: '로그아웃 하시겠어요?',
  LEAVE_PAGE: '작성 중인 내용이 있어요. 페이지를 나가시겠어요?',
} as const;

// ============================================================================
// Empty State Messages
// ============================================================================

/**
 * 빈 상태 메시지
 */
export const EMPTY_MESSAGES = {
  CART: '장바구니가 비어있어요',
  ORDERS: '아직 구매한 상품권이 없어요',
  TRADEINS: '판매 신청 내역이 없어요',
  PRODUCTS: '상품이 없습니다',
  SEARCH_RESULTS: '검색 결과가 없습니다',
  NOTIFICATIONS: '알림이 없습니다',
} as const;

// ============================================================================
// Button Labels
// ============================================================================

/**
 * 버튼 라벨
 */
export const BUTTON_LABELS = {
  // 일반
  CONFIRM: '확인',
  CANCEL: '취소',
  CLOSE: '닫기',
  SAVE: '저장',
  DELETE: '삭제',
  EDIT: '수정',
  SUBMIT: '제출',
  NEXT: '다음',
  PREV: '이전',
  RETRY: '다시 시도',

  // 인증
  LOGIN: '로그인',
  LOGOUT: '로그아웃',
  REGISTER: '회원가입',

  // 쇼핑
  ADD_TO_CART: '장바구니 담기',
  BUY_NOW: '바로 구매',
  CHECKOUT: '결제하기',
  CONTINUE_SHOPPING: '쇼핑 계속하기',
  VIEW_CART: '장바구니 보기',
  VIEW_ORDER: '주문 내역 보기',

  // 판매
  APPLY_TRADEIN: '판매 신청하기',
  VIEW_TRADEIN: '판매 내역 보기',

  // 복사
  COPY: '복사',
  COPY_PIN: 'PIN 복사',
  COPY_ACCOUNT: '계좌 복사',
} as const;

// ============================================================================
// Page Titles & Headers
// ============================================================================

/**
 * 페이지 제목
 */
export const PAGE_TITLES = {
  HOME: '와우기프트',
  LOGIN: '로그인',
  REGISTER: '회원가입',
  CART: '장바구니',
  CHECKOUT: '결제하기',
  MY_PAGE: '마이페이지',
  TRADE_IN: '상품권 판매',
  PRODUCT_LIST: '상품 목록',
  PRODUCT_DETAIL: '상품 상세',
  ADMIN: '관리자',
  SUPPORT: '고객센터',
  NOTICE: '공지사항',
} as const;

/**
 * 섹션 제목
 */
export const SECTION_TITLES = {
  BEST_SELLERS: '인기 상품권',
  NEW_PRODUCTS: '신규 상품',
  ORDER_ITEMS: '주문 상품',
  PAYMENT_METHOD: '결제 수단',
  BANK_INFO: '입금 계좌',
  ORDER_SUMMARY: '결제 금액',
  ACCOUNT_SETTINGS: '계정 설정',
  SUPPORT: '지원',
} as const;

// ============================================================================
// Placeholder Texts
// ============================================================================

/**
 * 플레이스홀더 텍스트
 */
export const PLACEHOLDERS = {
  EMAIL: '이메일 주소를 입력하세요',
  PASSWORD: '비밀번호를 입력하세요',
  PASSWORD_CONFIRM: '비밀번호를 다시 입력하세요',
  NAME: '이름을 입력하세요',
  PHONE: '전화번호를 입력하세요 (- 없이)',
  PIN_CODE: 'PIN 번호를 입력하세요 (- 포함)',
  ACCOUNT_NUMBER: '계좌번호를 입력하세요 (- 없이)',
  SEARCH: '검색어를 입력하세요',
} as const;

// ============================================================================
// Status Labels
// ============================================================================

/**
 * 상태 라벨
 */
export const STATUS_LABELS = {
  // 주문 상태
  ORDER_PENDING: '결제 대기',
  ORDER_PAID: '결제 완료',
  ORDER_DELIVERED: '발급 완료',
  ORDER_CANCELLED: '취소됨',

  // 판매 상태
  TRADEIN_REQUESTED: '검토 중',
  TRADEIN_VERIFIED: '검증 완료',
  TRADEIN_PAID: '정산 완료',
  TRADEIN_REJECTED: '반려됨',

  // KYC 상태
  KYC_PENDING: '인증 대기',
  KYC_VERIFIED: '인증 완료',
  KYC_REJECTED: '인증 반려',
} as const;

// ============================================================================
// Form Labels
// ============================================================================

/**
 * 폼 필드 라벨
 */
export const FORM_LABELS = {
  EMAIL: '이메일',
  PASSWORD: '비밀번호',
  PASSWORD_CONFIRM: '비밀번호 확인',
  NAME: '이름',
  PHONE: '전화번호',
  BANK_NAME: '은행',
  ACCOUNT_NUMBER: '계좌번호',
  ACCOUNT_HOLDER: '예금주',
  PIN_CODE: 'PIN 번호',
  PRODUCT: '상품',
  QUANTITY: '수량',
} as const;

// ============================================================================
// Combined Export
// ============================================================================

/**
 * 모든 메시지 통합 객체
 */
export const MESSAGES = {
  toast: TOAST_MESSAGES,
  error: ERROR_MESSAGES,
  confirm: CONFIRM_MESSAGES,
  empty: EMPTY_MESSAGES,
  button: BUTTON_LABELS,
  pageTitle: PAGE_TITLES,
  sectionTitle: SECTION_TITLES,
  placeholder: PLACEHOLDERS,
  status: STATUS_LABELS,
  formLabel: FORM_LABELS,
} as const;
