/**
 * @file voucher.service.spec.ts
 * @description 바우처 서비스 단위 테스트
 *
 * 테스트 범위:
 * - 주문 바우처 할당 (assignVouchersToOrder)
 * - 주문 바우처 해제 (releaseVouchersFromOrder)
 * - 트랜잭션 없이 호출 시 에러
 */
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { VOUCHER_REPOSITORY } from './interfaces/voucher-repository.interface';
import { VoucherService } from './voucher.service';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('VoucherService', () => {
  let service: VoucherService;
  let voucherRepository: any;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      voucherCode: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      product: { findUnique: jest.fn() },
      orderItem: { findMany: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    voucherRepository = {
      bulkCreate: jest.fn().mockResolvedValue({ count: 3 }),
      assignToOrder: jest.fn().mockResolvedValue({ assignedIds: [1, 2] }),
      releaseByOrderId: jest.fn().mockResolvedValue({ count: 2 }),
      markAsUsed: jest.fn().mockResolvedValue(undefined),
    };

    const cryptoService = {
      encrypt: jest.fn((val: string) => `enc_${val}`),
      decrypt: jest.fn((val: string) => val.replace('enc_', '')),
      hash: jest.fn((val: string) => `hash_${val}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoucherService,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoService, useValue: cryptoService },
        { provide: VOUCHER_REPOSITORY, useValue: voucherRepository },
      ],
    }).compile();

    service = module.get<VoucherService>(VoucherService);
  });

  describe('assignVouchersToOrder', () => {
    it('should throw if called without transaction', async () => {
      await expect(service.assignVouchersToOrder(1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should assign vouchers for each order item', async () => {
      const tx = {
        ...prisma,
        orderItem: {
          findMany: jest.fn().mockResolvedValue([
            {
              orderId: 1,
              productId: 10,
              quantity: 2,
              product: { name: 'Test' },
            },
          ]),
        },
      };

      voucherRepository.assignToOrder.mockResolvedValue({
        assignedIds: [100, 101],
      });

      const count = await service.assignVouchersToOrder(1, tx);
      expect(count).toBe(2);
      expect(voucherRepository.assignToOrder).toHaveBeenCalledWith(
        10,
        2,
        1,
        tx,
      );
    });

    it('should throw on insufficient stock', async () => {
      const tx = {
        ...prisma,
        orderItem: {
          findMany: jest.fn().mockResolvedValue([
            {
              orderId: 1,
              productId: 10,
              quantity: 5,
              product: { name: '테스트 상품' },
            },
          ]),
        },
      };

      voucherRepository.assignToOrder.mockResolvedValue({
        assignedIds: [100, 101], // only 2 available, need 5
      });

      await expect(service.assignVouchersToOrder(1, tx)).rejects.toThrow(
        /재고 부족/,
      );
    });

    it('should throw if order has no items', async () => {
      const tx = {
        ...prisma,
        orderItem: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      await expect(service.assignVouchersToOrder(1, tx)).rejects.toThrow(
        /아이템이 없습니다/,
      );
    });
  });

  describe('releaseVouchersFromOrder', () => {
    it('should release vouchers and return count', async () => {
      prisma.voucherCode.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.releaseVouchersFromOrder(1, prisma);
      expect(result).toBe(3);
      expect(prisma.voucherCode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ orderId: 1 }),
        }),
      );
    });
  });
});
