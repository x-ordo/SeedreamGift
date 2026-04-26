/**
 * @file statusMaps.ts
 * @description 상태 관련 상수 - 주문/판매 상태 레이블 및 스타일 매핑
 * @module constants
 *
 * 사용처:
 * - MyPage: 주문/판매 상태 배지 표시
 * - AdminPage: 주문/판매 상태 표시
 */

/**
 * 상태 표시 설정 타입
 */
export interface StatusConfig {
  label: string;      // 사용자에게 표시할 레이블 (한국어)
  class: string;      // CSS 클래스 (배경색 + 텍스트색)
  color: string;      // Badge 컴포넌트용 색상 (green, yellow, blue, red, elephant 등)
  description?: string; // 상세 설명 (선택)
}

/**
 * 주문 상태 맵
 *
 * 상태 흐름: PENDING → PAID → DELIVERED
 *           └→ CANCELLED
 */
export const ORDER_STATUS_MAP: Record<string, StatusConfig> = {
  'PENDING': {
    label: '결제 대기',
    class: 'bg-warning-light text-warning',
    color: 'yellow',
    description: '결제가 진행 중입니다.',
  },
  'ISSUED': {
    label: '입금 대기',
    class: 'bg-warning-light text-warning',
    color: 'yellow',
    description: '가상계좌가 발급되었습니다. 안내된 계좌로 입금해주세요.',
  },
  'EXPIRED': {
    label: '입금 기한 만료',
    class: 'bg-light text-muted',
    color: 'elephant',
    description: '입금 마감 시각이 지났습니다. 새로 결제를 시작해주세요.',
  },
  'PAID': {
    label: '결제 완료',
    class: 'bg-primary-light text-primary',
    color: 'blue',
    description: '결제가 완료되었습니다. PIN이 곧 발급됩니다.',
  },
  'DELIVERED': {
    label: '발급 완료',
    class: 'bg-success-light text-success',
    color: 'green',
    description: 'PIN이 발급되었습니다.',
  },
  'CANCELLED': {
    label: '취소됨',
    class: 'bg-light text-muted',
    color: 'elephant',
    description: '주문이 취소되었습니다.',
  },
  'COMPLETED': {
    label: '완료',
    class: 'bg-success-light text-success',
    color: 'green',
    description: '주문이 완료되었습니다.',
  },
  'REFUNDED': {
    label: '환불 진행 중',
    class: 'bg-warning-light text-warning',
    color: 'yellow',
    description: '환불 요청이 접수되었습니다. 영업일 1~2일 내 입금 완료됩니다.',
  },
  'REFUND_PAID': {
    label: '환불 완료',
    class: 'bg-light text-muted',
    color: 'elephant',
    description: '환불 금액이 입금되었습니다.',
  },
};

/**
 * 판매(Trade-In) 상태 맵
 *
 * 상태 흐름: REQUESTED → VERIFIED → PAID
 *                     └→ REJECTED
 */
export const TRADEIN_STATUS_MAP: Record<string, StatusConfig> = {
  'REQUESTED': {
    label: '신청완료',
    class: 'bg-warning-light text-warning',
    color: 'yellow',
    description: '판매 신청이 접수되었습니다.',
  },
  'RECEIVED': {
    label: '수령확인',
    class: 'bg-info-light text-info',
    color: 'blue',
    description: '상품권이 수령되었습니다. 검증이 진행됩니다.',
  },
  'FRAUD_HOLD': {
    label: '검토보류',
    class: 'bg-danger-light text-danger',
    color: 'red',
    description: '보안 검토 중입니다. 잠시 기다려주세요.',
  },
  'VERIFIED': {
    label: '검증완료',
    class: 'bg-info-light text-info',
    color: 'blue',
    description: 'PIN이 검증되었습니다. 입금이 진행됩니다.',
  },
  'PAID': {
    label: '입금완료',
    class: 'bg-success-light text-success',
    color: 'green',
    description: '정산금이 입금되었습니다.',
  },
  'REJECTED': {
    label: '거절됨',
    class: 'bg-danger-light text-danger',
    color: 'red',
    description: 'PIN 검증에 실패했습니다.',
  },
};

