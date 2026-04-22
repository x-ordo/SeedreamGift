/**
 * @file product.service.ts
 * @description 상품 관리 서비스 - 상품 CRUD 및 판매가·매입가 자동 계산
 * @module modules/product
 *
 * 사용처:
 * - ProductController: 상품 API 엔드포인트의 비즈니스 로직 처리
 * - OrdersService: 주문 생성 시 상품 정보 조회
 * - AdminController: 관리자 상품 관리 기능
 *
 * 가격 체계 (양방향 거래):
 * - price: 정가 (액면가)
 * - discountRate: 판매 할인율 (%) → buyPrice = price × (1 - discountRate/100)
 *   예: 10만원 상품, 5% 할인 → 고객 구매가 95,000원
 * - tradeInRate: 매입 할인율 (%) → tradeInPrice = price × (1 - tradeInRate/100)
 *   예: 10만원 상품, 8% 할인 → 매입 정산가 92,000원
 *
 * 소프트 삭제:
 * - remove() 시 deletedAt에 타임스탬프를 기록하고 isActive를 false로 변경
 * - 모든 조회 메서드에서 deletedAt이 null인 레코드만 반환
 */
import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { BaseCrudService } from '../../base/base-crud.service';
import { calculateBuyPrice, PRODUCT_ERRORS } from '../../shared/constants';
import { Product } from '../../shared/prisma/generated/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { toNumber } from '../../shared/utils';

@Injectable()
export class ProductService extends BaseCrudService<
  Product,
  CreateProductDto,
  UpdateProductDto
