/**
 * @file orders.module.ts
 * @description 주문 모듈 - 상품권 구매 주문 관리
 * @module orders
 *
 * 포함 기능:
 * - 주문 생성 (트랜잭션 처리)
 * - 일일 구매 한도 검증
 * - 바우처 자동 할당
 * - 주문 내역 조회
 *
 * 의존 모듈:
 * - VoucherModule: 바우처 재고 확인 및 할당
 * - SiteConfigModule: 일일 구매 한도 조회
 *
 * 외부 노출:
 * - OrdersService: PaymentModule에서 결제 후 주문 상태 업데이트
 */
import { Module } from '@nestjs/common';

import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import { VOUCHER_ASSIGNER } from './interfaces/voucher-assigner.interface';
import { OrderPaidListener } from './listeners/order-paid.listener';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { MockPaymentProvider } from './payment/mock-payment.provider';
import { PaymentStrategyFactory } from './payment/payment-strategy.factory';
import { TossPaymentProvider } from './payment/toss-payment.provider';
import {
  OrderCreationService,
  OrderQueryService,
  OrderLifecycleService,
} from './services';
import { SiteConfigModule } from '../site-config/site-config.module';
import { VoucherModule } from '../voucher/voucher.module';
import { VoucherService } from '../voucher/voucher.service';

@Module({
  imports: [VoucherModule, SiteConfigModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderCreationService,
    OrderQueryService,
    OrderLifecycleService,
    MockPaymentProvider,
    TossPaymentProvider,
    PaymentStrategyFactory,
    OrderPaidListener,
    { provide: VOUCHER_ASSIGNER, useExisting: VoucherService },
    // 기존 단일 프로바이더 방식 유지(하위 호환성)
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
