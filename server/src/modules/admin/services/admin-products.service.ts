import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { paginatedQuery } from '../../../base/paginated-query';
import { PaginationQueryDto } from '../../../base/pagination.dto';
import { calculateBuyPrice } from '../../../shared/constants/pricing';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  AdminCreateBrandDto,
  AdminUpdateBrandDto,
} from '../dto/admin-brand.dto';
import {
  AdminCreateProductDto,
  AdminUpdateProductDto,
} from '../dto/admin-product.dto';

@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ========================================
  // Products CRUD
  // ========================================

  async findAll(paginationDto: PaginationQueryDto) {
    return paginatedQuery(this.prisma.product, {
      pagination: paginationDto,
      orderBy: { createdAt: 'desc' },
      include: { brandRel: true },
    });
  }

  async create(dto: AdminCreateProductDto) {
    const { price, discountRate, brandCode, ...rest } = dto;
    const buyPrice = calculateBuyPrice(price, discountRate || 0);
    return this.prisma.product.create({
      data: {
        ...rest,
        price,
        discountRate,
        buyPrice,
        brandCode,
      },
    });
  }

  async update(id: number, dto: AdminUpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    const newPrice = dto.price ?? product.price;
    const newDiscountRate = dto.discountRate ?? Number(product.discountRate);
    const buyPrice = calculateBuyPrice(newPrice, newDiscountRate);

    const { brandCode, ...rest } = dto;
    const data: any = { ...rest, buyPrice };
    if (brandCode) {
      data.brandCode = brandCode;
    }

    return this.prisma.product.update({ where: { id }, data });
  }

  async delete(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ========================================
  // Brands CRUD
  // ========================================

  async findAllBrands(paginationDto: PaginationQueryDto) {
    return paginatedQuery(this.prisma.brand, {
      pagination: { ...paginationDto, limit: paginationDto.limit ?? 50 },
      orderBy: { order: 'asc' },
    });
  }

  async findOneBrand(code: string) {
    const brand = await this.prisma.brand.findUnique({ where: { code } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async createBrand(dto: AdminCreateBrandDto) {
    const existing = await this.prisma.brand.findUnique({
      where: { code: dto.code },
    });
    if (existing) throw new ConflictException('Brand code already exists');

    // pinConfig 객체를 JSON 문자열로 변환
    const { pinConfig, ...rest } = dto;
    const data: any = { ...rest };
    if (pinConfig) {
      data.pinConfig = JSON.stringify(pinConfig);
    }

    return this.prisma.brand.create({ data });
  }

  async updateBrand(code: string, dto: AdminUpdateBrandDto) {
    const brand = await this.prisma.brand.findUnique({ where: { code } });
    if (!brand) throw new NotFoundException('Brand not found');

    // pinConfig 객체를 JSON 문자열로 변환
    const { pinConfig, ...rest } = dto;
    const data: any = { ...rest };
    if (pinConfig) {
      data.pinConfig = JSON.stringify(pinConfig);
    }

    return this.prisma.brand.update({ where: { code }, data });
  }

  async deleteBrand(code: string) {
    const brand = await this.prisma.brand.findUnique({ where: { code } });
    if (!brand) throw new NotFoundException('Brand not found');

    return this.prisma.brand.delete({ where: { code } });
  }
}
