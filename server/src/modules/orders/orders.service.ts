/**
 * @file orders.service.ts
 * @description 주문 관리 파사드 서비스 — 하위 서비스로 위임
 * @module modules/orders
 *
 * 주문 생명주기 전체를 관장하는 파사드(Facade) 서비스.
 * 실제 비즈니스 로직은 3개 하위 서비스에 분산:
 * - OrderCreationService: 주문 생성 + 검증
 * - OrderQueryService: 조회 + 통계 + 거래내역 내보내기
 * - OrderLifecycleService: 취소, 상태 변경, 결제+배송
 *
 * 기존 OrdersService의 public 인터페이스를 100% 유지하므로
 * 컨트롤러·AdminOrdersService 등 소비자 코드 변경 불필요.
 */
import { Injectable } from '@nestjs/common';

import { CreateOrderDto } from './dto/create-order.dto';
import { OrderCreationService } from './services/order-creation.service';
import { OrderLifecycleService } from './services/order-lifecycle.service';
import { OrderQueryService } from './services/order-query.service';
import { BaseCrudService } from '../../base/base-crud.service';
import { PaginationQueryDto } from '../../base/pagination.dto';
import { Order } from '../../shared/prisma/generated/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class OrdersService extends BaseCrudService<Order, CreateOrderDto, any> {
  constructor(
    prisma: PrismaService,
    private readonly creation: OrderCreationService,
    private readonly query: OrderQueryService,
    private readonly lifecycle: OrderLifecycleService,
  ) {
    super(prisma.order);
  }

  // ========================================
  // Creation
  // ========================================

  createOrder(userId: number, data: CreateOrderDto): Promise<Order> {
    return this.creation.createOrder(userId, data);
  }

  // ========================================
  // Query
  // ========================================

  getOrder(orderId: number, userId: number, userRole?: string) {
    return this.query.getOrder(orderId, userId, userRole);
  }

  getMyOrders(userId: number, paginationDto?: PaginationQueryDto) {
    return this.query.getMyOrders(userId, paginationDto);
  }

  getReceivedGifts(userId: number, paginationDto?: PaginationQueryDto) {
    return this.query.getReceivedGifts(userId, paginationDto);
  }

  getMyStats(userId: number) {
    return this.query.getMyStats(userId);
  }

  getMyTransactionExport(
    userId: number,
    options?: {
      pinOption?: 'full' | 'masked' | 'none';
      type?: 'ALL' | 'SALE' | 'PURCHASE';
    },
  ) {
    return this.query.getMyTransactionExport(userId, options);
  }

  getMyBankSubmission(
    userId: number,
    options?: {
      startDate?: string;
      endDate?: string;
      type?: 'ALL' | 'SALE' | 'PURCHASE';
    },
  ) {
    return this.query.getMyBankSubmission(userId, options);
  }

  /** PIN 해석 — pinOption에 따라 전체/마스킹/빈 문자열 반환 (AdminOrdersService에서 사용) */
  resolvePin(
    encrypted: string,
    id: number,
    pinOption: 'full' | 'masked' | 'none',
  ): string {
    return this.query.resolvePin(encrypted, id, pinOption);
  }

  /** PIN 복호화 후 마스킹 — 은행제출 보고서용 (AdminOrdersService에서 사용) */
  maskPin(encryptedPin: string, voucherId: number): string {
    return this.query.maskPin(encryptedPin, voucherId);
  }

  // ========================================
  // Lifecycle
  // ========================================

  cancelMyOrder(orderId: number, userId: number): Promise<Order> {
    return this.lifecycle.cancelMyOrder(orderId, userId);
  }

  processPaymentAndDeliver(
    orderId: number,
    paymentKey: string,
  ): Promise<{
    orderId: number;
    status: string;
    vouchers: { pinCode: string; productName: string }[];
  }> {
    return this.lifecycle.processPaymentAndDeliver(orderId, paymentKey);
  }

  updateStatus(orderId: number, status: string) {
    return this.lifecycle.updateStatus(orderId, status);
  }
}
