/**
 * @file voucher.controller.ts
 * @description 바우처(상품권 PIN) API 컨트롤러 - 재고 관리 엔드포인트
 * @module voucher
 *
 * 엔드포인트:
 * - POST /vouchers/bulk - PIN 대량 등록 (관리자용)
 * - GET /vouchers/stock/:productId - 상품별 재고 확인
 * - GET /vouchers - 전체 바우처 목록 조회
 *
 * 인증: 모든 엔드포인트는 JWT 인증 필요
 * 권한: 대부분의 엔드포인트는 ADMIN 역할 필요
 */
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { BulkCreateVoucherDto } from './dto/voucher.dto';
import { VoucherService } from './voucher.service';
import { PaginationQueryDto } from '../../base/pagination.dto';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../shared/auth/roles.guard';

@ApiTags('Vouchers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vouchers')
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  /**
   * PIN 번호 대량 등록 (관리자용)
   * - 상품권 공급사로부터 받은 PIN 목록을 일괄 등록
   *
   * @param data - 상품 ID와 PIN 번호 배열
   * @returns 등록된 바우처 수
   */
  @Post('bulk')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'PIN 번호 대량 등록 (관리자용)' })
  @ApiResponse({ status: 201, description: '대량 등록 성공' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '상품 없음' })
  async bulkCreate(@Body() data: BulkCreateVoucherDto) {
    return this.voucherService.bulkCreate(data);
  }

  /**
   * 특정 상품의 가용 재고 확인
   * - AVAILABLE 상태인 바우처 수량 반환
   * - 관리자 전용 엔드포인트
   *
   * @param productId - 재고 확인할 상품 ID
   * @returns 상품 ID, 가용 재고 수량, 전체 수량
   */
  @Get('stock/:productId')
  @Roles('ADMIN')
  @ApiOperation({ summary: '특정 상품의 가용 재고 수량 확인 (관리자)' })
  @ApiResponse({ status: 200, description: '재고 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getStockCount(@Param('productId', ParseIntPipe) productId: number) {
    const available = await this.voucherService.count({
      productId,
      status: 'AVAILABLE',
    });
    const total = await this.voucherService.count({
      productId,
    });
    return { productId, available, total };
  }

  /**
   * 전체 바우처 목록 조회 (관리자용)
   * - 상태별 필터링 가능 (AVAILABLE, SOLD, EXPIRED)
   * - 페이지네이션 지원 (page, limit)
   *
   * @param query - 페이지네이션 파라미터
   * @param status - 필터링할 상태 (선택)
   * @returns { items, meta } 통합 페이지네이션 응답
   */
  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: '전체 PIN 내역 조회 (필터 가능, 페이지네이션)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '페이지 번호 (기본값: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '페이지당 항목 수 (기본값: 20, 최대: 100)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['AVAILABLE', 'SOLD', 'USED', 'EXPIRED'],
    description: '바우처 상태 필터',
  })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async findAll(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: string,
  ) {
    return this.voucherService.findAllPaginated({
      page: query.page,
      limit: query.limit,
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });
  }
}
