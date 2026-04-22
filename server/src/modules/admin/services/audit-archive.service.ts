/**
 * @file audit-archive.service.ts
 * @description 감사 로그 아카이브/삭제 크론 서비스
 * @module modules/admin
 *
 * 보관 정책:
 * - 90일 경과: isArchived = true (쿼리 성능 최적화)
 * - 180일 경과: 영구 삭제 (디스크 용량 관리)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class AuditArchiveService {
  private readonly logger = new Logger(AuditArchiveService.name);

  /** 아카이브 기준일 (일) */
  private readonly archiveAfterDays: number;
  /** 삭제 기준일 (일) */
  private readonly deleteAfterDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.archiveAfterDays = this.configService.get<number>(
      'AUDIT_ARCHIVE_DAYS',
      90,
    );
    this.deleteAfterDays = this.configService.get<number>(
      'AUDIT_DELETE_DAYS',
      180,
    );
  }

  /** 매일 자정에 실행: 오래된 감사 로그 아카이브 및 삭제 */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async archiveAndCleanup() {
    try {
      const now = new Date();

      // 1. 180일 경과 아카이브된 로그 삭제
      const deleteThreshold = new Date(now);
      deleteThreshold.setDate(deleteThreshold.getDate() - this.deleteAfterDays);

      const deleted = await this.prisma.auditLog.deleteMany({
        where: {
          isArchived: true,
          createdAt: { lt: deleteThreshold },
        },
      });

      // 2. 90일 경과 로그 아카이브
      const archiveThreshold = new Date(now);
      archiveThreshold.setDate(
        archiveThreshold.getDate() - this.archiveAfterDays,
      );

      const archived = await this.prisma.auditLog.updateMany({
        where: {
          isArchived: false,
          createdAt: { lt: archiveThreshold },
        },
        data: { isArchived: true },
      });

      if (deleted.count > 0 || archived.count > 0) {
        this.logger.log(
          `Audit log maintenance: archived ${archived.count}, deleted ${deleted.count}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to archive/cleanup audit logs', error);
    }
  }
}
