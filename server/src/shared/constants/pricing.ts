/**
 * @file pricing.ts
 * @description 가격 계산 관련 상수 및 유틸리티 함수
 * @module shared/constants
 *
 * 사용처:
 * - ProductService: 판매가(buyPrice) 계산
 * - TradeInService: 매입가(payoutAmount) 계산
 * - OrdersService: 주문 총액 계산
 */
import { Prisma } from '../prisma/generated/client';

/**
 * 판매가 계산
 *
 * 판매가 = 정가 × (1 - 할인율/100)
 * 예: 100,000원 × (1 - 0.05) = 95,000원
 *
 * @param price - 정가 (액면가)
 * @param discountRate - 할인율 (0-100)
 * @returns 계산된 판매가 (Prisma.Decimal)
 */
export function calculateBuyPrice(
  price: number | Prisma.Decimal,
  discountRate: number | Prisma.Decimal,
): Prisma.Decimal {
  return new Prisma.Decimal(price).mul(1 - Number(discountRate) / 100);
}

/**
 * 매입가 계산
 *
 * 매입가 = 정가 × (1 - 수수료율/100)
 * 예: 100,000원 × (1 - 0.20) = 80,000원
 *
 * @param price - 정가 (액면가)
 * @param tradeInRate - 수수료율 (0-100, 높을수록 사용자 수령액 적음)
 * @returns 계산된 매입가 (Prisma.Decimal)
 */
export function calculatePayoutAmount(
  price: number | Prisma.Decimal,
  tradeInRate: number | Prisma.Decimal,
): Prisma.Decimal {
  return new Prisma.Decimal(price).mul(1 - Number(tradeInRate) / 100);
}

/**
 * 할인 금액 계산
 *
 * @param price - 정가
 * @param discountRate - 할인율
 * @returns 할인 금액
 */
export function calculateDiscount(
  price: number | Prisma.Decimal,
  discountRate: number | Prisma.Decimal,
): Prisma.Decimal {
  return new Prisma.Decimal(price).mul(Number(discountRate) / 100);
}

/**
 * 가격 기본값
 */
export const PRICING_DEFAULTS = {
  /** 기본 할인율 (%) */
  DEFAULT_DISCOUNT_RATE: 0,
  /** 기본 매입 수수료율 (%) */
  DEFAULT_TRADEIN_RATE: 10,
  /** 최소 주문 금액 (원) */
  MIN_ORDER_AMOUNT: 1000,
  /** 최대 주문 금액 (원) */
  MAX_ORDER_AMOUNT: 10000000,
} as const;
