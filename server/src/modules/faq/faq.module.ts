import { Module } from '@nestjs/common';

import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FaqController],
  providers: [FaqService],
  exports: [FaqService],
})
export class FaqModule {}
