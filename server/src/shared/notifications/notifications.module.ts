import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';

import { TelegramAlertService } from './telegram-alert.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [TelegramAlertService],
  exports: [TelegramAlertService],
})
export class NotificationsModule {}
