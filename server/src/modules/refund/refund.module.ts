import { Module } from '@nestjs/common';

import { RefundService } from './refund.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { VOUCHER_ASSIGNER } from '../orders/interfaces/voucher-assigner.interface';
import { VoucherModule } from '../voucher/voucher.module';
import { VoucherService } from '../voucher/voucher.service';

@Module({
  imports: [PrismaModule, VoucherModule],
  providers: [
    RefundService,
    { provide: VOUCHER_ASSIGNER, useExisting: VoucherService },
  ],
  exports: [RefundService],
})
export class RefundModule {}
