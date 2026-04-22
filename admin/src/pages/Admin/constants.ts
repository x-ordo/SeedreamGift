/**
 * @file Admin/constants.ts
 * @description 관리자 페이지 전용 상수 및 타입 정의
 * @module pages/Admin
 *
 * 사용처:
 * - AdminPage: 탭 목록(ADMIN_TABS), 레이아웃 치수(ADMIN_LAYOUT), 역할 상수(ROLES)
 * - Admin/tabs/*: 상태 옵션(Badge 색상), 폼 기본값, 페이지네이션 설정
 *
 * 상수 분류:
 * - 탭 설정: ADMIN_TABS (15개 탭 정의; 장바구니 탭 제거됨), MOBILE_QUICK_TABS
 * - 상태 옵션: ORDER_STATUS_OPTIONS, TRADEIN_STATUS_OPTIONS, VOUCHER_STATUS_OPTIONS
 * - 상태 색상 맵: ORDER_STATUS_COLOR_MAP, TRADEIN_STATUS_COLOR_MAP (O(1) 조회용)
 * - 폼 기본값: PRODUCT_FORM_DEFAULTS, BRAND_FORM_DEFAULTS, FAQ_FORM_DEFAULTS
 * - 레이아웃: ADMIN_LAYOUT (사이드바 너비, sticky 위치 등)
 * - 역할: ROLES (ADMIN, PARTNER, USER)
 *
 * 공통 상수(BRAND_OPTIONS, 상태 맵 등)는 @/constants에서 가져오고,
 * 이 파일은 관리자 UI에 특화된 파생 상수만 관리한다.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Gauge, Users, ShieldCheck, Tag, BookmarkCheck, Ticket, Receipt,
  Banknote, Gift, Megaphone, Calendar, CircleHelp,
  MessageSquare, Settings, BookOpen, RefreshCw, FileText, Shield, Handshake, Landmark, Briefcase,
  ShieldAlert, ReceiptText, BadgeDollarSign,
} from 'lucide-react';
import {
  BRAND_OPTIONS,
  ORDER_STATUS_MAP,
  TRADEIN_STATUS_MAP,
  KYC_STATUS_MAP,
  VOUCHER_STATUS_MAP,
  APPROVAL_STATUS_MAP,
  VOUCHER_SOURCE_MAP,
} from '../../constants';

// Re-export central constants for convenience
export { BRAND_OPTIONS };

export type AdminTab =
  | 'dashboard' | 'users' | 'partners' | 'sessions' | 'products' | 'brands' | 'vouchers'
  | 'orders' | 'tradeins' | 'gifts' | 'refunds' | 'settlements' | 'fraud' | 'cash-receipts' | 'partner-prices'
  | 'notices' | 'events' | 'faqs' | 'inquiries' | 'business-inquiries' | 'policies'
  | 'security' | 'configs' | 'audit-logs';

/**
 * 상태 맵에서 Badge용 옵션 배열 생성 헬퍼
 */
function toStatusOptions(map: Record<string, { label: string; color: string }>) {
  return Object.entries(map).map(([value, { label, color }]) => ({ value, label, color }));
}

export const ORDER_STATUS_OPTIONS = toStatusOptions(ORDER_STATUS_MAP);
export const TRADEIN_STATUS_OPTIONS = toStatusOptions(TRADEIN_STATUS_MAP);
export const VOUCHER_STATUS_OPTIONS = toStatusOptions(VOUCHER_STATUS_MAP);
export const KYC_STATUS_OPTIONS = toStatusOptions(KYC_STATUS_MAP);

/** O(1) lookup Maps for render column usage */
export const BRAND_LABEL_MAP = new Map(BRAND_OPTIONS.map(b => [b.value, b.label]));
export const ORDER_STATUS_COLOR_MAP = new Map(ORDER_STATUS_OPTIONS.map(o => [o.value, o.color]));
export const TRADEIN_STATUS_COLOR_MAP = new Map(TRADEIN_STATUS_OPTIONS.map(o => [o.value, o.color]));
export const VOUCHER_STATUS_COLOR_MAP = new Map(VOUCHER_STATUS_OPTIONS.map(o => [o.value, o.color]));

