/**
 * @file constants.ts
 * @description 서버 전역 공유 상수 및 유틸리티 함수
 * @module shared
 *
 * 포함 내용:
 * - 역할/상태 열거형 (USER_ROLE, KYC_STATUS, ORDER_STATUS 등)
 * - 비즈니스 제한값 (PURCHASE_LIMITS, TRADEIN_LIMITS)
 * - 암호화 상수 (CRYPTO_CONSTANTS)
 * - 에러 메시지 상수 (TRADEIN_ERRORS, ORDER_ERRORS, CART_ERRORS 등)
 * - 가격 계산 유틸리티 (calculatePayoutAmount, calculateBuyPrice)
 *
 * 사용처:
 * - 모든 서비스 및 컨트롤러에서 하드코딩 문자열 대신 상수 사용
 * - 타입 안전성과 일관성 보장
 *
 * @deprecated shared/constants/ 디렉토리의 개별 파일 사용 권장
 */

import { Prisma } from './prisma/generated/client';

// ==========================================
// Enums & Types
// ==========================================

export const USER_ROLE = {
  USER: 'USER',
  PARTNER: 'PARTNER',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const KYC_STATUS = {
  NONE: 'NONE',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type KycStatus = (typeof KYC_STATUS)[keyof typeof KYC_STATUS];

export const TRADEIN_STATUS = {
  REQUESTED: 'REQUESTED',
  VERIFIED: 'VERIFIED',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
} as const;
export type TradeInStatus =
  (typeof TRADEIN_STATUS)[keyof typeof TRADEIN_STATUS];

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export const VOUCHER_STATUS = {
  AVAILABLE: 'AVAILABLE',
  SOLD: 'SOLD',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
} as const;

export const GIFT_STATUS = {
  SENT: 'SENT',
  CLAIMED: 'CLAIMED',
  EXPIRED: 'EXPIRED',
} as const;
export type GiftStatus = (typeof GIFT_STATUS)[keyof typeof GIFT_STATUS];

export const REFUND_STATUS = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];

export const INQUIRY_STATUS = {
  PENDING: 'PENDING',
  ANSWERED: 'ANSWERED',
  CLOSED: 'CLOSED',
} as const;
export type InquiryStatus =
  (typeof INQUIRY_STATUS)[keyof typeof INQUIRY_STATUS];

export const FAQ_CATEGORY = {
  GENERAL: 'GENERAL',
  PURCHASE: 'PURCHASE',
  TRADEIN: 'TRADEIN',
  PAYMENT: 'PAYMENT',
  DELIVERY: 'DELIVERY',
  ACCOUNT: 'ACCOUNT',
} as const;
export type FaqCategory = (typeof FAQ_CATEGORY)[keyof typeof FAQ_CATEGORY];

// ==========================================
// Configuration & Limits
// ==========================================

export const PURCHASE_LIMITS = {
  SINGLE: 500000,
  DAILY: 2000000, // 일일 한도 200만원
  MONTHLY: 5000000,
  DEFAULT_DAILY_LIMIT: 2000000, // 일일 한도 기본값 200만원
  /** 단일 주문 최대 아이템 수 */
  MAX_ITEMS_PER_ORDER: 20,
  /** 단일 상품 최대 수량 */
  MAX_QUANTITY_PER_ITEM: 10,
};

export const TRADEIN_LIMITS = {
  /** 일일 매입 신청 한도 (건) */
  MAX_REQUESTS_PER_DAY: 5,
  /** 월간 매입 총액 한도 (원) */
  MAX_MONTHLY_AMOUNT: 10000000,
};

export const CRYPTO_CONSTANTS = {
  ALGORITHM: 'aes-256-gcm',
  IV_LENGTH: 16,
  KEY_LENGTH: 32, // Added (256 bit)
  KEY_HEX_LENGTH: 64, // Added
  AUTH_TAG_LENGTH: 16, // Added
};

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
  /** 인증 세션 유효 시간 (ms) - 5분 */
  VERIFY_SESSION_TTL_MS: 5 * 60 * 1000,
} as const;

/** 주문 취소 가능 시간 (30분) */
export const ORDER_CANCEL_WINDOW_MS = 30 * 60 * 1000;
/** 선물 만료 기간 (일) */
export const GIFT_EXPIRY_DAYS = 30;

// ==========================================
// Error Messages
// ==========================================

export const TRADEIN_ERRORS = {
  PRODUCT_NOT_TRADEABLE: '이 상품은 현재 매입이 불가능합니다.',
  INVALID_PIN: '유효하지 않은 PIN 번호입니다.',
  ALREADY_USED: '이미 사용된 상품권입니다.',
  PIN_ALREADY_USED: '이미 등록된 PIN 번호입니다.',
  DAILY_LIMIT_EXCEEDED: '일일 매입 신청 한도를 초과했습니다.',
  KYC_REQUIRED: '매입 신청을 위해 본인 인증(KYC)이 필요합니다.',
} as const;

