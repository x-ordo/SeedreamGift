import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../api';
import type { CreateOrderResponse } from '../../types';


interface CreateOrderParams {
  items: { productId: number; quantity: number }[];
  paymentMethod: string;
  giftReceiverEmail?: string;
  giftMessage?: string;
  idempotencyKey?: string;
  shippingMethod?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddr?: string;
  recipientZip?: string;
  cashReceiptType?: string;
  cashReceiptNumber?: string;
}

/** 주문 생성 mutation */
export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation<CreateOrderResponse, Error, CreateOrderParams>({
    mutationFn: async (params) => {
      const response = await ordersApi.ordersPost({
        body: {
          items: params.items,
          paymentMethod: params.paymentMethod,
          giftReceiverEmail: params.giftReceiverEmail,
          giftMessage: params.giftMessage,
          idempotencyKey: params.idempotencyKey,
          shippingMethod: params.shippingMethod,
          recipientName: params.recipientName,
          recipientPhone: params.recipientPhone,
          recipientAddr: params.recipientAddr,
          recipientZip: params.recipientZip,
          cashReceiptType: params.cashReceiptType,
          cashReceiptNumber: params.cashReceiptNumber,
        } as any,
      });
      return response.data as unknown as CreateOrderResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-gifts'] });
    },
  });
};
