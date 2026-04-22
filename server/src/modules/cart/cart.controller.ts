/**
 * @file cart.controller.ts
 * @description 장바구니 API 컨트롤러 - 장바구니 관리 엔드포인트
 * @module modules/cart
 *
 * @summary 장바구니 관리를 위한 REST API 컨트롤러
 *
 * API 엔드포인트:
 * - GET /cart - 장바구니 조회 (아이템 목록, 총 금액, 아이템 수)
 * - POST /cart - 아이템 추가 (기존 상품이면 수량 증가)
 * - PATCH /cart/:id - 수량 변경
 * - DELETE /cart/:id - 아이템 삭제
 * - DELETE /cart - 장바구니 전체 비우기
 *
 * 사용처:
 * - 클라이언트 장바구니 페이지: 상품 담기, 수량 조절, 삭제
 * - 주문 페이지: 장바구니 상품으로 주문 생성
 *
 * 접근 권한: JWT 인증 필수 (본인 장바구니만 접근 가능)
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CartService } from './cart.service';
import {
  AddToCartDto,
  UpdateCartItemDto,
  BatchRemoveCartDto,
} from './dto/cart.dto';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { UserThrottleGuard } from '../../shared/guards/user-throttle.guard';

@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserThrottleGuard)
@Throttle({ default: { limit: 20, ttl: 60000 } })
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * 장바구니 조회
   *
   * 현재 로그인한 사용자의 장바구니 아이템 목록 조회
   *
   * @param {any} req - 요청 객체 (JWT에서 userId 추출)
   * @returns {Promise<Object>} 장바구니 정보
   * @returns {Array} returns.items - 장바구니 아이템 목록 (상품 정보 포함)
   * @returns {number} returns.totalAmount - 총 금액
   * @returns {number} returns.itemCount - 아이템 수
   */
  @Get()
  @ApiOperation({ summary: '장바구니 조회' })
  @ApiResponse({ status: 200, description: '장바구니 아이템 목록 및 총 금액' })
  async getCart(@Request() req: any) {
    return this.cartService.getCart(req.user.id);
  }

  /**
   * 장바구니에 아이템 추가
   *
   * 장바구니에 상품 추가 (기존 상품이면 수량 증가)
   *
   * @param {any} req - 요청 객체 (JWT에서 userId 추출)
   * @param {AddToCartDto} dto - 추가할 상품 정보
   * @param {number} dto.productId - 상품 ID
   * @param {number} [dto.quantity=1] - 수량
   * @returns {Promise<CartItem>} 추가/수정된 장바구니 아이템
   * @throws {BadRequestException} 비활성 상품
   */
  @Post()
  @ApiOperation({ summary: '장바구니에 아이템 추가' })
  @ApiResponse({ status: 201, description: '아이템 추가 성공' })
  @ApiResponse({ status: 400, description: '상품 없음 또는 재고 부족' })
  async addToCart(@Request() req: any, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(req.user.id, dto);
  }

  /**
   * 장바구니 아이템 수량 변경
   *
   * @param {any} req - 요청 객체 (JWT에서 userId 추출)
   * @param {number} id - 장바구니 아이템 ID (또는 상품 ID)
   * @param {UpdateCartItemDto} dto - 변경할 수량
   * @param {number} dto.quantity - 새 수량
   * @returns {Promise<CartItem>} 수정된 장바구니 아이템
   * @throws {NotFoundException} 아이템 없음
   * @throws {ForbiddenException} 다른 사용자의 장바구니 접근
   */
  @Patch(':id')
  @ApiOperation({ summary: '장바구니 아이템 수량 변경' })
  @ApiResponse({ status: 200, description: '수량 변경 성공' })
  @ApiResponse({ status: 404, description: '아이템 없음' })
  @ApiResponse({ status: 400, description: '재고 부족' })
  async updateQuantity(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateQuantity(req.user.id, id, dto);
  }

  /**
   * 장바구니 아이템 배치 삭제
   *
   * 여러 상품을 한 번에 장바구니에서 삭제
   *
   * @param {any} req - 요청 객체 (JWT에서 userId 추출)
   * @param {BatchRemoveCartDto} dto - 삭제할 상품 ID 목록
   * @returns {Promise<Object>} 삭제 결과
   */
  @Delete('batch')
  @ApiOperation({ summary: '장바구니 아이템 배치 삭제' })
  @ApiResponse({ status: 200, description: '배치 삭제 성공' })
  async removeItems(@Request() req: any, @Body() dto: BatchRemoveCartDto) {
    return this.cartService.removeItems(req.user.id, dto);
  }

  /**
   * 장바구니 아이템 삭제
   *
   * 특정 장바구니 아이템 삭제
   *
   * @param {any} req - 요청 객체 (JWT에서 userId 추출)
   * @param {number} id - 장바구니 아이템 ID (또는 상품 ID)
   * @returns {Promise<CartItem>} 삭제된 아이템
   * @throws {NotFoundException} 아이템 없음
   * @throws {ForbiddenException} 다른 사용자의 장바구니 접근
   */
  @Delete(':id')
  @ApiOperation({ summary: '장바구니 아이템 삭제' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 404, description: '아이템 없음' })
  async removeItem(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.cartService.removeItem(req.user.id, id);
  }

  /**
   * 장바구니 전체 비우기
   *
   * 현재 사용자의 장바구니 전체 삭제
   *
   * @param {any} req - 요청 객체 (JWT에서 userId 추출)
   * @returns {Promise<Object>} 삭제 결과
   * @returns {number} returns.deletedCount - 삭제된 아이템 수
   */
  @Delete()
  @ApiOperation({ summary: '장바구니 전체 비우기' })
  @ApiResponse({ status: 200, description: '전체 삭제 성공' })
  async clearCart(@Request() req: any) {
    return this.cartService.clearCart(req.user.id);
  }
}
