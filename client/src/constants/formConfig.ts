/**
 * @file formConfig.ts
 * @description 폼 관련 상수 - 은행 목록, 단계 설정 등
 * @module constants
 *
 * 주요 기능:
 * - 국내 주요 은행 목록 (카카오뱅크, 토스뱅크 포함)
 * - 판매 신청 단계 설정 (StepConfig)
 * - 배송 방법 옵션
 * - PIN/계좌번호 유효성 검사 규칙
 *
 * 사용 예시:
 * ```tsx
 * import { BANKS, TRADEIN_STEPS, PIN_VALIDATION } from '@/constants';
 *
 * // 은행 선택 드롭다운
 * <select>
 *   {BANKS.map(bank => <option key={bank}>{bank}</option>)}
 * </select>
 *
 * // PIN 유효성 검사
 * if (pin.length < PIN_VALIDATION.MIN_LENGTH) {
 *   setError('PIN은 8자 이상이어야 합니다.');
 * }
 * ```
 */

/**
 * 은행 목록 (Coocon API fnni_cd 코드 포함)
 * - 국내 주요 은행 및 저축은행
 */
export const BANKS = [
  { name: '국민은행', code: '004' },
  { name: '신한은행', code: '088' },
  { name: '우리은행', code: '020' },
  { name: '하나은행', code: '081' },
  { name: 'NH농협', code: '011' },
  { name: '기업은행', code: '003' },
  { name: 'SC제일은행', code: '023' },
  { name: '씨티은행', code: '027' },
  { name: '카카오뱅크', code: '090' },
  { name: '토스뱅크', code: '092' },
  { name: '케이뱅크', code: '089' },
  { name: '새마을금고', code: '045' },
  { name: '신협', code: '048' },
  { name: '우체국', code: '071' },
  { name: '부산은행', code: '032' },
  { name: '대구은행', code: '031' },
  { name: '경남은행', code: '039' },
  { name: '광주은행', code: '034' },
  { name: '전북은행', code: '037' },
  { name: '제주은행', code: '035' },
] as const;

/**
 * 은행 타입
 */
export type BankName = typeof BANKS[number]['name'];

/**
 * TradeIn 단계 설정
 */
export interface StepConfig {
  step: number;
  label: string;
  description?: string;
}

export const TRADEIN_STEPS: StepConfig[] = [
  { step: 1, label: '종류 선택', description: '상품권 종류를 선택하세요' },
  { step: 2, label: '정보 입력', description: '권종과 PIN을 입력하세요' },
  { step: 3, label: '계좌 입력', description: '입금받을 계좌를 입력하세요' },
];

/**
 * TradeIn 2단계 폼 (브랜드 선택 후)
 * - ProductListPage 판매 모드에서 사용
 */
export const TRADEIN_FORM_STEPS: StepConfig[] = [
  { step: 1, label: '상품 정보', description: '권종과 수량을 선택하세요' },
  { step: 2, label: '신청자 정보', description: '연락처와 계좌를 입력하세요' },
  { step: 3, label: '발송 정보', description: '배송 방법과 메시지를 입력하세요' },
];

/**
 * TradeIn 모바일 상품권 폼 (2단계 - 배송 정보 불필요)
 */
export const TRADEIN_MOBILE_STEPS: StepConfig[] = [
  { step: 1, label: '상품 정보', description: '권종과 PIN을 입력하세요' },
  { step: 2, label: '신청자 정보', description: '연락처와 계좌를 입력하세요' },
];

/**
 * 발송(배송) 방법 옵션
 */
export const SHIPPING_METHODS = [
  '익일특급(빠른등기)',
  '일반등기',
  '택배',
  '방문접수',
] as const;

/**
 * PIN 입력 규칙
 */
export const PIN_VALIDATION = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 20,
  PATTERN: /^[0-9-]+$/,
} as const;

/**
 * 계좌번호 입력 규칙
 */
export const ACCOUNT_VALIDATION = {
  MIN_LENGTH: 10,
  MAX_LENGTH: 20,
  PATTERN: /^[0-9]+$/,
} as const;
