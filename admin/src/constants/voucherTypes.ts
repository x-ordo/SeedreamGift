/**
 * @file voucherTypes.ts
 * @description 상품권 종류 관련 유틸리티 - 정규화, 브랜드 옵션, 이미지 매핑
 * @module constants
 *
 * 주요 기능:
 * - 브랜드 코드/한글명 정규화 (SHINSEGAE <-> 신세계)
 * - 브랜드별 상품 이미지 매핑
 * - 폼/필터용 브랜드 선택 옵션
 *
 * 사용 예시:
 * ```tsx
 * import { normalizeVoucherType, getProductImage, BRAND_OPTIONS } from '@/constants';
 *
 * const koreanName = normalizeVoucherType('SHINSEGAE'); // '신세계'
 * const imageUrl = getProductImage('신세계', 50000); // '/assets/img/product/shin_5.jpg'
 * ```
 */

/**
 * 브랜드 선택 옵션 (폼, 필터 등에서 사용)
 */
export const BRAND_OPTIONS = [
  { value: 'SHINSEGAE', label: '신세계' },
  { value: 'HYUNDAI', label: '현대' },
  { value: 'LOTTE', label: '롯데' },
  { value: 'DAISO', label: '다이소' },
  { value: 'CU', label: 'CU' },
  { value: 'WGIFT', label: '씨드림상품권' },
  { value: 'EX', label: '이엑스' },
] as const;

/**
 * 상품권 종류 정규화 (영문 코드 -> 한글명)
 *
 * @param voucherType - 원본 상품권 종류 (영문 또는 한글)
 * @returns 정규화된 한글명 (알 수 없으면 원본 반환)
 *
 * @example
 * normalizeVoucherType('SHINSEGAE') // '신세계'
 * normalizeVoucherType('현대')       // '현대'
 */
export function normalizeVoucherType(voucherType: string | undefined | null): string {
  if (!voucherType) return '';
  const upper = voucherType.toUpperCase();
  if (upper === 'SHINSEGAE' || voucherType === '신세계') return '신세계';
  if (upper === 'HYUNDAI' || voucherType === '현대') return '현대';
  if (upper === 'LOTTE' || voucherType === '롯데') return '롯데';
  if (upper === 'WGIFT' || voucherType === '씨드림상품권') return '씨드림상품권';
  if (upper === 'DAISO' || voucherType === '다이소') return '다이소';
  if (upper === 'CU' || voucherType === 'CU') return 'CU';
  if (upper === 'EX' || voucherType === '이엑스') return '이엑스';
  return voucherType;
}

/**
 * 상품 이미지 매핑 (데이터베이스에 이미지 URL이 없을 경우를 위한 폴백)
 */
const PRODUCT_IMAGE_MAP: Record<string, Record<number, string>> = {
  '신세계': {
    5000: '/assets/img/product/shin_05.svg',
    10000: '/assets/img/product/shin_1.svg',
    30000: '/assets/img/product/shin_3.svg',
    50000: '/assets/img/product/shin_5.svg',
    100000: '/assets/img/product/shin_10.svg',
    500000: '/assets/img/product/shin_50.svg',
  },
  '현대': {
    5000: '/assets/img/product/hyun_05.svg',
    10000: '/assets/img/product/hyun_1.svg',
    30000: '/assets/img/product/hyun_3.svg',
    50000: '/assets/img/product/hyun_5.svg',
    100000: '/assets/img/product/hyun_10.svg',
    500000: '/assets/img/product/hyun_50.svg',
  },
  '롯데': {
    5000: '/assets/img/product/lotte_05.svg',
    10000: '/assets/img/product/lotte_1.svg',
    30000: '/assets/img/product/lotte_3.svg',
    50000: '/assets/img/product/lotte_5.svg',
    100000: '/assets/img/product/lotte_10.svg',
    500000: '/assets/img/product/lotte_50.svg',
  },
  '다이소': {
    1000: '/assets/img/product/daiso_01.svg',
    5000: '/assets/img/product/daiso_05.svg',
    10000: '/assets/img/product/daiso_1.svg',
    50000: '/assets/img/product/daiso_5.svg',
    100000: '/assets/img/product/daiso_10.svg',
  },
  'CU': {
    1000: '/assets/img/product/cu_01.svg',
    5000: '/assets/img/product/cu_05.svg',
    10000: '/assets/img/product/cu_1.svg',
    50000: '/assets/img/product/cu_5.svg',
  },
  '씨드림상품권': {
    1000: '/assets/img/product/seedream_01.svg',
    10000: '/assets/img/product/seedream_1.svg',
    50000: '/assets/img/product/seedream_5.svg',
    100000: '/assets/img/product/seedream_10.svg',
    500000: '/assets/img/product/seedream_50.svg',
  },
};

/**
 * 상품 이미지 URL 가져오기
 *
 * @param voucherType - 상품권 종류 (영문 또는 한글)
 * @param price - 액면가
 * @returns 이미지 URL (정확한 매칭만, 없으면 null)
 *
 * @example
 * getProductImage('신세계', 50000)  // '/assets/img/product/shin_5.svg'
 * getProductImage('HYUNDAI', 100000) // '/assets/img/product/hyun_10.svg'
 */
export function getProductImage(voucherType: string, price: number): string | null {
  const normalized = normalizeVoucherType(voucherType);
  const typeImages = PRODUCT_IMAGE_MAP[normalized];

  if (!typeImages) return null;

  return typeImages[price] || null;
}

/**
 * 상품권 종류별 기본 이미지 가져오기 (가장 낮은 가격 이미지)
 *
 * @param voucherType - 상품권 종류 (영문 또는 한글)
 * @returns 기본 이미지 URL (없으면 null)
 */
export function getVoucherTypeDefaultImage(voucherType: string): string | null {
  const normalized = normalizeVoucherType(voucherType);
  const typeImages = PRODUCT_IMAGE_MAP[normalized];

  if (!typeImages) return null;

  const lowestPrice = Math.min(...Object.keys(typeImages).map(Number));
  return typeImages[lowestPrice] || null;
}