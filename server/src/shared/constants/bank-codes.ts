/**
 * @file bank-codes.ts
 * @description Coocon API 금융결제원 표준 은행 코드 매핑
 * @module shared/constants
 *
 * 사용처:
 * - KycService: 1원 인증 시 은행 코드 변환
 * - KycController: 요청 검증
 */

/** Coocon API fnni_cd 은행 코드 매핑 */
export const BANK_CODES: Record<string, string> = {
  국민은행: '004',
  신한은행: '088',
  우리은행: '020',
  하나은행: '081',
  NH농협: '011',
  기업은행: '003',
  SC제일은행: '023',
  씨티은행: '027',
  카카오뱅크: '090',
  토스뱅크: '092',
  케이뱅크: '089',
  새마을금고: '045',
  신협: '048',
  우체국: '071',
  부산은행: '032',
  대구은행: '031',
  경남은행: '039',
  광주은행: '034',
  전북은행: '037',
  제주은행: '035',
} as const;

/** 유효한 은행 코드 배열 */
export const VALID_BANK_CODES = Object.values(BANK_CODES);

/** 은행 코드 → 은행명 역매핑 */
export const BANK_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(BANK_CODES).map(([name, code]) => [code, name]),
);
