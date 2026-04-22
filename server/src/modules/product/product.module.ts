/**
 * @file product.module.ts
 * @description 상품 모듈 - 상품권 상품 관리
 * @module product
 *
 * 포함 기능:
 * - 상품 CRUD (생성, 조회, 수정, 삭제)
 * - 매입가 자동 계산 (buyRate 기반)
 * - 활성/비활성 상품 필터링
 *
 * 외부 노출:
 * - ProductService: 주문, 매입 처리 시 상품 정보 조회
 */
import { Module } from '@nestjs/common';

import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
