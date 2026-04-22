import { Injectable, NotFoundException } from '@nestjs/common';

import { paginatedQuery } from '../../../base/paginated-query';
import { PaginationQueryDto } from '../../../base/pagination.dto';
import { GIFT_STATUS } from '../../../shared/constants';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class AdminGiftsService {
  constructor(private readonly prisma: PrismaService) {}

  // ========================================
  // Gifts Management
  // ========================================

  async findAll(
    paginationDto: PaginationQueryDto,
    status?: string,
    search?: string,
  ) {
    // status filter: Gift.status 직접 필터
    const where: any = {};
    if (status === 'claimed') {
      where.status = GIFT_STATUS.CLAIMED;
    } else if (status === 'pending') {
      where.status = GIFT_STATUS.SENT;
    } else if (status === 'expired') {
      where.status = GIFT_STATUS.EXPIRED;
    } else if (status) {
      where.status = status.toUpperCase();
    }

    if (search) {
      const searchConditions: any[] = [
        { sender: { name: { contains: search } } },
        { receiver: { name: { contains: search } } },
        { receiverName: { contains: search } },
      ];
      const parsed = parseInt(search, 10);
      if (!isNaN(parsed)) {
        searchConditions.push({ id: parsed });
        searchConditions.push({ orderId: parsed });
      }
      where.OR = searchConditions;
    }

    return paginatedQuery(this.prisma.gift, {
      pagination: paginationDto,
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, email: true, name: true } },
        receiver: { select: { id: true, email: true, name: true } },
        order: { include: { items: { include: { product: true } } } },
      },
    });
  }

  async findOne(id: number) {
    const gift = await this.prisma.gift.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, email: true, name: true, phone: true } },
        receiver: {
          select: { id: true, email: true, name: true, phone: true },
        },
        order: {
          include: {
            items: { include: { product: true } },
            voucherCodes: true,
          },
        },
      },
    });
    if (!gift) throw new NotFoundException('Gift not found');
    return gift;
  }

  async getStats() {
    const [totalGifts, claimedGifts, expiredGifts, todayGifts, thisMonthGifts] =
      await Promise.all([
        this.prisma.gift.count(),
        this.prisma.gift.count({
          where: { status: GIFT_STATUS.CLAIMED },
        }),
        this.prisma.gift.count({
          where: { status: GIFT_STATUS.EXPIRED },
        }),
        this.prisma.gift.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        this.prisma.gift.count({
          where: {
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
      ]);

    const pendingGifts = totalGifts - claimedGifts - expiredGifts;
    const claimRate =
      totalGifts > 0 ? Math.round((claimedGifts / totalGifts) * 100) : 0;

    // Top senders
    const topSenders = await this.prisma.gift.groupBy({
      by: ['senderId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    return {
      totalGifts,
      pendingGifts,
      claimedGifts,
      expiredGifts,
      claimRate,
      todayGifts,
      thisMonthGifts,
      topSenders,
    };
  }
}
