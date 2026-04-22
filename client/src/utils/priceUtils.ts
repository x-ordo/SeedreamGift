/**
 * @file priceUtils.ts
 * @description 가격 관련 유틸리티 함수
 * @module utils
 *
 * 사용처:
 * - ProductCard: 가격 포맷팅
 * - CheckoutPage: 주문 총액 계산
 * - CartPage: 장바구니 합계
 */

/** 가격 포맷팅 옵션 */
export interface FormatPriceOptions {
  /** 통화 표시 여부 (기본: true) */
  showCurrency?: boolean;
  /** 로케일 (기본: 'ko-KR') */
  locale?: string;
  /** 통화 단위 (기본: '원') */
  currencyUnit?: string;
}

/**
 * 숫자를 통화 형식으로 포맷팅
 *
 * @param value - 포맷팅할 숫자
 * @param options - 포맷팅 옵션 또는 showCurrency boolean (하위 호환)
 * @returns 포맷팅된 문자열 (예: "100,000원")
 *
 * @example
 * formatPrice(100000)                          // "100,000원"
 * formatPrice(100000, false)                    // "100,000"
 * formatPrice(100000, { locale: 'en-US', currencyUnit: '$' }) // "100,000$"
 */
export const formatPrice = (
  value: number | string | null | undefined,
  options: boolean | FormatPriceOptions = true
): string => {
  const opts: FormatPriceOptions =
    typeof options === 'boolean' ? { showCurrency: options } : options;
  const {
    showCurrency = true,
    locale = 'ko-KR',
    currencyUnit = '원',
  } = opts;

  const num = Number(value) || 0;
  const formatted = num.toLocaleString(locale);
  return showCurrency ? `${formatted}${currencyUnit}` : formatted;
};

/**
 * 할인가 계산
 *
 * @param price - 원가
 * @param discountRate - 할인율 (0-100)
 * @returns 할인가
 *
 * @example
 * calculateDiscountedPrice(100000, 5) // 95000
 */
export const calculateDiscountedPrice = (
  price: number,
  discountRate: number
): number => {
  return price * (1 - discountRate / 100);
};

/**
 * 할인 금액 계산
 *
 * @param price - 원가
 * @param discountRate - 할인율 (0-100)
 * @returns 할인 금액
 *
 * @example
 * calculateDiscountAmount(100000, 5) // 5000
 */
export const calculateDiscountAmount = (
  price: number,
  discountRate: number
): number => {
  return price * (discountRate / 100);
};

/**
 * 매입가 계산
 *
 * @param price - 액면가
 * @param tradeInRate - 수수료율 (0-100)
 * @returns 매입가 (사용자 수령액)
 *
 * @example
 * calculatePayoutAmount(100000, 20) // 80000
 */
export const calculatePayoutAmount = (
  price: number,
  tradeInRate: number
): number => {
  return price * (1 - tradeInRate / 100);
};

/**
 * 총액 계산 (아이템 배열)
 *
 * @param items - { price: number, quantity: number }[] 형태의 아이템 배열
 * @returns 총액
 */
export const calculateTotal = (
  items: Array<{ price: number | string; quantity: number }>
): number => {
  return items.reduce((total, item) => {
    return total + (Number(item.price) || 0) * item.quantity;
  }, 0);
};

/**
 * 백분율 포맷팅
 *
 * @param value - 포맷팅할 숫자 (0-100)
 * @returns 포맷팅된 문자열 (예: "5%")
 */
export const formatPercent = (value: number): string => {
  return `${value}%`;
};

/**
 * 할인 배지 텍스트 생성
 *
 * @param discountRate - 할인율
 * @returns 배지 텍스트 (예: "-5%")
 */
export const getDiscountBadgeText = (discountRate: number): string => {
  return `-${discountRate}%`;
};

// ============================================================================
// Extended Price Utilities
// ============================================================================

/**
 * 상품 가격 정보 타입
 */
