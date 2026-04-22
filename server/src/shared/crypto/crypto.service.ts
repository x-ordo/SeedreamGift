/**
 * @file crypto.service.ts
 * @description 암호화 서비스 - PIN 및 민감 정보 보호
 * @module shared/crypto
 *
 * 제공 기능:
 * - AES-256-CBC 양방향 암호화/복호화 (encrypt, decrypt)
 * - SHA-256 단방향 해시 (hash) — 중복 검색용
 *
 * 사용처:
 * - VoucherService: PIN 코드 암호화 저장
 * - TradeInService: 매입 PIN 검증
 * - 관리자 페이지: 암호화된 PIN 복호화 표시 (상세 조회만)
 *
 * 설계 결정:
 * - AES-256-CBC: data-at-rest에 적합. GCM 무결성은 DB 접근 제어로 대체.
 * - SHA-256 (keyless): PIN 중복 검색용 WHERE 조건에만 사용. 인증 목적 아님.
 * - ENCRYPTION_KEY 환경변수 필수 (32자 이상)
 *
 * 암호화 형식: "iv_hex(32):ciphertext_hex"
 */
import * as crypto from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;
  private readonly ivLength = 16;

  constructor(private readonly configService: ConfigService) {
    const envKey = this.configService.get<string>('ENCRYPTION_KEY');
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (!envKey) {
      if (nodeEnv === 'test') {
        this.logger.warn(
          'ENCRYPTION_KEY not set. Using temporary key for TEST environment only.',
        );
        this.key = Buffer.from(
          'test-key-do-not-use-in-production'.slice(0, 32),
        );
        return;
      }
      throw new Error(
        'CRITICAL: ENCRYPTION_KEY environment variable is required. ' +
          'Set a 32-character key in .env file.',
      );
    }

    if (envKey.length < 32) {
      throw new Error(
        `ENCRYPTION_KEY must be at least 32 characters. Current length: ${envKey.length}`,
      );
    }

    this.key = Buffer.from(envKey.slice(0, 32));
  }

  /** AES-256-CBC 암호화. 반환 형식: "iv_hex:ciphertext_hex" */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * 복호화. 평문(비암호화) 데이터는 그대로 반환 (하위호환).
   * 암호문 형식이지만 복호화 실패 시 에러를 throw.
   */
  decrypt(text: string): string {
    if (!text || !text.includes(':')) {
      return text;
    }

    const [ivHex, encryptedHex] = text.split(':');
    if (!ivHex || !encryptedHex || ivHex.length !== 32) {
      return text; // IV 32 hex chars (16 bytes)가 아니면 평문
    }

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.logger.error(
        `Decryption failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new Error('데이터 복호화에 실패했습니다. 암호화 키를 확인하세요.');
    }
  }

  /** SHA-256 해시. PIN 중복 검색용 (DB WHERE 조건). */
  hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}
