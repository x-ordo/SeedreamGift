/**
 * @file PaymentTimeline.tsx
 * @description 주문 상세 모달에 삽입하는 결제 시도 이력 타임라인.
 *              Admin은 원본 필드를 그대로 받아 렌더. 동일한 컴포넌트 구조를 Partner에도 복제함.
 */
import { Badge } from '../../../design-system';
import { formatPrice } from '../../../utils';
import { PAYMENT_STATUS_COLOR_MAP, PAYMENT_STATUS_OPTIONS } from '../constants';

export interface PaymentItem {
  id: number;
  method: string;
  status: string;
  amount: number | string;
  bankCode?: string | null;
  bankName?: string | null;
  depositorName?: string | null;
  bankTxId?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  expiresAt?: string | null;
  failReason?: string | null;
  createdAt: string;
}

const METHOD_LABEL: Record<string, string> = {
  CARD: '카드',
  VIRTUAL_ACCOUNT: '가상계좌',
  BANK_TRANSFER: '계좌이체',
};

const statusLabel = (status: string) =>
  PAYMENT_STATUS_OPTIONS.find(o => o.value === status)?.label || status;

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString('ko-KR') : null;

interface Props {
  items?: PaymentItem[] | null;
}

const PaymentTimeline: React.FC<Props> = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <p style={{ color: 'var(--color-grey-500)', fontSize: 'var(--text-caption)', margin: 0 }}>
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
        gap: 'var(--space-3)',
      }}
      aria-label="결제 시도 이력"
    >
      {items.map((p) => (
        <li
          key={p.id}
          style={{
            borderLeft: '2px solid var(--color-grey-200)',
            paddingLeft: 'var(--space-3)',
            position: 'relative',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-caption)' }}>
            <span style={{ color: 'var(--color-grey-600)' }}>{fmtDate(p.createdAt)}</span>
            <span style={{ fontWeight: 600 }}>{METHOD_LABEL[p.method] || p.method}</span>
            <Badge color={PAYMENT_STATUS_COLOR_MAP.get(p.status) as any || 'elephant'} variant="weak" size="xsmall">
              {statusLabel(p.status)}
            </Badge>
          </div>
          <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-caption)', color: 'var(--color-grey-700)' }}>
            금액 <strong>{formatPrice(Number(p.amount))}</strong>
            {p.bankName && <> · {p.bankName}</>}
            {p.depositorName && <> · 입금자 {p.depositorName}</>}
            {p.bankTxId && <> · 거래ID <code style={{ fontFamily: 'var(--font-mono, monospace)' }}>{p.bankTxId}</code></>}
            {p.confirmedAt && <> · 확정 {fmtDate(p.confirmedAt)}</>}
            {p.expiresAt && p.status === 'PENDING' && <> · 만료 {fmtDate(p.expiresAt)}</>}
            {p.failReason && (
              <div style={{ color: 'var(--color-error)', marginTop: 'var(--space-1)' }}>
                실패 사유: {p.failReason}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

export default PaymentTimeline;
