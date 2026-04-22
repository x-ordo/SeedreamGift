import {
  Body,
  Controller,
  Delete,
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

import { PaginationQueryDto } from '../../../base/pagination.dto';
import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import type { RequestWithUser } from '../../../shared/auth/request-with-user.interface';
import { RolesGuard, Roles } from '../../../shared/auth/roles.guard';
import {
  AdminCreateBrandDto,
  AdminUpdateBrandDto,
} from '../dto/admin-brand.dto';
import {
  AdminCreateProductDto,
  AdminUpdateProductDto,
} from '../dto/admin-product.dto';
import { AdminVouchersQueryDto } from '../dto/admin-query.dto';
import {
  AdminUpdateVoucherDto,
  AdminBulkCreateVoucherDto,
} from '../dto/admin-voucher.dto';
import { AdminProductsService, AdminVouchersService } from '../services';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminProductsController {
  constructor(
    private readonly productsService: AdminProductsService,
    private readonly vouchersService: AdminVouchersService,
  ) {}

  // ========================================
  // Products Management
  // ========================================

  @Get('products')
  @ApiOperation({ summary: '상품 목록 조회' })
  findAllProducts(@Query() paginationDto: PaginationQueryDto) {
    return this.productsService.findAll(paginationDto);
  }

  @Post('products')
  @ApiOperation({ summary: '상품 생성' })
  createProduct(@Body() dto: AdminCreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: '상품 수정' })
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: '상품 삭제' })
  deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.delete(id);
  }

  // ========================================
  // Brands Management
  // ========================================

  @Get('brands')
  @ApiOperation({ summary: '브랜드 목록 조회' })
  findAllBrands(@Query() paginationDto: PaginationQueryDto) {
    return this.productsService.findAllBrands(paginationDto);
  }

  @Get('brands/:code')
  @ApiOperation({ summary: '브랜드 상세 조회' })
  findOneBrand(@Param('code') code: string) {
    return this.productsService.findOneBrand(code);
  }

  @Post('brands')
  @ApiOperation({ summary: '브랜드 생성' })
  createBrand(@Body() dto: AdminCreateBrandDto) {
    return this.productsService.createBrand(dto);
  }

  @Patch('brands/:code')
  @ApiOperation({ summary: '브랜드 수정' })
  updateBrand(@Param('code') code: string, @Body() dto: AdminUpdateBrandDto) {
    return this.productsService.updateBrand(code, dto);
  }

  @Delete('brands/:code')
  @ApiOperation({ summary: '브랜드 삭제' })
  deleteBrand(@Param('code') code: string) {
    return this.productsService.deleteBrand(code);
  }

  // ========================================
  // Vouchers Management
  // ========================================

  @Get('vouchers')
  @ApiOperation({ summary: '바우처(PIN) 목록 조회' })
  @ApiQuery({ name: 'productId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAllVouchers(@Query() query: AdminVouchersQueryDto) {
    const { page, limit, sort, order, productId, status } = query;
    return this.vouchersService.findAll(
      { page, limit, sort, order },
      productId ? parseInt(productId, 10) : undefined,
      status,
    );
  }

  @Get('vouchers/inventory')
  @ApiOperation({ summary: '상품별 재고 현황 조회' })
  getVoucherInventory() {
    return this.vouchersService.getInventory();
  }

  @Post('vouchers/bulk')
  @ApiOperation({ summary: '바우처 대량 등록' })
  bulkCreateVouchers(@Body() dto: AdminBulkCreateVoucherDto) {
    return this.vouchersService.bulkCreate(dto);
  }

  @Get('vouchers/:id')
  @ApiOperation({ summary: '바우처 상세 조회 (PIN 복호화)' })
  findOneVoucher(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.vouchersService.findOne(id, req.user.id);
  }

  @Patch('vouchers/:id')
  @ApiOperation({ summary: '바우처 상태 변경' })
  updateVoucher(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateVoucherDto,
  ) {
    return this.vouchersService.update(id, dto);
  }

  @Delete('vouchers/:id')
  @ApiOperation({ summary: '바우처 삭제' })
  deleteVoucher(@Param('id', ParseIntPipe) id: number) {
    return this.vouchersService.delete(id);
  }
}
