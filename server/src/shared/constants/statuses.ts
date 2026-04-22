/**
 * @file statuses.ts
 * @description 중앙화된 상태 상수 - 하드코딩 문자열 제거
 * @module shared/constants
 *
 * 모든 도메인 상태값을 한 곳에서 관리하여:
 * - 타입 안전성 향상 (as const)
 * - 오타 방지
 * - 일관된 상태값 사용
 */

/**
 * 주문 상태
 * @description 주문 생명주기 관리
 */
export const ORDER_STATUS = {
  /** 결제 대기 */
  PENDING: 'PENDING',
  /** 결제 완료 */
  PAID: 'PAID',
  /** 배송 완료 (PIN 발급) */
  DELIVERED: 'DELIVERED',
  /** 취소됨 */
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/**
 * 바우처(상품권 PIN) 상태
 * @description 재고 관리 상태
 */
export const VOUCHER_STATUS = {
  /** 판매 가능 (재고) */
  AVAILABLE: 'AVAILABLE',
  /** 판매 완료 */
  SOLD: 'SOLD',
  /** 사용 완료 */
  USED: 'USED',
  /** 만료됨 */
  EXPIRED: 'EXPIRED',
} as const;

export type VoucherStatus =
  (typeof VOUCHER_STATUS)[keyof typeof VOUCHER_STATUS];

/**
 * 매입 신청 상태
 * @description 상품권 매입 처리 단계
 */
export const TRADEIN_STATUS = {
  /** 신청됨 (검증 대기) */
  REQUESTED: 'REQUESTED',
  /** PIN 검증 완료 */
  VERIFIED: 'VERIFIED',
  /** 정산 완료 */
  PAID: 'PAID',
  /** 반려됨 (유효하지 않은 PIN 등) */
  REJECTED: 'REJECTED',
} as const;

export type TradeInStatus =
  (typeof TRADEIN_STATUS)[keyof typeof TRADEIN_STATUS];

/**
 * KYC 인증 상태
 * @description 본인 인증 처리 상태
 */
export const KYC_STATUS = {
  /** 미인증 (기본값) */
  NONE: 'NONE',
  /** 인증 대기 */
  PENDING: 'PENDING',
  /** 인증 완료 */
  VERIFIED: 'VERIFIED',
  /** 인증 반려 */
  REJECTED: 'REJECTED',
} as const;

export type KycStatus = (typeof KYC_STATUS)[keyof typeof KYC_STATUS];

/**
 * 사용자 역할
 * @description RBAC 권한 관리
 */
export const USER_ROLE = {
  /** 일반 회원 */
  USER: 'USER',
  /** 파트너 (대량 할인) */
  PARTNER: 'PARTNER',
  /** 관리자 (전체 접근) */
  ADMIN: 'ADMIN',
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

/**
 * 사이트 설정 값 타입
 * @description SiteConfig 테이블의 value 타입 구분
 */
export const CONFIG_TYPE = {
  /** 문자열 */
  STRING: 'STRING',
  /** 숫자 */
  NUMBER: 'NUMBER',
  /** 불리언 */
  BOOLEAN: 'BOOLEAN',
  /** JSON 객체 */
  JSON: 'JSON',
} as const;

export type ConfigType = (typeof CONFIG_TYPE)[keyof typeof CONFIG_TYPE];

/**
 * 선물 상태
 * @description 선물 생명주기 관리
 */
export const GIFT_STATUS = {
  /** 발송됨 (수령 대기) */
  SENT: 'SENT',
  /** 수령 완료 */
  CLAIMED: 'CLAIMED',
  /** 만료됨 */
  EXPIRED: 'EXPIRED',
} as const;

export type GiftStatus = (typeof GIFT_STATUS)[keyof typeof GIFT_STATUS];

/**
 * 환불 상태
 * @description 환불 처리 단계
 */
export const REFUND_STATUS = {
  /** 환불 요청됨 */
  REQUESTED: 'REQUESTED',
  /** 환불 승인 */
  APPROVED: 'APPROVED',
  /** 환불 거부 */
  REJECTED: 'REJECTED',
} as const;

export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];

/**
 * 1:1 문의 상태
 * @description 문의 처리 단계
 */
export const INQUIRY_STATUS = {
  /** 답변 대기 */
  PENDING: 'PENDING',
  /** 답변 완료 */
  ANSWERED: 'ANSWERED',
  /** 종료 */
  CLOSED: 'CLOSED',
} as const;

export type InquiryStatus =
  (typeof INQUIRY_STATUS)[keyof typeof INQUIRY_STATUS];

/**
 * FAQ 카테고리
 * @description FAQ 분류
 */
export const FAQ_CATEGORY = {
  GENERAL: 'GENERAL',
  PURCHASE: 'PURCHASE',
  TRADEIN: 'TRADEIN',
  PAYMENT: 'PAYMENT',
  DELIVERY: 'DELIVERY',
  ACCOUNT: 'ACCOUNT',
} as const;

export type FaqCategory = (typeof FAQ_CATEGORY)[keyof typeof FAQ_CATEGORY];
