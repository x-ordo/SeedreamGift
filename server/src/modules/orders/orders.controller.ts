/**
 * @file orders.controller.ts
 * @description 주문 API 컨트롤러 - 주문 생성, 조회, 선물 수령 엔드포인트 제공
 * @module modules/orders
 *
 * @summary 상품권 구매 주문 관리를 위한 REST API 컨트롤러
 *
 * API 엔드포인트:
 * - POST /orders - 새 주문 생성 (결제 대기 상태)
 * - GET /orders/my - 내 주문 내역 조회
 * - GET /orders/my-gifts - 받은 선물 목록 조회
 * - GET /orders/my/stats - 내 주문 통계 조회
 * - GET /orders/:id - 주문 상세 조회 (PIN 복호화 포함)
 *
 * 사용처:
 * - 클라이언트 주문 페이지: 장바구니 → 주문 생성 → 결제 → PIN 발급
 * - 클라이언트 마이페이지: 주문 내역, 주문 상세(PIN 확인), 받은 선물 조회
 *
 * 주문 플로우:
 * 1. POST /orders: 장바구니 상품으로 PENDING 상태 주문 생성
 * 2. PaymentController에서 결제 처리 후 → PAID 상태로 전이 + 바우처 발급
 * 3. GET /orders/:id: PIN 복호화 포함 상세 조회 (본인 주문만)
 *
 * 인증: 모든 엔드포인트는 JWT 인증 필수
 */
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CreateOrderDto } from './dto/create-order.dto';
import { TransactionExportQueryDto } from './dto/transaction-export-query.dto';
import { OrdersService } from './orders.service';
import { PaginationQueryDto } from '../../base/pagination.dto';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { UserThrottleGuard } from '../../shared/guards/user-throttle.guard';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * 새 주문 생성
   * - 장바구니 상품을 주문으로 변환
   * - 결제 처리 및 바우처 자동 할당
   *
   * @param req - 요청 객체 (JWT에서 추출한 user 정보 포함)
   * @param createOrderDto - 주문할 상품 목록 (productId, quantity)
   * @returns 생성된 주문 정보 (바우처 포함)
   */
  @Post()
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: '새 주문 생성 (결제 대기 상태)' })
  async create(@Request() req: any, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.createOrder(req.user.id, createOrderDto);
  }

  /**
   * 내 주문 내역 조회
   * - 로그인한 사용자의 모든 주문 내역 반환
   * - 최신순 정렬
   *
   * @param req - 요청 객체 (JWT에서 추출한 user 정보 포함)
   * @returns 주문 목록 (최신순)
   */
  @Get('my')
  @ApiOperation({ summary: '내 주문 내역 조회' })
  async findMyOrders(
    @Request() req: any,
    @Query() paginationDto: PaginationQueryDto,
  ) {
    return this.ordersService.getMyOrders(req.user.id, paginationDto);
  }

  /**
   * 받은 선물 목록 조회
   * 다른 사용자가 나에게 보낸 선물 주문을 Gift 테이블 조인하여 반환
   */
  @Get('my-gifts')
  @ApiOperation({ summary: '받은 선물 목록 조회' })
  async findMyGifts(
    @Request() req: any,
    @Query() paginationDto: PaginationQueryDto,
  ) {
    return this.ordersService.getReceivedGifts(req.user.id, paginationDto);
  }

  /**
   * 내 주문 통계 조회
   *
   * 마이페이지 대시보드용: 상태별 건수, 총 결제 금액 등
   *
   * @param {any} req - 요청 객체 (JWT에서 추출한 user 정보 포함)
   * @returns {Promise<Object>} 주문 통계 객체
   * @returns {number} returns.totalCount - 전체 주문 건수
   * @returns {Object} returns.statusBreakdown - 상태별 건수 (PENDING, PAID, DELIVERED, CANCELLED)
   * @returns {number} returns.totalSpent - 총 결제 금액 (PAID/DELIVERED 합산)
   */
  @Get('my/stats')
  @ApiOperation({ summary: '내 주문 통계 조회' })
  async findMyStats(@Request() req: any) {
    return this.ordersService.getMyStats(req.user.id);
  }

  /**
   * 내 거래내역 증빙 데이터 조회 (엑셀 내보내기용)
   * 구매(Order) + 매입(TradeIn) 통합 데이터 반환
   *
   * [보안] 유저는 pinOption='full' 불가 → 'masked'로 강제 다운그레이드
   */
  @Get('my/export')
  @ApiOperation({ summary: '내 거래내역 증빙 데이터 조회 (엑셀 내보내기용)' })
  async getMyTransactionExport(
    @Request() req: any,
    @Query() query: TransactionExportQueryDto,
  ) {
    const pinOption =
      query.pinOption === 'full' ? 'masked' : query.pinOption || 'masked';
    return this.ordersService.getMyTransactionExport(req.user.id, {
      pinOption,
      type: query.type || 'ALL',
    });
  }

  /**
   * 은행제출 증빙 데이터 조회 (2-sheet 엑셀용)
   * PIN/securityCode는 항상 마스킹 (유저 보안)
   */
  @Get('my/bank-submission')
  @ApiOperation({ summary: '은행제출 증빙 데이터 조회 (매입 증빙용)' })
  async getMyBankSubmission(
    @Request() req: any,
    @Query() query: TransactionExportQueryDto,
  ) {
    return this.ordersService.getMyBankSubmission(req.user.id, {
      type: query.type || 'ALL',
    });
  }

  /**
   * 내 주문 취소 (PENDING 상태만)
   */
  @Post(':id/cancel')
  @ApiOperation({ summary: '내 주문 취소 (PENDING 상태만)' })
  @ApiParam({ name: 'id', description: '주문 ID', type: Number })
  async cancelMyOrder(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.cancelMyOrder(id, req.user.id);
  }

  /**
   * 주문 상세 조회
   * - 특정 주문의 상세 정보 조회 (PIN 복호화 포함)
   * - 본인 주문만 조회 가능
   *
   * @param req - 요청 객체 (JWT에서 추출한 user 정보 포함)
   * @param id - 주문 ID
   * @returns 주문 상세 정보 (바우처 PIN 복호화 포함)
   */
  // :id 경로는 'my', 'my-gifts', 'my/stats'보다 뒤에 선언해야 경로 충돌 방지
  // ADMIN은 모든 주문 조회 가능, 일반 사용자는 본인 주문만 접근 가능
  @Get(':id')
  @ApiOperation({ summary: '주문 상세 조회 (PIN 복호화 포함)' })
  @ApiParam({ name: 'id', description: '주문 ID', type: Number })
  async findOne(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getOrder(id, req.user.id, req.user.role);
  }
}