/**
 * KYC 상태 맵
 */
export const KYC_STATUS_MAP: Record<string, StatusConfig> = {
  'NONE': {
    label: '미인증',
    class: 'bg-light text-muted',
    color: 'elephant',
  },
  'PENDING': {
    label: '인증대기',
    class: 'bg-warning-light text-warning',
    color: 'yellow',
  },
  'VERIFIED': {
    label: '인증완료',
    class: 'bg-success-light text-success',
    color: 'green',
  },
  'REJECTED': {
    label: '인증거절',
    class: 'bg-danger-light text-danger',
    color: 'red',
  },
};

/**
 * 바우처 상태 맵
 */
export const VOUCHER_STATUS_MAP: Record<string, StatusConfig> = {
  'AVAILABLE': {
    label: '사용가능',
    class: 'bg-success-light text-success',
    color: 'green',
  },
  'SOLD': {
    label: '판매완료',
    class: 'bg-primary-light text-primary',
    color: 'blue',
  },
  'USED': {
    label: '사용완료',
    class: 'bg-light text-muted',
    color: 'elephant',
  },
  'EXPIRED': {
    label: '만료',
    class: 'bg-danger-light text-danger',
    color: 'red',
  },
  'RESERVED': {
    label: '예약중',
    class: 'bg-info-light text-info',
    color: 'blue',
  },
  'DISPUTED': {
    label: '분쟁',
    class: 'bg-warning-light text-warning',
    color: 'orange',
  },
};

/**
 * 선물 상태 맵
 *
 * 상태 흐름: SENT → CLAIMED
 *                └→ EXPIRED
 */
export const GIFT_STATUS_MAP: Record<string, StatusConfig> = {
  'SENT': {
    label: '대기중',
    class: 'bg-warning-light text-warning',
    color: 'yellow',
    description: '선물이 발송되었습니다. 수령을 기다리고 있습니다.',
  },
  'CLAIMED': {
    label: '수령완료',
    class: 'bg-success-light text-success',
    color: 'green',
    description: '선물이 수령되었습니다.',
  },
  'EXPIRED': {
    label: '만료',
    class: 'bg-light text-muted',
    color: 'elephant',
    description: '선물이 만료되었습니다.',
  },
};

/**
 * 역할 상태 맵
 */
export const ROLE_STATUS_MAP: Record<string, StatusConfig> = {
  'ADMIN': { label: 'ADMIN', class: 'bg-danger-light text-danger', color: 'red' },
  'PARTNER': { label: 'PARTNER', class: 'bg-primary-light text-primary', color: 'blue' },
  'USER': { label: 'USER', class: 'bg-light text-muted', color: 'elephant' },
};

/**
 * 상태 설정 조회 헬퍼
 *
 * @param status - 상태 코드 (예: 'PENDING', 'PAID')
 * @param type - 상태 타입 ('order' | 'tradein' | 'kyc')
 * @returns 상태 설정 객체 (label, class, color, description)
 *
 * @example
 * const config = getStatusConfig('DELIVERED', 'order');
 * // { label: '발급 완료', class: 'bg-success-light text-success', color: 'green' }
 */
export const getStatusConfig = (
  status: string,
  type: 'order' | 'tradein' | 'kyc' | 'gift' | 'voucher' | 'role'
): StatusConfig => {
  const statusMaps = {
    order: ORDER_STATUS_MAP,
    tradein: TRADEIN_STATUS_MAP,
    kyc: KYC_STATUS_MAP,
    gift: GIFT_STATUS_MAP,
    voucher: VOUCHER_STATUS_MAP,
    role: ROLE_STATUS_MAP,
  };

  return statusMaps[type][status] || { label: status, class: 'bg-light text-muted', color: 'elephant' };
};
