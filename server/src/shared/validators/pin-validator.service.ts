/**
 * @file pin-validator.service.ts
 * @description PIN 유효성 검사 서비스 - 브랜드별 PIN 형식 검증
 * @module shared/validators
 *
 * 제공 기능:
 * - validate: PIN 코드 유효성 검사 (결과 반환)
 * - validateOrThrow: PIN 코드 유효성 검사 (예외 발생)
 * - getPinConfig: PIN 설정 조회
 * - formatPin: PIN 포맷팅 (화면 표시용)
 *
 * 검증 항목:
 * - PIN 길이 (브랜드별 상이)
 * - 숫자만 허용
 * - 보안코드 필수 여부 및 길이 (현대, 신세계)
 * - 권번호 필수 여부 및 길이 (신세계)
 *
 * 사용처:
 * - TradeInService: 매입 신청 시 PIN 검증
 * - VoucherController: 바우처 등록 시 PIN 검증
 */
import * as crypto from 'crypto';

import { Injectable, BadRequestException } from '@nestjs/common';

import {
  PinConfiguration,
  parsePinConfig,
  getDefaultPinConfig,
} from '../types/pin-config.interface';

/**
 * PIN 유효성 검사 입력 인터페이스
 */
export interface PinValidationInput {
  pinCode: string;
  securityCode?: string;
  giftNumber?: string;
}

/**
 * PIN 유효성 검사 결과 인터페이스
 */
export interface PinValidationResult {
  isValid: boolean;
  errors: string[];
  cleanedPin: string;
  cleanedSecurityCode?: string;
  cleanedGiftNumber?: string;
  combinedHash: string;
}

/**
 * PIN 유효성 검사 서비스
 *
 * 브랜드별 PIN 형식에 맞는 유효성 검사를 수행합니다.
 * 검증 실패 시 상세한 에러 메시지를 제공합니다.
 *
 * @example
 * const result = pinValidator.validate(
 *   { pinCode: '1234567890123456', securityCode: '1234' },
 *   null,
 *   'HYUNDAI'
 * );
 * if (!result.isValid) {
 *   console.log(result.errors);
 * }
 */
