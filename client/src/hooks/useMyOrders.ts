import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '../lib/axios';
import type { Order } from '../types';
import { STALE_TIMES } from '../constants/cache';
import { extractListData } from './queryHelpers';

/**
 * 로그인한 사용자의 전체 주문 내역을 조회하는 커스텀 훅입니다.
 * @description
 * '/orders/my' 엔드포인트를 호출하며, 주문 상태 및 결제 정보를 포함한 데이터를 반환합니다.
 * React Query의 staleTime을 활용하여 불필요한 중복 요청을 방지합니다.
 * @param {boolean} [enabled=true] 쿼리 활성화 여부
 * @returns {Order[]} 사용자의 주문 내역 목록
 */
export const useMyOrders = (enabled = true) => {
  return useQuery<Order[]>({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/orders/my');
      return extractListData<Order>(data);
    },
    enabled,
    staleTime: STALE_TIMES.USER_DATA,
  });
};
