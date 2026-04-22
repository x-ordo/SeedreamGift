/**
 * @file voucher-repository.interface.ts
 * @description 바우처 저장소 인터페이스 - Prisma 직접 의존을 추상화
 */

/** NestJS 인젝션 토큰 */
export const VOUCHER_REPOSITORY = Symbol('VOUCHER_REPOSITORY');

export interface CreateVoucherData {
  productId: number;
  pinCode: string;
  pinHash: string;
  status: string;
}

/**
 * 바우처 데이터 접근 인터페이스
 */
export interface IVoucherRepository {
  /** 바우처 대량 생성 */
  bulkCreate(data: CreateVoucherData[]): Promise<{ count: number }>;

  /** 특정 상품의 사용 가능한 바우처 조회 */
  findAvailableByProductId(
    productId: number,
    take: number,
    tx?: any,
  ): Promise<{ id: number; productId: number; status: string }[]>;

  /** 바우처 상태를 SOLD로 변경하고 주문에 연결 */
  markAsSold(
    voucherIds: number[],
    orderId: number,
    tx?: any,
  ): Promise<{ count: number }>;

  /** 주문의 바우처를 AVAILABLE로 복구 */
  releaseByOrderId(orderId: number, tx?: any): Promise<{ count: number }>;

  /** 비관적 잠금으로 바우처를 주문에 원자적 할당 (SELECT+UPDATE atomic) */
  assignToOrder(
    productId: number,
    quantity: number,
    orderId: number,
    tx?: any,
  ): Promise<{ assignedIds: number[] }>;
}
