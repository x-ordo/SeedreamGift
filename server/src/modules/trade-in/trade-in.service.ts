/**
 * @file trade-in.service.ts
 * @description 상품권 매입 서비스 - PIN 등록, 중복 검증, 정산 금액 계산
 * @module modules/trade-in
 *
 * 사용처:
 * - TradeInController: 매입 신청/조회 API의 비즈니스 로직
 * - AdminController: 관리자 매입 상태 변경 (VERIFIED → PAID)
 *
 * 매입 상태 전이:
 * REQUESTED → VERIFIED → PAID     (정상 플로우)
 * REQUESTED → REJECTED            (PIN 무효, 이미 사용된 상품권 등)
 *
 * 보안 처리:
 * - pinCode: AES-256 암호화 저장 (복호화는 관리자 조회 시에만)
 * - pinHash: SHA-256 해시 저장 (중복 체크용, 단방향이라 원본 복원 불가)
 * - securityCode, giftNumber, accountNum: AES-256 암호화 저장
 *
 * 정산 금액 계산:
 * payoutAmount = price × (1 - tradeInRate/100)
 * 예: 10만원 상품, 매입율 8% → 정산액 92,000원
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateBulkTradeInDto } from './dto/create-bulk-trade-in.dto';
import { CreateTradeInDto } from './dto/create-trade-in.dto';
import { BaseCrudService } from '../../base/base-crud.service';
import { paginatedQuery } from '../../base/paginated-query';
import { PaginationQueryDto } from '../../base/pagination.dto';
import {
  KYC_STATUS,
  PRODUCT_ERRORS,
  TRADEIN_ERRORS,
  TRADEIN_LIMITS,
  TRADEIN_STATUS,
} from '../../shared/constants';
import { calculatePayoutAmount } from '../../shared/constants/pricing';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { TradeIn } from '../../shared/prisma/generated/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class TradeInService extends BaseCrudService<
  TradeIn,
  CreateTradeInDto,
  any
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {
    super(prisma.tradeIn);
  }

  /**
   * 단건 매입 신청
   * PIN 중복 방지를 위해 해시 비교 → 암호화 저장 순서로 처리
   * 정산 금액은 상품의 tradeInRate 기준으로 자동 계산
   */
  async create(dto: CreateTradeInDto & { userId: number }): Promise<TradeIn> {
    const {
      productId,
      pinCode,
      securityCode,
      giftNumber,
      quantity = 1,
      senderName,
      senderPhone,
      senderEmail,
      shippingMethod,
      shippingDate,
      arrivalDate,
      message,
    } = dto;

    // PIN 해시 및 암호화는 트랜잭션 밖에서 수행 (CPU 작업이므로 안전)
    let pinHash: string | undefined;
    let encryptedPin: string | undefined;
    if (pinCode) {
      const pinDigits = pinCode.replace(/\D/g, '');
      pinHash = this.cryptoService.hash(pinDigits);
      encryptedPin = this.cryptoService.encrypt(pinDigits);
    }

    try {
      return await this.prisma.executeWithRetry(() =>
        this.prisma.$transaction(async (tx) => {
          // 0. KYC 인증 확인 + 등록 계좌 조회 — 매입은 본인 인증 완료 사용자만 가능
          const user = await tx.user.findUnique({
            where: { id: dto.userId },
            select: {
              kycStatus: true,
              bankName: true,
              bankCode: true,
              accountNumber: true,
              accountHolder: true,
            },
          });
          if (!user || user.kycStatus !== KYC_STATUS.VERIFIED) {
            throw new BadRequestException(TRADEIN_ERRORS.KYC_REQUIRED);
          }
          if (!user.accountNumber || !user.bankName) {
            throw new BadRequestException(
              '등록된 계좌가 없습니다. 마이페이지에서 계좌를 먼저 등록해주세요.',
            );
          }

          // 0.5 일일 매입 신청 한도 검증
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayCount = await tx.tradeIn.count({
            where: {
              userId: dto.userId,
              createdAt: { gte: todayStart },
            },
          });
          if (todayCount >= TRADEIN_LIMITS.MAX_REQUESTS_PER_DAY) {
            throw new BadRequestException(
              `일일 매입 신청 한도(${TRADEIN_LIMITS.MAX_REQUESTS_PER_DAY}건)를 초과했습니다.`,
            );
          }

          // 1. 상품 정보 조회 및 매입 가능 여부 확인
          const product = await tx.product.findUnique({
            where: { id: productId },
          });
          if (!product) {
            throw new NotFoundException(PRODUCT_ERRORS.NOT_FOUND);
          }
          if (!product.allowTradeIn) {
            throw new BadRequestException(TRADEIN_ERRORS.PRODUCT_NOT_TRADEABLE);
          }

          // 2. PIN 중복 체크 (트랜잭션 내에서 조회 → 생성 atomic 보장)
          if (pinHash) {
            const existing = await tx.tradeIn.findFirst({
              where: { pinHash },
            });
            if (existing) {
              throw new ConflictException(TRADEIN_ERRORS.PIN_ALREADY_USED);
            }
          }

          // 3. 정산 금액 계산 (수량 반영)
          const unitPayout = calculatePayoutAmount(
            product.price,
            product.tradeInRate,
          );
          const payoutAmount = unitPayout.mul(quantity);

          // 4. 민감 정보 암호화 후 저장
          return tx.tradeIn.create({
            data: {
              userId: dto.userId,
              productId,
              productBrand: product.brandCode,
              productName: product.name,
              productPrice: product.price,
              quantity,
              payoutAmount,
              pinCode: encryptedPin || undefined,
              pinHash: pinHash || undefined,
              securityCode: securityCode
                ? this.cryptoService.encrypt(securityCode)
                : undefined,
              giftNumber: giftNumber
                ? this.cryptoService.encrypt(giftNumber)
                : undefined,
              accountNum: user.accountNumber, // 이미 AES-256 암호화 상태
              bankName: user.bankName,
              accountHolder: user.accountHolder,
              senderName,
              senderPhone,
              senderEmail,
              shippingMethod,
              shippingDate: shippingDate ? new Date(shippingDate) : undefined,
              arrivalDate: arrivalDate ? new Date(arrivalDate) : undefined,
              message,
              status: TRADEIN_STATUS.REQUESTED,
            },
          });
        }),
      );
    } catch (error) {
      // P2002: Unique constraint violation (동시 요청으로 pinHash 중복 발생)
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2002') {
        throw new ConflictException(TRADEIN_ERRORS.PIN_ALREADY_USED);
      }
      throw error;
    }
  }

  /**
   * 내 매입 내역 조회
   *
   * 로그인한 사용자의 모든 매입 신청 내역 반환
   * 최신순 정렬
   *
   * @param {number} userId - 사용자 ID
   * @returns {Promise<TradeIn[]>} 매입 내역 목록
   */
  async getMyTradeIns(userId: number, paginationDto?: PaginationQueryDto) {
    return paginatedQuery(this.prisma.tradeIn, {
      pagination: paginationDto ?? {},
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 유효한 매입 상태 전이 맵 */
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    [TRADEIN_STATUS.REQUESTED]: [
      TRADEIN_STATUS.VERIFIED,
      TRADEIN_STATUS.REJECTED,
    ],
    [TRADEIN_STATUS.VERIFIED]: [TRADEIN_STATUS.PAID, TRADEIN_STATUS.REJECTED],
    [TRADEIN_STATUS.PAID]: [],
    [TRADEIN_STATUS.REJECTED]: [],
  };

  /**
   * 매입 상태 변경 (상태 전이 규칙 적용)
   *
   * 유효한 전이:
   * - REQUESTED → VERIFIED | REJECTED
   * - VERIFIED → PAID | REJECTED
   * - PAID, REJECTED → 변경 불가 (최종 상태)
   */
  async updateStatus(
    id: number,
    status: string,
    reason?: string,
  ): Promise<TradeIn> {
    return this.prisma.$transaction(async (tx) => {
      const tradeIn = await tx.tradeIn.findUnique({ where: { id } });
      if (!tradeIn) {
        throw new NotFoundException('TradeIn not found');
      }

      const allowedNextStates =
        TradeInService.VALID_TRANSITIONS[tradeIn.status] || [];
      if (!allowedNextStates.includes(status)) {
        throw new BadRequestException(
          `상태를 ${tradeIn.status}에서 ${status}(으)로 변경할 수 없습니다.`,
        );
      }

      return tx.tradeIn.update({
        where: { id },
        data: {
          status,
          adminNote: status === TRADEIN_STATUS.REJECTED ? reason : null,
        },
      });
    });
  }

  /**
   * 매입 상세 조회 시 복호화 (관리자용)
   *
   * PIN, 계좌번호 등 암호화된 필드를 복호화하여 반환
   * 보안상 주의 필요 - 관리자 전용
   */
  async findOneDecrypted(id: number) {
    const tradeIn = await this.prisma.tradeIn.findUnique({
      where: { id },
      include: { user: true, product: true },
    });
    if (!tradeIn) throw new NotFoundException('TradeIn not found');

    return {
      ...tradeIn,
      pinCode: tradeIn.pinCode
        ? this.cryptoService.decrypt(tradeIn.pinCode)
        : null,
      accountNum: tradeIn.accountNum
        ? this.cryptoService.decrypt(tradeIn.accountNum)
        : null,
    };
  }

  /**
   * 대량 PIN 매입 신청
   *
   * 개별 PIN마다 독립적으로 처리하여 일부 실패해도 나머지는 성공 처리
   * 배치 내 중복 PIN과 DB 내 기존 PIN 모두 체크
   *
   * @param {CreateBulkTradeInDto} dto - 대량 매입 신청 데이터
   * @param {number} dto.productId - 상품 ID
   * @param {Array} dto.pins - PIN 목록 [{pinCode, securityCode?, giftNumber?}]
   * @param {string} dto.accountNum - 정산 계좌번호
   * @param {string} dto.bankName - 은행명
   * @param {string} dto.accountHolder - 예금주
   * @param {number} dto.userId - 사용자 ID (컨트롤러에서 주입)
   * @returns {Promise<Object>} 대량 매입 결과
   * @returns {Array} returns.success - 성공한 PIN 목록 [{pinCode, payoutAmount, tradeInId}]
   * @returns {Array} returns.failed - 실패한 PIN 목록 [{pinCode, reason}]
   * @returns {number} returns.totalPayout - 총 정산 예정 금액
   * @throws {NotFoundException} 상품 없음
   * @throws {BadRequestException} 매입 불가능한 상품
   */
  async createBulk(dto: CreateBulkTradeInDto & { userId: number }): Promise<{
    success: { pinCode: string; payoutAmount: number; tradeInId: number }[];
    failed: { pinCode: string; reason: string }[];
    totalPayout: number;
  }> {
    const { productId, pins, senderName, senderPhone, senderEmail, userId } =
      dto;

    // 상품 정보 + KYC 상태 + 등록 계좌를 병렬 조회 (트랜잭션 외부 — 불변/읽기 전용 데이터)
    const [product, user] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          kycStatus: true,
          bankName: true,
          bankCode: true,
          accountNumber: true,
          accountHolder: true,
        },
      }),
    ]);
    if (!product) throw new NotFoundException(PRODUCT_ERRORS.NOT_FOUND);
    if (!product.allowTradeIn)
      throw new BadRequestException(TRADEIN_ERRORS.PRODUCT_NOT_TRADEABLE);
    if (!user || user.kycStatus !== KYC_STATUS.VERIFIED) {
      throw new BadRequestException(TRADEIN_ERRORS.KYC_REQUIRED);
    }
    if (!user.accountNumber || !user.bankName) {
      throw new BadRequestException(
        '등록된 계좌가 없습니다. 마이페이지에서 계좌를 먼저 등록해주세요.',
      );
    }

    const payoutAmount = calculatePayoutAmount(
      product.price,
      product.tradeInRate,
    );
    const success: {
      pinCode: string;
      payoutAmount: number;
      tradeInId: number;
    }[] = [];
    const failed: { pinCode: string; reason: string }[] = [];

    // 배치 내 중복 PIN 추적용 Set (같은 요청 안에서 동일 PIN 방지)
    const seenPins = new Set<string>();

    for (const pinEntry of pins) {
      // 숫자가 아닌 문자(하이픈, 공백 등) 제거하여 정규화
      const pinDigits = pinEntry.pinCode.replace(/\D/g, '');

      // 배치 내 중복
      if (seenPins.has(pinDigits)) {
        failed.push({ pinCode: pinEntry.pinCode, reason: '배치 내 중복 PIN' });
        continue;
      }
      seenPins.add(pinDigits);

      try {
        // 개별 PIN의 중복 체크 + 생성을 트랜잭션으로 atomic하게 처리
        const pinHash = this.cryptoService.hash(pinDigits);
        const encryptedPin = this.cryptoService.encrypt(pinDigits);

        const tradeIn = await this.prisma.$transaction(async (tx) => {
          const existing = await tx.tradeIn.findFirst({
            where: { pinHash },
          });
          if (existing) {
            throw new ConflictException(TRADEIN_ERRORS.PIN_ALREADY_USED);
          }

          return tx.tradeIn.create({
            data: {
              userId: userId,
              productId,
              productBrand: product.brandCode,
              productName: product.name,
              productPrice: product.price,
              payoutAmount,
              pinCode: encryptedPin,
              pinHash,
              securityCode: pinEntry.securityCode
                ? this.cryptoService.encrypt(pinEntry.securityCode)
                : undefined,
              giftNumber: pinEntry.giftNumber
                ? this.cryptoService.encrypt(pinEntry.giftNumber)
                : undefined,
              bankName: user.bankName,
              accountNum: user.accountNumber, // 이미 AES-256 암호화 상태
              accountHolder: user.accountHolder,
              senderName,
              senderPhone,
              senderEmail,
              status: TRADEIN_STATUS.REQUESTED,
            },
          });
        });

        success.push({
          pinCode: pinEntry.pinCode,
          payoutAmount: Number(payoutAmount),
          tradeInId: tradeIn.id,
        });
      } catch (error) {
        const reason =
          error instanceof ConflictException
            ? '이미 등록된 PIN'
            : '처리 중 오류 발생';
        failed.push({ pinCode: pinEntry.pinCode, reason });
      }
    }

    return {
      success,
      failed,
      totalPayout: success.reduce((sum, s) => sum + s.payoutAmount, 0),
    };
  }

  /**
   * 내 매입 통계 조회
   *
   * 상태별 건수, 누적 정산 금액, 최근 12개월 월별 추이 반환
   * VERIFIED/PAID 상태만 정산 금액에 포함 (REQUESTED/REJECTED는 제외)
   * 4개 쿼리 병렬 실행으로 성능 최적화
   *
   * @param {number} userId - 사용자 ID
   * @returns {Promise<Object>} 매입 통계
   * @returns {number} returns.totalCount - 전체 매입 건수
   * @returns {Object} returns.statusBreakdown - 상태별 건수 맵
   * @returns {number} returns.totalPayout - 누적 정산 금액
   * @returns {Array} returns.monthlyTrend - 월별 추이 (최근 12개월)
   */
  async getMyStats(userId: number) {
    const [totalCount, statusCounts, totalPayout, monthlyData] =
      await Promise.all([
        this.prisma.tradeIn.count({ where: { userId } }),
        this.prisma.tradeIn.groupBy({
          by: ['status'],
          where: { userId },
          _count: true,
        }),
        this.prisma.tradeIn.aggregate({
          where: { userId, status: { in: ['VERIFIED', 'PAID'] } },
          _sum: { payoutAmount: true },
        }),
        this.getMonthlyTrend(userId),
      ]);

    const statusMap: Record<string, number> = {};
    for (const sc of statusCounts) {
      statusMap[sc.status] = sc._count;
    }

    return {
      totalCount,
      statusBreakdown: statusMap,
      totalPayout: Number(totalPayout._sum.payoutAmount || 0),
      monthlyTrend: monthlyData as any[],
    };
  }

  /**
   * 월별 매입 추이 (최근 12개월) — MSSQL raw SQL 격리
   *
   * MSSQL 전용 함수(CONVERT, DATEADD, GETDATE)를 사용하므로
   * DB 변경 시 이 메서드만 수정하면 됨
   */
  private async getMonthlyTrend(
    userId: number,
  ): Promise<{ month: string; count: number; volume: number }[]> {
    return this.prisma.$queryRaw`
      SELECT
        CONVERT(VARCHAR(7), CreatedAt, 120) as month,
        COUNT(*) as count,
        SUM(CAST(PayoutAmount AS FLOAT)) as volume
      FROM TradeIns
      WHERE UserId = ${userId}
        AND CreatedAt >= DATEADD(MONTH, -12, GETDATE())
      GROUP BY CONVERT(VARCHAR(7), CreatedAt, 120)
      ORDER BY month DESC
    `;
  }
}
