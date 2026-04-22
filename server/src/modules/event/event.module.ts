import { Module } from '@nestjs/common';

import { EventController } from './event.controller';
import { EventService } from './event.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
