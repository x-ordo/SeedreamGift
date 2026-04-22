/**
 * @file voucher-assigner.interface.ts
 * @description 바우처 할당 인터페이스 - OrdersService가 VoucherService에 직접 의존하지 않도록 분리
 *
 * OrdersModule 내부에 인터페이스를 정의하고, VoucherService가 이를 구현하는 DIP 패턴
 */

/** NestJS 인젝션 토큰 */
export const VOUCHER_ASSIGNER = Symbol('VOUCHER_ASSIGNER');

/**
 * 주문에 바우처를 할당/해제하는 인터페이스
 *
 * OrdersService는 이 인터페이스에만 의존하며,
 * 구체적인 구현(VoucherService)은 모듈 설정에서 주입됨
 */
export interface IVoucherAssigner {
  /**
   * 주문에 바우처 자동 할당
   * @param orderId - 바우처를 할당할 주문 ID
   * @param tx - Prisma 트랜잭션 객체
   * @returns 할당된 바우처 수
   */
  assignVouchersToOrder(orderId: number, tx?: any): Promise<number>;

  /**
   * 주문에서 바우처 해제 (주문 취소 시)
   * @param orderId - 바우처를 해제할 주문 ID
   * @param tx - Prisma 트랜잭션 객체
   * @returns 해제된 바우처 수
   */
  releaseVouchersFromOrder(orderId: number, tx?: any): Promise<number>;
}
