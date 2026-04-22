/**
 * @file crypto.module.ts
 * @description 암호화 모듈 - 전역 암호화 서비스 제공
 * @module shared/crypto
 *
 * 제공 서비스:
 * - AES-256-GCM 암호화/복호화
 * - PIN 및 민감 정보 보호
 *
 * NOTE: @Global() 데코레이터로 전역 모듈 설정
 * 다른 모듈에서 import 없이 CryptoService 주입 가능
 */
import { Global, Module } from '@nestjs/common';

import { CryptoService } from './crypto.service';

@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
