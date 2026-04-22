import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '../lib/axios';
import { PAYMENT_BANK_INFO } from '../constants';
import { STALE_TIMES } from '../constants/cache';

/**
 * 입금 계좌 정보를 관리하는 커스텀 훅입니다.
 * @description
 * SiteConfig API를 통해 관리자가 설정한 은행명, 계좌번호, 예금주 정보를 가져옵니다.
 * '/site-configs/:key' 엔드포인트는 Public이므로 인증 없이 호출 가능하며,
 * API 호출 실패 시 'PAYMENT_BANK_INFO' 상수를 기본값(fallback)으로 사용합니다.
 */
export const useBankInfo = () => {
  const bankNameQuery = useQuery({
    queryKey: ['site-config', 'PAYMENT_BANK_NAME'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/site-configs/PAYMENT_BANK_NAME');
      return data?.value ?? data?.data?.value ?? null;
    },
    staleTime: STALE_TIMES.STATIC,
  });

  const accountQuery = useQuery({
    queryKey: ['site-config', 'PAYMENT_BANK_ACCOUNT'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/site-configs/PAYMENT_BANK_ACCOUNT');
      return data?.value ?? data?.data?.value ?? null;
    },
    staleTime: STALE_TIMES.STATIC,
  });

  const holderQuery = useQuery({
    queryKey: ['site-config', 'PAYMENT_BANK_HOLDER'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/site-configs/PAYMENT_BANK_HOLDER');
      return data?.value ?? data?.data?.value ?? null;
    },
    staleTime: STALE_TIMES.STATIC,
  });

  const isLoading = bankNameQuery.isLoading || accountQuery.isLoading || holderQuery.isLoading;

  return {
    bankName: bankNameQuery.data ?? PAYMENT_BANK_INFO.bankName,
    accountNumber: accountQuery.data ?? PAYMENT_BANK_INFO.accountNumber,
    accountHolder: holderQuery.data ?? PAYMENT_BANK_INFO.accountHolder,
    isLoading,
  };
};
