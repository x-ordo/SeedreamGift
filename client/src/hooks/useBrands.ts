/**
 * @file useBrands.ts
 * @description 브랜드 데이터 조회 훅 - React Query 기반 서버 상태 관리
 * @module hooks
 *
 * 주요 기능:
 * - 브랜드 목록 API 조회
 * - 1시간 캐시 (staleTime)
 * - 자동 재검증 및 에러 핸들링
 *
 * 사용 예시:
 * ```tsx
 * const { data: brands, isLoading, error } = useBrands();
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage />;
 *
 * return brands.map(brand => <BrandCard key={brand.id} brand={brand} />);
 * ```
 */
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '../lib/axios';
import { Brand } from '../types';
import { STALE_TIMES } from '../constants/cache';
import { extractListData } from './queryHelpers';

/**
 * 브랜드 목록 조회 훅
 *
 * @returns React Query 결과 객체 (data, isLoading, error, refetch 등)
 *
 * @example
 * const { data: brands = [], isLoading } = useBrands();
 */
export const useBrands = () => {
  return useQuery<Brand[]>({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/brands');
      return extractListData<Brand>(data);
    },
    staleTime: STALE_TIMES.STATIC,
  });
};
