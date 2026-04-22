/**
 * @file kyc-cleanup.service.ts
 * @description 만료된 KYC 인증 세션 정리 크론 서비스
 * @module modules/kyc
 *
 * KycVerifySession은 1원 인증 요청 시 생성되며 expiresAt 이후 무효.
 * 이 크론이 없으면 만료 세션이 무한 축적됨.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class KycCleanupService {
  private readonly logger = new Logger(KycCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 매시간 만료된 KYC 인증 세션 삭제 */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions() {
    try {
      const result = await this.prisma.kycVerifySession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired KYC sessions`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired KYC sessions', error);
    }
  }
}
