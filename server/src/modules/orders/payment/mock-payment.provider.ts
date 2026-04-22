/**
 * @file mock-payment.provider.ts
 * @description Mock 결제 제공자 — PG 연동 전 개발/테스트용
 *
 * 모든 결제를 무조건 성공으로 처리
 * 실제 PG 연동 시 TossPaymentProvider 등으로 교체
 */
import { Injectable, Logger } from '@nestjs/common';

import type {
  IPaymentProvider,
  PaymentVerifyResult,
  PaymentRefundResult,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  async verifyPayment(
    paymentKey: string,
    orderId: number,
    expectedAmount: number,
  ): Promise<PaymentVerifyResult> {
    this.logger.log(
      `[MOCK] Payment verified: key=${paymentKey}, order=${orderId}, amount=${expectedAmount}`,
    );
    return {
      success: true,
      paymentKey,
      orderId,
      amount: expectedAmount,
      method: 'MOCK',
      approvedAt: new Date(),
    };
  }

  async refundPayment(
    paymentKey: string,
    reason: string,
  ): Promise<PaymentRefundResult> {
    this.logger.log(
      `[MOCK] Payment refunded: key=${paymentKey}, reason=${reason}`,
    );
    return {
      success: true,
      refundedAmount: 0,
    };
  }
}