export interface PriceBreakdown {
  /** 원가 (액면가) */
  originalPrice: number;
  /** 판매가 (할인 적용) */
  salePrice: number;
  /** 할인 금액 */
  discountAmount: number;
  /** 할인율 */
  discountRate: number;
  /** 절약 금액 (= 할인 금액) */
  savings: number;
  /** 포맷팅된 원가 */
  formattedOriginal: string;
  /** 포맷팅된 판매가 */
  formattedSale: string;
  /** 포맷팅된 할인 금액 */
  formattedDiscount: string;
  /** 포맷팅된 할인율 */
  formattedRate: string;
}

/**
 * 상품 가격 상세 정보 계산
 *
 * @param price - 원가
 * @param discountRate - 할인율 (0-100)
 * @returns 가격 상세 정보 객체
 *
 * @example
 * const breakdown = getPriceBreakdown(100000, 5);
 * // {
 * //   originalPrice: 100000,
 * //   salePrice: 95000,
 * //   discountAmount: 5000,
 * //   discountRate: 5,
 * //   savings: 5000,
 * //   formattedOriginal: "100,000원",
 * //   formattedSale: "95,000원",
 * //   formattedDiscount: "5,000원",
 * //   formattedRate: "5%"
 * // }
 */
export const getPriceBreakdown = (
  price: number,
  discountRate: number,
  formatOptions?: FormatPriceOptions,
): PriceBreakdown => {
  const originalPrice = Number(price) || 0;
  const rate = Number(discountRate) || 0;
  const salePrice = calculateDiscountedPrice(originalPrice, rate);
  const discountAmount = calculateDiscountAmount(originalPrice, rate);

  return {
    originalPrice,
    salePrice,
    discountAmount,
    discountRate: rate,
    savings: discountAmount,
    formattedOriginal: formatPrice(originalPrice, formatOptions),
    formattedSale: formatPrice(salePrice, formatOptions),
    formattedDiscount: formatPrice(discountAmount, formatOptions),
    formattedRate: formatPercent(rate),
  };
};

/**
 * 매입 가격 정보 타입
 */
export interface TradeInPriceBreakdown {
  /** 액면가 */
  faceValue: number;
  /** 수수료율 */
  commissionRate: number;
  /** 수수료 금액 */
  commissionAmount: number;
  /** 매입가 (지급액) */
  payoutAmount: number;
  /** 포맷팅된 액면가 */
  formattedFaceValue: string;
  /** 포맷팅된 수수료 */
  formattedCommission: string;
  /** 포맷팅된 지급액 */
  formattedPayout: string;
  /** 지급률 (100 - 수수료율) */
  payoutRate: number;
}

/**
 * 매입 가격 상세 정보 계산
 *
 * @param faceValue - 액면가
 * @param commissionRate - 수수료율 (0-100)
 * @returns 매입 가격 상세 정보 객체
 *
 * @example
 * const breakdown = getTradeInBreakdown(100000, 20);
 * // {
 * //   faceValue: 100000,
 * //   commissionRate: 20,
 * //   commissionAmount: 20000,
 * //   payoutAmount: 80000,
 * //   formattedFaceValue: "100,000원",
 * //   formattedCommission: "20,000원",
 * //   formattedPayout: "80,000원",
 * //   payoutRate: 80
 * // }
 */
export const getTradeInBreakdown = (
  faceValue: number,
  commissionRate: number,
  formatOptions?: FormatPriceOptions,
): TradeInPriceBreakdown => {
  const value = Number(faceValue) || 0;
  const rate = Number(commissionRate) || 0;
  const payoutAmount = calculatePayoutAmount(value, rate);
  const commissionAmount = value - payoutAmount;

  return {
    faceValue: value,
    commissionRate: rate,
    commissionAmount,
    payoutAmount,
    formattedFaceValue: formatPrice(value, formatOptions),
    formattedCommission: formatPrice(commissionAmount, formatOptions),
    formattedPayout: formatPrice(payoutAmount, formatOptions),
    payoutRate: 100 - rate,
  };
};

/**
 * 장바구니 총액 정보 타입
 */
export interface CartTotalBreakdown {
  /** 상품 총액 (원가 기준) */
  subtotal: number;
  /** 총 할인 금액 */
  totalDiscount: number;
  /** 최종 결제 금액 */
  grandTotal: number;
  /** 상품 개수 */
  itemCount: number;
  /** 포맷팅된 상품 총액 */
  formattedSubtotal: string;
  /** 포맷팅된 할인 금액 */
  formattedDiscount: string;
  /** 포맷팅된 최종 금액 */
  formattedTotal: string;
}

