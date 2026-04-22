import { Injectable } from '@nestjs/common';

import { MockPaymentProvider } from './mock-payment.provider';
import { TossPaymentProvider } from './toss-payment.provider';
import type { IPaymentProvider } from '../interfaces/payment-provider.interface';

export type PaymentGatewayType = 'TOSS' | 'MOCK';

@Injectable()
export class PaymentStrategyFactory {
  constructor(
    private readonly mockProvider: MockPaymentProvider,
    private readonly tossProvider: TossPaymentProvider,
  ) {}

  /**
   * 결제 수단 또는 환경에 따라 적절한 PG 제공자를 반환
   */
  getProvider(pgType?: PaymentGatewayType | string): IPaymentProvider {
    // 운영 환경 등 조건에 따라 기본 PG사를 설정할 수 있음
    const targetType = pgType || process.env.DEFAULT_PG_TYPE || 'MOCK';

    switch (targetType) {
      case 'TOSS':
        return this.tossProvider;
      case 'MOCK':
      default:
        return this.mockProvider;
    }
  }
}
