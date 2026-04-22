import { ShoppingBag, Gift, Coins, Receipt, Settings, LucideIcon } from 'lucide-react';

/** 마이페이지 탭 ID 타입 */
export type MyPageTab = 'orders' | 'gifts' | 'tradeins' | 'receipts' | 'settings';

/** 받은 선물 타입 */
export interface MyGift {
  id: number;
  senderName: string;
  status?: string;
  expiresAt?: string;
  claimedAt?: string;
  createdAt: string;
  order?: {
    voucherCodes?: MyGiftVoucher[];
  };
}

/** 선물 바우처 정보 */
export interface MyGiftVoucher {
  id: number;
  pinCode: string;
  giftNumber?: string;
  product?: { name: string };
}

/** 정산 계좌 정보 */
export interface BankAccount {
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  bankVerifiedAt: string | null;
}

/** 현금영수증 타입 */
export interface CashReceipt {
  id: number;
  orderId: number;
  type: string;           // INCOME_DEDUCTION | EXPENSE_PROOF
  identityType: string;   // PHONE | BUSINESS_NO | CARD_NO
  maskedIdentity: string;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  mgtKey: string;
  confirmNum?: string;
  tradeDate?: string;
  status: string;         // PENDING | ISSUED | FAILED | CANCELLED
  isAutoIssued: boolean;
  issuedAt?: string;
  cancelledAt?: string;
  createdAt: string;
}

/** 알림 설정 */
export interface NotificationSettings {
  emailNotification: boolean;
  pushNotification: boolean;
}

/** 마이페이지 탭 설정 인터페이스 */
export interface MyPageTabConfig {
  id: MyPageTab;
  label: string;
  icon: LucideIcon;
}

/** 마이페이지 유효 탭 목록 */
export const VALID_MYPAGE_TABS: MyPageTab[] = ['orders', 'gifts', 'tradeins', 'receipts', 'settings'];

/** 마이페이지 탭 설정 정보 */
export const MYPAGE_TAB_CONFIG: MyPageTabConfig[] = [
  { id: 'orders', label: '구매내역', icon: ShoppingBag },
  { id: 'gifts', label: '받은선물', icon: Gift },
  { id: 'tradeins', label: '판매내역', icon: Coins },
  // [비활성화] 유가증권은 현금영수증 발급 대상 아님
  // { id: 'receipts', label: '현금영수증', icon: Receipt },
  { id: 'settings', label: '설정', icon: Settings }
];

/** 역할별 마이페이지 탭 필터링 (PARTNER는 소비자 기능 제외) */
export const getMyPageTabsForRole = (role?: string): MyPageTabConfig[] => {
  if (role === 'PARTNER') return MYPAGE_TAB_CONFIG.filter(t => t.id === 'settings');
  // [비활성화] 유가증권은 현금영수증 발급 대상 아님 — receipts 탭은 반환 목록에서 제외됨
  return MYPAGE_TAB_CONFIG;
};
