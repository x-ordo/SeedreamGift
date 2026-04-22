/**
 * @file prisma.module.ts
 * @description Prisma 모듈 - 전역 데이터베이스 연결 관리
 * @module shared/prisma
 *
 * 제공 서비스:
 * - PrismaService: DB 연결 및 쿼리 실행
 *
 * NOTE: @Global() 데코레이터로 전역 모듈 설정
 * 다른 모듈에서 import 없이 PrismaService 주입 가능
 *
 * 연결 정보: DATABASE_URL 환경 변수 (MSSQL)
 */
import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