export const APPROVAL_STATUS_OPTIONS = toStatusOptions(APPROVAL_STATUS_MAP);
export const VOUCHER_SOURCE_OPTIONS = toStatusOptions(VOUCHER_SOURCE_MAP);

export const APPROVAL_STATUS_COLOR_MAP = new Map(APPROVAL_STATUS_OPTIONS.map(o => [o.value, o.color]));
export const VOUCHER_SOURCE_COLOR_MAP = new Map(VOUCHER_SOURCE_OPTIONS.map(o => [o.value, o.color]));

export const INQUIRY_STATUS_OPTIONS = [
  { value: 'PENDING', label: '답변대기', color: 'yellow' },
  { value: 'ANSWERED', label: '답변완료', color: 'green' },
  { value: 'CLOSED', label: '종료', color: 'elephant' },
];

export const INQUIRY_CATEGORY_OPTIONS = [
  { value: 'order', label: '주문/결제' },
  { value: 'delivery', label: '배송' },
  { value: 'refund', label: '환불/취소' },
  { value: 'tradein', label: '상품권 매입' },
  { value: 'account', label: '회원/계정' },
  { value: 'etc', label: '기타' },
];

export const INQUIRY_STATUS_COLOR_MAP = new Map(INQUIRY_STATUS_OPTIONS.map(o => [o.value, o.color]));
export const INQUIRY_CATEGORY_LABEL_MAP = new Map(INQUIRY_CATEGORY_OPTIONS.map(o => [o.value, o.label]));

export const REFUND_STATUS_OPTIONS = [
  { value: 'REQUESTED', label: '환불요청', color: 'yellow' },
  { value: 'APPROVED', label: '승인', color: 'green' },
  { value: 'REJECTED', label: '거부', color: 'red' },
];

export const REFUND_STATUS_COLOR_MAP = new Map(REFUND_STATUS_OPTIONS.map(o => [o.value, o.color]));

export const FAQ_CATEGORY_OPTIONS = [
  { value: 'GENERAL', label: '일반' },
  { value: 'PURCHASE', label: '구매' },
  { value: 'TRADEIN', label: '매입' },
  { value: 'PAYMENT', label: '결제' },
  { value: 'DELIVERY', label: '배송' },
  { value: 'ACCOUNT', label: '계정' },
];

/** 사이드바 그룹 정의 */
export const TAB_GROUPS = [
  { id: 'members', label: '회원 관리' },
  { id: 'products', label: '상품 관리' },
  { id: 'transactions', label: '거래 관리' },
  { id: 'content', label: '콘텐츠 관리' },
  { id: 'system', label: '시스템' },
] as const;

export interface AdminTabConfig {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
  group: string;
  title: string;
  description: string;
}

