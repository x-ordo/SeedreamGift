/**
 * @file product.controller.ts
 * @description 상품 API 컨트롤러 - 상품 조회(공개) 및 관리(ADMIN) 엔드포인트 제공
 * @module modules/product
 *
 * @summary 상품권 상품 관리를 위한 REST API 컨트롤러
 *
 * API 엔드포인트:
 * - GET /products - 상품 목록 조회 (공개)
 * - GET /products/rates - 브랜드별 시세 조회 (공개)
 * - GET /products/live-rates - 상품별 시세 조회 (공개)
 * - GET /products/:id - 상품 상세 조회 (공개)
 * - POST /products - 상품 생성 (ADMIN)
 * - PATCH /products/:id - 상품 수정 (ADMIN)
 * - DELETE /products/:id - 상품 삭제 (ADMIN)
 *
 * 사용처:
 * - 클라이언트 홈: 상품 목록, 브랜드별 시세 티커, 대시보드 라이브 시세
 * - 관리자 페이지: 상품 CRUD 관리
 *
 * 접근 제어:
 * - GET 엔드포인트: 인증 없이 공개 접근 (BaseCrudController 기본 동작)
 * - POST/PATCH/DELETE: JwtAuthGuard + RolesGuard('ADMIN')으로 관리자만 허용
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductService } from './product.service';
import { BaseCrudController } from '../../base/base-crud.controller';
import { BaseEntity } from '../../base/base.entity';
import {
  PaginationQueryDto,
  createPaginatedResponse,
} from '../../base/pagination.dto';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../shared/auth/roles.guard';
import { UserThrottleGuard } from '../../shared/guards/user-throttle.guard';
import { Product } from '../../shared/prisma/generated/client';

// Prisma 모델과 BaseEntity를 연결하는 타입 어댑터
// BaseCrudController의 제네릭 제약을 충족시키기 위해 필요
class ProductEntity extends BaseEntity implements Product {
  brandCode: string;
  name: string;
  description: string | null;
  price: any; // Decimal
  discountRate: any; // Decimal
  buyPrice: any; // Decimal
  tradeInRate: any; // Decimal

  allowTradeIn: boolean;
  imageUrl: string | null;
  isActive: boolean;
  type: string;
  shippingMethod: string;
  deletedAt: Date | null;
}

@ApiTags('Products')
@Controller('products')
export class ProductController extends BaseCrudController<
  ProductEntity,
  CreateProductDto,
  UpdateProductDto
> {
  constructor(private readonly productService: ProductService) {
    super(productService as any);
  }

  /**
   * 상품 목록 조회 (공개, 비페이지네이션)
   *
   * 공개 API: 활성 상품 전체를 배열로 반환 (페이지네이션 없음)
   * 관리자 페이지네이션 조회는 /admin/products 사용
   */
  @Get()
  @ApiOperation({ summary: '활성 상품 목록 조회 (공개)' })
  override async findAll(@Query() query?: PaginationQueryDto): Promise<any> {
    const products = await this.productService.getActiveProducts();

    // 메모리 내 페이지네이션 처리
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = products.slice(startIndex, endIndex);

    return createPaginatedResponse(
      paginatedItems,
      products.length,
      page,
      limit,
    );
  }

  /**
   * 브랜드별 시세 조회 (공개)
   *
   * 실시간 시세 티커용 - 각 브랜드의 대표 할인율/매입율 반환
   *
   * @returns {Promise<Array>} 브랜드별 시세 배열
   * @returns {string} returns[].brandCode - 브랜드 코드 (SHINSEGAE, HYUNDAI 등)
   * @returns {string} returns[].brandName - 브랜드 한글명 (신세계, 현대 등)
   * @returns {number} returns[].discountRate - 판매 할인율 (%)
   * @returns {number} returns[].tradeInRate - 매입 할인율 (%)
   */
  @Get('rates')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: '브랜드별 시세 조회 (공개)' })
  async getRates() {
    return this.productService.getActiveRates();
  }

  /**
   * 상품별 시세 조회 (공개)
   *
   * 대시보드 카드 - 상품명/액면가/고객판매가/고객구매가 표시용
   *
   * @returns {Promise<Object>} 시세 정보 객체
   * @returns {Array} returns.rates - 상품별 시세 배열
   * @returns {number} returns.rates[].id - 상품 ID
   * @returns {string} returns.rates[].name - 상품명
   * @returns {string} returns.rates[].brandCode - 브랜드 코드
   * @returns {number} returns.rates[].price - 정가 (액면가)
   * @returns {number} returns.rates[].buyPrice - 고객 구매가
   * @returns {number} returns.rates[].discountRate - 판매 할인율
   * @returns {number} returns.rates[].tradeInPrice - 매입 정산가
   * @returns {number} returns.rates[].tradeInRate - 매입 할인율
   * @returns {Date} returns.lastUpdatedAt - 마지막 갱신 시각
   */
  @Get('live-rates')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: '상품별 시세 조회 (대시보드용)' })
  async getLiveRates() {
    return this.productService.getProductLiveRates();
  }

  /**
     * 상품 생성 (관리자 전용)
  
   *
   * buyPrice(판매가)는 서비스 레이어에서 price와 discountRate로 자동 계산됨
   * 계산식: buyPrice = price × (1 - discountRate/100)
   *
   * @param {CreateProductDto} createDto - 상품 생성 데이터
   * @param {string} createDto.brandCode - 브랜드 코드 (필수)
   * @param {string} createDto.name - 상품명 (필수)
   * @param {number} createDto.price - 정가/액면가 (필수)
   * @param {number} createDto.discountRate - 판매 할인율 (필수)
   * @param {number} createDto.tradeInRate - 매입 할인율 (필수)
   * @returns {Promise<Product>} 생성된 상품 정보
   * @throws {BadRequestException} 유효성 검사 실패 시
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '상품 생성 (관리자)' })
  override async create(@Body() createDto: CreateProductDto) {
    return this.productService.create(createDto);
  }

  /**
   * 상품 수정 (관리자 전용)
   *
   * 가격이나 할인율이 변경되면 buyPrice도 함께 재계산됨
   *
   * @param {number} id - 수정할 상품 ID
   * @param {UpdateProductDto} updateDto - 수정할 필드 (부분 업데이트 가능)
   * @returns {Promise<Product>} 수정된 상품 정보
   * @throws {NotFoundException} 상품이 존재하지 않거나 삭제된 경우
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '상품 수정 (관리자)' })
  override async update(
    @Param('id') id: number,
    @Body() updateDto: UpdateProductDto,
  ) {
    return this.productService.update(id, updateDto);
  }

  /**
   * 상품 삭제 (관리자 전용)
   *
   * 실제 DB 삭제가 아닌 소프트 삭제 (deletedAt 기록) - 주문 이력 보존을 위해
   * 삭제된 상품은 isActive가 false로 변경되며, 목록 조회에서 제외됨
   *
   * @param {number} id - 삭제할 상품 ID
   * @returns {Promise<Product>} 삭제 처리된 상품 정보 (deletedAt 필드에 타임스탬프 기록됨)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '상품 삭제 (관리자)' })
  override async remove(@Param('id') id: number) {
    return this.productService.remove(id);
  }
}
