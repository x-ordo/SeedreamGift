/**
 * @file audit.module.ts
 * @description 감사 로그 모듈 - 보안 감사 기능 제공
 * @module shared/audit
 *
 * 제공 서비스:
 * - AuditService: 감사 로그 기록
 *
 * NOTE: @Global() 데코레이터로 전역 모듈 설정
 * 다른 모듈에서 import 없이 AuditService 주입 가능
 */
import { Module, Global } from '@nestjs/common';

import { AuditService } from './audit.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