/**
 * 장바구니 아이템 타입
 */
export interface CartItem {
  price: number | string;
  buyPrice?: number | string;
  quantity: number;
}

/**
 * 장바구니 총액 상세 계산
 *
 * @param items - 장바구니 아이템 배열
 * @returns 장바구니 총액 상세 정보
 */
export const getCartTotalBreakdown = (
  items: CartItem[],
  formatOptions?: FormatPriceOptions,
): CartTotalBreakdown => {
  let subtotal = 0;
  let grandTotal = 0;
  let itemCount = 0;

  for (const item of items) {
    const originalPrice = Number(item.price) || 0;
    const salePrice = Number(item.buyPrice ?? item.price) || 0;
    const qty = item.quantity || 0;

    subtotal += originalPrice * qty;
    grandTotal += salePrice * qty;
    itemCount += qty;
  }

  const totalDiscount = subtotal - grandTotal;

  return {
    subtotal,
    totalDiscount,
    grandTotal,
    itemCount,
    formattedSubtotal: formatPrice(subtotal, formatOptions),
    formattedDiscount: formatPrice(totalDiscount, formatOptions),
    formattedTotal: formatPrice(grandTotal, formatOptions),
  };
};

/**
 * 금액 범위 포맷팅
 *
 * @param min - 최소 금액
 * @param max - 최대 금액
 * @returns 포맷팅된 범위 문자열
 *
 * @example
 * formatPriceRange(10000, 50000) // "10,000원 ~ 50,000원"
 * formatPriceRange(10000, 10000) // "10,000원"
 */
export const formatPriceRange = (
  min: number,
  max: number,
  formatOptions?: FormatPriceOptions,
): string => {
  if (min === max) {
    return formatPrice(min, formatOptions);
  }
  return `${formatPrice(min, formatOptions)} ~ ${formatPrice(max, formatOptions)}`;
};

/** 축약 포맷팅 옵션 */
export interface FormatPriceShortOptions {
  /** 로케일 (기본: 'ko-KR') */
  locale?: string;
  /** 통화 단위 (기본: '원') */
  currencyUnit?: string;
  /** 만 단위 접미사 (기본: '만') */
  tenThousandSuffix?: string;
  /** 만 단위 기준값 (기본: 10000) */
  tenThousandUnit?: number;
}

/**
 * 금액 단위 축약 (만원 단위)
 *
 * @param value - 금액
 * @param options - 축약 옵션
 * @returns 축약된 문자열
 *
 * @example
 * formatPriceShort(50000)   // "5만원"
 * formatPriceShort(100000)  // "10만원"
 * formatPriceShort(1500000) // "150만원"
 * formatPriceShort(5000)    // "5,000원"
 */
export const formatPriceShort = (
  value: number,
  options: FormatPriceShortOptions = {}
): string => {
  const {
    locale = 'ko-KR',
    currencyUnit = '원',
    tenThousandSuffix = '만',
    tenThousandUnit = 10000,
  } = options;
  const num = Number(value) || 0;

  if (num >= tenThousandUnit && num % tenThousandUnit === 0) {
    return `${num / tenThousandUnit}${tenThousandSuffix}${currencyUnit}`;
  }

  return formatPrice(num, { locale, currencyUnit });
};

/**
 * 가격 유효성 검사
 *
 * @param value - 검사할 값
 * @returns 유효한 양수인지 여부
 */
export const isValidPrice = (value: unknown): boolean => {
  const num = Number(value);
  return !isNaN(num) && num >= 0 && isFinite(num);
};

/**
 * 가격 비교
 *
 * @param a - 첫 번째 금액
 * @param b - 두 번째 금액
 * @returns -1 (a < b), 0 (a === b), 1 (a > b)
 */
export const comparePrice = (a: number, b: number): -1 | 0 | 1 => {
  const numA = Number(a) || 0;
  const numB = Number(b) || 0;

  if (numA < numB) return -1;
  if (numA > numB) return 1;
  return 0;
};
