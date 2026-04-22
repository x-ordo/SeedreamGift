/**
 * @file pricing.spec.ts
 * @description 가격 계산 유틸리티 단위 테스트
 *
 * 순수 함수 테스트 — DB/DI 의존성 없음
 */
import {
  calculateBuyPrice,
  calculatePayoutAmount,
  calculateDiscount,
} from './pricing';
import { Prisma } from '../prisma/generated/client';

describe('Pricing Utilities', () => {
  describe('calculateBuyPrice', () => {
    it('should calculate buy price with number inputs', () => {
      // 50,000원 × (1 - 3.5/100) = 48,250원
      const result = calculateBuyPrice(50000, 3.5);
      expect(Number(result)).toBe(48250);
    });

    it('should calculate buy price with Decimal inputs', () => {
      const price = new Prisma.Decimal(100000);
      const discountRate = new Prisma.Decimal(5);
      // 100,000 × (1 - 5/100) = 95,000
      const result = calculateBuyPrice(price, discountRate);
      expect(Number(result)).toBe(95000);
    });

    it('should return full price when discount is 0', () => {
      const result = calculateBuyPrice(50000, 0);
      expect(Number(result)).toBe(50000);
    });

    it('should return 0 when discount is 100%', () => {
      const result = calculateBuyPrice(50000, 100);
      expect(Number(result)).toBe(0);
    });

    it('should handle small discount rates correctly', () => {
      // 30,000 × (1 - 2/100) = 29,400
      const result = calculateBuyPrice(30000, 2);
      expect(Number(result)).toBe(29400);
    });
  });

  describe('calculatePayoutAmount', () => {
    it('should calculate payout with typical trade-in rate', () => {
      // 100,000원 × (1 - 8/100) = 92,000원
      const result = calculatePayoutAmount(100000, 8);
      expect(Number(result)).toBe(92000);
    });

    it('should calculate payout with Decimal inputs', () => {
      const price = new Prisma.Decimal(50000);
      const tradeInRate = new Prisma.Decimal(10);
      // 50,000 × (1 - 10/100) = 45,000
      const result = calculatePayoutAmount(price, tradeInRate);
      expect(Number(result)).toBe(45000);
    });

    it('should return full amount when rate is 0', () => {
      const result = calculatePayoutAmount(100000, 0);
      expect(Number(result)).toBe(100000);
    });
  });

  describe('calculateDiscount', () => {
    it('should calculate discount amount', () => {
      // 100,000 × 5/100 = 5,000
      const result = calculateDiscount(100000, 5);
      expect(Number(result)).toBe(5000);
    });

    it('should return 0 for 0% discount', () => {
      const result = calculateDiscount(100000, 0);
      expect(Number(result)).toBe(0);
    });
  });
});
