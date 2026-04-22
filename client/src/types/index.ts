/**
 * @file types/index.ts
 * @description 프론트엔드 타입 정의
 * @module types
 */

// ============================================
// Branded ID Types - 도메인 간 ID 혼용 방지
// ============================================

/** 브랜딩 심볼로 nominal typing 구현 */
declare const __brand: unique symbol;
type Branded<T, B extends string> = T & { readonly [__brand]: B };

/** 사용자 ID */
export type UserId = Branded<number, 'UserId'>;
/** 상품 ID */
export type ProductId = Branded<number, 'ProductId'>;
/** 주문 ID */
export type OrderId = Branded<number, 'OrderId'>;
/** 바우처 ID */
export type VoucherId = Branded<number, 'VoucherId'>;
/** 매입 ID */
export type TradeInId = Branded<number, 'TradeInId'>;

// ============================================
// Product Types
// ============================================

export interface Product {
  id: number;
  type?: 'PHYSICAL' | 'DIGITAL';
  brandCode: string;
  name: string;
  description?: string;
  price: number;
  discountRate: number;
  buyPrice: number;
  tradeInRate: number;
  allowTradeIn: boolean;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Brand {
  id: number;
  code: string;
  name: string;
  color?: string;
  imageUrl?: string;
  order: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 장바구니 아이템 타입 */
export interface CartItem extends Product {
  quantity: number;
  /** 가용 재고 수량 (서버 동기화 시 설정, 0이면 품절) */
  availableStock?: number;
}

// ============================================
// Order Types
// ============================================

/** 바우처 코드 (PIN) */
export interface VoucherCode {
  id: number;
  pinCode: string;
  giftNumber?: string;
  productId: number;
  product?: Product;
  status: 'AVAILABLE' | 'SOLD' | 'USED' | 'EXPIRED';
}

/** 주문 아이템 */
export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  product?: Product;
  quantity: number;
  price: number;
}

/** 주문 상태 */
export type OrderStatus = 'PENDING' | 'PAID' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

/** 주문 */
export interface Order {
  id: number;
  userId: number;
  totalAmount: number;
  status: OrderStatus;
  paymentMethod?: string;
  paymentKey?: string;
  cashReceiptType?: string;
  cashReceiptNumber?: string;
  orderCode?: string;
  orderItems?: OrderItem[];
  voucherCodes?: VoucherCode[];
  createdAt: string;
  updatedAt: string;
}

/** 주문 생성 응답 */
export interface CreateOrderResponse {
  id: number;
  orderCode?: string | null;
  userId: number;
  totalAmount: number;
  status: OrderStatus;
  items: OrderItem[];
  voucherCodes: VoucherCode[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Trade-In Types
// ============================================

/** 매입 상태 */
export type TradeInStatus = 'REQUESTED' | 'RECEIVED' | 'VERIFIED' | 'PAID' | 'REJECTED' | 'FRAUD_HOLD';

/** 매입 신청 */
export interface TradeIn {
  id: number;
  userId: number;
  productId: number;
  product?: Product;
  pinCode: string;
  bankName: string;
  accountNum: string;
  accountHolder: string;
  payoutAmount: number;
  quantity: number;
  status: TradeInStatus;
  productBrand?: string;
  productName?: string;
  inspectionNote?: string;
  adminNote?: string;
  tradeInRate?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// User Types
// ============================================

/** 사용자 역할 */
export type UserRole = 'USER' | 'PARTNER' | 'ADMIN';

/** KYC 상태 */
export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

/** 사용자 */
export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  kycStatus: KycStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Paginated Types
// ============================================

/** Go 서버 API 에러 응답 */
export interface ApiError {
  success: boolean;
  error: string;
  errorId?: string;
}

/** 페이지네이션 응답 (Go 서버 { items, meta } 형식) */
export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export * from './mypage';
export * from './checkout';
