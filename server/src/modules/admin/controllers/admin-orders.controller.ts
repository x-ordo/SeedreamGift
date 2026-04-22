import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import type { RequestWithUser } from '../../../shared/auth/request-with-user.interface';
import { RolesGuard, Roles } from '../../../shared/auth/roles.guard';
import type { TradeInStatus } from '../../../shared/constants/statuses';
import { TransactionExportQueryDto } from '../../orders/dto/transaction-export-query.dto';
import { CreateRefundDto, ProcessRefundDto } from '../../refund/dto/refund.dto';
import { RefundService } from '../../refund/refund.service';
import {
  UpdateTradeInStatusDto,
  UpdateOrderStatusDto,
} from '../dto/admin-actions.dto';
import {
  AdminStatusFilterQueryDto,
  AdminOrdersQueryDto,
  AdminTradeInsQueryDto,
} from '../dto/admin-query.dto';
import { BankReportQueryDto } from '../dto/bank-report-query.dto';
import { TradeInPayoutQueryDto } from '../dto/trade-in-payout-query.dto';
import { AdminOrdersService, AdminTradeInService } from '../services';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminOrdersController {
  constructor(
    private readonly ordersService: AdminOrdersService,
    private readonly tradeInService: AdminTradeInService,
    private readonly refundService: RefundService,
  ) {}

  // ========================================
  // Orders Management
  // ========================================

  @Get('orders')
  @ApiOperation({ summary: '주문 목록 조회' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAllOrders(@Query() query: AdminOrdersQueryDto) {
    const { page, limit, sort, order, status, search } = query;
    return this.ordersService.findAll(
      { page, limit, sort, order },
      status,
      search,
    );
  }

  @Get('reports/bank-transactions')
  @ApiOperation({ summary: '은행제출 거래내역 보고서 조회' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    type: String,
    description: '시작일 (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    type: String,
    description: '종료일 (ISO 8601)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['SALE', 'PURCHASE', 'ALL'],
    description: '거래유형',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: '상태 필터 (쉼표 구분)',
  })
  getBankTransactionReport(@Query() query: BankReportQueryDto) {
    return this.ordersService.getBankTransactionReport(query);
  }

  @Get('reports/user-transactions/:userId')
  @ApiOperation({ summary: '특정 사용자 거래내역 증빙 조회' })
  getUserTransactionExport(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: TransactionExportQueryDto,
  ) {
    return this.ordersService.getUserTransactionExport(userId, {
      pinOption: query.pinOption || 'masked',
      type: query.type || 'ALL',
    });
  }

  @Get('reports/trade-in-payouts')
  @ApiOperation({ summary: '매입 증빙 리포트 조회 (은행제출용)' })
  getTradeInPayoutReport(@Query() query: TradeInPayoutQueryDto) {
    return this.tradeInService.getPayoutReport(query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: '주문 상세 조회' })
  findOneOrder(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: '주문 상태 변경' })
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto.status);
  }

  // ========================================
  // TradeIns Management
  // ========================================

  @Get('trade-ins')
  @ApiOperation({ summary: '매입 신청 목록 조회' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'brandCode', required: false, type: String })
  findAllTradeIns(@Query() query: AdminTradeInsQueryDto) {
    const { page, limit, sort, order, status, search, brandCode } = query;
    return this.tradeInService.findAll(
      { page, limit, sort, order },
      status as TradeInStatus | undefined,
      search,
      brandCode,
    );
  }

  @Get('trade-ins/:id')
  @ApiOperation({ summary: '매입 신청 상세 조회 (복호화)' })
  findOneTradeIn(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.tradeInService.findOne(id, req.user.id);
  }

  @Patch('trade-ins/:id/status')
  @ApiOperation({ summary: '매입 신청 상태 변경' })
  updateTradeInStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTradeInStatusDto,
  ) {
    return this.tradeInService.updateStatus(id, dto.status, dto.reason);
  }

  // ========================================
  // Refunds Management
  // ========================================

  @Get('refunds')
  @ApiOperation({ summary: '환불 목록 조회' })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAllRefunds(@Query() query: AdminStatusFilterQueryDto) {
    const { page, limit, sort, order, status } = query;
    return this.refundService.findAll({ page, limit, sort, order }, status);
  }

  @Get('refunds/:id')
  @ApiOperation({ summary: '환불 상세 조회' })
  findOneRefund(@Param('id', ParseIntPipe) id: number) {
    return this.refundService.findOne(id);
  }

  @Post('refunds')
  @ApiOperation({ summary: '환불 요청 생성' })
  createRefund(@Body() dto: CreateRefundDto, @Request() req: RequestWithUser) {
    return this.refundService.createRefund(
      dto.orderId,
      dto.reason,
      req.user.id,
    );
  }

  @Post('refunds/:id/approve')
  @ApiOperation({ summary: '환불 승인' })
  approveRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessRefundDto,
    @Request() req: RequestWithUser,
  ) {
    return this.refundService.approveRefund(id, req.user.id, dto.adminNote);
  }

  @Post('refunds/:id/reject')
  @ApiOperation({ summary: '환불 거부' })
  rejectRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessRefundDto,
    @Request() req: RequestWithUser,
  ) {
    return this.refundService.rejectRefund(id, req.user.id, dto.adminNote);
  }
}
