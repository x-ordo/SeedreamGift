import { useMutation } from '@tanstack/react-query';
import { paymentsApi } from '../../api';

export interface InitiatePaymentParams {
  orderId: number;
  clientType: 'P' | 'M';
  /**
   * 발급 가능한 은행을 콤마구분으로 제한합니다 (예: "088" 또는 "088,004").
   * undefined / 빈 문자열이면 모든 은행에서 발급 (서버 omitempty 로 키움에 미전송).
   */
  bankCode?: string;
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
      // 자동생성 클라이언트는 swagger.json 스냅샷 기반이라 새 옵션 필드(bankCode)를
      // 모를 수 있어 unknown 캐스팅으로 우회. 서버는 json:"bankCode,omitempty"로
      // 받으므로 빈 문자열/undefined 모두 안전하게 처리됨.
      const body: { orderId: number; clientType: 'P' | 'M'; bankCode?: string } = {
        orderId: params.orderId,
        clientType: params.clientType,
      };
      if (params.bankCode) body.bankCode = params.bankCode;
      const response = await paymentsApi.paymentsInitiatePost({
        body: body as unknown as Parameters<typeof paymentsApi.paymentsInitiatePost>[0]['body'],
      });
      return response.data as unknown as InitiatePaymentResult;
    },
  });
};
