/**
 * @file orders.service.spec.ts
 * @description 주문 서비스 단위 테스트
 *
 * 테스트 범위:
 * - 주문 상태 전이 규칙 (VALID_TRANSITIONS)
 * - 구매 한도 검증 (일일/월간/건당)
 * - PIN 마스킹 로직
 * - 주문 취소 조건 검증
 *
 * OrdersService는 파사드이므로, 하위 서비스(OrderCreationService,
 * OrderQueryService, OrderLifecycleService)를 실제 인스턴스로 주입하여
 * 위임 + 비즈니스 로직을 통합 검증합니다.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import { VOUCHER_ASSIGNER } from './interfaces/voucher-assigner.interface';
import { OrdersService } from './orders.service';
import { OrderCreationService } from './services/order-creation.service';
import { OrderLifecycleService } from './services/order-lifecycle.service';
import { OrderQueryService } from './services/order-query.service';
import { ORDER_STATUS } from '../../shared/constants';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SiteConfigService } from '../site-config/site-config.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;
  let cryptoService: any;
  let siteConfigService: any;
  let voucherAssigner: any;
  let paymentProvider: any;

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      product: { findMany: jest.fn() },
      voucherCode: { groupBy: jest.fn() },
      orderItem: { findMany: jest.fn() },
      gift: { findMany: jest.fn(), count: jest.fn() },
      tradeIn: { findMany: jest.fn() },
      $transaction: jest.fn((fn: any) => {
        if (typeof fn === 'function') return fn(prisma);
        return Promise.all(fn);
      }),
      executeWithRetry: jest.fn((fn: any) => fn()),
    };

    cryptoService = {
      encrypt: jest.fn((val: string) => `enc_${val}`),
      decrypt: jest.fn((val: string) => val.replace('enc_', '')),
      hash: jest.fn((val: string) => `hash_${val}`),
    };

    siteConfigService = {
      getNumber: jest.fn().mockResolvedValue(2000000), // default daily limit
    };

    voucherAssigner = {
      assignVouchersToOrder: jest.fn().mockResolvedValue(1),
      releaseVouchersFromOrder: jest.fn().mockResolvedValue({ count: 1 }),
    };

    paymentProvider = {
      verifyPayment: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        OrderCreationService,
        OrderQueryService,
        OrderLifecycleService,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoService, useValue: cryptoService },
        { provide: SiteConfigService, useValue: siteConfigService },
        { provide: VOUCHER_ASSIGNER, useValue: voucherAssigner },
        { provide: PAYMENT_PROVIDER, useValue: paymentProvider },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('updateStatus — state transition rules', () => {
    const createOrder = (status: string) => ({
      id: 1,
      userId: 1,
      status,
      totalAmount: 50000,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should allow PENDING → PAID', async () => {
      const order = createOrder(ORDER_STATUS.PENDING);
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.order.update.mockResolvedValue({
        ...order,
        status: ORDER_STATUS.PAID,
        voucherCodes: [],
      });

      const result = await service.updateStatus(1, ORDER_STATUS.PAID);
      expect(result.status).toBe(ORDER_STATUS.PAID);
    });

    it('should allow PENDING → CANCELLED', async () => {
      const order = createOrder(ORDER_STATUS.PENDING);
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.order.update.mockResolvedValue({
        ...order,
        status: ORDER_STATUS.CANCELLED,
        voucherCodes: [],
      });

      const result = await service.updateStatus(1, ORDER_STATUS.CANCELLED);
      expect(result.status).toBe(ORDER_STATUS.CANCELLED);
      expect(voucherAssigner.releaseVouchersFromOrder).toHaveBeenCalledWith(
        1,
        prisma,
      );
    });

    it('should allow PAID → DELIVERED', async () => {
      const order = createOrder(ORDER_STATUS.PAID);
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.order.update.mockResolvedValue({
        ...order,
        status: ORDER_STATUS.DELIVERED,
        voucherCodes: [],
      });

      const result = await service.updateStatus(1, ORDER_STATUS.DELIVERED);
      expect(result.status).toBe(ORDER_STATUS.DELIVERED);
    });

    it('should reject DELIVERED → PENDING (invalid transition)', async () => {
      prisma.order.findUnique.mockResolvedValue(
        createOrder(ORDER_STATUS.DELIVERED),
      );

      await expect(
        service.updateStatus(1, ORDER_STATUS.PENDING),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject CANCELLED → PAID (terminal state)', async () => {
      prisma.order.findUnique.mockResolvedValue(
        createOrder(ORDER_STATUS.CANCELLED),
      );

      await expect(service.updateStatus(1, ORDER_STATUS.PAID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for missing order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus(999, 'PAID')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should auto-assign vouchers when transitioning to PAID', async () => {
      const order = createOrder(ORDER_STATUS.PENDING);
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.order.update.mockResolvedValue({
        ...order,
        status: ORDER_STATUS.PAID,
        voucherCodes: [], // empty = needs assignment
      });

      await service.updateStatus(1, ORDER_STATUS.PAID);
      expect(voucherAssigner.assignVouchersToOrder).toHaveBeenCalledWith(
        1,
        prisma,
      );
    });
  });

  describe('getOrder — access control', () => {
    const mockOrder = {
      id: 1,
      userId: 10,
      totalAmount: 50000,
      status: 'PAID',
      items: [],
      voucherCodes: [],
    };

    it('should return order for owner', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrder(1, 10);
      expect(result.id).toBe(1);
    });

    it('should return order for ADMIN regardless of ownership', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrder(1, 999, 'ADMIN');
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException for non-owner non-admin', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.getOrder(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for missing order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.getOrder(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelMyOrder', () => {
    it('should cancel a recent PENDING order', async () => {
      const recentOrder = {
        id: 1,
        userId: 10,
        status: ORDER_STATUS.PENDING,
        createdAt: new Date(), // just now
      };
      prisma.order.findUnique.mockResolvedValue(recentOrder);
      prisma.order.update.mockResolvedValue({
        ...recentOrder,
        status: ORDER_STATUS.CANCELLED,
      });
      siteConfigService.getNumber.mockResolvedValue(30 * 60 * 1000); // 30 min

      const result = await service.cancelMyOrder(1, 10);
      expect(result.status).toBe(ORDER_STATUS.CANCELLED);
      expect(voucherAssigner.releaseVouchersFromOrder).toHaveBeenCalled();
    });

    it('should reject cancel for non-PENDING order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        userId: 10,
        status: ORDER_STATUS.PAID,
        createdAt: new Date(),
      });

      await expect(service.cancelMyOrder(1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject cancel for other user order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        userId: 10,
        status: ORDER_STATUS.PENDING,
        createdAt: new Date(),
      });

      await expect(service.cancelMyOrder(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject cancel after cancel window expires', async () => {
      const oldOrder = {
        id: 1,
        userId: 10,
        status: ORDER_STATUS.PENDING,
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };
      prisma.order.findUnique.mockResolvedValue(oldOrder);
      siteConfigService.getNumber.mockResolvedValue(30 * 60 * 1000); // 30 min window

      await expect(service.cancelMyOrder(1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('maskPin', () => {
    it('should mask PIN keeping first 4 characters', () => {
      cryptoService.decrypt.mockReturnValue('1234567890');
      const result = service.maskPin('enc_test', 1);
      expect(result).toBe('1234****');
    });

    it('should return short PIN as-is', () => {
      cryptoService.decrypt.mockReturnValue('1234');
      const result = service.maskPin('enc_short', 1);
      expect(result).toBe('1234');
    });

    it('should return masked placeholder on decrypt failure', () => {
      cryptoService.decrypt.mockImplementation(() => {
        throw new Error('decrypt failed');
      });
      const result = service.maskPin('bad_data', 1);
      expect(result).toBe('****-****-****');
    });
  });

  describe('resolvePin', () => {
    it('should return empty string for none option', () => {
      const result = service.resolvePin('enc_test', 1, 'none');
      expect(result).toBe('');
    });

    it('should return full decrypted pin for full option', () => {
      cryptoService.decrypt.mockReturnValue('1234567890');
      const result = service.resolvePin('enc_test', 1, 'full');
      expect(result).toBe('1234567890');
    });

    it('should return masked pin for masked option', () => {
      cryptoService.decrypt.mockReturnValue('1234567890');
      const result = service.resolvePin('enc_test', 1, 'masked');
      expect(result).toBe('1234****');
    });
  });

  describe('getMyOrders — pagination', () => {
    it('should return paginated orders', async () => {
      const mockOrders = [
        { id: 1, userId: 10, status: 'PAID', items: [], voucherCodes: [] },
      ];
      prisma.order.findMany.mockResolvedValue(mockOrders);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.getMyOrders(10, { page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should use default pagination when not provided', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      const result = await service.getMyOrders(10);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });
});
