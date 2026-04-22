import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { KycCleanupService } from './kyc-cleanup.service';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        timeout: configService.get<number>('kyc.coocon.timeoutMs', 10000),
      }),
      inject: [ConfigService],
    }),
    UsersModule,
  ],
  controllers: [KycController],
  providers: [KycService, KycCleanupService],
  exports: [KycService],
})
export class KycModule {}
