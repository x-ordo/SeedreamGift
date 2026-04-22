import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { VOUCHER_STATUS } from '../../shared/constants';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class VoucherExpiryService {
  private readonly logger = new Logger(VoucherExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 매일 01:00 — 만료일이 지난 AVAILABLE 바우처를 EXPIRED로 전이 */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async expireVouchers() {
    const result = await this.prisma.voucherCode.updateMany({
      where: {
        status: VOUCHER_STATUS.AVAILABLE,
        expiredAt: { lt: new Date(), not: null },
      },
      data: { status: VOUCHER_STATUS.EXPIRED },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} vouchers`);
    }
  }
}
