import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '../lib/axios';
import type { TradeIn } from '../types';
import { STALE_TIMES } from '../constants/cache';
import { extractListData } from './queryHelpers';

/**
 * 로그인한 사용자가 신청한 상품 매입(내놓기) 내역을 조회하는 커스텀 훅입니다.
 * @description
 * '/trade-ins/my' 엔드포인트를 통해 신청된 매입 건들의 상태와 금액 정보를 가져옵니다.
 * 사용자의 자산과 관련된 정보이므로 캐시를 활용하여 일관된 정보를 제공합니다.
 * @param {boolean} [enabled=true] 쿼리 활성화 여부
 * @returns {TradeIn[]} 매입 신청 내역 목록
 */
export const useMyTradeIns = (enabled = true) => {
  return useQuery<TradeIn[]>({
    queryKey: ['my-tradeins'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/trade-ins/my');
      return extractListData<TradeIn>(data);
    },
    enabled,
    staleTime: STALE_TIMES.USER_DATA,
  });
};
