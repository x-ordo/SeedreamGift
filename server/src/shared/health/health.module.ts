/**
 * @file health.module.ts
 * @description 헬스체크 모듈 - 시스템 상태 진단 기능
 * @module shared/health
 *
 * 제공 기능:
 * - GET /health 엔드포인트
 * - DB, 메모리, 디스크 상태 체크
 *
 * 의존 모듈:
 * - TerminusModule: NestJS 헬스체크 프레임워크
 * - PrismaModule: DB 연결 상태 체크용
 */
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [TerminusModule, PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