export const ADMIN_TABS: AdminTabConfig[] = [
  { id: 'dashboard', label: '대시보드 홈', icon: Gauge, group: 'members', title: '대시보드', description: '플랫폼 전체 현황을 한눈에 확인합니다.' },
  { id: 'users', label: '회원 관리', icon: Users, group: 'members', title: '회원 관리', description: '회원 정보, KYC 인증, 역할을 관리합니다.' },
  { id: 'partners', label: '파트너 관리', icon: Handshake, group: 'members', title: '파트너 관리', description: '파트너 회원과 상품 승인을 관리합니다.' },
  { id: 'sessions', label: '세션 관리', icon: ShieldCheck, group: 'members', title: '세션 관리', description: '로그인 세션과 보안 기록을 관리합니다.' },
  { id: 'products', label: '상품 관리', icon: Tag, group: 'products', title: '상품 관리', description: '상품권 상품의 가격, 할인율을 관리합니다.' },
  { id: 'brands', label: '브랜드 관리', icon: BookmarkCheck, group: 'products', title: '브랜드 관리', description: '상품권 브랜드 정보를 관리합니다.' },
  { id: 'vouchers', label: '재고(PIN) 관리', icon: Ticket, group: 'products', title: '재고(PIN) 관리', description: '바우처 PIN 재고와 발급 현황을 관리합니다.' },
  { id: 'partner-prices', label: '파트너 단가', icon: BadgeDollarSign, group: 'products', title: '파트너 단가 관리', description: '파트너별 상품 단가를 설정하고 관리합니다.' },
  { id: 'orders', label: '주문 관리', icon: Receipt, group: 'transactions', title: '주문 관리', description: '주문 현황과 결제 상태를 관리합니다.' },
  { id: 'tradeins', label: '매입(판매) 신청', icon: Banknote, group: 'transactions', title: '매입 관리', description: '상품권 매입 신청을 검증하고 정산합니다.' },
  { id: 'gifts', label: '선물 관리', icon: Gift, group: 'transactions', title: '선물 관리', description: '선물 발송 및 수령 내역을 관리합니다.' },
  { id: 'refunds', label: '환불 관리', icon: RefreshCw, group: 'transactions', title: '환불 관리', description: '환불 요청을 검토하고 처리합니다.' },
  { id: 'settlements', label: '정산 관리', icon: Landmark, group: 'transactions', title: '정산 관리', description: '파트너 정산을 관리하고 입금 처리합니다.' },
  { id: 'fraud', label: '사기 조회', icon: ShieldAlert, group: 'transactions', title: '사기 조회 관리', description: '더치트 사기 피해사례 조회 및 FRAUD_HOLD 관리' },
  // [비활성화] 유가증권은 현금영수증 발급 대상 아님
  // { id: 'cash-receipts', label: '현금영수증', icon: ReceiptText, group: 'transactions', title: '현금영수증 관리', description: '현금영수증 발행, 취소, 재발행을 관리합니다.' },
  { id: 'notices', label: '공지사항 관리', icon: Megaphone, group: 'content', title: '공지사항 관리', description: '공지사항을 작성하고 관리합니다.' },
  { id: 'events', label: '이벤트 관리', icon: Calendar, group: 'content', title: '이벤트 관리', description: '이벤트와 프로모션을 관리합니다.' },
  { id: 'faqs', label: 'FAQ 관리', icon: CircleHelp, group: 'content', title: 'FAQ 관리', description: '자주 묻는 질문을 관리합니다.' },
  { id: 'inquiries', label: '1:1 문의 관리', icon: MessageSquare, group: 'content', title: '1:1 문의 관리', description: '고객 문의에 답변하고 관리합니다.' },
  { id: 'business-inquiries', label: '사업 제휴 문의', icon: Briefcase, group: 'content', title: '사업 제휴 문의', description: '기업 파트너십 및 대량 구매 문의를 관리합니다.' },
  { id: 'policies', label: '약관 관리', icon: FileText, group: 'content', title: '약관 관리', description: '이용약관, 개인정보처리방침 등을 관리합니다.' },
  { id: 'security', label: '보안/패턴 설정', icon: Shield, group: 'system', title: '보안 및 패턴 탐지', description: '보안 규칙과 비정상 패턴 탐지를 관리합니다.' },
  { id: 'configs', label: '시스템 설정', icon: Settings, group: 'system', title: '시스템 설정', description: '플랫폼 설정값을 관리합니다.' },
  { id: 'audit-logs', label: '감사 로그', icon: BookOpen, group: 'system', title: '감사 로그', description: '관리자 작업 이력을 조회합니다.' },
];

/** 역할 문자열 상수 */
export const ROLES = {
  ADMIN: 'ADMIN',
  PARTNER: 'PARTNER',
  USER: 'USER',
} as const;

/** 관리자 테이블 기본 페이지네이션 */
export const ADMIN_PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  AUDIT_LOG_PAGE_SIZE: 20,
} as const;

