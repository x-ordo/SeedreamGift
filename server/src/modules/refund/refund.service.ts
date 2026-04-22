import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { paginatedQuery } from '../../base/paginated-query';
import { PaginationQueryDto } from '../../base/pagination.dto';
import {
  ORDER_STATUS,
  REFUND_STATUS,
  REFUND_ERRORS,
} from '../../shared/constants';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { IVoucherAssigner } from '../orders/interfaces/voucher-assigner.interface';
import { VOUCHER_ASSIGNER } from '../orders/interfaces/voucher-assigner.interface';

@Injectable()
export class RefundService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VOUCHER_ASSIGNER)
    private readonly voucherAssigner: IVoucherAssigner,
  ) {}

  /**
   * 환불 요청 생성 (관리자용)
   */
  async createRefund(orderId: number, reason: string, adminId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { refund: true },
    });

    if (!order) throw new NotFoundException(REFUND_ERRORS.ORDER_NOT_FOUND);
    if (order.refund) {
      throw new BadRequestException(REFUND_ERRORS.ALREADY_EXISTS);
    }
    if (order.status === ORDER_STATUS.CANCELLED) {
      throw new BadRequestException(REFUND_ERRORS.ALREADY_CANCELLED);
    }

    return this.prisma.refund.create({
      data: {
        orderId,
        amount: order.totalAmount,
        reason,
        status: REFUND_STATUS.REQUESTED,
        processedBy: adminId,
      },
    });
  }

  /**
   * 환불 승인 (관리자용) -- 주문 취소 + 바우처 회수
   */
  async approveRefund(refundId: number, adminId: number, adminNote?: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { order: true },
    });

    if (!refund) throw new NotFoundException(REFUND_ERRORS.NOT_FOUND);
    if (refund.status !== REFUND_STATUS.REQUESTED) {
      throw new BadRequestException(REFUND_ERRORS.ALREADY_PROCESSED);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. 환불 승인 처리
      const updatedRefund = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: REFUND_STATUS.APPROVED,
          processedBy: adminId,
          processedAt: new Date(),
          adminNote,
        },
      });

      // 2. 주문 취소
      await tx.order.update({
        where: { id: refund.orderId },
        data: { status: ORDER_STATUS.CANCELLED },
      });

      // 3. 바우처 회수 (SOLD -> AVAILABLE) — VoucherService 도메인 로직 위임
      await this.voucherAssigner.releaseVouchersFromOrder(refund.orderId, tx);

      return updatedRefund;
    });
  }

  /**
   * 환불 거부 (관리자용)
   */
  async rejectRefund(refundId: number, adminId: number, adminNote?: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) throw new NotFoundException(REFUND_ERRORS.NOT_FOUND);
    if (refund.status !== REFUND_STATUS.REQUESTED) {
      throw new BadRequestException(REFUND_ERRORS.ALREADY_PROCESSED);
    }

    return this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: REFUND_STATUS.REJECTED,
        processedBy: adminId,
        processedAt: new Date(),
        adminNote,
      },
    });
  }

  /**
   * 환불 목록 조회 (관리자용)
   */
  async findAll(paginationDto: PaginationQueryDto, status?: string) {
    return paginatedQuery(this.prisma.refund, {
      pagination: paginationDto,
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: { id: true, userId: true, totalAmount: true, status: true },
        },
      },
    });
  }

  /**
   * 환불 상세 조회
   */
  async findOne(id: number) {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: { include: { product: { select: { name: true } } } },
            user: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
    if (!refund) throw new NotFoundException(REFUND_ERRORS.NOT_FOUND);
    return refund;
  }
}
