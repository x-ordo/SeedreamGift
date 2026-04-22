/**
 * @file pinPatterns.ts
 * @description 브랜드별 PIN 코드 패턴 정의
 * @module constants
 *
 * 주요 기능:
 * - 브랜드별 PIN 세그먼트 패턴 정의 (예: [4,4,4,4] = 16자리)
 * - 보안코드/권번호 필요 여부 설정
 * - PIN 포맷팅 및 유효성 검사 유틸리티
 *
 * 사용 예시:
 * ```tsx
 * import { getPinConfig, formatPin, isValidPin } from '@/constants';
 *
 * const config = getPinConfig('HYUNDAI');
 * // { pinLength: 16, pinPattern: [4,4,4,4], hasSecurityCode: true, ... }
 *
 * const formatted = formatPin('1234567890123456', [4,4,4,4]);
 * // '1234-5678-9012-3456'
 * ```
 */

/** 브랜드 코드 타입 */
export type BrandCode =
    | 'SHINSEGAE'
    | 'HYUNDAI'
    | 'LOTTE'
    | 'WGIFT'
    | 'DAISO'
    | 'CU'
    | 'OLIVEYOUNG'
    | 'EX'
    | 'DEFAULT';

/** PIN 패턴 (각 세그먼트의 자릿수 배열) */
export type PinPattern = number[];

/** PIN 설정 인터페이스 */
export interface PinConfiguration {
    /** PIN 기본 길이 */
    pinLength: number;
    /** PIN 세그먼트 패턴 */
    pinPattern: PinPattern;
    /** 보안코드 필요 여부 */
    hasSecurityCode: boolean;
    /** 보안코드 길이 */
    securityCodeLength?: number;
    /** 권번호 필요 여부 */
    hasGiftNumber: boolean;
    /** 권번호 길이 */
    giftNumberLength?: number;
    /** 허용 가능한 PIN 길이 배열 (CU: 12 또는 16) */
    allowedLengths?: number[];
    /** 라벨 텍스트 */
    labels: {
        pin: string;
        securityCode?: string;
        giftNumber?: string;
    };
}

/** 브랜드별 PIN 패턴 매핑 */
export const PIN_PATTERNS: Record<BrandCode, PinPattern> = {
    /** 현대 - 16자리 (4-4-4-4) + 보안코드 4자리 */
    HYUNDAI: [4, 4, 4, 4],
    /** 신세계 - 6자리 PIN + 보안코드 3자리 + 권번호 13자리 */
    SHINSEGAE: [6],
    /** 롯데 - 16자리 (4-4-4-4) */
    LOTTE: [4, 4, 4, 4],
    /** W상품권 - 16자리 (4-4-4-4) */
    WGIFT: [4, 4, 4, 4],
    /** 다이소 - 12자리 (4-4-4) */
    DAISO: [4, 4, 4],
    /** CU - 12자리 (4-4-4) 또는 16자리 */
    CU: [4, 4, 4],
    /** 올리브영 - 16자리 (4-4-4-4) */
    OLIVEYOUNG: [4, 4, 4, 4],
    /** 이엑스 - 16자리 영숫자 */
    EX: [16],
    /** 기본 - 16자리 (4-4-4-4) */
    DEFAULT: [4, 4, 4, 4],
};

/** 브랜드별 전체 PIN 설정 */
export const PIN_CONFIGS: Record<BrandCode, PinConfiguration> = {
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
        allowedLengths: [12, 16],
        hasSecurityCode: false,
        hasGiftNumber: false,
        labels: {
            pin: 'PIN 번호',
        },
    },
    OLIVEYOUNG: {
        pinLength: 16,
        pinPattern: [4, 4, 4, 4],
        hasSecurityCode: false,
        hasGiftNumber: false,
        labels: {
            pin: 'PIN 번호',
        },
    },
    EX: {
        pinLength: 16,
        pinPattern: [16],
        hasSecurityCode: false,
        hasGiftNumber: true,
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
 * 브랜드 코드로 PIN 패턴 조회
 * @param brandCode 브랜드 코드
 * @returns PIN 패턴 배열
 */
export const getPinPattern = (brandCode: string | undefined): PinPattern => {
    if (!brandCode) return PIN_PATTERNS.DEFAULT;
    const upperCode = brandCode.toUpperCase() as BrandCode;
    return PIN_PATTERNS[upperCode] || PIN_PATTERNS.DEFAULT;
};

/**
 * 브랜드 코드로 전체 PIN 설정 조회
 * @param brandCode 브랜드 코드
 * @returns PIN 설정 객체
 */
export const getPinConfig = (brandCode: string | undefined): PinConfiguration => {
    if (!brandCode) return PIN_CONFIGS.DEFAULT;
    const upperCode = brandCode.toUpperCase() as BrandCode;
    return PIN_CONFIGS[upperCode] || PIN_CONFIGS.DEFAULT;
};

/**
 * PIN 패턴의 전체 자릿수 계산
 * @param pattern PIN 패턴
 * @returns 전체 자릿수
 */
export const getTotalPinLength = (pattern: PinPattern): number => {
    return pattern.reduce((sum, len) => sum + len, 0);
};

/**
 * PIN 값을 패턴에 맞게 포맷팅
 * @param value 원본 PIN 값 (숫자만)
 * @param pattern PIN 패턴
 * @param separator 구분자 (기본: -)
 * @returns 포맷팅된 PIN 문자열
 */
export const formatPin = (
    value: string,
    pattern: PinPattern,
    separator: string = '-'
): string => {
    const cleanValue = value.replace(/\D/g, '');
    const segments: string[] = [];
    let position = 0;

    for (const length of pattern) {
        if (position >= cleanValue.length) break;
        segments.push(cleanValue.slice(position, position + length));
        position += length;
    }

    return segments.join(separator);
};

/**
 * 포맷팅된 PIN에서 숫자만 추출
 * @param formattedValue 포맷팅된 PIN
 * @returns 숫자만 포함된 문자열
 */
export const unformatPin = (formattedValue: string): string => {
    return formattedValue.replace(/\D/g, '');
};

/**
 * PIN 유효성 검사
 * @param value PIN 값 (숫자만)
 * @param pattern PIN 패턴
 * @returns 유효 여부
 */
export const isValidPin = (value: string, pattern: PinPattern): boolean => {
    const cleanValue = value.replace(/\D/g, '');
    const expectedLength = getTotalPinLength(pattern);
    return cleanValue.length === expectedLength && /^\d+$/.test(cleanValue);
};
