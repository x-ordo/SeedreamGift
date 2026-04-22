import { Injectable, Logger } from '@nestjs/common';

import type {
  IPaymentProvider,
  PaymentVerifyResult,
  PaymentRefundResult,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class TossPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(TossPaymentProvider.name);

  async verifyPayment(
    paymentKey: string,
    orderId: number,
    expectedAmount: number,
  ): Promise<PaymentVerifyResult> {
    this.logger.log(`[TOSS] Verifying payment: key=${paymentKey}`);
    
    // TODO: 실제 토스페이먼츠 API 연동 로직 구현
    // const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', { ... });
    // const data = await response.json();

    return {
      success: true,
      paymentKey,
      orderId,
      amount: expectedAmount,
      method: 'TOSS',
      approvedAt: new Date(),
    };
  }

  async refundPayment(
    paymentKey: string,
    reason: string,
  ): Promise<PaymentRefundResult> {
    this.logger.log(`[TOSS] Refunding payment: key=${paymentKey}, reason=${reason}`);
    
    // TODO: 실제 토스페이먼츠 환불 API 연동

    return {
      success: true,
      refundedAmount: 0,
    };
  }
}
