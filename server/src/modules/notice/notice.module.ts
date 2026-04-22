import { Module } from '@nestjs/common';

import { NoticeController } from './notice.controller';
import { NoticeService } from './notice.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NoticeController],
  providers: [NoticeService],
  exports: [NoticeService],
})
export class NoticeModule {}
