import { useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '../../lib/axios';

/** 주문 취소 mutation (PENDING 상태만) */
export const useCancelOrder = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (orderId: number) => {
      await axiosInstance.post(`/orders/${orderId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    },
  });
};
