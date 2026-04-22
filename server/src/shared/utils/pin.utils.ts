/**
 * @file pin.utils.ts
 * @description PIN 번호 정규화 유틸리티
 * @module shared/utils
 *
 * 사용처:
 * - VoucherService: PIN 대량 등록 시 해시 생성
 * - TradeInService: 매입 신청 시 PIN 중복 체크용 해시 생성
 *
 * PIN 정규화 규칙:
 * - 숫자가 아닌 문자(하이픈, 공백 등) 제거
 * - 원본 형식 보존이 필요한 경우 정규화 전 값을 별도 저장
 */

/**
 * PIN 번호에서 숫자만 추출 (정규화)
 *
 * 하이픈, 공백, 점 등 비숫자 문자를 모두 제거하여
 * 해시 비교 시 형식 차이에 의한 오탐 방지
 *
 * @example
 * normalizePinDigits('1234-5678-9012') // '123456789012'
 * normalizePinDigits('1234 5678 9012') // '123456789012'
 * normalizePinDigits('123456789012')   // '123456789012' (변경 없음)
 *
 * @param pin - 원본 PIN 번호 (하이픈/공백 포함 가능)
 * @returns 숫자만 포함된 정규화된 PIN
 */
export function normalizePinDigits(pin: string): string {
  return pin.replace(/\D/g, '');
}