/** AdminPage 레이아웃 치수 */
export const ADMIN_LAYOUT = {
  SIDEBAR_WIDTH: '240px',
  STICKY_TOP: '100px',
  NAV_MAX_HEIGHT: 'calc(100vh - 140px)',
  CONTENT_MIN_HEIGHT: '600px',
} as const;

/** isActive 기반 상태 라벨 맵 */
export const ACTIVE_STATUS_LABELS = {
  brand: { active: '활성', inactive: '비활성' },
  product: { active: '판매중', inactive: '중지' },
  event: { active: '진행중', inactive: '종료' },
} as const;

/** 이벤트 기간 상태 */
export const EVENT_PERIOD_STATUS = {
  UPCOMING: { label: '예정', color: 'blue' as const },
  ENDED: { label: '종료', color: 'elephant' as const },
  ONGOING: { label: '진행중', color: 'green' as const },
} as const;


/** 상품 유형 옵션 */
export const PRODUCT_TYPE_OPTIONS = [
  { value: 'PHYSICAL', label: '실물상품' },
  { value: 'DIGITAL', label: '디지털(PIN)' },
  { value: 'ENVELOPE', label: '봉투' },
] as const;

/** 배송 방법 옵션 */
export const SHIPPING_METHOD_OPTIONS = [
  { value: 'NONE', label: '배송없음' },
  { value: 'DELIVERY', label: '택배배송' },
  { value: 'PICKUP', label: '방문수령' },
  { value: 'BOTH', label: '택배+방문' },
] as const;

/** 상품 폼 기본값 */
export const PRODUCT_FORM_DEFAULTS = {
  brand: 'SHINSEGAE',
  price: 50000,
  discountRate: 3,
  tradeInRate: 5,
  allowTradeIn: true,
  allowPartnerStock: false,
  isActive: true,
  type: 'PHYSICAL',
  shippingMethod: 'DELIVERY',
  fulfillmentType: 'STOCK',
  providerCode: '',
  providerProductCode: '',
} as const;

export const FULFILLMENT_TYPE_OPTIONS = [
  { value: 'STOCK', label: '수동 재고' },
  { value: 'API', label: '외부 API 발급' },
] as const;

export const PROVIDER_OPTIONS = [
  { value: 'EXPAY', label: '이엑스페이 (EXPay)' },
  { value: 'STUB', label: '테스트 (Stub)' },
] as const;

/** 브랜드 폼 기본값 */
export const BRAND_FORM_DEFAULTS = {
  color: '#3182F6',
  order: 1,
  isActive: true,
} as const;

/** FAQ 폼 기본값 */
export const FAQ_FORM_DEFAULTS = {
  category: 'GENERAL',
  order: 1,
  isActive: true,
} as const;

export interface ProductFormData {
  brand: string;
  name: string;
  description: string;
  price: number;
  discountRate: number;
  tradeInRate: number;
  allowTradeIn: boolean;
  allowPartnerStock: boolean;
  isActive: boolean;
  imageUrl: string;
  type: string;
  shippingMethod: string;
}

/** 정산 상태 옵션 */
export const SETTLEMENT_STATUS_OPTIONS = [
  { value: 'PENDING', label: '대기', color: 'yellow' },
  { value: 'CONFIRMED', label: '확인', color: 'blue' },
  { value: 'PAID', label: '입금완료', color: 'green' },
  { value: 'FAILED', label: '실패', color: 'red' },
] as const;

export const SETTLEMENT_STATUS_COLOR_MAP = new Map(
  SETTLEMENT_STATUS_OPTIONS.map(o => [o.value, o.color]),
);

export const SETTLEMENT_FREQUENCY_OPTIONS = [
  { value: 'INSTANT', label: '즉시' },
  { value: 'WEEKLY', label: '주간' },
  { value: 'MONTHLY', label: '월간' },
  { value: 'MANUAL', label: '수동' },
] as const;
