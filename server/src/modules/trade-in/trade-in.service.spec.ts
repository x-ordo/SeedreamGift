/**
 * @file trade-in.service.spec.ts
 * @description 매입 서비스 단위 테스트
 *
 * 테스트 범위:
 * - 매입 상태 전이 규칙 (TRADEIN_VALID_TRANSITIONS)
 * - 복호화 로직 (findOneDecrypted)
 * - 내 매입 내역 조회 (페이지네이션)
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { TradeInService } from './trade-in.service';
import { TRADEIN_STATUS } from '../../shared/constants';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { KycValidator } from '../../shared/validators/kyc.validator';
import { SiteConfigService } from '../site-config/site-config.service';

describe('TradeInService', () => {
  let service: TradeInService;
  let prisma: any;
  let cryptoService: any;

  beforeEach(async () => {
    prisma = {
      tradeIn: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      product: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: any) => {
        if (typeof fn === 'function') return fn(prisma);
        return Promise.all(fn);
      }),
      executeWithRetry: jest.fn((fn: any) => fn()),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    cryptoService = {
      encrypt: jest.fn((val: string) => `enc_${val}`),
      decrypt: jest.fn((val: string) => val.replace('enc_', '')),
      hash: jest.fn((val: string) => `hash_${val}`),
    };

    const siteConfigService = {
      getNumber: jest.fn().mockResolvedValue(5), // MAX_REQUESTS_PER_DAY default
    };

    const kycValidator = {
      ensureVerified: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeInService,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoService, useValue: cryptoService },
        { provide: SiteConfigService, useValue: siteConfigService },
        { provide: KycValidator, useValue: kycValidator },
      ],
    }).compile();

    service = module.get<TradeInService>(TradeInService);
  });

  describe('updateStatus — state transition rules', () => {
    const createTradeIn = (status: string) => ({
      id: 1,
      userId: 10,
      productId: 1,
      status,
      payoutAmount: 92000,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should allow REQUESTED → VERIFIED', async () => {
      prisma.tradeIn.findUnique.mockResolvedValue(
        createTradeIn(TRADEIN_STATUS.REQUESTED),
      );
      prisma.tradeIn.update.mockResolvedValue({
        ...createTradeIn(TRADEIN_STATUS.REQUESTED),
        status: TRADEIN_STATUS.VERIFIED,
      });

      const result = await service.updateStatus(1, TRADEIN_STATUS.VERIFIED);
      expect(result.status).toBe(TRADEIN_STATUS.VERIFIED);
    });

    it('should allow REQUESTED → REJECTED', async () => {
      prisma.tradeIn.findUnique.mockResolvedValue(
        createTradeIn(TRADEIN_STATUS.REQUESTED),
      );
      prisma.tradeIn.update.mockResolvedValue({
        ...createTradeIn(TRADEIN_STATUS.REQUESTED),
        status: TRADEIN_STATUS.REJECTED,
        adminNote: 'PIN 무효',
      });

      const result = await service.updateStatus(
        1,
        TRADEIN_STATUS.REJECTED,
        'PIN 무효',
      );
      expect(result.status).toBe(TRADEIN_STATUS.REJECTED);
    });

    it('should allow VERIFIED → PAID', async () => {
      prisma.tradeIn.findUnique.mockResolvedValue(
        createTradeIn(TRADEIN_STATUS.VERIFIED),
      );
      prisma.tradeIn.update.mockResolvedValue({
        ...createTradeIn(TRADEIN_STATUS.VERIFIED),
        status: TRADEIN_STATUS.PAID,
      });

      const result = await service.updateStatus(1, TRADEIN_STATUS.PAID);
      expect(result.status).toBe(TRADEIN_STATUS.PAID);
    });

    it('should reject PAID → REQUESTED (terminal state)', async () => {
      prisma.tradeIn.findUnique.mockResolvedValue(
        createTradeIn(TRADEIN_STATUS.PAID),
      );

      await expect(
        service.updateStatus(1, TRADEIN_STATUS.REQUESTED),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject REJECTED → VERIFIED (terminal state)', async () => {
      prisma.tradeIn.findUnique.mockResolvedValue(
        createTradeIn(TRADEIN_STATUS.REJECTED),
      );

      await expect(
        service.updateStatus(1, TRADEIN_STATUS.VERIFIED),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject REQUESTED → PAID (must go through VERIFIED)', async () => {
      prisma.tradeIn.findUnique.mockResolvedValue(
        createTradeIn(TRADEIN_STATUS.REQUESTED),
      );

      await expect(
        service.updateStatus(1, TRADEIN_STATUS.PAID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for missing trade-in', async () => {
      prisma.tradeIn.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(999, TRADEIN_STATUS.VERIFIED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneDecrypted', () => {
    it('should decrypt pinCode and accountNum', async () => {
      prisma.tradeIn.findUnique.mockResolvedValue({
        id: 1,
        pinCode: 'enc_1234567890',
        accountNum: 'enc_1234567',
        user: { id: 10, name: 'Test' },
        product: { id: 1, name: 'Test Product' },
      });

      const result = await service.findOneDecrypted(1);
      expect(result.pinCode).toBe('1234567890');
      expect(result.accountNum).toBe('1234567');
    });

    it('should handle null pinCode and accountNum', async () => {
      prisma.tradeIn.findUnique.mockResolvedValue({
        id: 1,
        pinCode: null,
        accountNum: null,
        user: { id: 10 },
        product: { id: 1 },
      });

      const result = await service.findOneDecrypted(1);
      expect(result.pinCode).toBeNull();
      expect(result.accountNum).toBeNull();
    });

    it('should throw NotFoundException for missing trade-in', async () => {
      prisma.tradeIn.findUnique.mockResolvedValue(null);

      await expect(service.findOneDecrypted(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyTradeIns — pagination', () => {
    it('should return paginated trade-ins', async () => {
      const mockItems = [
        { id: 1, userId: 10, status: 'REQUESTED' },
        { id: 2, userId: 10, status: 'VERIFIED' },
      ];
      prisma.tradeIn.findMany.mockResolvedValue(mockItems);
      prisma.tradeIn.count.mockResolvedValue(2);

      const result = await service.getMyTradeIns(10, { page: 1, limit: 20 });
      expect(result.items).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should use default pagination', async () => {
      prisma.tradeIn.findMany.mockResolvedValue([]);
      prisma.tradeIn.count.mockResolvedValue(0);

      const result = await service.getMyTradeIns(10);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });
});
