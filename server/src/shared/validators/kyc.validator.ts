/**
 * @file kyc.validator.ts
 * @description KYC 인증 상태 검증 서비스 - 중복 검증 로직 통합
 * @module shared/validators
 *
 * 사용처:
 * - OrdersService: 주문 생성 시 KYC 인증 확인
 * - TradeInService: 매입 신청 시 KYC 인증 확인
 * - KycService: KYC 데이터 제출 시 이중 인증 방지
 *
 * 제공 기능:
 * - ensureVerified: KYC 인증 완료 상태 확인 (미인증 시 예외)
 * - ensureNotVerified: KYC 미인증 상태 확인 (이미 인증 완료 시 예외)
 */
import { Injectable, BadRequestException } from '@nestjs/common';

import { KYC_STATUS } from '../constants/statuses';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KycValidator {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * KYC 인증 완료 상태 확인 -- 미인증 시 예외 발생
   * @param userId User ID
   * @param errorMessage Custom error message (optional)
   * @returns The user record (for chaining)
   */
  async ensureVerified(userId: number, errorMessage?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kycStatus: true, role: true },
    });
    if (!user || user.kycStatus !== KYC_STATUS.VERIFIED) {
      throw new BadRequestException(
        errorMessage || '본인 인증(KYC)이 필요합니다.',
      );
    }
    return user;
  }

  /**
   * KYC 미인증 상태 확인 -- 이미 인증 완료 시 예외 발생
   * @param userId User ID
   * @returns The user record (for chaining)
   */
  async ensureNotVerified(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kycStatus: true },
    });
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');
    if (user.kycStatus === KYC_STATUS.VERIFIED) {
      throw new BadRequestException('이미 인증이 완료된 계정입니다.');
    }
    return user;
  }
}
