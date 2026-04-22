/**
 * @file order-creation.service.ts
 * @description 주문 생성 책임 — 검증, 한도 확인, 트랜잭션 처리
 * @module modules/orders/services
 *
 * OrdersService에서 분리된 주문 생성 전용 서비스.
 * createOrder + 모든 검증 헬퍼 메서드를 포함합니다.
 */
import * as crypto from 'crypto';

import {
  Injectable,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';

import {
  PURCHASE_LIMITS,
  ORDER_ERRORS,
  ORDER_STATUS,
  VOUCHER_STATUS,
  GIFT_ERRORS,
  GIFT_STATUS,
  GIFT_EXPIRY_DAYS,
} from '../../../shared/constants';
import { Order, Prisma } from '../../../shared/prisma/generated/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { getStartOfDay } from '../../../shared/utils';
import { SiteConfigService } from '../../site-config/site-config.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { VOUCHER_ASSIGNER } from '../interfaces/voucher-assigner.interface';
import type { IVoucherAssigner } from '../interfaces/voucher-assigner.interface';

@Injectable()
export class OrderCreationService {
  private readonly logger = new Logger(OrderCreationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VOUCHER_ASSIGNER)
    private readonly voucherAssigner: IVoucherAssigner,
    private readonly configService: SiteConfigService,
  ) {}

  /**
   * 신규 주문 생성 (트랜잭션 처리)
   *
   * 장바구니 상품을 주문으로 변환하고 바우처를 자동 할당
   * 트랜잭션으로 원자성 보장 (상품 재고, 주문 생성, 바우처 할당 일괄 처리)
   */
  async createOrder(userId: number, data: CreateOrderDto): Promise<Order> {
    // Pre-transaction validations
    this.validateOrderItems(data);
    const user = await this.validateUserKyc(userId);

    // 멱등성 체크
    if (data.idempotencyKey) {
      const existing = await this.prisma.order.findFirst({
        where: { idempotencyKey: data.idempotencyKey },
        include: { items: true, voucherCodes: true },
      });
      if (existing) return existing;
    }

    // 한도 사전 조회 (트랜잭션 밖 — 설정값이므로 안전)
    const { effectiveDailyLimit, effectiveTxLimit, monthlyLimit } =
      await this.resolveEffectiveLimits(user);

    const result = await this.prisma.executeWithRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          // 1. Gift Validation (트랜잭션 내 — TOCTOU 방지)
          const giftReceiverId = await this.resolveGiftReceiver(
            tx,
            userId,
            data.giftReceiverEmail,
          );

          // 2. 일일/월간 구매 한도 조회 (트랜잭션 내 — race condition 방지)
          const { currentTotal, currentMonthlyTotal } =
            await this.getUserSpendingTotals(tx, userId);

          // 3. 상품 검증 및 금액 계산
          const { totalAmount, orderItemsData, hasPhysicalItem } =
            await this.validateAndBuildOrderItems(tx, data.items);

          // 4. 배송 정보 검증
          this.validateShippingInfo(hasPhysicalItem, data);

          // 5. 한도 검증
          this.validatePurchaseLimits(
            Number(totalAmount),
            effectiveTxLimit,
            effectiveDailyLimit,
            currentTotal,
            monthlyLimit,
            currentMonthlyTotal,
          );

          // 6. Create Order
          const order = await tx.order.create({
            data: {
              orderCode: OrderCreationService.generateOrderCode(),
              userId,
              totalAmount,
              status: ORDER_STATUS.PENDING,
              paymentMethod: data.paymentMethod || undefined,
              items: { create: orderItemsData },
              idempotencyKey: data.idempotencyKey || undefined,
              shippingMethod: data.shippingMethod,
              recipientName: data.recipientName,
              recipientPhone: data.recipientPhone,
              recipientAddr: data.recipientAddr,
              recipientZip: data.recipientZip,
              cashReceiptType: data.cashReceiptType,
              cashReceiptNumber: data.cashReceiptNumber,
            },
          });

          // 7. Create Gift Record if applicable
          if (giftReceiverId) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + GIFT_EXPIRY_DAYS);

            await tx.gift.create({
              data: {
                senderId: userId,
                receiverId: giftReceiverId,
                orderId: order.id,
                status: GIFT_STATUS.SENT,
                message: data.giftMessage || undefined,
                expiresAt,
              },
            });
          }

          return tx.order.findUnique({
            where: { id: order.id },
            include: { items: true },
          }) as any;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    return result;
  }

  // ========================================
  // Validation helpers
  // ========================================

  /** 주문 아이템 수량 검증 (트랜잭션 불필요) */
  validateOrderItems(data: CreateOrderDto): void {
    if (data.items.length > PURCHASE_LIMITS.MAX_ITEMS_PER_ORDER) {
      throw new BadRequestException(
        `주문당 최대 ${PURCHASE_LIMITS.MAX_ITEMS_PER_ORDER}개 상품까지 주문 가능합니다.`,
      );
    }
    for (const item of data.items) {
      if (item.quantity > PURCHASE_LIMITS.MAX_QUANTITY_PER_ITEM) {
        throw new BadRequestException(
          `상품당 최대 ${PURCHASE_LIMITS.MAX_QUANTITY_PER_ITEM}개까지 주문 가능합니다.`,
        );
      }
    }
  }

  /** KYC 인증 상태 및 개인 한도 조회 */
  async validateUserKyc(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycStatus: true,
        customLimitPerTx: true,
        customLimitPerDay: true,
      },
    });
    if (!user || user.kycStatus !== 'VERIFIED') {
      throw new BadRequestException(
        '상품 구매를 위해 본인 인증(KYC)이 필요합니다.',
      );
    }
    return user;
  }

  /** 전역/개인 한도 해석 */
  async resolveEffectiveLimits(user: {
    customLimitPerTx: Prisma.Decimal | null;
    customLimitPerDay: Prisma.Decimal | null;
  }) {
    const [globalDailyLimit, monthlyLimit] = await Promise.all([
      this.configService.getNumber(
        'PURCHASE_LIMIT_DAILY',
        PURCHASE_LIMITS.DEFAULT_DAILY_LIMIT,
      ),
      this.configService.getNumber(
        'PURCHASE_LIMIT_MONTHLY',
        PURCHASE_LIMITS.MONTHLY,
      ),
    ]);

    const effectiveDailyLimit =
      user.customLimitPerDay != null
        ? Number(user.customLimitPerDay)
        : globalDailyLimit;
    const effectiveTxLimit =
      user.customLimitPerTx != null ? Number(user.customLimitPerTx) : Infinity;

    return { effectiveDailyLimit, effectiveTxLimit, monthlyLimit };
  }

  /** 선물 수신자 검증 (트랜잭션 내) */
  async resolveGiftReceiver(
    tx: Prisma.TransactionClient,
    senderId: number,
    receiverEmail?: string,
  ): Promise<number | null> {
    if (!receiverEmail) return null;

    const receiver = await tx.user.findUnique({
      where: { email: receiverEmail },
    });
    if (!receiver)
      throw new BadRequestException(GIFT_ERRORS.RECIPIENT_NOT_FOUND);
    if (receiver.id === senderId)
      throw new BadRequestException(GIFT_ERRORS.CANNOT_GIFT_SELF);

    return receiver.id;
  }

  /** 사용자 일일/월간 구매 실적 조회 (트랜잭션 내) */
  async getUserSpendingTotals(tx: Prisma.TransactionClient, userId: number) {
    const today = getStartOfDay();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const activeStatuses = [
      ORDER_STATUS.PENDING,
      ORDER_STATUS.PAID,
      ORDER_STATUS.DELIVERED,
    ];

    const [userTodayTotal, userMonthlyTotal] = await Promise.all([
      tx.order.aggregate({
        where: {
          userId,
          status: { in: activeStatuses },
          createdAt: { gte: today },
        },
        _sum: { totalAmount: true },
      }),
      tx.order.aggregate({
        where: {
          userId,
          status: { in: activeStatuses },
          createdAt: { gte: monthStart },
        },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      currentTotal: Number(userTodayTotal._sum.totalAmount || 0),
      currentMonthlyTotal: Number(userMonthlyTotal._sum.totalAmount || 0),
    };
  }

  /** 상품 검증, 재고 확인, 주문 아이템 데이터 구성 (트랜잭션 내) */
  async validateAndBuildOrderItems(
    tx: Prisma.TransactionClient,
    items: CreateOrderDto['items'],
  ) {
    const productIds = items.map((item) => item.productId);
    const [products, stockCounts] = await Promise.all([
      tx.product.findMany({ where: { id: { in: productIds } } }),
      tx.voucherCode.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          status: VOUCHER_STATUS.AVAILABLE,
        },
        _count: true,
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const stockMap = new Map(stockCounts.map((s) => [s.productId, s._count]));

    let totalAmount = new Prisma.Decimal(0);
    const orderItemsData: {
      productId: number;
      quantity: number;
      price: Prisma.Decimal;
    }[] = [];
    let hasPhysicalItem = false;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product || !product.isActive || product.deletedAt)
        throw new BadRequestException(ORDER_ERRORS.PRODUCT_NOT_AVAILABLE);

      if (product.type !== 'DIGITAL') {
        hasPhysicalItem = true;
      }

      const stockCount = stockMap.get(product.id) || 0;
      if (stockCount < item.quantity)
        throw new BadRequestException(
          ORDER_ERRORS.INSUFFICIENT_STOCK(product.name),
        );

      const itemTotal = new Prisma.Decimal(product.buyPrice).mul(item.quantity);
      totalAmount = totalAmount.add(itemTotal);
      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.buyPrice,
      });
    }

    return { totalAmount, orderItemsData, hasPhysicalItem };
  }

  /** 배송 정보 검증 */
  validateShippingInfo(hasPhysicalItem: boolean, data: CreateOrderDto): void {
    if (!hasPhysicalItem) return;

    if (!data.shippingMethod) {
      throw new BadRequestException('배송 방법을 선택해주세요.');
    }
    if (data.shippingMethod === 'DELIVERY') {
      if (!data.recipientName || !data.recipientPhone || !data.recipientAddr) {
        throw new BadRequestException('배송 정보를 모두 입력해주세요.');
      }
    }
  }

  /**
   * 주문코드 생성: WG-YYYYMMDD-XXXXX
   * XXXXX = 영숫자 5자리 난수 (혼동 문자 O/0/I/1 제외)
   */
  static generateOrderCode(): string {
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dateStr = kst.toISOString().slice(0, 10).replace(/-/g, '');
    const bytes = crypto.randomBytes(5);
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += CHARS[bytes[i] % CHARS.length];
    }
    return `WG-${dateStr}-${rand}`;
  }

  /** 1회/일일/월간 구매 한도 검증 */
  validatePurchaseLimits(
    totalAmount: number,
    txLimit: number,
    dailyLimit: number,
    currentDailyTotal: number,
    monthlyLimit: number,
    currentMonthlyTotal: number,
  ): void {
    if (totalAmount > txLimit) {
      throw new BadRequestException(
        `1회 구매 한도를 초과했습니다. (한도: ${txLimit.toLocaleString()}원)`,
      );
    }

    const remainingDaily = dailyLimit - currentDailyTotal;
    if (currentDailyTotal + totalAmount > dailyLimit) {
      throw new BadRequestException(
        ORDER_ERRORS.DAILY_LIMIT_EXCEEDED(remainingDaily),
      );
    }

    const remainingMonthly = monthlyLimit - currentMonthlyTotal;
    if (currentMonthlyTotal + totalAmount > monthlyLimit) {
      throw new BadRequestException(
        `월간 구매 한도를 초과했습니다. (잔여 한도: ${remainingMonthly.toLocaleString()}원)`,
      );
    }
  }
}
