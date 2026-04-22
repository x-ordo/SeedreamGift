import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { PaginationQueryDto } from '../../../base/pagination.dto';
import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../../shared/auth/roles.guard';
import {
  AdminGiftsQueryDto,
  AdminAuditLogsQueryDto,
} from '../dto/admin-query.dto';
import { AdminUpdateSiteConfigDto } from '../dto/admin-site-config.dto';
import {
  AdminDashboardService,
  AdminOrdersService,
  AdminGiftsService,
  AdminConfigService,
} from '../services';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminSystemController {
  constructor(
    private readonly dashboardService: AdminDashboardService,
    private readonly ordersService: AdminOrdersService,
    private readonly giftsService: AdminGiftsService,
    private readonly configService: AdminConfigService,
  ) {}

  // ========================================
  // Dashboard
  // ========================================

  @Get('stats')
  @ApiOperation({ summary: '관리자 대시보드 통계 조회' })
  getStats() {
    return this.dashboardService.getStats();
  }

  // ========================================
  // CartItems Management
  // ========================================

  @Get('carts')
  @ApiOperation({ summary: '전체 장바구니 목록 조회' })
  findAllCarts(@Query() paginationDto: PaginationQueryDto) {
    return this.ordersService.findAllCarts(paginationDto);
  }

  @Get('carts/user/:userId')
  @ApiOperation({ summary: '사용자별 장바구니 조회' })
  findUserCarts(@Param('userId', ParseIntPipe) userId: number) {
    return this.ordersService.findUserCarts(userId);
  }

  @Delete('carts/:id')
  @ApiOperation({ summary: '장바구니 아이템 삭제' })
  deleteCartItem(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.deleteCartItem(id);
  }

  @Delete('carts/user/:userId/all')
  @ApiOperation({ summary: '사용자 장바구니 전체 비우기' })
  clearUserCart(@Param('userId', ParseIntPipe) userId: number) {
    return this.ordersService.clearUserCart(userId);
  }

  // ========================================
  // Gifts Management
  // ========================================

  @Get('gifts')
  @ApiOperation({ summary: '선물 목록 조회' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAllGifts(@Query() query: AdminGiftsQueryDto) {
    const { page, limit, sort, order, status, search } = query;
    return this.giftsService.findAll(
      { page, limit, sort, order },
      status,
      search,
    );
  }

  @Get('gifts/stats')
  @ApiOperation({ summary: '선물 통계 조회' })
  getGiftStats() {
    return this.giftsService.getStats();
  }

  @Get('gifts/:id')
  @ApiOperation({ summary: '선물 상세 조회' })
  findOneGift(@Param('id', ParseIntPipe) id: number) {
    return this.giftsService.findOne(id);
  }

  // ========================================
  // AuditLogs (Read-only)
  // ========================================

  @Get('audit-logs')
  @ApiOperation({ summary: '감사 로그 목록 조회' })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'resource', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  findAllAuditLogs(@Query() query: AdminAuditLogsQueryDto) {
    const { page, limit, sort, order, action, resource, userId } = query;
    return this.dashboardService.findAllAuditLogs(
      { page, limit, sort, order },
      {
        action,
        resource,
        userId: userId ? parseInt(userId, 10) : undefined,
      },
    );
  }

  @Get('audit-logs/:id')
  @ApiOperation({ summary: '감사 로그 상세 조회' })
  findOneAuditLog(@Param('id', ParseIntPipe) id: number) {
    return this.dashboardService.findOneAuditLog(id);
  }

  // ========================================
  // SiteConfigs Management
  // ========================================

  @Get('site-configs')
  @ApiOperation({ summary: '시스템 설정 목록 조회' })
  findAllSiteConfigs() {
    return this.configService.findAll();
  }

  @Patch('site-configs/:id')
  @ApiOperation({ summary: '시스템 설정 변경' })
  updateSiteConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateSiteConfigDto,
  ) {
    return this.configService.update(id, dto.value);
  }
}
