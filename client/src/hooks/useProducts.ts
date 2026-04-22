import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '../lib/axios';
import type { Product } from '../types';
import { STALE_TIMES } from '../constants/cache';
import { extractListData } from './queryHelpers';

interface UseProductsOptions {
  enabled?: boolean;
}

/**
 * 서비스에서 판매 중인 전체 상품 목록을 조회하는 커스텀 훅입니다.
 * @description
 * '/products' 엔드포인트를 호출하며, 상품 목록은 자주 변경되지 않으므로
 * 10분(STALE_TIMES.PRODUCTS)의 긴 캐시 시간을 적용하여 서버 부하를 줄이고 성능을 최적화합니다.
 * @param {UseProductsOptions} [options] 쿼리 옵션 (활성화 여부 등)
 * @returns {Product[]} 판매 중인 상품 목록
 */
export const useProducts = (options?: UseProductsOptions) => {
  return useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/products');
      return extractListData<Product>(data);
    },
    staleTime: STALE_TIMES.PRODUCTS,
    enabled: options?.enabled,
  });
};
