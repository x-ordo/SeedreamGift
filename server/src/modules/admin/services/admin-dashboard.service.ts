import { Injectable, NotFoundException, Logger } from '@nestjs/common';

import { paginatedQuery } from '../../../base/paginated-query';
import {
  PaginationQueryDto,
  createPaginatedResponse,
} from '../../../base/pagination.dto';
import { KYC_STATUS, TRADEIN_STATUS } from '../../../shared/constants/statuses';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 대시보드 주요 지표 조회 (단일 SQL로 8개 COUNT 집계)
   */
  async getStats() {
    const result = await this.prisma.$queryRaw<
      {
        userCount: number;
        productCount: number;
        tradeInCount: number;
        pendingKycCount: number;
        pendingTradeInCount: number;
        orderCount: number;
        giftCount: number;
        voucherCount: number;
      }[]
    >`
      SELECT
        (SELECT COUNT(*) FROM Users WHERE DeletedAt IS NULL) AS userCount,
        (SELECT COUNT(*) FROM Products) AS productCount,
        (SELECT COUNT(*) FROM TradeIns) AS tradeInCount,
        (SELECT COUNT(*) FROM Users WHERE KycStatus = ${KYC_STATUS.PENDING} AND DeletedAt IS NULL) AS pendingKycCount,
        (SELECT COUNT(*) FROM TradeIns WHERE Status = ${TRADEIN_STATUS.REQUESTED}) AS pendingTradeInCount,
        (SELECT COUNT(*) FROM Orders) AS orderCount,
        (SELECT COUNT(*) FROM Gifts) AS giftCount,
        (SELECT COUNT(*) FROM VoucherCodes) AS voucherCount
    `;

    const row = result[0];
    return {
      userCount: Number(row.userCount),
      productCount: Number(row.productCount),
      tradeInCount: Number(row.tradeInCount),
      pendingKycCount: Number(row.pendingKycCount),
      pendingTradeInCount: Number(row.pendingTradeInCount),
      orderCount: Number(row.orderCount),
      giftCount: Number(row.giftCount),
      voucherCount: Number(row.voucherCount),
    };
  }

  // ========================================
  // AuditLogs (Read-only)
  // ========================================

  async findAllAuditLogs(
    paginationDto: PaginationQueryDto,
    filters?: { action?: string; resource?: string; userId?: number },
  ) {
    const where: any = {};
    if (filters?.action) where.action = filters.action;
    if (filters?.resource) where.resource = filters.resource;
    if (filters?.userId) where.userId = filters.userId;

    try {
      return await paginatedQuery(this.prisma.auditLog, {
        pagination: paginationDto,
        where,
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch audit logs. Filters: ${JSON.stringify(filters)}, Pagination: ${JSON.stringify(paginationDto)}`,
        error instanceof Error ? error.stack : String(error),
      );
      // 테이블 미존재 등 DB 오류 시 빈 결과 반환 (프로덕션 안정성)
      const page = paginationDto.page ?? 1;
      const limit = paginationDto.limit ?? 20;
      return createPaginatedResponse([], 0, page, limit);
    }
  }

  async findOneAuditLog(id: number) {
    const log = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('AuditLog not found');
    return log;
  }
}
