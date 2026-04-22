/**
 * @file storage.ts
 * @description localStorage 키 관리 상수
 * @module constants
 *
 * 사용처:
 * - AuthContext: 토큰/사용자 정보 저장
 * - useCartStore: 장바구니 영속화
 *
 * 버전 관리:
 * - STORAGE_VERSION을 변경하면 기존 데이터가 무효화됨
 * - 마이그레이션 필요 시 별도 로직 구현
 */

/**
 * 스토리지 버전
 * - 변경 시 기존 localStorage 데이터가 무효화됨
 */
export const STORAGE_VERSION = 'v1';

/**
 * 인증 관련 스토리지 키
 */
export const AUTH_STORAGE_KEYS = {
  /** JWT 액세스 토큰 */
  TOKEN: `auth:${STORAGE_VERSION}:token`,
  /** 사용자 정보 (JSON) */
  USER: `auth:${STORAGE_VERSION}:user`,
} as const;

/**
 * 장바구니 스토리지 키
 */
export const CART_STORAGE_KEY = `seedream-gift-cart:${STORAGE_VERSION}`;

/**
 * 장바구니 타임스탬프 키
 * - 장바구니 마지막 수정 시각 (7일 만료 체크용)
 */
export const CART_TIMESTAMP_KEY = `seedream-gift-cart:${STORAGE_VERSION}:timestamp`;

/**
 * 기타 스토리지 키
 */
export const MISC_STORAGE_KEYS = {
  /** 최근 본 상품 */
  RECENT_PRODUCTS: `seedream-gift-recent:${STORAGE_VERSION}`,
  /** 테마 설정 */
  THEME: `seedream-gift-theme:${STORAGE_VERSION}`,
  /** 언어 설정 */
  LOCALE: `seedream-gift-locale:${STORAGE_VERSION}`,
  /** 검색 히스토리 */
  SEARCH_HISTORY: 'wgift_search_history',
} as const;

/** 검색 히스토리 최대 저장 수 */
export const MAX_SEARCH_HISTORY = 10;

/**
 * 모든 스토리지 키 목록 (디버깅/초기화용)
 * @see clearAllStorage
 */
export const ALL_STORAGE_KEYS = [
  ...Object.values(AUTH_STORAGE_KEYS),
  CART_STORAGE_KEY,
  CART_TIMESTAMP_KEY,
  ...Object.values(MISC_STORAGE_KEYS),
] as const;

/**
 * 스토리지 전체 초기화
 * - 로그아웃 시 또는 데이터 초기화 필요 시 호출
 * - 모든 seedream-gift 관련 localStorage 키 삭제
 */
export const clearAllStorage = (): void => {
  ALL_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
};

/**
 * 인증 스토리지만 초기화
 * - 토큰 만료/인증 오류 시 호출
 * - 장바구니 등 다른 데이터는 유지
 */
export const clearAuthStorage = (): void => {
  Object.values(AUTH_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
};
