/**
 * @file PaymentTimeline.tsx
 * @description Partner용 결제 시도 이력 타임라인. Admin 버전과 동일한 props 구조지만,
 *              디자인 토큰(partner-badge 클래스)과 스타일만 Partner 테마로 변경.
 *              민감 필드(bankTxId, depositorName)는 서버 응답 단계에서 이미 마스킹됨.
 */
import { PAYMENT_STATUS_MAP } from '../constants';

export interface PaymentItem {
  id: number;
  method: string;
  status: string;
  amount: number | string;
  bankCode?: string | null;
  bankName?: string | null;
  depositorName?: string | null;   // 마스킹된 "홍*"
  bankTxId?: string | null;         // 마스킹된 "PAY_abc1****"
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

const METHOD_LABEL: Record<string, string> = {
  CARD: '카드',
  VIRTUAL_ACCOUNT: '가상계좌',
  BANK_TRANSFER: '계좌이체',
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString('ko-KR') : null;

interface Props {
  items?: PaymentItem[] | null;
}

const PaymentTimeline: React.FC<Props> = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <p style={{ color: 'var(--color-grey-500)', fontSize: '13px', margin: 0 }}>
        결제 시도 내역이 없습니다.
      </p>
    );
  }

  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
      aria-label="결제 시도 이력"
    >
      {items.map((p) => {
        const status = PAYMENT_STATUS_MAP[p.status] || { label: p.status, color: 'gray' };
        return (
          <li
            key={p.id}
            style={{
              borderLeft: '2px solid var(--color-grey-200)',
              paddingLeft: 'var(--space-3)',
              position: 'relative',
              fontSize: '13px',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '-5px',
                top: '4px',
                width: '8px',
                height: '8px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-primary)',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ color: 'var(--color-grey-600)' }}>{fmtDate(p.createdAt)}</span>
              <span style={{ fontWeight: 600 }}>{METHOD_LABEL[p.method] || p.method}</span>
              <span className={`partner-badge ${status.color}`}>{status.label}</span>
            </div>
            <div style={{ color: 'var(--color-grey-700)', marginTop: 'var(--space-1)' }}>
              금액 <strong>{Number(p.amount).toLocaleString()}원</strong>
              {p.bankName && <> · {p.bankName}</>}
              {p.depositorName && <> · 입금자 {p.depositorName}</>}
              {p.bankTxId && <> · 거래ID <code style={{ fontFamily: 'var(--font-family-mono)' }}>{p.bankTxId}</code></>}
              {p.confirmedAt && <> · 확정 {fmtDate(p.confirmedAt)}</>}
              {p.expiresAt && p.status === 'PENDING' && <> · 만료 {fmtDate(p.expiresAt)}</>}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default PaymentTimeline;
