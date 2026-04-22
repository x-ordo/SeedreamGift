/**
 * @file audit.service.ts
 * @description 감사 로그 서비스 - 보안 이벤트 기록
 * @module shared/audit
 *
 * 기능:
 * - 중요 변경 사항 DB 기록
 * - 사용자 행동 추적 (관리자 대시보드용)
 * - 보안 감사 및 컴플라이언스 지원
 *
 * 기록 정보:
 * - userId: 행위자 (로그인 사용자)
 * - action: 수행 동작 (예: POST /api/orders)
 * - resource: 대상 리소스 (예: orders)
 * - oldValue/newValue: 변경 전후 값
 * - ip, userAgent: 클라이언트 정보
 *
 * 사용처:
 * - AuditInterceptor: 자동 로깅
 * - 관리자 페이지: 감사 로그 조회
 */
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * 감사 로그 서비스
 *
 * 보안 감사를 위한 로그 기록 서비스입니다.
 * 비즈니스 로직 실패 시에도 로깅 오류가 전파되지 않습니다.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 보안 감사 로그 기록
   */
  async log(params: {
    userId?: number;
    action: string;
    resource: string;
    resourceId?: string;
    method?: string;
    statusCode?: number;
    oldValue?: any;
    newValue?: any;
    ip?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId,
          method: params.method,
          statusCode: params.statusCode,
          oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
          newValue: params.newValue ? JSON.stringify(params.newValue) : null,
          ip: params.ip,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      // 감사 로그 기록 실패가 비즈니스 로직에 영향을 주지 않도록 함
      this.logger.error(
        'AuditLog failed',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