> {
  /** 테스트 상품 이름 접두사 패턴 (공개 쿼리에서 자동 제외) */
  private static readonly TEST_NAME_PATTERNS = [
    'E2E-',
    'Test-',
    '테스트-',
    '필터 테스트',
  ];

  /** 테스트 상품 이름 포함 패턴 (이름 중간에 키워드가 있는 경우) */
  private static readonly TEST_NAME_CONTAINS = [
    '테스트 상품',
    '재고없음 상품',
    '수정된 상품명',
  ];

  /** 테스트 상품 필터 조건 (Prisma NOT 절) */
  private static get testProductFilter() {
    return {
      NOT: {
        OR: [
          ...ProductService.TEST_NAME_PATTERNS.map((prefix) => ({
            name: { startsWith: prefix },
          })),
          ...ProductService.TEST_NAME_CONTAINS.map((keyword) => ({
            name: { contains: keyword },
          })),
        ],
      },
    };
  }

  constructor(private readonly prisma: PrismaService) {
    super(prisma.product);
  }

  /**
   * 상품 목록 조회 (소프트 삭제 제외)
   *
   * 소프트 삭제된 상품을 자동으로 제외하기 위해 BaseCrudService의 findAll을 오버라이드
   * 모든 조회에 deletedAt: null 조건을 강제 주입
   *
   * @param {Object} [params] - 조회 파라미터
   * @param {Object} [params.where] - Prisma where 조건
   * @param {Object} [params.orderBy] - 정렬 조건 (기본값: id desc)
   * @param {Object} [params.include] - 관계 포함 조건
   * @returns {Promise<Product[]>} 활성 상품 목록
   *
   */
  override async findAll(params?: any) {
    // 관리자 조회가 아닌 경우 활성 상품만 반환
    const includeInactive = params?.includeInactive === true;
    const where = {
      ...(params?.where || {}),
      deletedAt: null,
      ...(includeInactive ? {} : { isActive: true }),
      // 비관리자 요청 시 테스트 상품 제외
      ...(includeInactive ? {} : ProductService.testProductFilter),
    };
    const orderBy = params?.orderBy || { id: 'desc' };

    return this.prisma.product.findMany({
      where,
      orderBy,
      include: params?.include,
    });
  }

  /**
   * 상품 목록 페이지네이션 조회 (소프트 삭제 제외)
   *
   * @param {Object} [params] - 페이지네이션 파라미터
   * @param {number} [params.page] - 페이지 번호 (1부터 시작)
   * @param {number} [params.limit] - 페이지당 항목 수
   * @param {Object} [params.where] - 필터 조건
   * @param {Object} [params.orderBy] - 정렬 조건
   * @returns {Promise<{items: Product[], meta: PaginationMeta}>} 페이지네이션된 상품 목록
   */
  override async findAllPaginated(params?: any) {
    // 관리자 조회가 아닌 경우 활성 상품만 반환 (isActive: true)
    // 관리자는 params.includeInactive=true로 비활성 상품도 조회 가능
    const includeInactive = params?.includeInactive === true;
    const where = {
      ...(params?.where || {}),
      deletedAt: null,
      ...(includeInactive ? {} : { isActive: true }),
      // 비관리자 요청 시 테스트 상품 제외
      ...(includeInactive ? {} : ProductService.testProductFilter),
    };
    const orderBy = params?.orderBy || { id: 'desc' };
    return super.findAllPaginated({ ...params, where, orderBy });
  }

  /**
   * 상품 상세 조회 (소프트 삭제 제외)
   *
   * @param {number} id - 상품 ID
   * @returns {Promise<Product>} 상품 정보
   * @throws {NotFoundException} 상품이 존재하지 않거나 삭제된 경우
   */
  override async findOne(id: number): Promise<Product> {
    const item = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!item) {
      throw new NotFoundException('상품을 찾을 수 없거나 삭제되었습니다.');
    }
    return item;
  }

  /**
   * 활성 상품 목록 조회 (사용자용)
   *
   * isActive가 true이고 삭제되지 않은 상품만 반환
   * 브랜드 코드순으로 정렬됨
   *
   * @returns {Promise<Product[]>} 활성 상품 목록
   */
  async getActiveProducts() {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...ProductService.testProductFilter,
      },
      orderBy: { brandCode: 'asc' },
    });
  }

  /**
   * 상품 생성 (판매가 자동 계산)
   *
   * buyPrice는 price와 discountRate로 자동 계산됨
   * 계산식: buyPrice = price × (1 - discountRate/100)
   *
   * @param {CreateProductDto} data - 상품 생성 데이터
   * @param {string} data.brandCode - 브랜드 코드 (SHINSEGAE, HYUNDAI 등)
   * @param {string} data.name - 상품명
   * @param {number} data.price - 정가/액면가
   * @param {number} data.discountRate - 판매 할인율 (%)
   * @param {number} data.tradeInRate - 매입 할인율 (%)
   * @returns {Promise<Product>} 생성된 상품 정보
   */
  async create(data: CreateProductDto): Promise<Product> {
    const buyPrice = calculateBuyPrice(data.price, data.discountRate);

    return this.prisma.product.create({
      data: {
        ...data,
        buyPrice,
      },
    });
  }

  /**
   * 상품 정보 수정
   *
   * 삭제된 상품은 수정 불가
   * 가격 또는 할인율 중 하나라도 변경되면 buyPrice를 재계산
   *
   * @param {number} id - 수정할 상품 ID
   * @param {UpdateProductDto} data - 수정할 필드 (부분 업데이트)
   * @returns {Promise<Product>} 수정된 상품 정보
   * @throws {NotFoundException} 상품이 존재하지 않거나 삭제된 경우
   */
  async update(id: number, data: UpdateProductDto): Promise<Product> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(PRODUCT_ERRORS.NOT_FOUND);
    }

    // 가격 또는 할인율 중 하나라도 변경되면 buyPrice를 재계산해야 함
    // 변경되지 않은 필드는 기존 DB 값을 사용하여 계산
    let buyPrice = existing.buyPrice;
    if (data.price !== undefined || data.discountRate !== undefined) {
      const price = data.price ?? toNumber(existing.price);
      const discountRate = data.discountRate ?? toNumber(existing.discountRate);
      buyPrice = calculateBuyPrice(price, discountRate);
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...data,
        buyPrice,
      },
    });
  }

  /**
   * 상품 소프트 삭제 (Soft Delete)
   *
   * 주문 내역과의 관계 유지를 위해 실제 DB 행을 삭제하지 않음
   * deletedAt에 현재 시각을 기록하고 isActive를 false로 변경
   *
   * @param {number} id - 삭제할 상품 ID
   * @returns {Promise<Product>} 삭제 처리된 상품 정보
   */
  async remove(id: number): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  /**
   * 상품별 시세 정보 조회 (대시보드 카드용)
   *
   * 개별 상품의 액면가, 고객판매가, 고객구매가 반환
   * 활성 상품만 대상, 브랜드별 → 가격 내림차순 정렬
   *
   * @returns {Promise<Object>} 시세 정보 객체
   * @returns {Array} returns.rates - 상품별 시세 배열
   * @returns {Date} returns.lastUpdatedAt - 마지막 상품 갱신 시각
   */
  async getProductLiveRates(): Promise<{
    rates: {
      id: number;
      name: string;
      brandCode: string;
      price: number;
      buyPrice: number;
      discountRate: number;
      tradeInPrice: number;
      tradeInRate: number;
    }[];
    lastUpdatedAt: Date;
  }> {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...ProductService.testProductFilter,
      },
      orderBy: [{ brandCode: 'asc' }, { price: 'desc' }],
      select: {
        id: true,
        name: true,
        brandCode: true,
        price: true,
        buyPrice: true,
        discountRate: true,
        tradeInRate: true,
        updatedAt: true,
      },
    });

    // Derive lastUpdatedAt from fetched products (eliminates extra query)
    const lastUpdatedAt =
      products.reduce(
        (max, p) => (p.updatedAt > max ? p.updatedAt : max),
        new Date(0),
      ) || new Date();

    // MSSQL Decimal 타입은 문자열로 반환되므로 toNumber()로 변환 필요
    // tradeInPrice는 DB에 저장하지 않고 실시간으로 계산 (시세가 자주 바뀌므로)
    const rates = products.map((p) => {
      const price = toNumber(p.price);
      const buyPrice = toNumber(p.buyPrice);
      const discountRate = toNumber(p.discountRate);
      const tradeInRate = toNumber(p.tradeInRate);
      const tradeInPrice = Math.floor(price * (1 - tradeInRate / 100));
      return {
        id: p.id,
        name: p.name,
        brandCode: p.brandCode,
        price,
        buyPrice,
        discountRate,
        tradeInPrice,
        tradeInRate,
      };
    });

    return { rates, lastUpdatedAt };
  }

  /**
   * 브랜드별 시세 정보 조회 (실시간 티커용)
   *
   * 각 브랜드의 대표 상품 할인율/매입율 반환
   * 활성 상품만 대상, 동일 브랜드 내 첫 상품의 시세를 대표값으로 사용
   *
   * @returns {Promise<Array>} 브랜드별 시세 배열
   * @returns {string} returns[].brandCode - 브랜드 코드
   * @returns {string} returns[].brandName - 브랜드 한글명
   * @returns {number} returns[].discountRate - 판매 할인율 (%)
   * @returns {number} returns[].tradeInRate - 매입 할인율 (%)
   */
  async getActiveRates(): Promise<
    {
      brandName: string;
      brandCode: string;
      discountRate: number;
      tradeInRate: number;
    }[]
  > {
    // 브랜드별로 그룹핑하여 대표 시세 조회
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...ProductService.testProductFilter,
      },
      orderBy: { brandCode: 'asc' },
      select: {
        brandCode: true,
        discountRate: true,
        tradeInRate: true,
      },
    });

    // 동일 브랜드 내 상품이 여러 개여도 할인율은 동일하므로 첫 번째 상품의 시세를 대표값으로 사용
    const brandMap = new Map<
      string,
      { discountRate: number; tradeInRate: number }
    >();

    for (const product of products) {
      if (!brandMap.has(product.brandCode)) {
        brandMap.set(product.brandCode, {
          discountRate: toNumber(product.discountRate),
          tradeInRate: toNumber(product.tradeInRate),
        });
      }
    }

    // 브랜드 코드 -> 이름 매핑 (DB Brand 테이블에서 동적 조회)
    const brands = await this.prisma.brand.findMany({
      where: { code: { in: Array.from(brandMap.keys()) } },
      select: { code: true, name: true },
    });
    const brandNames = new Map(brands.map((b) => [b.code, b.name]));

    return Array.from(brandMap.entries()).map(([brand, rates]) => ({
      brandCode: brand,
      brandName: brandNames.get(brand) || brand,
      discountRate: rates.discountRate,
      tradeInRate: rates.tradeInRate,
    }));
  }
}
