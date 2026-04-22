import { useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '../../lib/axios';

interface CreateTradeInParams {
  productId: number;
  pinCode: string;
  bankName: string;
  accountNum: string;
  accountHolder: string;
}

interface TradeInResponse {
  id: number;
  status: string;
  payoutAmount: number;
}

/** 매입 신청 mutation */
export const useCreateTradeIn = () => {
  const queryClient = useQueryClient();

  return useMutation<TradeInResponse, Error, CreateTradeInParams>({
    mutationFn: async (params) => {
      const { data } = await axiosInstance.post('/trade-ins', params);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tradeins'] });
    },
  });
};
