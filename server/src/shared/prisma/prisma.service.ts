/**
 * @file prisma.service.ts
 * @description Prisma ORM 서비스 - 데이터베이스 연결 관리 (Prisma 7)
 * @module prisma
 *
 * 주요 기능:
 * - NestJS 수명주기와 Prisma 연결 동기화
 * - 연결 풀 최적화 (Best Practice: num_cpus * 2 + 1)
 * - 쿼리 로깅 (개발/프로덕션 구분)
 * - Graceful shutdown 지원
 *
 * 데이터베이스: MSSQL (Microsoft SQL Server)
 * 드라이버: @prisma/adapter-mssql (Prisma 7 필수)
 *
 * @see https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool
 */
import { cpus } from 'os';

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';

import { PrismaMssql } from '@prisma/adapter-mssql';

import { PrismaClient, Prisma } from './generated/client';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * DATABASE_URL 파싱하여 MSSQL 연결 설정 생성
 *
 * Best Practice: 연결 풀 설정 포함
 * - pool.min/max: 연결 풀 크기 (기본: CPU * 2 + 1)
 * - connectionTimeout: 연결 타임아웃 (기본: 15초)
 * - requestTimeout: 쿼리 타임아웃 (기본: 30초)
 */
function parseDatabaseUrl(url: string) {
  if (!url) return null;
  // Format: sqlserver://host:port;database=xxx;user=xxx;password=xxx;...
  const match = url.match(
    /sqlserver:\/\/([^:]+):(\d+);database=([^;]+);user=([^;]+);password=([^;]+)/,
  );
  if (!match) return null;

  const cpuCount = cpus().length;
  const poolSize = Math.max(cpuCount * 2 + 1, 5);

  return {
    server: match[1],
    port: parseInt(match[2], 10),
    database: match[3],
    user: match[4],
    password: match[5],
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
    pool: {
      min: 2,
      max: poolSize,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };
}

/**
 * Prisma 로깅 설정
 */
function getLogConfig(): Prisma.LogLevel[] {
  return process.env.NODE_ENV === 'production'
    ? ['error', 'warn']
    : ['query', 'error', 'warn'];
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor() {
    const dbUrl = process.env.DATABASE_URL || '';
    const config = parseDatabaseUrl(dbUrl);

    // Call super first
    if (!config) {
      super({ log: getLogConfig() });
    } else {
      const adapter = new PrismaMssql(config);
      super({
        adapter,
        log: getLogConfig(),
      });
    }

    if (!config) {
      this.logger.error(
        'DATABASE_URL is missing or invalid. Check your .env file.',
      );
    } else {
      this.logger.log(`Prisma initialized (pool size: ${config.pool.max})`);
    }
  }

  /**
   * 모듈 초기화 시 DB 연결
   *
   * Note: Prisma 7에서 $use() 미들웨어 API가 제거됨.
   * Slow Query 감지는 Prisma 내장 로깅(log: ['query'])으로 대체.
   * 필요 시 $extends()를 통해 커스텀 쿼리 모니터링 가능.
   */
  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Database connection established');
        return;
      } catch (error) {
        this.logger.error(
          `Database connection failed (attempt ${attempt}/${this.maxRetries}):`,
          error.message,
        );

        if (attempt === this.maxRetries) {
          throw error;
        }

        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * 모듈 종료 시 DB 연결 해제
   *
   * Best Practice: NestJS 10+ 권장 방식
   * - OnModuleDestroy 훅 사용 (deprecated: enableShutdownHooks)
   * - app.enableShutdownHooks()와 함께 사용
   */
  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /**
   * 트랜잭션 래퍼 with 재시도
   *
   * Best Practice: 일시적 오류에 대한 트랜잭션 재시도
   * - P2034 (Write conflict) 등 재시도 가능 오류 처리
   *
   * @param fn - 트랜잭션 내에서 실행할 함수
   * @param maxRetries - 최대 재시도 횟수 (기본: 3)
   */
  async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        const prismaError = error as { code?: string };

        // P2034: Transaction write conflict (재시도 가능)
        // P1001: Connection error (재시도 가능)
        const retryableCodes = ['P2034', 'P1001', 'P1002'];

        if (
          prismaError.code &&
          retryableCodes.includes(prismaError.code) &&
          attempt < maxRetries
        ) {
          this.logger.warn(
            `Retryable error ${prismaError.code} (attempt ${attempt}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
          continue;
        }

        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }
}
