/**
 * @file dateUtils.ts
 * @description 날짜/시간 유틸리티 함수
 * @module shared/utils
 *
 * 사용처:
 * - OrdersService: 일일 구매 한도 계산 (오늘 자정 기준)
 */

/**
 * 오늘 시작 시간 (00:00:00.000) 반환
 *
 * @returns 오늘 자정 Date 객체
 *
 * @example
 * // 현재: 2024-01-15 14:30:00
 * getStartOfDay() // 2024-01-15 00:00:00.000
 */
export function getStartOfDay(date: Date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}
