import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { paginatedQuery } from '../../../base/paginated-query';
import { PaginationQueryDto } from '../../../base/pagination.dto';
import { CryptoService } from '../../../shared/crypto/crypto.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CartService } from '../../cart/cart.service';
import { OrdersService } from '../../orders/orders.service';

@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly cryptoService: CryptoService,
    private readonly cartService: CartService,
  ) {}

  // ========================================
  // Orders CRUD
  // ========================================

  async findAll(
    paginationDto: PaginationQueryDto,
    status?: string,
    search?: string,
  ) {
    const where: any = {};
    if (status) where.status = status;

    if (search) {
      const searchConditions: any[] = [
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
        { orderCode: { contains: search } },
      ];
      const parsed = parseInt(search, 10);
      if (!isNaN(parsed)) {
        searchConditions.push({ id: parsed });
      }
      where.OR = searchConditions;
    }

    return paginatedQuery(this.prisma.order, {
      pagination: paginationDto,
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, name: true } },
        items: { include: { product: true } },
      },
    });
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, name: true, phone: true } },
        items: { include: { product: true } },
        voucherCodes: true,
        gift: {
          include: {
            receiver: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: number, status: string) {
    // OrdersService에 위임하여 CANCELLED 시 바우처 회수 등 비즈니스 로직 수행
    return this.ordersService.updateStatus(id, status);
  }

  // ========================================
  // CartItems Management
  // ========================================

  async findAllCarts(paginationDto: PaginationQueryDto) {
    // CartService에 위임하여 도메인 경계 유지
    return this.cartService.findAllPaginated(paginationDto);
  }

  async findUserCarts(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // CartService.getCart()는 재고 포함 응답이므로 여기선 직접 조회 유지
    // (관리자용은 재고 불필요, product만 포함)
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
    });
    return items;
  }

  async deleteCartItem(id: number) {
    const item = await this.prisma.cartItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Cart item not found');

    return this.prisma.cartItem.delete({ where: { id } });
  }

  async clearUserCart(userId: number) {
    // CartService에 위임하여 도메인 경계 유지
    return this.cartService.clearCartByUserId(userId);
  }

  // ========================================
  // Bank Transaction Report
  // ========================================

  async getBankTransactionReport(query: {
    startDate: string;
    endDate: string;
    type?: 'SALE' | 'PURCHASE' | 'ALL';
    status?: string;
    pinOption?: 'full' | 'masked' | 'none';
  }) {
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);

    const type = query.type || 'ALL';
    const pinOption = query.pinOption || 'masked';
    const statusList = query.status
      ? query.status.split(',').map((s) => s.trim())
      : undefined;

    const items: any[] = [];
    let totalSales = 0;
    let totalPurchases = 0;

    // 판매(Order) 조회
    if (type === 'ALL' || type === 'SALE') {
      const orderWhere: any = {
        createdAt: { gte: start, lte: end },
      };
      if (statusList) orderWhere.status = { in: statusList };

      const orders = await this.prisma.order.findMany({
        where: orderWhere,
        include: {
          user: { select: { name: true, email: true, phone: true } },
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  brandCode: true,
                  price: true,
                  buyPrice: true,
                },
              },
            },
          },
          voucherCodes: { select: { id: true, pinCode: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      for (const order of orders) {
        const resolvedPins = order.voucherCodes.map((vc) =>
          this.ordersService.resolvePin(vc.pinCode, vc.id, pinOption),
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
            customerName: order.user?.name || '-',
            customerPhone: order.recipientPhone || order.user?.phone || '-',
            customerAddress: order.recipientAddr || '-',
            productName: item.product?.name || '-',
            brandCode: item.product?.brandCode || '-',
            quantity: item.quantity,
            unitPrice: Number(item.price),
            faceValue: Number(item.product?.price || 0),
            totalAmount: amount,
            pin: pinDisplay,
            status: order.status,
            paymentMethod: order.paymentMethod || '-',
          });
        }
      }
    }

    // 매입(TradeIn) 조회
    if (type === 'ALL' || type === 'PURCHASE') {
      const tradeInWhere: any = {
        createdAt: { gte: start, lte: end },
      };
      if (statusList) tradeInWhere.status = { in: statusList };

      const tradeIns = await this.prisma.tradeIn.findMany({
        where: tradeInWhere,
        include: {
          user: { select: { name: true, email: true, phone: true } },
          product: { select: { name: true, brandCode: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      for (const ti of tradeIns) {
        const amount = Number(ti.payoutAmount);
        totalPurchases += amount;

        let pinDisplay = '-';
        if (ti.pinCode && pinOption !== 'none') {
          pinDisplay = this.ordersService.resolvePin(
            ti.pinCode,
            ti.id,
            pinOption,
          );
        } else if (pinOption === 'none') {
          pinDisplay = '';
        }

        items.push({
          transactionId: `TI-${ti.id}`,
          type: 'PURCHASE' as const,
          date: ti.createdAt.toISOString(),
          customerName: ti.user?.name || ti.senderName || '-',
          customerPhone: ti.user?.phone || ti.senderPhone || '-',
          customerAddress: '-',
          productName: ti.productName || ti.product?.name || '-',
          brandCode: ti.productBrand || ti.product?.brandCode || '-',
          quantity: ti.quantity,
          unitPrice: Number(ti.productPrice || 0),
          faceValue: Number(ti.productPrice || 0),
          totalAmount: amount,
          pin: pinDisplay,
          status: ti.status,
          paymentMethod: '계좌이체',
        });
      }
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
        transactionCount: items.length,
      },
    };
  }

  /**
   * 특정 사용자의 거래내역 증빙 데이터 조회 (관리자용)
   * OrdersService.getMyTransactionExport()에 위임
   */
  async getUserTransactionExport(
    userId: number,
    options?: {
      pinOption?: 'full' | 'masked' | 'none';
      type?: 'ALL' | 'SALE' | 'PURCHASE';
    },
  ) {
    return this.ordersService.getMyTransactionExport(userId, options);
  }
}
