/**
 * @file prisma-voucher.repository.ts
 * @description Prisma 기반 바우처 저장소 구현체
 */
import { Injectable } from '@nestjs/common';

import {
  IVoucherRepository,
  CreateVoucherData,
} from './interfaces/voucher-repository.interface';
import { VOUCHER_STATUS } from '../../shared/constants';
import { Prisma } from '../../shared/prisma/generated/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class PrismaVoucherRepository implements IVoucherRepository {
  constructor(private readonly prisma: PrismaService) {}

  async bulkCreate(data: CreateVoucherData[]): Promise<{ count: number }> {
    return this.prisma.voucherCode.createMany({ data });
  }

  async findAvailableByProductId(
    productId: number,
    take: number,
    tx?: any,
  ): Promise<{ id: number; productId: number; status: string }[]> {
    const client = tx || this.prisma;
    return client.voucherCode.findMany({
      where: { productId, status: VOUCHER_STATUS.AVAILABLE },
      take,
      orderBy: { id: 'asc' },
    });
  }

  async markAsSold(
    voucherIds: number[],
    orderId: number,
    tx?: any,
  ): Promise<{ count: number }> {
    const client = tx || this.prisma;
    return client.voucherCode.updateMany({
      where: {
        id: { in: voucherIds },
        status: VOUCHER_STATUS.AVAILABLE,
      },
      data: {
        status: VOUCHER_STATUS.SOLD,
        orderId,
        soldAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async releaseByOrderId(
    orderId: number,
    tx?: any,
  ): Promise<{ count: number }> {
    const client = tx || this.prisma;
    return client.voucherCode.updateMany({
      where: { orderId, status: VOUCHER_STATUS.SOLD },
      data: {
        status: VOUCHER_STATUS.AVAILABLE,
        orderId: null,
        soldAt: null,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * MSSQL 비관적 잠금으로 바우처를 주문에 원자적 할당
   *
   * CTE + UPDLOCK/ROWLOCK 힌트로 SELECT와 UPDATE를 단일 SQL문으로 수행
   * → TOCTOU 제거, deadlock 최소화
   */
  async assignToOrder(
    productId: number,
    quantity: number,
    orderId: number,
    tx?: any,
  ): Promise<{ assignedIds: number[] }> {
    const client = tx || this.prisma;
    const rows: { Id: number }[] = await client.$queryRaw(Prisma.sql`
      WITH cte AS (
        SELECT TOP(${quantity}) [Id], [Status], [OrderId], [SoldAt], [UpdatedAt]
        FROM [VoucherCodes] WITH (UPDLOCK, ROWLOCK)
        WHERE [ProductId] = ${productId}
          AND [Status] = 'AVAILABLE'
        ORDER BY [Id] ASC
      )
      UPDATE cte
      SET [Status] = 'SOLD',
          [OrderId] = ${orderId},
          [SoldAt] = GETDATE(),
          [UpdatedAt] = GETDATE()
      OUTPUT inserted.[Id]
    `);
    return { assignedIds: rows.map((r) => r.Id) };
  }
}
