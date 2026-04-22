import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { paginatedQuery } from '../../../base/paginated-query';
import { PaginationQueryDto } from '../../../base/pagination.dto';
import { CryptoService } from '../../../shared/crypto/crypto.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  AdminUpdateVoucherDto,
  AdminBulkCreateVoucherDto,
} from '../dto/admin-voucher.dto';

@Injectable()
export class AdminVouchersService {
  private readonly logger = new Logger(AdminVouchersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  // ========================================
  // Vouchers (VoucherCode) Management
  // ========================================

  async findAll(
    paginationDto: PaginationQueryDto,
    productId?: number,
    status?: string,
  ) {
    const where: any = {};
    if (productId) where.productId = productId;
    if (status) where.status = status;

    return paginatedQuery(this.prisma.voucherCode, {
      pagination: paginationDto,
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        product: true,
        order: { select: { id: true, userId: true, status: true } },
      },
    });
  }

  async findOne(id: number, adminId: number) {
    const voucher = await this.prisma.voucherCode.findUnique({
      where: { id },
      include: {
        product: true,
        order: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');

    // Decrypt PIN for admin view
    const pinCode = this.cryptoService.decrypt(voucher.pinCode);

    this.logger.warn(
      `[AUDIT] Admin(${adminId}) decrypted PIN for voucher(${id}), product(${voucher.productId})`,
    );

    return { ...voucher, pinCode };
  }

  async update(id: number, dto: AdminUpdateVoucherDto) {
    const voucher = await this.prisma.voucherCode.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundException('Voucher not found');

    return this.prisma.voucherCode.update({ where: { id }, data: dto });
  }

  async delete(id: number) {
    const voucher = await this.prisma.voucherCode.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundException('Voucher not found');

    return this.prisma.voucherCode.delete({ where: { id } });
  }

  async bulkCreate(dto: AdminBulkCreateVoucherDto) {
    const { productId } = dto;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // 구조화 방식과 기존 방식 통합 처리
    const items = dto.vouchers
      ? dto.vouchers.map((v) => ({
          pin: v.pin,
          giftNumber: v.giftNumber || null,
          securityCode: v.securityCode || null,
        }))
      : (dto.pinCodes || []).map((pin) => ({
          pin,
          giftNumber: null as string | null,
          securityCode: null as string | null,
        }));

    // 1. 해시 일괄 계산 — 숫자만 추출 후 해싱 (trade-in과 동일 정규화)
    const allHashes = items.map((item) => ({
      ...item,
      pinHash: this.cryptoService.hash(item.pin.replace(/\D/g, '')),
    }));

    // 2. 중복 체크: N개 findUnique → 1개 findMany batch 쿼리
    const hashList = allHashes.map((h) => h.pinHash);
    const existingHashes = new Set(
      (
        await this.prisma.voucherCode.findMany({
          where: { pinHash: { in: hashList } },
          select: { pinHash: true },
        })
      ).map((v) => v.pinHash),
    );

    // 3. 중복 제외 후 암호화 (CPU only)
    const newItems = allHashes.filter((h) => !existingHashes.has(h.pinHash));
    const duplicates = allHashes.length - newItems.length;

    const createData = newItems.map((item) => ({
      productId,
      pinCode: this.cryptoService.encrypt(item.pin),
      pinHash: item.pinHash,
      giftNumber: item.giftNumber,
      securityCode: item.securityCode
        ? this.cryptoService.encrypt(item.securityCode)
        : null,
      status: 'AVAILABLE',
    }));

    // 4. 일괄 삽입: N개 create → 1개 createMany
    let success = 0;
    const errors: string[] = [];

    if (createData.length > 0) {
      try {
        const result = await this.prisma.voucherCode.createMany({
          data: createData,
        });
        success = result.count;
      } catch (e) {
        // createMany 실패 시 개별 삽입 fallback
        this.logger.warn(
          'createMany failed, falling back to individual inserts',
        );
        await this.prisma.$transaction(async (tx) => {
          for (const entry of createData) {
            try {
              await tx.voucherCode.create({ data: entry });
              success++;
            } catch {
              errors.push(`****${entry.pinHash.slice(-4)}`);
            }
          }
        });
      }
    }

    return { success, duplicates, errors };
  }

  /**
   * 상품별 재고 현황 조회
   */
  async getInventory() {
    // 2 queries total: products + single groupBy aggregation
    const [products, allStatusCounts] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true },
        include: {
          brandRel: true,
          _count: {
            select: { voucherCodes: true },
          },
        },
        orderBy: [{ brandCode: 'asc' }, { price: 'asc' }],
      }),
      this.prisma.voucherCode.groupBy({
        by: ['productId', 'status'],
        where: { product: { isActive: true } },
        _count: { id: true },
      }),
    ]);

    // Build lookup map: productId → { available, sold, used, expired }
    const countsByProduct = new Map<number, Record<string, number>>();
    for (const sc of allStatusCounts) {
      if (!countsByProduct.has(sc.productId)) {
        countsByProduct.set(sc.productId, {
          available: 0,
          sold: 0,
          used: 0,
          expired: 0,
        });
      }
      const status = sc.status.toLowerCase();
      const counts = countsByProduct.get(sc.productId)!;
      if (status in counts) {
        counts[status] = sc._count.id;
      }
    }

    return products.map((product) => {
      const counts = countsByProduct.get(product.id) || {
        available: 0,
        sold: 0,
        used: 0,
        expired: 0,
      };
      return {
        productId: product.id,
        productName: product.name,
        brandCode: product.brandCode,
        brandName: product.brandRel?.name || product.brandCode,
        price: product.price,
        total: product._count.voucherCodes,
        ...counts,
      };
    });
  }
}
