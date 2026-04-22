/**
 * @file voucher.service.ts
 * @description 바우처(상품권 PIN) 관리 서비스 - 재고 관리 및 주문 할당
 * @module voucher
 *
 * 주요 기능:
 * - PIN 번호 대량 등록 (관리자용)
 * - 주문 시 바우처 자동 할당
 * - 재고 현황 조회
 *
 * 바우처 상태:
 * - AVAILABLE: 판매 가능 (재고)
 * - SOLD: 판매 완료 (주문에 할당됨)
 * - EXPIRED: 만료됨
 */
import { Inject, Injectable, BadRequestException } from '@nestjs/common';

import { CreateVoucherDto, BulkCreateVoucherDto } from './dto/voucher.dto';
import type { IVoucherRepository } from './interfaces/voucher-repository.interface';
import { VOUCHER_REPOSITORY } from './interfaces/voucher-repository.interface';
import { BaseCrudService } from '../../base/base-crud.service';
import { VOUCHER_STATUS } from '../../shared/constants';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { VoucherCode } from '../../shared/prisma/generated/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { IVoucherAssigner } from '../orders/interfaces/voucher-assigner.interface';

@Injectable()
export class VoucherService
  extends BaseCrudService<VoucherCode, CreateVoucherDto, any>
  implements IVoucherAssigner
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    @Inject(VOUCHER_REPOSITORY)
    private readonly voucherRepository: IVoucherRepository,
  ) {
    super(prisma.voucherCode);
  }

  /**
   * PIN 번호 대량 등록 (관리자용)
   *
   * 처리 흐름:
   * 1. 각 PIN에 대해 AES-256-GCM 암호화 수행
   * 2. 중복 등록 방지를 위해 SHA256 해시 생성 (pinHash)
   * 3. DB 일괄 삽입 (createMany)
   *
   * @param data - 대량 등록 DTO
   * @returns 생성된 바우처 수
   */
  async bulkCreate(data: BulkCreateVoucherDto) {
    // 입력 검증: pinCodes 또는 vouchers 중 하나는 필수
    if (!data.pinCodes?.length && !data.vouchers?.length) {
      throw new BadRequestException('PIN 코드를 입력해주세요.');
    }

    // 상품 존재 여부 확인
    const product = await this.prisma.product.findUnique({
      where: { id: data.productId },
    });
    if (!product) {
      throw new BadRequestException(
        `상품 ID ${data.productId}을(를) 찾을 수 없습니다.`,
      );
    }

    // 만료일 계산: Brand.pinConfig.expiryDays 또는 기본 365일
    let expiredAt: Date | undefined;
    if (data.expiryDays) {
      expiredAt = new Date();
      expiredAt.setDate(expiredAt.getDate() + data.expiryDays);
    }

    // 구조화 방식과 기존 방식 통합 처리
    const items = data.vouchers
      ? data.vouchers
      : data.pinCodes!.map((pin) => ({
          pin,
          giftNumber: undefined as string | undefined,
          securityCode: undefined as string | undefined,
        }));

    const createData = items.map((item) => {
      // PIN 정규화: 숫자만 추출하여 해싱 (trade-in.service.ts와 동일 규칙)
      const pinDigits = item.pin.replace(/\D/g, '');
      const pinHash = this.cryptoService.hash(pinDigits);

      return {
        productId: data.productId,
        pinCode: this.cryptoService.encrypt(item.pin),
        pinHash,
        giftNumber: item.giftNumber || null,
        securityCode: item.securityCode
          ? this.cryptoService.encrypt(item.securityCode)
          : null,
        status: VOUCHER_STATUS.AVAILABLE,
        expiredAt,
      };
    });

    try {
      return await this.prisma.voucherCode.createMany({
        data: createData,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          '이미 등록된 PIN 번호가 포함되어 있습니다.',
        );
      }
      throw error;
    }
  }

  /**
   * 주문에 바우처 자동 할당
   *
   * 처리 흐름:
   * 1. 주문 아이템 목록 조회 (상품별 수량)
   * 2. 각 상품별로 AVAILABLE 상태인 바우처 확보 (행 잠금)
   * 3. 확보한 바우처를 SOLD로 변경하고 주문에 연결
   *
   * @param orderId - 바우처를 할당할 주문 ID
   * @param tx - Prisma 트랜잭션 객체 (원자성 보장용) - 필수
   * @returns 할당된 바우처 수
   * @throws BadRequestException - 재고 부족 또는 트랜잭션 없이 호출 시
   *
   * NOTE: 반드시 트랜잭션 내에서 호출해야 함 (동시성 이슈 방지)
   */
  async assignVouchersToOrder(orderId: number, tx?: any): Promise<number> {
    // 트랜잭션 컨텍스트 검증 (동시성 문제 방지)
    if (!tx) {
      throw new BadRequestException(
        'assignVouchersToOrder must be called within a transaction',
      );
    }

    const prisma = tx;
    let totalAssigned = 0;

    // 1. 주문 아이템 조회 (어떤 상품을 몇 개 주문했는지)
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId },
      include: { product: { select: { name: true } } },
    });

    if (orderItems.length === 0) {
      throw new BadRequestException(`주문 ID ${orderId}에 아이템이 없습니다`);
    }

    // 2. 각 아이템별로 바우처 할당 (비관적 잠금 — Repository에 위임)
    for (const item of orderItems) {
      const productName = item.product?.name || `ID ${item.productId}`;

      const { assignedIds } = await this.voucherRepository.assignToOrder(
        item.productId,
        item.quantity,
        orderId,
        prisma,
      );

      // 할당된 수량 검증 (재고 부족 감지)
      if (assignedIds.length < item.quantity) {
        throw new BadRequestException(
          `재고 부족: ${productName} (필요: ${item.quantity}, 재고: ${assignedIds.length})`,
        );
      }

      totalAssigned += assignedIds.length;
    }

    return totalAssigned;
  }

  /**
   * 바우처를 USED 상태로 변경 (PIN 사용 확인 시)
   *
   * @param voucherId - 바우처 ID
   * @returns 업데이트된 바우처
   */
  async markAsUsed(voucherId: number) {
    return this.prisma.voucherCode.update({
      where: { id: voucherId },
      data: {
        status: VOUCHER_STATUS.USED,
        usedAt: new Date(),
      },
    });
  }

  /**
   * 주문에서 바우처 해제 (주문 취소 시 호출)
   * SOLD 상태의 바우처를 다시 AVAILABLE로 복구
   *
   * @param orderId - 바우처를 해제할 주문 ID
   * @param tx - Prisma 트랜잭션 객체
   */
  /**
   * 복수 상품의 가용 재고 수량 일괄 조회
   *
   * CartService 도메인 경계 메서드: 장바구니 재고 확인용.
   * N+1 방지를 위해 groupBy로 한 번에 조회.
   *
   * @param {number[]} productIds - 상품 ID 목록
   * @returns Map<productId, availableCount>
   */
  async getAvailableStockCounts(
    productIds: number[],
  ): Promise<Map<number, number>> {
    if (productIds.length === 0) return new Map();

    const stockCounts = await this.prisma.voucherCode.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        status: VOUCHER_STATUS.AVAILABLE,
      },
      _count: true,
    });

    return new Map(stockCounts.map((s) => [s.productId, s._count]));
  }

  /**
   * 단일 상품의 가용 재고 수량 조회
   *
   * CartService 도메인 경계 메서드: 장바구니 추가 시 재고 확인용.
   *
   * @param {number} productId - 상품 ID
   * @returns 가용 재고 수량
   */
  async getAvailableStockCount(productId: number): Promise<number> {
    return this.prisma.voucherCode.count({
      where: { productId, status: VOUCHER_STATUS.AVAILABLE },
    });
  }

  async releaseVouchersFromOrder(orderId: number, tx?: any): Promise<number> {
    const prisma = tx || this.prisma;

    const result = await prisma.voucherCode.updateMany({
      where: {
        orderId,
        status: VOUCHER_STATUS.SOLD,
      },
      data: {
        status: VOUCHER_STATUS.AVAILABLE,
        orderId: null,
        soldAt: null,
        updatedAt: new Date(),
      },
    });

    return result.count;
  }
}
