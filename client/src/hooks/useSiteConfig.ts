import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '../lib/axios';
import { STALE_TIMES } from '../constants/cache';
import { extractListData } from './queryHelpers';

interface SiteConfig {
  key: string;
  value: string;
  type: string;
}

/**
 * 서비스의 전역 설정(Site Config) 정보를 조회하는 커스텀 훅입니다.
 * @description
 * 서비스 운영에 필요한 환경 설정값(은행 정보, 공지사항 여부 등)을 '/site-configs'에서 조회합니다.
 * 정적인 설정값 특성을 고려하여 1시간(STALE_TIMES.STATIC)의 캐시 시간을 가집니다.
 * @returns {SiteConfig[]} 설정 키-값 쌍의 목록
 */
export const useSiteConfig = () => {
  return useQuery<SiteConfig[]>({
    queryKey: ['site-config'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/site-configs');
      return extractListData<SiteConfig>(data);
    },
    staleTime: STALE_TIMES.STATIC,
  });
};
