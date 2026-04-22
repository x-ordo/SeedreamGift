import { Module } from '@nestjs/common';

import { GiftExpiryService } from './gift-expiry.service';
import { GiftController } from './gift.controller';
import { GiftService } from './gift.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [GiftController],
  providers: [GiftService, GiftExpiryService],
  exports: [GiftService],
})
export class GiftModule {}
