/**
 * @file payment-provider.interface.ts
 * @description 결제 제공자 인터페이스 - PG사 직접 의존을 추상화
 *
 * 실제 PG 연동 시 이 인터페이스를 구현하면 OrdersService 변경 없이 교체 가능
 * 예: TossPaymentProvider, KcpPaymentProvider 등
 */

/** NestJS 인젝션 토큰 */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentVerifyResult {
  success: boolean;
  paymentKey: string;
  orderId: number;
  amount: number;
  method?: string;
  approvedAt?: Date;
}

export interface PaymentRefundResult {
  success: boolean;
  refundedAmount: number;
}

/**
 * 결제 제공자 인터페이스
 */
export interface IPaymentProvider {
  /** 결제 검증 — PG사에 결제 승인 상태 확인 */
  verifyPayment(
    paymentKey: string,
    orderId: number,
    expectedAmount: number,
  ): Promise<PaymentVerifyResult>;

  /** 결제 환불 — PG사에 환불 요청 */
  refundPayment(
    paymentKey: string,
    reason: string,
  ): Promise<PaymentRefundResult>;
}
