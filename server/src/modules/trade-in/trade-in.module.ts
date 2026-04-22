import { Module } from '@nestjs/common';

import { TradeInController } from './trade-in.controller';
import { TradeInService } from './trade-in.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TradeInController],
  providers: [TradeInService],
  exports: [TradeInService],
})
export class TradeInModule {}
