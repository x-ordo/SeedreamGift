/**
 * @file mfa.service.ts
 * @description TOTP 기반 MFA 서비스 — 관리자 2단계 인증
 *
 * 기능:
 * - TOTP 비밀키 생성 및 QR URI 반환
 * - TOTP 코드 검증
 * - MFA 활성화/비활성화
 *
 * 보안:
 * - TOTP 비밀키는 AES-256 암호화 저장
 * - 활성화 전 1회 코드 검증 필수 (확인 후 활성화)
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { generateSecret, verifySync, generateURI } from 'otplib';

import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MfaService {
  private readonly issuer: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
  ) {
    this.issuer = this.configService.get<string>('auth.jwt.issuer', 'w-gift');
  }

  /**
   * MFA 설정 시작 — TOTP 비밀키 생성 및 otpauth URI 반환
   * 아직 활성화되지 않음 (verify 단계에서 활성화)
   */
  async setupMfa(userId: number): Promise<{ otpauthUri: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, mfaEnabled: true },
    });
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');
    if (user.mfaEnabled) {
      throw new BadRequestException(
        'MFA가 이미 활성화되어 있습니다. 먼저 비활성화 후 재설정하세요.',
      );
    }

    const secret = generateSecret();

    // 비밀키 암호화 저장 (아직 mfaEnabled=false)
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: this.cryptoService.encrypt(secret) },
    });

    const otpauthUri = generateURI({
      secret,
      label: user.email,
      issuer: this.issuer,
    });

    // 평문 secret은 클라이언트에 반환하지 않음 (otpauthUri에 포함되어 있으므로 QR 스캔에 충분)
    return { otpauthUri };
  }

  /**
   * MFA 활성화 확인 — TOTP 코드 검증 후 활성화
   */
  async verifyAndEnableMfa(
    userId: number,
    token: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, mfaEnabled: true },
    });
    if (!user || !user.totpSecret) {
      throw new BadRequestException('MFA 설정을 먼저 시작하세요.');
    }
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA가 이미 활성화되어 있습니다.');
    }

    const secret = this.cryptoService.decrypt(user.totpSecret);
    const result = verifySync({ token, secret });
    if (!result.valid) {
      throw new BadRequestException('유효하지 않은 인증 코드입니다.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { message: 'MFA가 활성화되었습니다.' };
  }

  /**
   * MFA 비활성화 — 현재 TOTP 코드 검증 후 비활성화
   */
  async disableMfa(
    userId: number,
    token: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, mfaEnabled: true },
    });
    if (!user || !user.mfaEnabled || !user.totpSecret) {
      throw new BadRequestException('MFA가 활성화되어 있지 않습니다.');
    }

    const secret = this.cryptoService.decrypt(user.totpSecret);
    const result = verifySync({ token, secret });
    if (!result.valid) {
      throw new BadRequestException('유효하지 않은 인증 코드입니다.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, totpSecret: null },
    });

    return { message: 'MFA가 비활성화되었습니다.' };
  }

  /**
   * TOTP 코드 검증 (로그인 시 호출)
   */
  async verifyToken(userId: number, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, mfaEnabled: true },
    });
    if (!user || !user.mfaEnabled || !user.totpSecret) {
      return true; // MFA 미활성화 시 통과
    }

    const secret = this.cryptoService.decrypt(user.totpSecret);
    const result = verifySync({ token, secret });
    return result.valid;
  }

  /**
   * 사용자의 MFA 상태 확인
   */
  async isMfaEnabled(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    return user?.mfaEnabled ?? false;
  }
}
