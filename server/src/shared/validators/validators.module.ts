/**
 * @file validators.module.ts
 * @description 공유 검증 모듈 - 전역 검증 서비스 제공
 * @module shared/validators
 *
 * 제공 서비스:
 * - KycValidator: KYC 인증 상태 검증
 * - PinValidatorService: PIN 유효성 검사
 *
 * NOTE: @Global() 데코레이터로 전역 모듈 설정
 * 다른 모듈에서 import 없이 KycValidator, PinValidatorService 주입 가능
 */
import { Global, Module } from '@nestjs/common';

import { KycValidator } from './kyc.validator';
import { PinValidatorService } from './pin-validator.service';

@Global()
@Module({
  providers: [KycValidator, PinValidatorService],
  exports: [KycValidator, PinValidatorService],
})
export class ValidatorsModule {}
