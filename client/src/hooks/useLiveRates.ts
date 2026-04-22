import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '../lib/axios';
import { STALE_TIMES } from '../constants/cache';

interface ProductRate {
  id: number;
  name: string;
  brandCode: string;
  price: number;
  buyPrice: number;
  discountRate: number;
  tradeInPrice: number;
  tradeInRate: number;
}

/**
 * 실시간 상품 시세 정보를 조회하는 커스텀 훅입니다.
 * @description
 * React Query를 사용하여 '/products/live-rates' 엔드포인트에서 데이터를 가져오며,
 * 시세 데이터의 특성상 빈번한 요청을 방지하기 위해 1분(STALE_TIMES.REALTIME)의 캐시 시간을 가집니다.
 * @returns {ProductRate[]} 상품별 시세(판매가, 매입가, 할인율 등) 목록
 */
export function useLiveRates() {
  return useQuery<ProductRate[]>({
    queryKey: ['liveRates'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/products/live-rates');
      if (Array.isArray(data)) return data;
      return data?.rates ?? [];
    },
    staleTime: STALE_TIMES.REALTIME,
    refetchInterval: 60 * 1000, // 1분마다 자동 갱신
    refetchIntervalInBackground: false, // 백그라운드 탭에서는 갱신 안 함
  });
}