@Injectable()
export class PinValidatorService {
  /**
   * PIN 코드 유효성 검사
   * @param input PIN 입력값
   * @param pinConfigJson 브랜드 PIN 설정 JSON (없으면 brandCode 사용)
   * @param brandCode 브랜드 코드 (pinConfigJson 없을 때 기본값 조회용)
   */
  validate(
    input: PinValidationInput,
    pinConfigJson?: string | null,
    brandCode?: string,
  ): PinValidationResult {
    const config = pinConfigJson
      ? parsePinConfig(pinConfigJson)
      : brandCode
        ? getDefaultPinConfig(brandCode)
        : getDefaultPinConfig('DEFAULT');

    const errors: string[] = [];

    // PIN 코드 정제 (영숫자 브랜드는 공백/하이픈만 제거, 일반은 숫자만)
    const cleanedPin = config.pinAlphanumeric
      ? input.pinCode.replace(/[\s-]/g, '')
      : this.cleanNumericString(input.pinCode);
    const cleanedSecurityCode = input.securityCode
      ? this.cleanNumericString(input.securityCode)
      : undefined;
    const cleanedGiftNumber = input.giftNumber
      ? config.giftNumberPattern
        ? input.giftNumber.replace(/[\s-]/g, '') // 세그먼트 패턴이 있으면 공백/하이픈만 제거
        : this.cleanNumericString(input.giftNumber)
      : undefined;

    // PIN 길이 검증
    const validPinLengths = config.allowedLengths || [config.pinLength];
    if (!validPinLengths.includes(cleanedPin.length)) {
      errors.push(
        `PIN 코드는 ${validPinLengths.join(' 또는 ')}자리여야 합니다. (현재: ${cleanedPin.length}자리)`,
      );
    }

    // PIN 문자 유효성 검증
    if (config.pinAlphanumeric) {
      if (!/^[A-Za-z0-9]+$/.test(cleanedPin)) {
        errors.push('PIN 코드는 영문자와 숫자만 입력 가능합니다.');
      }
    } else if (!/^\d+$/.test(cleanedPin)) {
      errors.push('PIN 코드는 숫자만 입력 가능합니다.');
    }

    // 보안코드 검증 (필요한 경우)
    if (config.hasSecurityCode) {
      if (!cleanedSecurityCode) {
        errors.push('보안코드를 입력해주세요.');
      } else if (cleanedSecurityCode.length !== config.securityCodeLength) {
        errors.push(
          `보안코드는 ${config.securityCodeLength}자리여야 합니다. (현재: ${cleanedSecurityCode.length}자리)`,
        );
      } else if (!/^\d+$/.test(cleanedSecurityCode)) {
        errors.push('보안코드는 숫자만 입력 가능합니다.');
      }
    }

    // 권번호 검증 (필요한 경우)
    if (config.hasGiftNumber) {
      if (!cleanedGiftNumber) {
        errors.push(`${config.labels?.giftNumber || '권번호'}를 입력해주세요.`);
      } else if (config.giftNumberPattern) {
        // 세그먼트 패턴 검증 (EX 등): 총 길이만 체크
        const expectedLength = config.giftNumberPattern.reduce(
          (a, b) => a + b,
          0,
        );
        if (cleanedGiftNumber.length !== expectedLength) {
          errors.push(
            `${config.labels?.giftNumber || '권번호'}는 ${expectedLength}자리여야 합니다. (현재: ${cleanedGiftNumber.length}자리)`,
          );
        }
      } else if (cleanedGiftNumber.length !== config.giftNumberLength) {
        errors.push(
          `${config.labels?.giftNumber || '권번호'}는 ${config.giftNumberLength}자리여야 합니다. (현재: ${cleanedGiftNumber.length}자리)`,
        );
      } else if (!/^\d+$/.test(cleanedGiftNumber)) {
        errors.push(
          `${config.labels?.giftNumber || '권번호'}는 숫자만 입력 가능합니다.`,
        );
      }
    }

    // 복합 해시 생성 (PIN + 보안코드 + 권번호)
    const combinedHash = this.generateCombinedHash(
      cleanedPin,
      cleanedSecurityCode,
      cleanedGiftNumber,
    );

    return {
      isValid: errors.length === 0,
      errors,
      cleanedPin,
      cleanedSecurityCode,
      cleanedGiftNumber,
      combinedHash,
    };
  }

  /**
   * PIN 코드 유효성 검사 (예외 발생 버전)
   */
  validateOrThrow(
    input: PinValidationInput,
    pinConfigJson?: string | null,
    brandCode?: string,
  ): PinValidationResult {
    const result = this.validate(input, pinConfigJson, brandCode);
    if (!result.isValid) {
      throw new BadRequestException(result.errors.join(', '));
    }
    return result;
  }

  /**
   * PIN 설정 조회
   */
  getPinConfig(
    pinConfigJson?: string | null,
    brandCode?: string,
  ): PinConfiguration {
    return pinConfigJson
      ? parsePinConfig(pinConfigJson)
      : brandCode
        ? getDefaultPinConfig(brandCode)
        : getDefaultPinConfig('DEFAULT');
  }

  /**
   * 숫자 외 문자 제거
   */
  private cleanNumericString(value: string): string {
    return value.replace(/\D/g, '');
  }

  /**
   * 복합 해시 생성 (중복 검사용)
   * PIN + 보안코드 + 권번호를 조합하여 SHA256 해시 생성
   */
  private generateCombinedHash(
    pin: string,
    securityCode?: string,
    giftNumber?: string,
  ): string {
    const combined = [pin, securityCode || '', giftNumber || ''].join(':');
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * PIN 포맷팅 (화면 표시용)
   */
  formatPin(pin: string, pattern: number[], separator = '-'): string {
    const cleanPin = this.cleanNumericString(pin);
    const segments: string[] = [];
    let position = 0;

    for (const length of pattern) {
      if (position >= cleanPin.length) break;
      segments.push(cleanPin.slice(position, position + length));
      position += length;
    }

    return segments.join(separator);
  }
}
