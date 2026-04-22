import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { GIFT_STATUS } from '../../shared/constants';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class GiftExpiryService {
  private readonly logger = new Logger(GiftExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 매일 02:00 — 만료된 선물 자동 EXPIRED 전이 */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async expireGifts() {
    const result = await this.prisma.gift.updateMany({
      where: {
        status: GIFT_STATUS.SENT,
        expiresAt: { lt: new Date() },
      },
      data: { status: GIFT_STATUS.EXPIRED },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} gifts`);
    }
  }
}
