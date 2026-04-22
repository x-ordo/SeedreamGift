import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class OrderPaidListener {
  private readonly logger = new Logger(OrderPaidListener.name);

  /**
   * Observer Pattern: 주문 결제 완료(order.paid) 이벤트 수신
   * 이벤트 수신 시 비동기로 부가적인 작업(SMS 발송, 통계 집계 등)을 처리
   */
  @OnEvent('order.paid')
  handleOrderPaidEvent(payload: {
    orderId: number;
    status: string;
    vouchers: { pinCode: string; productName: string }[];
  }) {
    this.logger.log(`Received order.paid event for Order ID: ${payload.orderId}`);

    // TODO 1: 사용자에게 결제 완료 및 바우처 PIN SMS 발송 로직
    this.logger.debug(`[Observer] SMS 발송 모의 처리 - Vouchers: ${payload.vouchers.length}건`);

    // TODO 2: 시스템 일일 판매 통계 업데이트 비동기 처리
    this.logger.debug(`[Observer] 통계 업데이트 모의 처리 - Order ID: ${payload.orderId}`);
  }

  @OnEvent('order.paid.admin')
  handleAdminOrderPaidEvent(payload: { orderId: number; status: string }) {
    this.logger.log(`Received order.paid.admin event for Order ID: ${payload.orderId}`);
    
    // 관리자가 강제로 상태를 변경했을 때의 추가 로직 (예: 알림)
  }
}
