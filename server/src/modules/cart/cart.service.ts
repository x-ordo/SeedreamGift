/**
 * @file cart.service.ts
 * @description 장바구니 서비스 - 장바구니 아이템 관리
 * @module modules/cart
 *
 * @summary 장바구니 관리 비즈니스 로직
 *
 * 주요 기능:
 * - 장바구니 조회 (상품 정보 포함, 총 금액 계산)
 * - 아이템 추가 (기존 아이템 있으면 수량 증가)
 * - 수량 변경
 * - 아이템 삭제
 * - 장바구니 전체 비우기
 *
 * 특징:
 * - 비활성 상품은 장바구니에 추가 불가
 * - 소유권 검증으로 다른 사용자 장바구니 접근 차단
 * - cartItemId 기반 조회 (소유권 검증 포함)
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import {
  AddToCartDto,
  UpdateCartItemDto,
  BatchRemoveCartDto,
} from './dto/cart.dto';
import { paginatedQuery } from '../../base/paginated-query';
import { PaginationQueryDto } from '../../base/pagination.dto';
import { CART_ERRORS } from '../../shared/constants';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { VoucherService } from '../voucher/voucher.service';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly voucherService: VoucherService,
  ) {}

  /**
   * 사용자 장바구니 조회
   *
   * @param userId - 사용자 ID
   * @returns 장바구니 아이템 목록 (상품 정보 포함)
   */
  async getCart(userId: number) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            brandCode: true,
            name: true,
            price: true,
            buyPrice: true,
            discountRate: true,
            imageUrl: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 전체 상품의 가용 재고를 한 번에 조회 (N+1 방지)
    // VoucherService에 위임하여 도메인 경계 유지
    const productIds = items.map((item) => item.productId);
    const stockMap =
      await this.voucherService.getAvailableStockCounts(productIds);

    // 각 아이템에 가용 재고 수량 첨부
    const itemsWithStock = items.map((item) => ({
      ...item,
      availableStock: stockMap.get(item.productId) ?? 0,
    }));

    // 총 금액 계산
    const totalAmount = items.reduce((sum, item) => {
      return sum + Number(item.product.buyPrice) * item.quantity;
    }, 0);

    return {
      items: itemsWithStock,
      totalAmount,
      itemCount: items.length,
    };
  }

  /**
   * 장바구니에 아이템 추가
   *
   * - 이미 장바구니에 있는 상품이면 수량 증가
   * - 비활성 상품은 추가 불가
   *
   * @param userId - 사용자 ID
   * @param dto - 추가할 상품 정보
   * @returns 추가/수정된 장바구니 아이템
   */
  async addToCart(userId: number, dto: AddToCartDto) {
    const { productId, quantity = 1 } = dto;

    // 3개 독립 쿼리 병렬 실행 (상품 검증, 재고 확인, 기존 아이템 확인)
    // 재고 확인은 VoucherService에 위임하여 도메인 경계 유지
    const [product, availableStock, existingItem] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId } }),
      this.voucherService.getAvailableStockCount(productId),
      this.prisma.cartItem.findFirst({ where: { userId, productId } }),
    ]);

    if (!product || !product.isActive) {
      throw new BadRequestException(CART_ERRORS.PRODUCT_NOT_AVAILABLE);
    }

    if (availableStock < quantity) {
      throw new BadRequestException(CART_ERRORS.OUT_OF_STOCK);
    }

    if (existingItem) {
      // 기존 아이템이 있으면 수량 증가
      const newQuantity = existingItem.quantity + quantity;

      return this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
        include: { product: true },
      });
    }

    // 새 아이템 추가
    return this.prisma.cartItem.create({
      data: { userId, productId, quantity },
      include: { product: true },
    });
  }

  /**
   * 장바구니 아이템 수량 변경
   *
   * @param userId - 사용자 ID
   * @param cartItemId - 장바구니 아이템 ID
   * @param dto - 변경할 수량
   * @returns 수정된 장바구니 아이템
   */
  async updateQuantity(
    userId: number,
    cartItemId: number,
    dto: UpdateCartItemDto,
  ) {
    // 아이템 존재 + 소유권 동시 확인
    const item = await this.prisma.cartItem.findFirst({
      where: { id: cartItemId, userId },
    });

    if (!item) {
      throw new NotFoundException(CART_ERRORS.NOT_FOUND);
    }

    return this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: dto.quantity },
      include: { product: true },
    });
  }

  /**
   * 장바구니 아이템 삭제
   *
   * @param userId - 사용자 ID
   * @param cartItemId - 장바구니 아이템 ID
   * @returns 삭제된 아이템
   */
  async removeItem(userId: number, cartItemId: number) {
    // 아이템 존재 + 소유권 동시 확인
    const item = await this.prisma.cartItem.findFirst({
      where: { id: cartItemId, userId },
    });

    if (!item) {
      throw new NotFoundException(CART_ERRORS.NOT_FOUND);
    }

    return this.prisma.cartItem.delete({
      where: { id: item.id },
    });
  }

  /**
   * 장바구니 아이템 배치 삭제
   *
   * @param userId - 사용자 ID
   * @param dto - 삭제할 상품 ID 목록
   * @returns 삭제된 아이템 수
   */
  async removeItems(userId: number, dto: BatchRemoveCartDto) {
    const result = await this.prisma.cartItem.deleteMany({
      where: {
        userId,
        productId: { in: dto.productIds },
      },
    });

    return { deletedCount: result.count };
  }

  /**
   * 장바구니 전체 비우기
   *
   * @param userId - 사용자 ID
   * @returns 삭제된 아이템 수
   */
  async clearCart(userId: number) {
    const result = await this.prisma.cartItem.deleteMany({
      where: { userId },
    });

    return { deletedCount: result.count };
  }

  /**
   * userId로 장바구니 전체 삭제 (관리자/탈퇴용)
   *
   * AdminOrdersService, AdminUsersService 도메인 경계 메서드.
   * clearCart()와 동일하지만, 삭제된 건수만 number로 반환.
   *
   * @param {number} userId - 사용자 ID
   * @returns 삭제된 아이템 수
   */
  async clearCartByUserId(userId: number): Promise<number> {
    const result = await this.prisma.cartItem.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  /**
   * 관리자용 장바구니 페이지네이션 조회
   *
   * AdminOrdersService 도메인 경계 메서드.
   * 모든 사용자의 장바구니를 페이지네이션으로 조회.
   *
   * @param paginationDto - 페이지네이션 파라미터
   * @returns 페이지네이션된 장바구니 목록
   */
  async findAllPaginated(paginationDto: PaginationQueryDto) {
    return paginatedQuery(this.prisma.cartItem, {
      pagination: paginationDto,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        product: true,
      },
    });
  }
}
