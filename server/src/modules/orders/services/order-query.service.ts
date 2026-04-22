/**
 * @file order-query.service.ts
 * @description 주문 조회 책임 — 상세 조회, 목록 조회, 통계, 거래내역 내보내기
 * @module modules/orders/services
 *
 * OrdersService에서 분리된 주문 조회 전용 서비스.
 * getOrder, getMyOrders, getReceivedGifts, getMyStats, getMyTransactionExport 포함.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import {
  PaginationQueryDto,
  createPaginatedResponse,
} from '../../../base/pagination.dto';
import { ORDER_ERRORS } from '../../../shared/constants';
import { CryptoService } from '../../../shared/crypto/crypto.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class OrderQueryService {
  private readonly logger = new Logger(OrderQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * 주문 상세 조회 (PIN 복호화 포함)
   */
  async getOrder(
    orderId: number,
    userId: number,
    userRole?: string,
  ): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true, brandCode: true, price: true } },
          },
        },
        voucherCodes: true,
      },
    });

    if (!order) {
      throw new NotFoundException(ORDER_ERRORS.NOT_FOUND);
    }

    // [보안] 소유권 확인 - 본인 주문이 아니면 ADMIN 역할 명시 필수
    if (userRole !== 'ADMIN' && order.userId !== userId) {
      throw new NotFoundException(ORDER_ERRORS.NOT_FOUND);
    }

    return this.decryptOrderVouchers(order);
  }

  /**
   * 내 주문 내역 목록 조회 (PIN 복호화 포함, 페이지네이션)
   */
  async getMyOrders(userId: number, paginationDto?: PaginationQueryDto) {
    const page = paginationDto?.page ?? 1;
    const limit = paginationDto?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            include: { product: { select: { name: true, brandCode: true } } },
          },
          voucherCodes: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    const items = orders.map((order) => this.decryptOrderVouchers(order));
    return createPaginatedResponse(items, total, page, limit);
  }

  /**
   * 받은 선물 목록 조회 (페이지네이션)
   */
  async getReceivedGifts(userId: number, paginationDto?: PaginationQueryDto) {
    const page = paginationDto?.page ?? 1;
    const limit = paginationDto?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [gifts, total] = await Promise.all([
      this.prisma.gift.findMany({
        where: { receiverId: userId },
        include: {
          sender: { select: { name: true, email: true } },
          order: {
            include: {
              items: {
                include: {
                  product: { select: { name: true, brandCode: true } },
                },
              },
              voucherCodes: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.gift.count({ where: { receiverId: userId } }),
    ]);

    const items = gifts.map((gift) => ({
      id: gift.id,
      senderName: gift.sender.name || gift.sender.email,
      status: gift.status,
      expiresAt: gift.expiresAt,
      claimedAt: gift.claimedAt,
      createdAt: gift.createdAt,
      order: this.decryptOrderVouchers(gift.order),
    }));

    return createPaginatedResponse(items, total, page, limit);
  }

  /**
   * 내 주문 통계 조회
   */
  async getMyStats(userId: number) {
    const [totalCount, statusCounts, totalSpent] = await Promise.all([
      this.prisma.order.count({ where: { userId } }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { userId },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: { userId, status: { in: ['PAID', 'DELIVERED'] } },
        _sum: { totalAmount: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const sc of statusCounts) {
      statusMap[sc.status] = sc._count;
    }

    return {
      totalCount,
      statusBreakdown: statusMap,
      totalSpent: Number(totalSpent._sum.totalAmount || 0),
    };
  }

  /**
   * 사용자 거래내역 증빙 데이터 조회
   */
  async getMyTransactionExport(
    userId: number,
    options?: {
      pinOption?: 'full' | 'masked' | 'none';
      type?: 'ALL' | 'SALE' | 'PURCHASE';
    },
  ) {
    const pinOption = options?.pinOption || 'masked';
    const type = options?.type || 'ALL';

    const [orders, tradeIns] = await Promise.all([
      type === 'PURCHASE'
        ? Promise.resolve([])
        : this.prisma.order.findMany({
            where: { userId },
            include: {
              items: {
                include: {
                  product: {
                    select: { name: true, brandCode: true, price: true },
                  },
                },
              },
              voucherCodes: { select: { id: true, pinCode: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
      type === 'SALE'
        ? Promise.resolve([])
        : this.prisma.tradeIn.findMany({
            where: { userId },
            include: {
              product: { select: { name: true, brandCode: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
    ]);

    const items: any[] = [];
    let totalSales = 0;
    let totalPurchases = 0;

    // 판매(구매) 거래
    for (const order of orders) {
      const resolvedPins = order.voucherCodes.map((vc) =>
        this.resolvePin(vc.pinCode, vc.id, pinOption),
      );
      const pinDisplay =
        pinOption === 'none' ? '' : resolvedPins.join(', ') || '-';

      for (const item of order.items) {
        const amount = Number(item.price) * item.quantity;
        totalSales += amount;

        items.push({
          transactionId: `ORD-${order.id}`,
          type: 'SALE' as const,
          date: order.createdAt.toISOString(),
          productName: item.product?.name || '-',
          brandCode: item.product?.brandCode || '-',
          quantity: item.quantity,
          unitPrice: Number(item.price),
          faceValue: Number(item.product?.price || 0),
          totalAmount: amount,
          pin: pinDisplay,
          status: order.status,
          paymentMethod: order.paymentMethod || '-',
          recipientName: order.recipientName || '',
          recipientPhone: order.recipientPhone || '',
          recipientAddr: order.recipientAddr || '',
          bankName: '',
          accountNum: '',
          accountHolder: '',
          note: '',
        });
      }
    }

    // 매입(환매) 거래
    for (const ti of tradeIns) {
      const amount = Number(ti.payoutAmount);
      totalPurchases += amount;

      let pinDisplay = '-';
      if (ti.pinCode && pinOption !== 'none') {
        pinDisplay = this.resolvePin(ti.pinCode, ti.id, pinOption);
      } else if (pinOption === 'none') {
        pinDisplay = '';
      }

      items.push({
        transactionId: `TI-${ti.id}`,
        type: 'PURCHASE' as const,
        date: ti.createdAt.toISOString(),
        productName: ti.productName || ti.product?.name || '-',
        brandCode: ti.productBrand || ti.product?.brandCode || '-',
        quantity: ti.quantity,
        unitPrice: Number(ti.productPrice || 0),
        faceValue: Number(ti.productPrice || 0),
        totalAmount: amount,
        pin: pinDisplay,
        status: ti.status,
        paymentMethod: '계좌이체',
        recipientName: '',
        recipientPhone: '',
        recipientAddr: '',
        bankName: ti.bankName || '',
        accountNum: this.resolveAccount(ti.accountNum, pinOption),
        accountHolder: ti.accountHolder || '',
        note: ti.adminNote || '',
      });
    }

    items.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return {
      items,
      summary: {
        totalSales,
        totalPurchases,
        netAmount: totalSales - totalPurchases,
        salesCount: orders.length,
        purchasesCount: tradeIns.length,
        transactionCount: items.length,
      },
    };
  }

  // ========================================
  // 은행제출 증빙 (2-sheet 포맷용 데이터)
  // ========================================

  /**
   * 사용자의 매입 증빙 데이터 조회 (은행제출용)
   * PIN/securityCode는 항상 마스킹 (보안)
   */
  async getMyBankSubmission(
    userId: number,
    options?: {
      startDate?: string;
      endDate?: string;
      type?: 'ALL' | 'SALE' | 'PURCHASE';
    },
  ) {
    const type = options?.type || 'ALL';
    const where: any = { userId };

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = new Date(options.startDate);
      if (options.endDate) {
        const end = new Date(options.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [orders, tradeIns] = await Promise.all([
      type === 'PURCHASE'
        ? Promise.resolve([])
        : this.prisma.order.findMany({
            where,
            include: {
              items: {
                include: {
                  product: {
                    select: { name: true, brandCode: true, price: true },
                  },
                },
              },
              voucherCodes: { select: { id: true, pinCode: true } },
            },
            orderBy: { createdAt: 'asc' },
          }),
      type === 'SALE'
        ? Promise.resolve([])
        : this.prisma.tradeIn.findMany({
            where,
            orderBy: { createdAt: 'asc' },
          }),
    ]);

    const items: any[] = [];
    let totalSales = 0;
    let totalPurchases = 0;

    // 판매(구매) 거래
    for (const order of orders) {
      const resolvedPins = order.voucherCodes.map((vc) =>
        this.maskPin(vc.pinCode, vc.id),
      );
      const pinDisplay = resolvedPins.join(', ') || '-';

      for (const item of order.items) {
        const amount = Number(item.price) * item.quantity;
        totalSales += amount;

        items.push({
          tradeInId: `ORD-${order.id}`,
          date: order.createdAt.toISOString(),
          sellerName: '',
          sellerPhone: '',
          bankName: '',
          accountHolder: '',
          accountNum: '',
          productName: item.product?.name || '-',
          brandCode: item.product?.brandCode || '-',
          quantity: item.quantity,
          faceValue: Number(item.product?.price || 0),
          payoutAmount: amount,
          pinCode: pinDisplay,
          securityCode: '',
          status: order.status,
          adminNote: '',
          type: 'SALE' as const,
          paymentMethod: order.paymentMethod || '-',
        });
      }
    }

    // 매입(환매) 거래
    for (const ti of tradeIns) {
      const amount = Number(ti.payoutAmount);
      totalPurchases += amount;

      items.push({
        tradeInId: `TI-${ti.id}`,
        date: ti.createdAt.toISOString(),
        sellerName: '',
        sellerPhone: '',
        bankName: ti.bankName || '-',
        accountHolder: ti.accountHolder || '-',
        accountNum: this.resolveAccount(ti.accountNum, 'masked'),
        productName: ti.productName || '-',
        brandCode: ti.productBrand || '-',
        quantity: ti.quantity,
        faceValue: Number(ti.productPrice || 0),
        payoutAmount: amount,
        pinCode: ti.pinCode ? this.maskPin(ti.pinCode, ti.id) : '-',
        securityCode: ti.securityCode
          ? this.resolveMasked(ti.securityCode)
          : '',
        status: ti.status,
        adminNote: ti.adminNote || '',
        type: 'PURCHASE' as const,
        paymentMethod: '계좌이체',
      });
    }

    return {
      items,
      summary: {
        totalRecords: items.length,
        totalSales,
        totalPurchases,
        totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
        totalFaceValue: items.reduce((s, i) => s + i.faceValue * i.quantity, 0),
      },
    };
  }

  /** 암호화 필드 마스킹 (앞 2자리만 표시) */
  private resolveMasked(encrypted: string): string {
    try {
      const decrypted = this.cryptoService.decrypt(encrypted);
      return decrypted.length > 2 ? decrypted.slice(0, 2) + '***' : decrypted;
    } catch {
      return '***';
    }
  }

  // ========================================
  // PIN helpers (public — used by AdminOrdersService)
  // ========================================

  /** PIN 복호화 — 실패 시 마스킹 처리 (전체 조회 실패 방지) */
  safeDecrypt(pinCode: string, voucherId: number): string {
    try {
      return this.cryptoService.decrypt(pinCode);
    } catch {
      this.logger.error(`PIN 복호화 실패 (voucherId: ${voucherId})`);
      return '****-****-****';
    }
  }

  /**
   * PIN 복호화 후 마스킹 — 은행제출 보고서용
   */
  maskPin(encryptedPin: string, voucherId: number): string {
    const decrypted = this.safeDecrypt(encryptedPin, voucherId);
    if (decrypted === '****-****-****') return decrypted;
    if (decrypted.length <= 4) return decrypted;
    return decrypted.slice(0, 4) + '****';
  }

  /**
   * PIN 해석 — pinOption에 따라 전체/마스킹/빈 문자열 반환
   */
  resolvePin(
    encrypted: string,
    id: number,
    pinOption: 'full' | 'masked' | 'none',
  ): string {
    if (pinOption === 'none') return '';
    if (pinOption === 'full') return this.safeDecrypt(encrypted, id);
    return this.maskPin(encrypted, id);
  }

  /** 주문 객체 내의 암호화된 바우처 PIN을 복호화하는 헬퍼 */
  decryptOrderVouchers<
    T extends { voucherCodes?: { id: number; pinCode: string }[] },
  >(order: T): T {
    if (!order.voucherCodes) return order;

    return {
      ...order,
      voucherCodes: order.voucherCodes.map((vc) => ({
        ...vc,
        pinCode: this.safeDecrypt(vc.pinCode, vc.id),
      })),
    };
  }

  /**
   * 계좌번호 해석 — pinOption에 따라 마스킹 또는 빈 문자열 반환
   */
  private resolveAccount(
    encrypted: string | null,
    pinOption: 'full' | 'masked' | 'none',
  ): string {
    if (!encrypted) return '';
    if (pinOption === 'none') return '';
    try {
      const decrypted = this.cryptoService.decrypt(encrypted);
      if (pinOption === 'full') return decrypted;
      return decrypted.length > 4 ? '***' + decrypted.slice(-4) : decrypted;
    } catch {
      return '***-****';
    }
  }
}
