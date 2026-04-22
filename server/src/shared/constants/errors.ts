/**
 * @file errors.ts
 * @description 에러 메시지 상수 (한국어)
 * @module shared/constants
 *
 * 사용처:
 * - 모든 서비스 및 컨트롤러에서 일관된 에러 메시지 사용
 *
 * 규칙:
 * - 모든 에러 메시지는 한국어로 작성
 * - 동적 값이 필요한 경우 함수 형태로 제공
 */

/**
 * 인증 관련 에러
 */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  TOKEN_EXPIRED: '인증이 만료되었습니다. 다시 로그인해주세요.',
  UNAUTHORIZED: '로그인이 필요합니다.',
  FORBIDDEN: '접근 권한이 없습니다.',
  USER_NOT_FOUND: '사용자를 찾을 수 없습니다.',
  EMAIL_EXISTS: '이미 사용 중인 이메일입니다.',
  PHONE_EXISTS: '이미 사용 중인 휴대폰 번호입니다.',
  INVALID_TOKEN: '유효하지 않은 인증 토큰입니다.',
  INVALID_OLD_PASSWORD: '기존 비밀번호가 올바르지 않습니다.',
  REFRESH_TOKEN_NOT_FOUND: '리프레시 토큰을 찾을 수 없습니다.',
  RESET_TOKEN_EXPIRED:
    '비밀번호 재설정 링크가 만료되었습니다. 다시 요청해주세요.',
  RESET_TOKEN_INVALID: '유효하지 않은 비밀번호 재설정 링크입니다.',
  DUPLICATE_INFO: '이미 사용 중인 정보입니다.',
  ACCOUNT_LOCKED: '계정이 일시적으로 잠겼습니다. 15분 후 다시 시도해주세요.',
  SESSION_NOT_FOUND: '세션을 찾을 수 없습니다.',
  KYC_REQUIRED_FOR_PASSWORD_CHANGE:
    '비밀번호 변경을 위해 계좌 인증이 필요합니다. 계좌 인증을 먼저 완료해주세요.',
} as const;

/**
 * 계정 잠금 에러 메시지 (남은 분 동적)
 */
export const accountLockedMessage = (minutes: number) =>
  `계정이 일시적으로 잠겼습니다. ${minutes}분 후 다시 시도해주세요.`;

/**
 * 주문 관련 에러
 */
export const ORDER_ERRORS = {
  NOT_FOUND: '주문을 찾을 수 없습니다.',
  ALREADY_PROCESSED: '이미 처리된 주문입니다.',
  ACCESS_DENIED: '주문에 대한 접근 권한이 없습니다.',
  INSUFFICIENT_STOCK: (productName: string) => `${productName} 재고 부족`,
  DAILY_LIMIT_EXCEEDED: (remaining: number) =>
    `일일 구매 한도를 초과했습니다. (잔여 한도: ${remaining.toLocaleString()}원)`,
  PRODUCT_NOT_AVAILABLE: '상품을 구매할 수 없습니다.',
  EMPTY_CART: '장바구니가 비어있습니다.',
} as const;

/**
 * 상품 관련 에러
 */
export const PRODUCT_ERRORS = {
  NOT_FOUND: '상품을 찾을 수 없습니다.',
  NOT_ACTIVE: '현재 판매 중지된 상품입니다.',
  TRADEIN_NOT_ALLOWED: '이 상품은 현재 매입이 불가능합니다.',
  INVALID_PRICE: '유효하지 않은 가격입니다.',
  INVALID_DISCOUNT: '할인율은 0-100 사이여야 합니다.',
} as const;

/**
 * 매입(Trade-In) 관련 에러
 */
export const TRADEIN_ERRORS = {
  NOT_FOUND: '매입 신청을 찾을 수 없습니다.',
  PRODUCT_NOT_TRADEABLE: '이 상품은 현재 매입이 불가능합니다.',
  INVALID_PIN: 'PIN 번호가 유효하지 않습니다.',
  PIN_ALREADY_USED: '이미 사용된 PIN 번호입니다.',
  DAILY_LIMIT_EXCEEDED: '일일 매입 신청 한도를 초과했습니다.',
  KYC_REQUIRED: '매입 신청을 위해 본인 인증(KYC)이 필요합니다.',
} as const;

