import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '../lib/axios';
import type { Product } from '../types';
import { STALE_TIMES } from '../constants/cache';

/**
 * 특정 상품의 상세 정보를 조회하는 커스텀 훅입니다.
 * @description
 * 상품 ID를 기반으로 '/products/:id' 엔드포인트에서 데이터를 가져옵니다.
 * ID가 존재할 때만 쿼리가 활성화(enabled)되도록 설정되어 있으며, 상세 페이지의 빠른 응답을 위해 캐시를 사용합니다.
 * @param {number | undefined} id 조회할 상품의 고유 ID
 * @returns {Product} 상품 상세 데이터 (이름, 이미지, 가격 등)
 */
export const useProduct = (id: number | undefined) => {
  return useQuery<Product>({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/products/${id}`);
      return data;
    },
    enabled: !!id,
    staleTime: STALE_TIMES.DETAIL,
  });
};
