/**
 * @file order-lifecycle.service.ts
 * @description 주문 생명주기 책임 — 취소, 상태 변경, 결제+배송 처리
 * @module modules/orders/services
 *
 * OrdersService에서 분리된 주문 상태 관리 전용 서비스.
 * cancelMyOrder, updateStatus, processPaymentAndDeliver 포함.
 */
import {
  Injectable,
  BadRequestException,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  ORDER_ERRORS,
  ORDER_STATUS,
  ORDER_CANCEL_WINDOW_MS,
} from '../../../shared/constants';
import { CryptoService } from '../../../shared/crypto/crypto.service';
import { Order } from '../../../shared/prisma/generated/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { PaymentStrategyFactory } from '../payment/payment-strategy.factory';
import type { IVoucherAssigner } from '../interfaces/voucher-assigner.interface';
import { VOUCHER_ASSIGNER } from '../interfaces/voucher-assigner.interface';

@Injectable()
export class OrderLifecycleService {
  private readonly logger = new Logger(OrderLifecycleService.name);

  /** 유효한 주문 상태 전이 맵 */
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PAID]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.CANCELLED]: [],
  };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VOUCHER_ASSIGNER)
    private readonly voucherAssigner: IVoucherAssigner,
    private readonly paymentFactory: PaymentStrategyFactory,
    private readonly cryptoService: CryptoService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 사용자 주문 취소 (PENDING 상태만)
   * 생성 후 30분 이내의 PENDING 주문만 취소 가능
   */
  async cancelMyOrder(orderId: number, userId: number): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new NotFoundException(ORDER_ERRORS.NOT_FOUND);
    if (order.userId !== userId)
      throw new NotFoundException(ORDER_ERRORS.NOT_FOUND);
    if (order.status !== ORDER_STATUS.PENDING) {
      throw new BadRequestException(
        '결제 대기 중인 주문만 취소할 수 있습니다.',
      );
    }

    // 취소 가능 시간 이내 주문만 취소 가능
    const thirtyMinutesAgo = new Date(Date.now() - ORDER_CANCEL_WINDOW_MS);
    if (order.createdAt < thirtyMinutesAgo) {
      throw new BadRequestException(
        '주문 생성 후 30분이 지나 취소할 수 없습니다. 고객센터에 문의해주세요.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: ORDER_STATUS.CANCELLED },
      });

      // Release any vouchers that might have been assigned
      await this.voucherAssigner.releaseVouchersFromOrder(orderId, tx);

      return updatedOrder;
    });
  }

  /**
   * 결제 처리 및 바우처 배송
   *
   * 개선: 외부 API 호출(verifyPayment)을 DB 트랜잭션 외부로 분리하여
   * 커넥션 점유 시간을 최소화하고 시스템 가용성을 높임.
   * Factory를 통해 결제 수단에 맞는 Provider를 동적으로 선택.
   */
  async processPaymentAndDeliver(
    orderId: number,
    paymentKey: string,
  ): Promise<{
    orderId: number;
    status: string;
    vouchers: { pinCode: string; productName: string }[];
  }> {
    // 1. 사전 조회 (트랜잭션 밖)
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        voucherCodes: { include: { product: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(ORDER_ERRORS.NOT_FOUND);
    }

    // 상태 전환 유효성 검사 (Idempotency)
    if (
      order.status === ORDER_STATUS.PAID ||
      order.status === ORDER_STATUS.DELIVERED
    ) {
      return {
        orderId,
        status: order.status,
        vouchers: order.voucherCodes.map((vc) => ({
          pinCode: this.safeDecrypt(vc.pinCode, vc.id),
          productName: vc.product.name,
        })),
      };
    }

    // 2. 외부 PG 결제 검증 (트랜잭션 밖)
    // Factory 패턴: 주문의 결제 수단(또는 기본 설정)에 따라 Provider 획득
    const provider = this.paymentFactory.getProvider(order.paymentMethod || 'MOCK');
    
    const paymentResult = await provider.verifyPayment(
      paymentKey,
      orderId,
      Number(order.totalAmount),
    );
    if (!paymentResult.success) {
      throw new BadRequestException('결제 검증에 실패했습니다.');
    }

    // 3. 상태 업데이트 및 바우처 할당 (트랜잭션 내)
    const result = await this.prisma.$transaction(async (tx) => {
      // 트랜잭션 내에서 상태 재확인 (Race Condition 방지)
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });

      if (currentOrder?.status !== ORDER_STATUS.PENDING) {
        throw new BadRequestException('이미 처리 중이거나 취소된 주문입니다.');
      }

      // 상태 업데이트
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: ORDER_STATUS.PAID,
          paymentKey,
        },
      });

      // 바우처 할당
      await this.voucherAssigner.assignVouchersToOrder(orderId, tx);

      // 최종 결과 조회
      const finalOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          voucherCodes: { include: { product: true } },
        },
      });

      return {
        orderId,
        status: ORDER_STATUS.PAID,
        vouchers:
          finalOrder?.voucherCodes.map((vc) => ({
            pinCode: this.safeDecrypt(vc.pinCode, vc.id),
            productName: vc.product.name,
          })) || [],
      };
    });

    // 4. 주문 완료 이벤트 발행 (Observer 패턴)
    this.eventEmitter.emit('order.paid', result);

    return result;
  }

  /**
   * 관리자용 주문 상태 변경 (상태 전이 규칙 적용)
   */
  async updateStatus(orderId: number, status: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException(ORDER_ERRORS.NOT_FOUND);

    // 상태 전이 규칙 검증
    const allowedNextStates =
      OrderLifecycleService.VALID_TRANSITIONS[order.status] || [];
    if (!allowedNextStates.includes(status)) {
      throw new BadRequestException(
        `주문 상태를 ${order.status}에서 ${status}(으)로 변경할 수 없습니다.`,
      );
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status },
        include: { items: true, voucherCodes: true },
      });

      // PAID 전환 시 바우처가 미할당이면 자동 할당
      if (
        status === ORDER_STATUS.PAID &&
        updated.voucherCodes.length === 0
      ) {
        await this.voucherAssigner.assignVouchersToOrder(orderId, tx);
      }

      // 주문이 취소되면 할당된 바우처 회수
      if (status === ORDER_STATUS.CANCELLED) {
        await this.voucherAssigner.releaseVouchersFromOrder(orderId, tx);
      }

      return updated;
    });

    // 상태 변경 이벤트 발행 (필요한 경우)
    if (status === ORDER_STATUS.PAID) {
      this.eventEmitter.emit('order.paid.admin', { orderId, status });
    }

    return updatedOrder;
  }

  /** PIN 복호화 — 실패 시 마스킹 처리 */
  private safeDecrypt(pinCode: string, voucherId: number): string {
    try {
      return this.cryptoService.decrypt(pinCode);
    } catch {
      this.logger.error(`PIN 복호화 실패 (voucherId: ${voucherId})`);
      return '****-****-****';
    }
  }
}
