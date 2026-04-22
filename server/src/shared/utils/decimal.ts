/**
 * @file decimal.ts
 * @description Decimal 타입 변환 유틸리티 - MSSQL에서 반환되는 Decimal 문자열 처리
 */

/**
 * Decimal 또는 문자열을 숫자로 변환
 * MSSQL Decimal 타입은 문자열로 반환되므로 Number()로 변환 필요
 */
export const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

/**
 * 가격 포맷팅 (원화)
 */
export const formatPrice = (value: unknown): string => {
  return toNumber(value).toLocaleString('ko-KR') + '원';
};
