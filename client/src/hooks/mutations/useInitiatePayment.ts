import { useMutation } from '@tanstack/react-query';
import { paymentsApi } from '../../api';

export interface InitiatePaymentParams {
  orderId: number;
  clientType: 'P' | 'M';
}

/**
 * Seedream 발급 응답. 서버 `IssueResult` 와 1:1 매핑.
 *
 * ★ 보안(설계 D5):
 *  - `formData.TOKEN` 은 1회용 세션 토큰. localStorage / sessionStorage / URL
 *    query 저장 금지. `<form>` hidden input 으로만 사용하고 submit 즉시 파기.
 */
export interface InitiatePaymentResult {
  seedreamVAccountId: number;
  targetUrl: string;
  formData: Record<string, string>;
  depositEndDateAt: string;
  orderCode: string;
}

/**
 * Seedream LINK 모드 VA 발급 mutation. 성공 시 브라우저를 키움페이 은행선택
 * 창으로 auto-submit 하기 위한 `targetUrl` + `formData` 를 반환합니다.
 */
export const useInitiatePayment = () => {
  return useMutation<InitiatePaymentResult, Error, InitiatePaymentParams>({
    mutationFn: async (params) => {
      const response = await paymentsApi.paymentsInitiatePost({
        body: { orderId: params.orderId, clientType: params.clientType },
      });
      return response.data as unknown as InitiatePaymentResult;
    },
  });
};
