/**
 * @file pin-config.interface.ts
 * @description PIN 설정 인터페이스 및 브랜드별 기본 설정
 * @module shared/types
 *
 * 포함 내용:
 * - PinConfiguration: PIN 코드 구조 인터페이스
 * - DEFAULT_PIN_CONFIGS: 브랜드별 기본 PIN 설정
 * - parsePinConfig: JSON 문자열 파싱 함수
 * - getDefaultPinConfig: 브랜드 코드로 기본 설정 조회
 *
 * 지원 브랜드:
 * - HYUNDAI: 16자리 PIN + 4자리 보안코드
 * - SHINSEGAE: 6자리 PIN + 3자리 보안코드 + 13자리 권번호
 * - LOTTE: 16자리 PIN
 * - WGIFT: 16자리 PIN
 * - DAISO: 12자리 PIN
 * - CU: 12 또는 16자리 PIN
 *
 * 사용처:
 * - PinValidatorService: PIN 유효성 검사
 * - TradeInService: 매입 PIN 검증
 * - 클라이언트 PIN 입력 UI
 */

/**
 * PIN 설정 인터페이스
 *
 * 브랜드별 PIN 코드 구조를 정의합니다.
 * Product.pinConfig 필드에 JSON으로 저장됩니다.
 */
export interface PinConfiguration {
  /** PIN 기본 길이 */
  pinLength: number;

  /** PIN 세그먼트 패턴 (예: [4,4,4,4] = 16자리 4-4-4-4 형식) */
  pinPattern: number[];

  /** 보안코드 필요 여부 (현대, 신세계) */
  hasSecurityCode: boolean;

  /** 보안코드 길이 (현대: 4자리, 신세계: 3자리) */
  securityCodeLength?: number;

  /** 권번호 필요 여부 (신세계) */
  hasGiftNumber: boolean;

  /** 권번호 길이 (신세계: 13자리) */
  giftNumberLength?: number;

  /** 허용 가능한 PIN 길이 배열 (CU: 12 또는 16) */
  allowedLengths?: number[];

  /** PIN이 영숫자 혼합인지 여부 (EX 브랜드 등) */
  pinAlphanumeric?: boolean;

  /** 권번호 세그먼트 패턴 (예: [3,4,5] = CODE1(3)-CODE2(4)-CODE3(5)) */
  giftNumberPattern?: number[];

  /** 라벨 텍스트 */
  labels: {
    pin: string;
    securityCode?: string;
    giftNumber?: string;
  };
}

/**
 * 브랜드별 기본 PIN 설정
 */
export const DEFAULT_PIN_CONFIGS: Record<string, PinConfiguration> = {
  HYUNDAI: {
    pinLength: 16,
    pinPattern: [4, 4, 4, 4],
    hasSecurityCode: true,
    securityCodeLength: 4,
    hasGiftNumber: false,
    labels: {
      pin: 'PIN 번호',
      securityCode: '보안코드',
    },
  },
  SHINSEGAE: {
    pinLength: 6,
    pinPattern: [6],
    hasSecurityCode: true,
    securityCodeLength: 3,
    hasGiftNumber: true,
    giftNumberLength: 13,
    labels: {
      pin: 'PIN 번호',
      securityCode: '보안코드',
      giftNumber: '권번호',
    },
  },
  LOTTE: {
    pinLength: 16,
    pinPattern: [4, 4, 4, 4],
    hasSecurityCode: false,
    hasGiftNumber: false,
    labels: {
      pin: 'PIN 번호',
    },
  },
  WGIFT: {
    pinLength: 16,
    pinPattern: [4, 4, 4, 4],
    hasSecurityCode: false,
    hasGiftNumber: false,
    labels: {
      pin: 'PIN 번호',
    },
  },
  DAISO: {
    pinLength: 12,
    pinPattern: [4, 4, 4],
    hasSecurityCode: false,
    hasGiftNumber: false,
    labels: {
      pin: 'PIN 번호',
    },
  },
  CU: {
    pinLength: 12,
    pinPattern: [4, 4, 4],
    hasSecurityCode: false,
    hasGiftNumber: false,
    allowedLengths: [12, 16],
    labels: {
      pin: 'PIN 번호',
    },
  },
  EX: {
    pinLength: 16,
    pinPattern: [16],
    pinAlphanumeric: true,
    hasSecurityCode: false,
    hasGiftNumber: true,
    giftNumberPattern: [3, 4, 5],
    labels: {
      pin: '인증코드',
      giftNumber: '카드번호',
    },
  },
  DEFAULT: {
    pinLength: 16,
    pinPattern: [4, 4, 4, 4],
    hasSecurityCode: false,
    hasGiftNumber: false,
    labels: {
      pin: 'PIN 번호',
    },
  },
};

/**
 * PIN 설정 JSON 문자열 파싱
 */
export function parsePinConfig(
  pinConfigJson: string | null | undefined,
): PinConfiguration {
  if (!pinConfigJson) {
    return DEFAULT_PIN_CONFIGS.DEFAULT;
  }
  try {
    return JSON.parse(pinConfigJson) as PinConfiguration;
  } catch {
    return DEFAULT_PIN_CONFIGS.DEFAULT;
  }
}

/**
 * 브랜드 코드로 기본 PIN 설정 조회
 */
export function getDefaultPinConfig(brandCode: string): PinConfiguration {
  const upperCode = brandCode.toUpperCase();
  return DEFAULT_PIN_CONFIGS[upperCode] || DEFAULT_PIN_CONFIGS.DEFAULT;
}
