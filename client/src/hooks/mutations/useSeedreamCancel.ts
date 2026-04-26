/**
 * @file useSeedreamCancel.ts
 * @description 가상계좌 결제 취소/환불 통합 mutation
 *
 * POST /api/v1/payment/seedream/cancel
 *  - payMethod="VACCOUNT-ISSUECAN" : 입금 전 발급 취소 (ISSUED 상태)
 *  - payMethod="BANK"              : 입금 후 환불 (PAID/DELIVERED 상태)
 *
 * 백엔드 검증(seedream_cancel_handler.go:59-67):
 *  - cancelReason: required, 5~50 rune
 *  - BANK 인 경우 bankCode + accountNo 필수
 *
 * API_GUIDE.md §17 환불 / §15.6 입금전취소 참조.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '../../lib/axios';

export type SeedreamCancelPayMethod = 'VACCOUNT-ISSUECAN' | 'BANK';

export interface SeedreamCancelParams {
  orderCode: string;
  payMethod: SeedreamCancelPayMethod;
  cancelReason: string;
  /** BANK 결제수단 환불 시 필수. 키움 화이트리스트 3자리 은행 코드. */
  bankCode?: string;
  /** BANK 결제수단 환불 시 필수. 환불 받을 계좌번호. */
  accountNo?: string;
}

export interface SeedreamCancelResult {
  success: boolean;
  /** 이미 취소 완료된 건이라 멱등 처리됐을 때 true. UI 는 "이미 취소 완료" 메시지로. */
  alreadyDone?: boolean;
  message?: string;
  data?: unknown; // 키움 원본 응답 — UI 에서는 거의 사용 안 함
}

/**
 * Seedream VA 취소/환불 mutation. 성공 시 my-orders 쿼리를 invalidate 해
 * 주문 목록의 상태 라벨이 즉시 갱신되도록 합니다.
 *
 * 주의: 백엔드는 즉시 응답하지만 실제 상태 전이는 webhook (vaccount.payment_canceled,
 * vaccount.deposit_canceled) 이 와야 일어납니다. 따라서 invalidate 후 잠시 후
 * 자동 재조회되어 라벨이 업데이트됨.
 */
export const useSeedreamCancel = () => {
  const queryClient = useQueryClient();

  return useMutation<SeedreamCancelResult, Error, SeedreamCancelParams>({
    mutationFn: async (params) => {
      const body: Record<string, string> = {
        orderCode: params.orderCode,
        payMethod: params.payMethod,
        cancelReason: params.cancelReason,
      };
      if (params.payMethod === 'BANK') {
        if (params.bankCode) body.bankCode = params.bankCode;
        if (params.accountNo) body.accountNo = params.accountNo;
      }
      const res = await axiosInstance.post('/payment/seedream/cancel', body);
      return res.data as SeedreamCancelResult;
    },
    onSuccess: () => {
      // 주문 목록 + 개별 주문 상세 모두 무효화
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
    },
  });
};
