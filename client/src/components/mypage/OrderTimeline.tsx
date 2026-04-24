import React, { useState } from 'react';
import { useOrderTimeline, type OrderTimelineEvent } from '../../hooks';
import { getRelativeTime } from '../../utils/dateUtils';
import styles from './OrderTimeline.module.css';

interface Props {
  orderId: number;
  /** 초기 펼침 여부. default false — 유저 클릭으로 로드. */
  defaultOpen?: boolean;
}

interface EventMeta {
  label: string;
  tone: 'default' | 'success' | 'error' | 'warning';
}

/**
 * 서버의 raw eventType 을 유저 친숙 라벨 + 톤(점 색상) 으로 매핑합니다.
 * 알 수 없는 eventType 은 그대로 노출 (fallback).
 */
function describeEvent(eventType: string): EventMeta {
  switch (eventType) {
    case 'VACCOUNT_ISSUED':
      return { label: '가상계좌 발급 완료', tone: 'default' };
    case 'PAYMENT_CONFIRMED':
      return { label: '입금 확인 완료', tone: 'success' };
    case 'PAYMENT_CANCELED':
      return { label: '결제 취소됨 (가맹점 요청)', tone: 'warning' };
    case 'PAYMENT_CANCELLED_EXTERNAL':
      return { label: '자동 취소됨 (은행/PG)', tone: 'warning' };
    case 'REFUND_REQUESTED':
      return { label: '환불 접수됨', tone: 'warning' };
    case 'REFUND_DEPOSIT_CONFIRMED':
      return { label: '환불 완료 (입금 확인)', tone: 'success' };
    case 'ORDER_CREATED':
      return { label: '주문 생성', tone: 'default' };
    case 'STATUS_CHANGED':
      return { label: '상태 변경', tone: 'default' };
    case 'VOUCHER_REDEEMED':
      return { label: '상품권 사용됨', tone: 'success' };
    case 'VOUCHER_REFUNDED':
      return { label: '상품권 환불됨', tone: 'warning' };
    default:
      return { label: eventType, tone: 'default' };
  }
}

/** 이벤트 payload 중 유저 친화 텍스트로 요약. null 이면 아무것도 표시 안 함. */
function summarizePayload(e: OrderTimelineEvent): string | null {
  if (!e.payload) return null;
  const parts: string[] = [];
  const p = e.payload;
  if (typeof p.amount === 'number') parts.push(`${Number(p.amount).toLocaleString()}원`);
  if (typeof p.amountApplied === 'number') parts.push(`${Number(p.amountApplied).toLocaleString()}원 사용`);
  if (typeof p.vouchersSold === 'number' && p.vouchersSold > 0) {
    parts.push(`바우처 ${p.vouchersSold}장`);
  }
  if (typeof p.serialNo === 'string') parts.push(`바우처 ${p.serialNo}`);
  if (typeof p.bankCode === 'string') parts.push(`은행 ${p.bankCode}`);
  if (typeof p.reason === 'string' && p.reason.length > 0) parts.push(`사유: ${p.reason}`);
  if (typeof p.daouTrx === 'string') parts.push(`거래번호 ${p.daouTrx}`);
  if (typeof p.refundDaouTrx === 'string') parts.push(`환불 거래번호 ${p.refundDaouTrx}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function dotClass(tone: EventMeta['tone']): string {
  switch (tone) {
    case 'success':
      return `${styles.dot} ${styles.dotSuccess}`;
    case 'error':
      return `${styles.dot} ${styles.dotError}`;
    case 'warning':
      return `${styles.dot} ${styles.dotWarning}`;
    default:
      return styles.dot;
  }
}

/**
 * 주문의 결제 진행 타임라인 (접었다 펴는 형태).
 *
 * 기본 접힘 상태에서는 API 호출하지 않음 (enabled=false) — 유저가 열었을 때만
 * 로드해 네트워크 비용 최소화. 열어본 적 있으면 staleTime 동안 캐시.
 */
const OrderTimeline: React.FC<Props> = ({ orderId, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const { data, isLoading, error } = useOrderTimeline(orderId, open);

  return (
    <div className={styles.wrapper}>
      <div className={styles.heading}>
        <span>결제 진행 이력</span>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? '접기' : '펼쳐 보기'}
        </button>
      </div>

      {!open && null}
      {open && isLoading && (
        <p className={styles.loadingText} role="status">이력 불러오는 중...</p>
      )}
      {open && error && (
        <p className={styles.errorText} role="alert">이력을 불러올 수 없어요</p>
      )}
      {open && data && data.length === 0 && (
        <p className={styles.emptyText}>아직 기록된 이력이 없어요</p>
      )}
      {open && data && data.length > 0 && (
        <ul className={styles.list}>
          {data.map((e) => {
            const meta = describeEvent(e.eventType);
            const summary = summarizePayload(e);
            return (
              <li key={e.id} className={styles.item}>
                <span className={dotClass(meta.tone)} aria-hidden="true" />
                <span className={styles.label}>{meta.label}</span>
                <time className={styles.time} dateTime={e.createdAt}>
                  {getRelativeTime(e.createdAt)}
                </time>
                {summary && <div className={styles.meta}>{summary}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default OrderTimeline;
