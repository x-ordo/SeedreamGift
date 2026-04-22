import { useQuery } from '@tanstack/react-query';
import { cashReceiptApi } from '../api/manual';
import { STALE_TIMES } from '../constants/cache';
import { extractListData } from './queryHelpers';
import type { CashReceipt } from '../types/mypage';

/**
 * 로그인한 사용자의 현금영수증 내역을 조회하는 커스텀 훅입니다.
 * @description
 * '/cash-receipts/my' 엔드포인트를 호출하며, 발급된 현금영수증 목록을 반환합니다.
 * @param {boolean} [enabled=true] 쿼리 활성화 여부
 * @returns {CashReceipt[]} 사용자의 현금영수증 내역 목록
 */
export const useMyCashReceipts = (enabled = true) => {
  return useQuery<CashReceipt[]>({
    queryKey: ['my-cash-receipts'],
    queryFn: async () => {
      const res = await cashReceiptApi.getMyReceipts();
      return extractListData<CashReceipt>(res.data);
    },
    enabled,
    staleTime: STALE_TIMES.USER_DATA,
  });
};
