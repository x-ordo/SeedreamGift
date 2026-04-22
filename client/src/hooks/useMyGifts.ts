import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '../lib/axios';
import { extractListData } from './queryHelpers';
import type { MyGift } from '../types';
import { STALE_TIMES } from '../constants/cache';

/**
 * 로그인한 사용자가 수령한 선물 목록을 조회하는 커스텀 훅입니다.
 * @description
 * React Query를 통해 '/orders/my-gifts'에서 데이터를 가져오며,
 * 개인 데이터이므로 USER_DATA 수준의 캐시 정책을 적용합니다.
 * @param {boolean} [enabled=true] 쿼리 활성화 여부 (인증된 상태에서만 호출 가능)
 * @returns {MyGift[]} 수령한 선물 상세 목록
 */
export const useMyGifts = (enabled = true) => {
  return useQuery<MyGift[]>({
    queryKey: ['my-gifts'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/orders/my-gifts');
      return extractListData<MyGift>(data);
    },
    enabled,
    staleTime: STALE_TIMES.USER_DATA,
  });
};
