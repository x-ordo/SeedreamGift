/**
 * @file transaction-export.utils.ts
 * @description 거래내역 내보내기 공통 유틸 — 주문/매입 아이템 빌드, 요약, 정렬
 *
 * AdminOrdersService.getBankTransactionReport() 와
 * OrdersService.getMyTransactionExport() 의 공통 로직 추출.
 */

/** PIN 해석 콜백 타입 */
export type PinResolver = (
  encrypted: string,
  id: number,
  option: PinOption,
) => string;

export type PinOption = 'full' | 'masked' | 'none';

/** 공통 트랜잭션 아이템 필드 */
export interface BaseTransactionItem {
  transactionId: string;
  type: 'SALE' | 'PURCHASE';
  date: string;
  productName: string;
  brandCode: string;
  quantity: number;
  unitPrice: number;
  faceValue: number;
  totalAmount: number;
  pin: string;
  status: string;
  paymentMethod: string;
}

/** 내보내기 요약 */
export interface ExportSummary {
  totalSales: number;
  totalPurchases: number;
  netAmount: number;
  transactionCount: number;
}

// ========================================
// Order Item Builder
// ========================================

interface OrderForExport {
  id: number;
  createdAt: Date;
  status: string;
  paymentMethod?: string | null;
  recipientPhone?: string | null;
  recipientName?: string | null;
  recipientAddr?: string | null;
  items: Array<{
    price: any;
    quantity: number;
    product?: { name?: string; brandCode?: string; price?: any } | null;
  }>;
  voucherCodes: Array<{ id: number; pinCode: string }>;
  user?: { name?: string; phone?: string; email?: string } | null;
}

/**
 * 주문(Order)들을 트랜잭션 아이템 배열로 변환
 *
 * @param orders - Prisma에서 조회한 주문 목록
 * @param pinOption - PIN 표시 수준
 * @param resolvePin - PIN 해석 함수
 * @param extraFields - 주문별 추가 필드 매퍼 (아이템마다 병합)
 * @returns { items, totalSales }
 */
export function buildOrderItems<T extends BaseTransactionItem>(
  orders: OrderForExport[],
  pinOption: PinOption,
  resolvePin: PinResolver,
  extraFields?: (order: OrderForExport) => Record<string, unknown>,
): { items: T[]; totalSales: number } {
  const items: T[] = [];
  let totalSales = 0;

  for (const order of orders) {
    const resolvedPins = order.voucherCodes.map((vc) =>
      resolvePin(vc.pinCode, vc.id, pinOption),
    );
    const pinDisplay =
      pinOption === 'none' ? '' : resolvedPins.join(', ') || '-';

    const extra = extraFields?.(order) ?? {};

    for (const item of order.items) {
      const amount = Number(item.price) * item.quantity;
      totalSales += amount;

      items.push({
        transactionId: `ORD-${order.id}`,
        type: 'SALE' as const,
        date: order.createdAt.toISOString(),
        productName: item.product?.name || '-',
        brandCode: item.product?.brandCode || '-',
        quantity: item.quantity,
        unitPrice: Number(item.price),
        faceValue: Number(item.product?.price || 0),
        totalAmount: amount,
        pin: pinDisplay,
        status: order.status,
        paymentMethod: order.paymentMethod || '-',
        ...extra,
      } as T);
    }
  }

  return { items, totalSales };
}

// ========================================
// TradeIn Item Builder
// ========================================

interface TradeInForExport {
  id: number;
  createdAt: Date;
  status: string;
  quantity: number;
  payoutAmount: any;
  productPrice?: any;
  productName?: string | null;
  productBrand?: string | null;
  pinCode?: string | null;
  senderName?: string | null;
  senderPhone?: string | null;
  bankName?: string | null;
  accountNum?: string | null;
  accountHolder?: string | null;
  adminNote?: string | null;
  user?: { name?: string; phone?: string } | null;
  product?: { name?: string; brandCode?: string } | null;
}

/**
 * 매입(TradeIn)들을 트랜잭션 아이템 배열로 변환
 */
export function buildTradeInItems<T extends BaseTransactionItem>(
  tradeIns: TradeInForExport[],
  pinOption: PinOption,
  resolvePin: PinResolver,
  extraFields?: (ti: TradeInForExport) => Record<string, unknown>,
): { items: T[]; totalPurchases: number } {
  const items: T[] = [];
  let totalPurchases = 0;

  for (const ti of tradeIns) {
    const amount = Number(ti.payoutAmount);
    totalPurchases += amount;

    let pinDisplay = '-';
    if (ti.pinCode && pinOption !== 'none') {
      pinDisplay = resolvePin(ti.pinCode, ti.id, pinOption);
    } else if (pinOption === 'none') {
      pinDisplay = '';
    }

    const extra = extraFields?.(ti) ?? {};

    items.push({
      transactionId: `TI-${ti.id}`,
      type: 'PURCHASE' as const,
      date: ti.createdAt.toISOString(),
      productName: ti.productName || ti.product?.name || '-',
      brandCode: ti.productBrand || ti.product?.brandCode || '-',
      quantity: ti.quantity,
      unitPrice: Number(ti.productPrice || 0),
      faceValue: Number(ti.productPrice || 0),
      totalAmount: amount,
      pin: pinDisplay,
      status: ti.status,
      paymentMethod: '계좌이체',
      ...extra,
    } as T);
  }

  return { items, totalPurchases };
}

// ========================================
// Sort & Summary
// ========================================

/** 날짜 오름차순 정렬 (in-place) */
export function sortByDate<T extends { date: string }>(items: T[]): T[] {
  return items.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

/** 내보내기 요약 생성 */
export function buildExportSummary(
  totalSales: number,
  totalPurchases: number,
  transactionCount: number,
  extra?: Record<string, unknown>,
): ExportSummary & Record<string, unknown> {
  return {
    totalSales,
    totalPurchases,
    netAmount: totalSales - totalPurchases,
    transactionCount,
    ...extra,
  };
}

/** 내보내기용 메모리 보호 최대 건수 */
export const EXPORT_MAX = 10000;
