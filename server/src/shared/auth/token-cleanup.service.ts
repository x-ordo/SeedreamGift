import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 매시간 만료된 RefreshToken 레코드 삭제
   * - DB 테이블 비대화 방지
   * - 만료된 토큰은 어차피 사용 불가하므로 안전하게 삭제
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredRefreshTokens() {
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        this.logger.log(`Cleaned ${result.count} expired refresh tokens`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired refresh tokens', error);
    }
  }

  /**
   * 매시간 만료된 비밀번호 재설정 토큰 정리
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredPasswordResets() {
    try {
      const result = await this.prisma.user.updateMany({
        where: {
          passwordResetExpiry: { lt: new Date() },
          passwordResetToken: { not: null },
        },
        data: {
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      });
      if (result.count > 0) {
        this.logger.log(
          `Cleaned ${result.count} expired password reset tokens`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to cleanup expired password reset tokens',
        error,
      );
    }
  }
}
