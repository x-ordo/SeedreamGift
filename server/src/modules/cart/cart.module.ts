/**
 * @file cart.module.ts
 * @description 장바구니 모듈 - 사용자 장바구니 관리
 * @module cart
 *
 * 포함 기능:
 * - 장바구니 조회, 추가, 수정, 삭제
 * - 재고 확인 후 아이템 추가
 *
 * 외부 노출:
 * - CartService: 주문 생성 시 장바구니 조회/삭제
 */
import { Module } from '@nestjs/common';

import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { VoucherModule } from '../voucher/voucher.module';

@Module({
  imports: [VoucherModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
