/**
 * @file Partner/constants.ts
 * @description Partner page tab definitions and constants
 */
import type { LucideIcon } from 'lucide-react';
import {
  Gauge, Tag, Receipt, Ticket, Banknote, UserCircle, ShoppingCart, Coins,
} from 'lucide-react';

export type PartnerTab =
  | 'dashboard' | 'products' | 'buy' | 'tradein' | 'orders' | 'vouchers' | 'payouts' | 'profile';

export interface PartnerTabConfig {
  id: PartnerTab;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

export const PARTNER_TABS: PartnerTabConfig[] = [
  { id: 'dashboard', label: '대시보드', icon: Gauge, title: '대시보드', description: '파트너 현황을 한눈에 확인합니다.' },
  { id: 'products', label: '등록 가능 상품', icon: Tag, title: '등록 가능 상품', description: '파트너 PIN 등록이 허용된 상품을 조회합니다.' },
  { id: 'buy', label: '상품 구매', icon: ShoppingCart, title: '상품 구매', description: '파트너 전용 단가로 상품권을 구매합니다.' },
  { id: 'tradein', label: '매입 신청', icon: Coins, title: '매입 신청', description: '보유 상품권의 매입을 신청합니다.' },
  { id: 'orders', label: '주문 현황', icon: Receipt, title: '주문 현황', description: '내 상품의 주문 내역을 조회합니다.' },
  { id: 'vouchers', label: 'PIN 재고', icon: Ticket, title: 'PIN 재고 관리', description: '바우처 PIN을 등록하고 재고를 관리합니다.' },
  { id: 'payouts', label: '정산 내역', icon: Banknote, title: '정산 내역', description: '수수료 및 정산 내역을 조회합니다.' },
  { id: 'profile', label: '내 정보', icon: UserCircle, title: '내 정보', description: '파트너 프로필을 관리합니다.' },
];

/** Pagination defaults */
export const PARTNER_PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
} as const;

/** Brand options for product creation */
export const BRAND_OPTIONS = [
  { value: 'SHINSEGAE', label: '신세계' },
  { value: 'HYUNDAI', label: '현대' },
  { value: 'LOTTE', label: '롯데' },
  { value: 'DAISO', label: '다이소' },
  { value: 'OLIVEYOUNG', label: '올리브영' },
] as const;

/** Order status display config */
export const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '결제대기', color: 'yellow' },
  PAID: { label: '결제완료', color: 'blue' },
  DELIVERED: { label: '발송완료', color: 'green' },
  CANCELLED: { label: '취소', color: 'red' },
};

/** Voucher status display config */
export const VOUCHER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  AVAILABLE: { label: '사용가능', color: 'green' },
  SOLD: { label: '판매됨', color: 'blue' },
  USED: { label: '사용됨', color: 'gray' },
  EXPIRED: { label: '만료', color: 'red' },
};

/** Trade-in status display config */
export const TRADEIN_STATUS_MAP: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: '신청완료', color: 'yellow' },
  RECEIVED: { label: '접수', color: 'blue' },
  VERIFIED: { label: '검수완료', color: 'indigo' },
  PAID: { label: '정산완료', color: 'green' },
  REJECTED: { label: '반려', color: 'red' },
};

/** Approval status display config */
export const APPROVAL_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '승인대기', color: 'yellow' },
  APPROVED: { label: '승인됨', color: 'green' },
  REJECTED: { label: '반려', color: 'red' },
};

/** Brand label lookup */
export const BRAND_LABEL_MAP = new Map(BRAND_OPTIONS.map(b => [b.value, b.label]));
