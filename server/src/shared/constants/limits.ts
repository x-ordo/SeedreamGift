/**
 * @file limits.ts
 * @description 시스템 제한 관련 상수
 * @module shared/constants
 *
 * 사용처:
 * - OrdersService: 일일 구매 한도 검증
 * - CryptoService: 암호화 키 길이 검증
 * - ThrottlerModule: API Rate Limiting
 */

/**
 * 구매 관련 제한
 */
export const PURCHASE_LIMITS = {
  /** 일일 구매 한도 기본값 (원) - SiteConfig 미설정 시 사용 */
  DEFAULT_DAILY_LIMIT: 2000000,
  /** 월간 구매 한도 기본값 (원) - SiteConfig 미설정 시 사용 */
  MONTHLY: 5000000,
  /** 일일 최대 주문 건수 */
  MAX_ORDERS_PER_DAY: 10,
  /** 단일 주문 최대 아이템 수 */
  MAX_ITEMS_PER_ORDER: 20,
  /** 단일 상품 최대 수량 (제한 없음 수준으로 상향) */
  MAX_QUANTITY_PER_ITEM: 999,
} as const;

/**
 * 매입 관련 제한
 */
export const TRADEIN_LIMITS = {
  /** 일일 매입 신청 한도 (건) */
  MAX_REQUESTS_PER_DAY: 5,
  /** 월간 매입 총액 한도 (원) */
  MAX_MONTHLY_AMOUNT: 10000000,
} as const;

/**
 * 암호화 관련 상수
 */
export const CRYPTO_CONSTANTS = {
  /** 암호화 키 길이 (바이트) - AES-256 */
  KEY_LENGTH: 32,
  /** 암호화 키 hex 문자열 길이 */
  KEY_HEX_LENGTH: 64,
  /** IV 길이 (바이트) */
  IV_LENGTH: 16,
  /** 인증 태그 길이 (바이트) */
  AUTH_TAG_LENGTH: 16,
  /** 암호화 알고리즘 */
  ALGORITHM: 'aes-256-gcm' as const,
} as const;

/**
 * API Rate Limiting 설정
 */
export const RATE_LIMITS = {
  /** 기본 요청 제한 (요청/분) */
  DEFAULT_REQUESTS_PER_MINUTE: 100,
  /** 로그인 시도 제한 (요청/분) */
  LOGIN_REQUESTS_PER_MINUTE: 5,
  /** 회원가입 제한 (요청/시간) */
  REGISTER_REQUESTS_PER_HOUR: 3,
} as const;

/**
 * 페이지네이션 기본값
 */
export const PAGINATION_DEFAULTS = {
  /** 기본 페이지 크기 */
  DEFAULT_PAGE_SIZE: 20,
  /** 최대 페이지 크기 */
  MAX_PAGE_SIZE: 100,
  /** 기본 시작 페이지 */
  DEFAULT_PAGE: 1,
} as const;

/**
 * 주문/선물 비즈니스 시간 상수
 */
export const ORDER_CANCEL_WINDOW_MS = 30 * 60 * 1000; // 30분
export const GIFT_EXPIRY_DAYS = 30;

/**
 * JWT 관련 상수
 * @deprecated Source of truth is auth.config.ts. This constant is kept for backward compatibility only.
 */
/**
 * 인증 보안 관련 상수
 */
export const AUTH_SECURITY = {
  /** 연속 로그인 실패 허용 횟수 */
  MAX_FAILED_ATTEMPTS: 5,
  /** 계정 잠금 시간 (분) */
  LOCKOUT_DURATION_MINUTES: 15,
} as const;

/**
 * KYC 인증 관련 제한
 */
export const KYC_LIMITS = {
  /** 최대 인증 시도 횟수 */
  MAX_VERIFY_ATTEMPTS: 10,
  /** 인증 세션 유효 시간 (ms) - 10분 */
  VERIFY_SESSION_TTL_MS: 10 * 60 * 1000,
} as const;

/**
 * JWT 관련 상수
 * @deprecated Source of truth is auth.config.ts. This constant is kept for backward compatibility only.
 */
export const JWT_CONSTANTS = {
  /** Access 토큰 만료 시간 (초) - 10분 */
  EXPIRES_IN: 600,
  /** 세션 절대 만료 시간 (초) - 1시간 (refresh로 연장 불가) */
  SESSION_DURATION: 3600,
} as const;