/**
 * 장바구니 관련 에러
 */
export const CART_ERRORS = {
  NOT_FOUND: '장바구니 아이템을 찾을 수 없습니다.',
  PRODUCT_NOT_AVAILABLE: '상품을 찾을 수 없거나 판매 중지된 상품입니다.',
  OUT_OF_STOCK: '해당 상품의 재고가 부족합니다.',
  ACCESS_DENIED: '이 항목에 대한 권한이 없습니다.',
} as const;

/**
 * 선물 관련 에러
 */
export const GIFT_ERRORS = {
  RECIPIENT_NOT_FOUND: '존재하지 않는 회원입니다.',
  CANNOT_RECEIVE_GIFT: '선물을 받을 수 없는 회원입니다. (관리자 승인 필요)',
  CANNOT_GIFT_SELF: '자신에게 선물할 수 없습니다.',
  RECIPIENT_CANNOT_RECEIVE: '해당 회원은 선물을 받을 수 없습니다.',
} as const;

/**
 * 바우처 관련 에러
 */
export const VOUCHER_ERRORS = {
  NOT_FOUND: '바우처를 찾을 수 없습니다.',
  ALREADY_SOLD: '이미 판매된 바우처입니다.',
  INSUFFICIENT_STOCK: (productId: number) => `재고 부족: 상품 ID ${productId}`,
} as const;

/**
 * 암호화 관련 에러
 */
export const CRYPTO_ERRORS = {
  KEY_NOT_SET: 'FATAL: ENCRYPTION_KEY environment variable is required',
  KEY_INVALID_LENGTH:
    'FATAL: ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
  INVALID_FORMAT: 'Invalid encrypted data format',
  INVALID_IV: 'Invalid IV length',
  INVALID_AUTH_TAG: 'Invalid auth tag length',
  DECRYPTION_FAILED: '복호화에 실패했습니다.',
} as const;

/**
 * 입력 검증 에러
 */
export const VALIDATION_ERRORS = {
  REQUIRED: (field: string) => `${field}은(는) 필수 항목입니다.`,
  INVALID_FORMAT: (field: string) => `${field} 형식이 올바르지 않습니다.`,
  TOO_SHORT: (field: string, min: number) =>
    `${field}은(는) 최소 ${min}자 이상이어야 합니다.`,
  TOO_LONG: (field: string, max: number) =>
    `${field}은(는) 최대 ${max}자까지 입력 가능합니다.`,
  OUT_OF_RANGE: (field: string, min: number, max: number) =>
    `${field}은(는) ${min}~${max} 사이의 값이어야 합니다.`,
} as const;

/**
 * 회원 탈퇴 관련 에러
 */
export const USER_ERRORS = {
  INVALID_PASSWORD: '비밀번호가 올바르지 않습니다.',
  PENDING_ORDERS:
    '미처리 주문이 있어 탈퇴할 수 없습니다. 주문 완료 후 다시 시도해주세요.',
  PENDING_TRADEINS:
    '미처리 매입 건이 있어 탈퇴할 수 없습니다. 처리 완료 후 다시 시도해주세요.',
  NOT_FOUND: '사용자를 찾을 수 없습니다.',
} as const;

/**
 * 환불 관련 에러
 */
export const REFUND_ERRORS = {
  NOT_FOUND: '환불 요청을 찾을 수 없습니다.',
  ALREADY_EXISTS: '이미 환불 요청이 존재합니다.',
  ALREADY_CANCELLED: '이미 취소된 주문입니다.',
  ALREADY_PROCESSED: '이미 처리된 환불 요청입니다.',
  ORDER_NOT_FOUND: '주문을 찾을 수 없습니다.',
} as const;

/**
 * 일반 에러
 */
export const GENERAL_ERRORS = {
  INTERNAL_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  BAD_REQUEST: '잘못된 요청입니다.',
  NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
  TOO_MANY_REQUESTS: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
} as const;