export const ORDER_ERRORS = {
  OUT_OF_STOCK: '재고가 부족합니다.',
  LIMIT_EXCEEDED: '구매 한도를 초과했습니다.',
  INVALID_PAYMENT: '결제 정보가 유효하지 않습니다.',
  NOT_FOUND: '주문을 찾을 수 없습니다.',
  ACCESS_DENIED: '접근 권한이 없습니다.',
  ALREADY_PROCESSED: '이미 처리된 주문입니다.',
  PRODUCT_NOT_AVAILABLE: '해당 상품은 현재 구매할 수 없습니다.',
  DAILY_LIMIT_EXCEEDED: (remaining: number) =>
    `일일 구매 한도를 초과했습니다. (잔여 한도: ${remaining.toLocaleString()}원)`,
  INSUFFICIENT_STOCK: (productName: string) => `${productName} 재고 부족`,
};

export const CART_ERRORS = {
  NOT_FOUND: '장바구니 아이템을 찾을 수 없습니다.',
  PRODUCT_NOT_FOUND: '상품을 찾을 수 없습니다.',
  PRODUCT_NOT_AVAILABLE: '상품을 찾을 수 없거나 판매 중지된 상품입니다.',
  OUT_OF_STOCK: '해당 상품의 재고가 부족합니다.',
  INVALID_QUANTITY: '수량이 유효하지 않습니다.',
  MAX_QUANTITY_EXCEEDED: '최대 수량을 초과했습니다.',
  ACCESS_DENIED: '이 항목에 대한 권한이 없습니다.',
} as const;

export const GIFT_ERRORS = {
  NOT_FOUND: '선물을 찾을 수 없습니다.',
  ALREADY_CLAIMED: '이미 수령된 선물입니다.',
  EXPIRED: '만료된 선물입니다.',
  SELF_GIFT_NOT_ALLOWED: '본인에게는 선물할 수 없습니다.',
  RECEIVER_NOT_FOUND: '받는 사람을 찾을 수 없습니다.',
  RECIPIENT_NOT_FOUND: '존재하지 않는 회원입니다.',
  CANNOT_RECEIVE_GIFT: '선물을 받을 수 없는 회원입니다. (관리자 승인 필요)',
  CANNOT_GIFT_SELF: '자신에게 선물할 수 없습니다.',
  RECIPIENT_CANNOT_RECEIVE: '해당 회원은 선물을 받을 수 없습니다.',
} as const;

export const CRYPTO_ERRORS = {
  ENCRYPTION_FAILED: '암호화 처리에 실패했습니다.',
  DECRYPTION_FAILED: '복호화 처리에 실패했습니다.',
  KEY_NOT_SET: '암호화 키가 설정되지 않았습니다.',
  KEY_INVALID_LENGTH: '암호화 키 길이가 유효하지 않습니다.',
  INVALID_FORMAT: '암호화 데이터 형식이 유효하지 않습니다.',
  INVALID_IV: 'IV 값이 유효하지 않습니다.',
  INVALID_AUTH_TAG: '인증 태그가 유효하지 않습니다.',
};

export const REFUND_ERRORS = {
  NOT_FOUND: '환불 요청을 찾을 수 없습니다.',
  ALREADY_EXISTS: '이미 환불 요청이 존재합니다.',
  ALREADY_CANCELLED: '이미 취소된 주문입니다.',
  ALREADY_PROCESSED: '이미 처리된 환불 요청입니다.',
  ORDER_NOT_FOUND: '주문을 찾을 수 없습니다.',
} as const;

export const PRODUCT_ERRORS = {
  NOT_FOUND: '상품을 찾을 수 없습니다.',
  NOT_ACTIVE: '현재 판매 중지된 상품입니다.',
  TRADEIN_NOT_ALLOWED: '이 상품은 현재 매입이 불가능합니다.',
} as const;

// ==========================================
// Utilities
// ==========================================

/**
 * 매입가 계산
 * @param price 정가
 * @param rate 수수료율 (%)
 * @returns 매입가 (Decimal)
 */
export function calculatePayoutAmount(
  price: number | Prisma.Decimal,
  rate: number,
): Prisma.Decimal {
  const priceVal =
    typeof price === 'number' ? new Prisma.Decimal(price) : price;
  // Payout = Price * (1 - rate/100)
  return priceVal.mul(1 - rate / 100);
}

/**
 * 구매가 계산 (할인 적용)
 * @param price 정가
 * @param discountRate 할인율 (%)
 * @returns 구매가 (Decimal)
 */
export function calculateBuyPrice(
  price: number,
  discountRate: number,
): Prisma.Decimal {
  // Return Decimal
  const val = Math.floor(price * (1 - discountRate / 100));
  return new Prisma.Decimal(val);
}
