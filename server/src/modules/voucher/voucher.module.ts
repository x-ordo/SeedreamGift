/**
 * @file voucher.module.ts
 * @description 바우처 모듈 - 상품권 PIN 재고 관리
 * @module voucher
 *
 * 포함 기능:
 * - 바우처 대량 등록 (엑셀/CSV 업로드)
 * - 재고 조회 (상품별 가용 수량)
 * - 주문 시 바우처 자동 할당
 * - PIN 암호화 저장/복호화 조회
 *
 * 외부 노출:
 * - VoucherService: 주문 처리 시 바우처 할당/조회
 */
import { Module } from '@nestjs/common';

import { VOUCHER_REPOSITORY } from './interfaces/voucher-repository.interface';
import { PrismaVoucherRepository } from './prisma-voucher.repository';
import { VoucherExpiryService } from './voucher-expiry.service';
import { VoucherController } from './voucher.controller';
import { VoucherService } from './voucher.service';
import { CryptoModule } from '../../shared/crypto/crypto.module';

@Module({
  imports: [CryptoModule],
  controllers: [VoucherController],
  providers: [
    VoucherService,
    VoucherExpiryService,
    { provide: VOUCHER_REPOSITORY, useClass: PrismaVoucherRepository },
  ],
  exports: [VoucherService, VOUCHER_REPOSITORY],
})
export class VoucherModule {}
