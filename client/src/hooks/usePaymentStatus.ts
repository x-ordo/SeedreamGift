import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '../lib/axios';

/**
 * 백엔드 PaymentStatusResponse (services.PaymentStatusResponse) 에 대응.
 * swagger regenerate 전까지 수동 타입 유지.
 */
export type PaymentUIStatus =
  | 'AWAITING_BANK_SELECTION'
  | 'AWAITING_DEPOSIT'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'FAILED'
  | 'AMOUNT_MISMATCH'
  | 'UNKNOWN';

export interface PaymentStatus {
  orderId: number;
  orderCode: string;
  orderStatus: string;
  totalAmount: number;
  method: string;
  paymentStatus: string;
  seedreamPhase?: string | null;
  bankCode?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  depositorName?: string | null;
  expiresAt?: string | null;
  uiStatus: PaymentUIStatus;
  canResume: boolean;
}

/**
 * GET /api/v1/orders/:id/payment-status
 *
 * 유저 본인의 주문에 대한 결제/입금 대기 UI 구성 정보를 조회.
 * PENDING/ISSUED 주문의 입금 계좌 + 기한 + 재시도 가능 여부를 반환.
 *
 * enabled=false 로 두면 조건부 조회 (예: 주문 상태가 PENDING 일 때만).
 */
export const usePaymentStatus = (orderId: number | null | undefined, enabled = true) => {
  return useQuery<PaymentStatus>({
    queryKey: ['payment-status', orderId],
    queryFn: async () => {
      const response = await axiosInstance.get(`/orders/${orderId}/payment-status`);
      // Standard envelope: { success, data }
      const payload = response.data?.data ?? response.data;
      return payload as PaymentStatus;
    },
    enabled: enabled && !!orderId,
    // 입금 대기 중이면 1분마다 재조회 — 백엔드 상태 전이를 자동 반영.
    // PAID 로 전환되면 정지 (refetchInterval 콜백에서 데이터 확인).
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      if (data.uiStatus === 'AWAITING_BANK_SELECTION' || data.uiStatus === 'AWAITING_DEPOSIT') {
        return 60_000;
      }
      return false;
    },
  });
};
