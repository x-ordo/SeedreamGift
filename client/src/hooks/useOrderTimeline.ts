import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '../lib/axios';

/**
 * GET /api/v1/orders/:id/timeline 응답 엔트리.
 * 서버 `OrderTimelineEvent` (services.OrderTimelineEvent) 와 1:1.
 */
export interface OrderTimelineEvent {
  id: number;
  eventType: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * 유저 본인 주문의 이벤트 이력 (시간순 과거→현재) 을 조회합니다.
 * 서버가 payload 를 allow-list 로 필터링해 민감 필드는 이미 제거된 상태.
 *
 * enabled=false 로 두면 조건부 조회 (예: 주문 상세 펼침 시에만 로드).
 */
export const useOrderTimeline = (orderId: number | null | undefined, enabled = true) => {
  return useQuery<OrderTimelineEvent[]>({
    queryKey: ['order-timeline', orderId],
    queryFn: async () => {
      const response = await axiosInstance.get(`/orders/${orderId}/timeline`);
      const payload = response.data?.data ?? response.data;
      if (Array.isArray(payload)) return payload as OrderTimelineEvent[];
      return [];
    },
    enabled: enabled && !!orderId,
    // 이벤트 기록이 상태 전이와 동시에 일어나므로 payment-status 와 동일 주기 폴링.
    // 주문이 활성(PENDING/ISSUED) 일 때는 상위 컴포넌트가 enabled 로 on/off 제어.
    staleTime: 30_000,
  });
};
