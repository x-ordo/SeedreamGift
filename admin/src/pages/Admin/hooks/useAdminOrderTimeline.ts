import { useEffect, useState } from 'react';
import { axiosInstance } from '../../../lib/axios';

/** 서버 services.OrderTimelineEvent 와 1:1 매핑. */
export interface AdminOrderTimelineEvent {
  id: number;
  eventType: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Admin 전용 주문 타임라인 조회.
 *
 * admin 은 React Query 를 일부만 사용하고 detail modal 은 ad-hoc fetch 패턴을
 * 쓰므로 (OrdersTab.tsx:132) 여기도 동일한 useEffect 기반. orderId 가 null 이면
 * 아무 요청도 보내지 않고 빈 배열 유지.
 */
export function useAdminOrderTimeline(orderId: number | null) {
  const [events, setEvents] = useState<AdminOrderTimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setEvents([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    axiosInstance
      .get(`/orders/${orderId}/timeline`)
      .then((resp) => {
        if (cancelled) return;
        const raw = resp.data?.data ?? resp.data;
        setEvents(Array.isArray(raw) ? (raw as AdminOrderTimelineEvent[]) : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '이력을 불러올 수 없어요');
        setEvents([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return { events, loading, error };
}

/**
 * eventType → 한국어 라벨. Admin 뷰는 추가로 내부 식별자(DaouTrx 등) 도 관심 있음.
 * 클라이언트 `OrderTimeline.describeEvent` 와 동일 매핑 유지.
 */
export function adminEventLabel(eventType: string): string {
  switch (eventType) {
    case 'VACCOUNT_ISSUED':
      return '가상계좌 발급';
    case 'PAYMENT_CONFIRMED':
      return '입금 확인';
    case 'PAYMENT_CANCELED':
      return '결제 취소 (가맹점 요청)';
    case 'PAYMENT_CANCELLED_EXTERNAL':
      return '자동 취소 (은행/PG)';
    case 'REFUND_REQUESTED':
      return '환불 접수';
    case 'REFUND_DEPOSIT_CONFIRMED':
      return '환불 완료';
    case 'VOUCHER_REDEEMED':
      return '상품권 사용';
    case 'VOUCHER_REFUNDED':
      return '상품권 환불';
    case 'ORDER_CREATED':
      return '주문 생성';
    case 'STATUS_CHANGED':
      return '상태 변경';
    default:
      return eventType;
  }
}

/**
 * payload → admin 전용 요약 (DaouTrx 등 운영 식별자까지 노출).
 * 서버 allow-list 가 이미 민감 필드는 걸러내므로 여기서는 순수 포맷만 담당.
 */
export function adminEventSummary(e: AdminOrderTimelineEvent): string | null {
  if (!e.payload) return null;
  const parts: string[] = [];
  const p = e.payload;
  if (typeof p.amount === 'number') parts.push(`${Number(p.amount).toLocaleString()}원`);
  if (typeof p.amountApplied === 'number') parts.push(`사용 ${Number(p.amountApplied).toLocaleString()}원`);
  if (typeof p.vouchersSold === 'number' && p.vouchersSold > 0) parts.push(`바우처 ${p.vouchersSold}장`);
  if (typeof p.bankCode === 'string') parts.push(`은행 ${p.bankCode}`);
  if (typeof p.reason === 'string' && p.reason.length > 0) parts.push(`사유: ${p.reason}`);
  if (typeof p.source === 'string') parts.push(`요청자: ${p.source}`);
  if (typeof p.actorType === 'string') parts.push(`주체: ${p.actorType}`);
  if (typeof p.serialNo === 'string') parts.push(`SerialNo ${p.serialNo}`);
  if (typeof p.daouTrx === 'string') parts.push(`DaouTrx ${p.daouTrx}`);
  if (typeof p.refundDaouTrx === 'string') parts.push(`RefundTrx ${p.refundDaouTrx}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}
