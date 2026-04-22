import type { Product } from './index';

/** 체크아웃 아이템 타입 */
export interface CheckoutItem extends Product {
  quantity: number;
}

/** 입금 계좌 정보 (useBankInfo 반환 타입) */
export interface BankInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isLoading: boolean;
}

/** 선물 대상 정보 */
export interface GiftTarget {
  email: string;
  name: string;
  message?: string;
}

/** 배송 정보 */
export interface ShippingInfo {
  method: 'DELIVERY' | 'PICKUP';
  recipientName?: string;
  recipientPhone?: string;
  recipientAddr?: string;
  recipientZip?: string;
}

/** 결제 수단 타입 */
export type PaymentMethod = 'CASH' | 'VIRTUAL_ACCOUNT' | 'DEDICATED_ACCOUNT' | 'OPEN_BANKING';

/** 현금영수증 신청 타입 */
export type CashReceiptType = 'PERSONAL' | 'BUSINESS' | 'NO_RECEIPT';

/** 상품권 노출 정보 인터페이스 */
export interface VoucherDisplay {
  pinCode: string;
  giftNumber?: string | null;
}

/** 주문 결과 데이터 인터페이스 */
export interface OrderResultData {
  orderId: number;
  orderCode: string | null;
  pinCodes: string[];
  vouchers: VoucherDisplay[];
  totalAmount: number;
}
