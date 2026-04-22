import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  calculateDiscountedPrice,
  calculateDiscountAmount,
  calculatePayoutAmount,
  calculateTotal,
  formatPercent,
  isValidPrice,
  comparePrice,
  formatPriceShort,
} from './priceUtils';

describe('formatPrice', () => {
  it('숫자를 한국 원화 형식으로 포맷', () => {
    expect(formatPrice(50000)).toBe('50,000원');
    expect(formatPrice(1000000)).toBe('1,000,000원');
  });

  it('통화 단위 생략', () => {
    expect(formatPrice(50000, false)).toBe('50,000');
  });

  it('null/undefined/0 처리', () => {
    expect(formatPrice(null)).toBe('0원');
    expect(formatPrice(undefined)).toBe('0원');
    expect(formatPrice(0)).toBe('0원');
  });

  it('문자열 숫자 변환', () => {
    expect(formatPrice('50000')).toBe('50,000원');
  });

  it('잘못된 문자열은 0원', () => {
    expect(formatPrice('abc')).toBe('0원');
  });
});

describe('calculateDiscountedPrice', () => {
  it('정상 할인가 계산', () => {
    expect(calculateDiscountedPrice(100000, 5)).toBe(95000);
    expect(calculateDiscountedPrice(50000, 10)).toBe(45000);
  });

  it('할인율 0%', () => {
    expect(calculateDiscountedPrice(100000, 0)).toBe(100000);
  });

  it('할인율 100%', () => {
    expect(calculateDiscountedPrice(100000, 100)).toBe(0);
  });
});

describe('calculateDiscountAmount', () => {
  it('할인 금액 계산', () => {
    expect(calculateDiscountAmount(100000, 5)).toBe(5000);
    expect(calculateDiscountAmount(50000, 10)).toBe(5000);
  });
});

describe('calculatePayoutAmount', () => {
  it('매입 지급액 계산: price × (1 - rate/100)', () => {
    // 50000원 × (1 - 8/100) = 46000 (8% 할인)
    expect(calculatePayoutAmount(50000, 8)).toBe(46000);
    // 100000원 × (1 - 5/100) = 95000
    expect(calculatePayoutAmount(100000, 5)).toBe(95000);
  });
});

describe('calculateTotal', () => {
  it('아이템 배열의 총액 계산', () => {
    const items = [
      { price: 50000, quantity: 2 },
      { price: 30000, quantity: 1 },
    ];
    expect(calculateTotal(items)).toBe(130000);
  });

  it('빈 배열은 0', () => {
    expect(calculateTotal([])).toBe(0);
  });
});

describe('formatPercent', () => {
  it('백분율 포맷', () => {
    expect(formatPercent(5)).toBe('5%');
    expect(formatPercent(10.5)).toBe('10.5%');
  });
});

describe('isValidPrice', () => {
  it('유효한 가격', () => {
    expect(isValidPrice(100)).toBe(true);
    expect(isValidPrice(0)).toBe(true);
  });

  it('유효하지 않은 가격', () => {
    expect(isValidPrice(-1)).toBe(false);
    expect(isValidPrice('abc')).toBe(false);
    expect(isValidPrice(NaN)).toBe(false);
    expect(isValidPrice(Infinity)).toBe(false);
  });

  it('null/0은 Number() 변환 시 0이므로 유효', () => {
    // Number(null) === 0, 0 >= 0 이므로 true
    expect(isValidPrice(null)).toBe(true);
    expect(isValidPrice(0)).toBe(true);
  });
});

describe('comparePrice', () => {
  it('가격 비교', () => {
    expect(comparePrice(100, 200)).toBe(-1);
    expect(comparePrice(200, 100)).toBe(1);
    expect(comparePrice(100, 100)).toBe(0);
  });
});

describe('formatPriceShort', () => {
  it('만원 단위 축약', () => {
    expect(formatPriceShort(10000)).toBe('1만원');
    expect(formatPriceShort(50000)).toBe('5만원');
    expect(formatPriceShort(1000000)).toBe('100만원');
  });

  it('1만원 미만은 원 단위', () => {
    expect(formatPriceShort(5000)).toBe('5,000원');
  });
});
