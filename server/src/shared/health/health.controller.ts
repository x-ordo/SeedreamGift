/**
 * @file health.controller.ts
 * @description 헬스체크 컨트롤러 - 시스템 상태 진단 API
 * @module shared/health
 *
 * 엔드포인트:
 * - GET /health - 시스템 상태 진단
 *
 * 진단 항목:
 * - database: DB 연결 상태 (Prisma ping)
 * - memory_heap: Heap 메모리 사용량 (150MB 제한)
 * - storage: 디스크 공간 (90% 이상 사용 시 에러)
 *
 * 사용처:
 * - 로드밸런서 헬스체크
 * - 모니터링 시스템 연동
 * - 운영 상태 확인
 */
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';

import { PrismaService } from '../prisma/prisma.service';

/**
 * 헬스체크 컨트롤러
 *
 * @nestjs/terminus를 사용한 시스템 상태 진단.
 * 각 지표가 임계값을 초과하면 503 Service Unavailable 반환.
 */
@ApiTags('System')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
    private prisma: PrismaService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: '시스템 상태 진단 (DB, 메모리, 디스크)' })
  check() {
    return this.health.check([
      // DB 상태 체크
      () => this.db.pingCheck('database', this.prisma),
      // 메모리 사용량 체크 (Heap: 150MB 제한)
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      // 디스크 공간 체크 (C드라이브 또는 현재 루트, 90% 이상 사용 시 에러)
      () =>
        this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }
}
