/**
 * @file PaymentsTab.tsx
 * @description Partner 결제현황 — 내 상품 주문의 결제 상태만 조회.
 *              민감 필드(고객명·실패사유)는 서버 응답 단계에서 이미 null 처리됨.
 */
import { useState, useMemo, useEffect } from 'react';
import { partnerApi } from '@/api/manual';
import { usePartnerList } from '../hooks/usePartnerList';
import { PAYMENT_STATUS_MAP, PARTNER_PAGINATION } from '../constants';

interface PaymentRow {
  paymentId: number;
  orderId: number;
  orderCode?: string | null;
  method: string;
  status: string;
  amount: number;
  confirmedAt?: string | null;
  createdAt: string;
}

interface PaymentSummary {
  totalCount: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
}

const METHOD_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'CARD', label: '카드' },
  { value: 'VIRTUAL_ACCOUNT', label: '가상계좌' },
  { value: 'BANK_TRANSFER', label: '계좌이체' },
];

const last30Days = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

const PaymentsTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [from, setFrom] = useState<string>(last30Days());
  const [to, setTo] = useState<string>(today());
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<PaymentSummary | null>(null);

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
    method: methodFilter || undefined,
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
  }), [statusFilter, methodFilter, from, to, search]);

  // Go 백엔드는 `{ items, total, summary }` flat 구조를 반환하지만
  // usePartnerList는 `{ items, meta: { total } }`를 기대하므로 래핑.
  const { items, loading, page, total, setPage } = usePartnerList<PaymentRow>(
    async (params) => {
      const resp = await partnerApi.getMyPayments(params);
      return { items: resp.items, meta: { total: resp.total } };
    },
    { filters, errorMessage: '결제현황을 불러오는데 실패했습니다.' },
  );

  // Summary는 status 필터 미적용 기준 — 별도 호출로 수집
  useEffect(() => {
    const loadSummary = async () => {
      try {
        const resp = await partnerApi.getMyPayments({
          ...filters,
          status: undefined,
          page: 1,
          pageSize: 1,
        });
        setSummary(resp.summary ?? null);
      } catch {
        setSummary(null);
      }
    };
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, methodFilter, search]);

  const totalPages = Math.ceil(total / PARTNER_PAGINATION.DEFAULT_PAGE_SIZE);

  return (
    <div className="partner-tab">
      {/* Summary Cards */}
      {summary && (
        <div className="partner-stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="partner-stat-card">
            <span className="partner-stat-label">총 결제</span>
            <span className="partner-stat-value tabular-nums">{summary.totalCount}건</span>
          </div>
          <div className="partner-stat-card">
            <span className="partner-stat-label">성공</span>
            <span className="partner-stat-value success tabular-nums">{summary.successCount}건</span>
          </div>
          <div className="partner-stat-card">
            <span className="partner-stat-label">실패</span>
            <span className="partner-stat-value tabular-nums" style={{ color: 'var(--color-error)' }}>{summary.failedCount}건</span>
          </div>
          <div className="partner-stat-card">
            <span className="partner-stat-label">대기</span>
            <span className="partner-stat-value tabular-nums" style={{ color: 'var(--color-warning)' }}>{summary.pendingCount}건</span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="partner-filter-card">
        <input
          type="date"
          className="partner-filter-select"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          max={to || undefined}
          aria-label="시작일"
        />
        <span style={{ color: 'var(--color-grey-400)' }}>~</span>
        <input
          type="date"
          className="partner-filter-select"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          min={from || undefined}
          max={today()}
          aria-label="종료일"
        />
        <select
          className="partner-filter-select"
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          aria-label="결제 수단 필터"
        >
          {METHOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="partner-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="결제 상태 필터"
        >
          <option value="">전체 상태</option>
          {Object.entries(PAYMENT_STATUS_MAP).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          type="search"
          className="partner-search-input"
          placeholder="주문코드 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="결제 검색"
          style={{ marginLeft: 'auto' }}
        />
      </div>

      {/* Table */}
      <div className="partner-table-card">
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <caption className="sr-only">결제현황 목록</caption>
          <thead>
            <tr>
              <th scope="col">주문코드</th>
              <th scope="col">수단</th>
              <th scope="col">금액</th>
              <th scope="col">상태</th>
              <th scope="col">결제일시</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}>
                  <span role="status" aria-busy="true">로딩 중...</span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}>
                  결제 내역이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((p) => {
                const status = PAYMENT_STATUS_MAP[p.status] || { label: p.status, color: 'gray' };
                return (
                  <tr key={p.paymentId}>
                    <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px' }}>
                      {p.orderCode || `#${p.orderId}`}
                    </td>
                    <td>{METHOD_OPTIONS.find((m) => m.value === p.method)?.label || p.method}</td>
                    <td className="tabular-nums">{Number(p.amount).toLocaleString()}원</td>
                    <td><span className={`partner-badge ${status.color}`}>{status.label}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--color-grey-500)' }}>
                      {new Date(p.createdAt).toLocaleString('ko-KR')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="partner-pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>다음</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentsTab;
