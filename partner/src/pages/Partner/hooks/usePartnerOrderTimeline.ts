import { useEffect, useState } from 'react';
import { axiosInstance } from '../../../lib/axios';

/** 서버 services.OrderTimelineEvent 와 1:1. */
export interface PartnerOrderTimelineEvent {
  id: number;
  eventType: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * 파트너 본인 주문의 timeline 조회.
 *
 * 서버 /orders/:id/timeline 은 role 무관하게 `WHERE UserId = ?` 로 권한을
 * 강제하므로 (ADMIN 제외) 파트너 UserID 로 본인 판매분만 조회됨.
 * orderId 가 null 이면 아무 요청도 보내지 않고 빈 배열 유지.
 */
export function usePartnerOrderTimeline(orderId: number | null) {
  const [events, setEvents] = useState<PartnerOrderTimelineEvent[]>([]);
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
        setEvents(Array.isArray(raw) ? (raw as PartnerOrderTimelineEvent[]) : []);
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

/** eventType → 파트너 관점 한국어 라벨. */
export function partnerEventLabel(eventType: string): string {
  switch (eventType) {
    case 'VACCOUNT_ISSUED':
      return '가상계좌 발급';
    case 'PAYMENT_CONFIRMED':
      return '입금 확인 완료';
    case 'PAYMENT_CANCELED':
      return '결제 취소 (본사 요청)';
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

/** 파트너 요약 — 운영 식별자(DaouTrx) 포함, 다만 actorType 은 생략. */
export function partnerEventSummary(e: PartnerOrderTimelineEvent): string | null {
  if (!e.payload) return null;
  const parts: string[] = [];
  const p = e.payload;
  if (typeof p.amount === 'number') parts.push(`${Number(p.amount).toLocaleString()}원`);
  if (typeof p.amountApplied === 'number') parts.push(`사용 ${Number(p.amountApplied).toLocaleString()}원`);
  if (typeof p.vouchersSold === 'number' && p.vouchersSold > 0) parts.push(`바우처 ${p.vouchersSold}장`);
  if (typeof p.bankCode === 'string') parts.push(`은행 ${p.bankCode}`);
  if (typeof p.reason === 'string' && p.reason.length > 0) parts.push(`사유: ${p.reason}`);
  if (typeof p.serialNo === 'string') parts.push(`SerialNo ${p.serialNo}`);
  if (typeof p.daouTrx === 'string') parts.push(`DaouTrx ${p.daouTrx}`);
  if (typeof p.refundDaouTrx === 'string') parts.push(`RefundTrx ${p.refundDaouTrx}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}
