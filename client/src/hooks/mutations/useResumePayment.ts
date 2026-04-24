import { useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '../../lib/axios';
import type { InitiatePaymentParams, InitiatePaymentResult } from './useInitiatePayment';

/**
 * POST /api/v1/payments/resume
 *
 * VA TOKEN 은 1회용이므로 "재시도" = 기존 PENDING Payment 취소 + 새 VA 발급.
 * 성공 시 useInitiatePayment 와 동일한 IssueResult 반환 → /checkout/redirect
 * 로 auto-submit.
 *
 * 성공 후 payment-status 쿼리 무효화 — MyPage 에서 새 계좌/기한을 즉시 반영.
 */
export const useResumePayment = () => {
  const queryClient = useQueryClient();
  return useMutation<InitiatePaymentResult, Error, InitiatePaymentParams>({
    mutationFn: async (params) => {
      const response = await axiosInstance.post('/payments/resume', {
        orderId: params.orderId,
        clientType: params.clientType,
      });
      const payload = response.data?.data ?? response.data;
      return payload as InitiatePaymentResult;
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: ['payment-status', params.orderId] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    },
  });
};
