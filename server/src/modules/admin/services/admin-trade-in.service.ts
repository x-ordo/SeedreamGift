import { Injectable, Logger } from '@nestjs/common';

import { paginatedQuery } from '../../../base/paginated-query';
import { PaginationQueryDto } from '../../../base/pagination.dto';
import { TradeInStatus } from '../../../shared/constants/statuses';
import { CryptoService } from '../../../shared/crypto/crypto.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { TradeInService } from '../../trade-in/trade-in.service';
import type { TradeInPayoutQueryDto } from '../dto/trade-in-payout-query.dto';

@Injectable()
export class AdminTradeInService {
  private readonly logger = new Logger(AdminTradeInService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tradeInService: TradeInService,
    private readonly cryptoService: CryptoService,
  ) {}

  // ========================================
  // TradeIns CRUD
  // ========================================

  async findAll(
    paginationDto: PaginationQueryDto,
    status?: TradeInStatus,
    search?: string,
    brandCode?: string,
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (brandCode) where.productBrand = brandCode;

    if (search) {
      const searchConditions: any[] = [
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
      ];
      const parsed = parseInt(search, 10);
      if (!isNaN(parsed)) {
        searchConditions.push({ id: parsed });
      }
      where.OR = searchConditions;
    }

    return paginatedQuery(this.prisma.tradeIn, {
      pagination: paginationDto,
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, name: true } },
        product: true,
      },
    });
  }

  async findOne(id: number, adminId: number) {
    const result = await this.tradeInService.findOneDecrypted(id);

    this.logger.warn(
      `[AUDIT] Admin(${adminId}) decrypted trade-in(${id}) data: PIN=${!!result.pinCode}, Account=${!!result.accountNum}, user(${result.userId})`,
    );

    return result;
  }

  /**
   * 매입 신청 상태 변경 — 도메인 서비스에 위임
   */
  async updateStatus(id: number, status: TradeInStatus, reason?: string) {
    return this.tradeInService.updateStatus(id, status, reason);
  }

  // ========================================
  // 매입 증빙 리포트 (은행제출용 2-sheet)
  // ========================================

  /**
   * 매입 증빙 리포트 데이터 조회
   * TradeIn 레코드를 날짜 범위로 조회 + PIN/계좌 복호화
   */
  async getPayoutReport(query: TradeInPayoutQueryDto) {
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);

    const pinOption = query.pinOption || 'masked';

    const where: any = {
      createdAt: { gte: start, lte: end },
    };
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = parseInt(query.userId, 10);
    if (query.brandCode) where.productBrand = query.brandCode;

    const tradeIns = await this.prisma.tradeIn.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true, phone: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    this.logger.warn(
      `[AUDIT] Admin requested payout report: ${tradeIns.length} records (${query.startDate} ~ ${query.endDate})`,
    );

    const items = tradeIns.map((ti) => ({
      tradeInId: `TI-${ti.id}`,
      date: ti.createdAt.toISOString(),
      sellerName: ti.user?.name || '-',
      sellerPhone: ti.user?.phone || '-',
      bankName: ti.bankName || '-',
      accountHolder: ti.accountHolder || '-',
      accountNum: this.resolveAccount(ti.accountNum, pinOption),
      productName: ti.productName || '-',
      brandCode: ti.productBrand || '-',
      quantity: ti.quantity,
      faceValue: Number(ti.productPrice || 0),
      payoutAmount: Number(ti.payoutAmount),
      pinCode: this.resolvePin(ti.pinCode, pinOption),
      securityCode: this.resolveEncrypted(ti.securityCode, pinOption),
      status: ti.status,
      adminNote: ti.adminNote || '',
    }));

    const totalFaceValue = items.reduce(
      (s, i) => s + i.faceValue * i.quantity,
      0,
    );
    const totalPayout = items.reduce((s, i) => s + i.payoutAmount, 0);

    return {
      items,
      summary: {
        totalRecords: items.length,
        totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
        totalFaceValue,
        totalPayout,
        startDate: query.startDate,
        endDate: query.endDate,
      },
    };
  }

  // ========================================
  // Crypto helpers
  // ========================================

  private resolvePin(
    encrypted: string | null,
    pinOption: 'full' | 'masked' | 'none',
  ): string {
    if (!encrypted || pinOption === 'none') return '';
    try {
      const decrypted = this.cryptoService.decrypt(encrypted);
      if (pinOption === 'full') return decrypted;
      return decrypted.length > 4 ? decrypted.slice(0, 4) + '****' : decrypted;
    } catch {
      return '****';
    }
  }

  private resolveAccount(
    encrypted: string | null,
    pinOption: 'full' | 'masked' | 'none',
  ): string {
    if (!encrypted || pinOption === 'none') return '';
    try {
      const decrypted = this.cryptoService.decrypt(encrypted);
      if (pinOption === 'full') return decrypted;
      return decrypted.length > 4 ? '***' + decrypted.slice(-4) : decrypted;
    } catch {
      return '***-****';
    }
  }

  private resolveEncrypted(
    encrypted: string | null | undefined,
    pinOption: 'full' | 'masked' | 'none',
  ): string {
    if (!encrypted || pinOption === 'none') return '';
    try {
      const decrypted = this.cryptoService.decrypt(encrypted);
      if (pinOption === 'full') return decrypted;
      return decrypted.length > 2 ? decrypted.slice(0, 2) + '***' : decrypted;
    } catch {
      return '***';
    }
  }
}
