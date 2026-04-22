/**
 * @file PayoutsTab.tsx
 * @description Partner settlement history — date range filter, summary, settlement records
 */
import { useState, useEffect, useMemo } from 'react';
import { Download } from 'lucide-react';
import { partnerApi } from '@/api/manual';
import { usePartnerList } from '../hooks/usePartnerList';
import { useToast } from '@/contexts/ToastContext';
import { PARTNER_PAGINATION } from '../constants';

interface SettlementSummary {
  totalSales: number;
  totalCommission: number;
  totalPayout: number;
  count: number;
}

/** Settlement status display config */
const SETTLEMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '대기', color: 'yellow' },
  CONFIRMED: { label: '확인', color: 'blue' },
  PAID: { label: '입금완료', color: 'green' },
  FAILED: { label: '실패', color: 'red' },
};

/** Get date string in YYYY-MM-DD format */
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const PayoutsTab: React.FC = () => {
  const { showToast } = useToast();

  // Default: current month
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [fromDate, setFromDate] = useState(formatDate(firstOfMonth));
  const [toDate, setToDate] = useState(formatDate(now));
  const [statusFilter, setStatusFilter] = useState('');
  const [summary, setSummary] = useState<SettlementSummary | null>(null);

  const filters = useMemo(() => ({
    from: fromDate || undefined,
    to: toDate || undefined,
    status: statusFilter || undefined,
  }), [fromDate, toDate, statusFilter]);

  const { items, loading, page, total, setPage } = usePartnerList<any>(
    (params) => partnerApi.getMySettlements(params),
    { filters, errorMessage: '정산 내역을 불러오는데 실패했습니다.' }
  );

  const totalPages = Math.ceil(total / PARTNER_PAGINATION.DEFAULT_PAGE_SIZE);

  // Load settlement summary
  useEffect(() => {
    if (!fromDate || !toDate) return;
    const loadSummary = async () => {
      try {
        const data = await partnerApi.getSettlementSummary(fromDate, toDate);
        setSummary(data);
      } catch {
        setSummary(null);
      }
    };
    loadSummary();
  }, [fromDate, toDate]);

  const handleExcelDownload = () => {
    try {
      import('xlsx').then(XLSX => {
        const wsData = items.map((item: any) => ({
          'ID': `#${item.id}`,
          '기간': item.period || '-',
          '매출': Number(item.totalSales ?? 0),
          '수수료': Number(item.commissionAmount ?? 0),
          '정산액': Number(item.payoutAmount ?? 0),
          '상태': SETTLEMENT_STATUS_MAP[item.status]?.label || item.status || '-',
          '정산일': item.paidAt || item.createdAt || '-',
        }));

        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '정산내역');
        XLSX.writeFile(wb, `settlement_${fromDate}_${toDate}.xlsx`);
        showToast({ message: '엑셀 파일이 다운로드되었습니다.', type: 'success' });
      });
    } catch {
      showToast({ message: '엑셀 다운로드에 실패했습니다.', type: 'error' });
    }
  };

  return (
    <div className="partner-tab">
      {/* Date Range Filter */}
      <div className="partner-filter-card">
        <label style={{ fontSize: '12px', color: 'var(--color-grey-500)', fontWeight: 500 }}>기간</label>
        <input
          type="date"
          className="partner-filter-select"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          max={toDate || undefined}
          aria-label="시작일"
        />
        <span style={{ color: 'var(--color-grey-400)' }}>~</span>
        <input
          type="date"
          className="partner-filter-select"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          min={fromDate || undefined}
          max={new Date().toISOString().slice(0, 10)}
          aria-label="종료일"
        />
        <select
          className="partner-filter-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="상태 필터"
        >
          <option value="">전체 상태</option>
          {Object.entries(SETTLEMENT_STATUS_MAP).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <div style={{ marginLeft: 'auto' }}>
          <button type="button" className="partner-btn-secondary" onClick={handleExcelDownload} disabled={items.length === 0}>
            <Download size={14} /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="partner-stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="partner-stat-card">
          <span className="partner-stat-label">총 매출</span>
          <span className="partner-stat-value tabular-nums">
            {summary ? `${(summary.totalSales / 10000).toLocaleString()}만원` : '-'}
          </span>
        </div>
        <div className="partner-stat-card">
          <span className="partner-stat-label">수수료</span>
          <span className="partner-stat-value tabular-nums" style={{ color: 'var(--color-grey-600)' }}>
            {summary ? `${(summary.totalCommission / 10000).toLocaleString()}만원` : '-'}
          </span>
        </div>
        <div className="partner-stat-card">
          <span className="partner-stat-label">정산액</span>
          <span className="partner-stat-value success tabular-nums">
            {summary ? `${(summary.totalPayout / 10000).toLocaleString()}만원` : '-'}
          </span>
        </div>
        <div className="partner-stat-card">
          <span className="partner-stat-label">정산 건수</span>
          <span className="partner-stat-value tabular-nums">
            {summary ? `${summary.count}건` : '-'}
          </span>
        </div>
      </div>

      {/* Settlement Table */}
      <div className="partner-table-card">
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <caption className="sr-only">정산 내역</caption>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">기간</th>
              <th scope="col">매출</th>
              <th scope="col">수수료</th>
              <th scope="col">정산액</th>
              <th scope="col">상태</th>
              <th scope="col">정산일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}><span role="status" aria-busy="true">로딩 중...</span></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}>정산 내역이 없습니다.</td></tr>
            ) : (
              items.map((settlement: any, idx: number) => {
                const statusDef = SETTLEMENT_STATUS_MAP[settlement.status] || { label: settlement.status || '-', color: 'gray' };
                return (
                  <tr key={settlement.id || idx}>
                    <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: 'var(--color-purple-500)' }}>
                      #{settlement.id}
                    </td>
                    <td style={{ fontSize: '13px' }}>{settlement.period || '-'}</td>
                    <td className="tabular-nums">{Number(settlement.totalSales ?? 0).toLocaleString()}원</td>
                    <td className="tabular-nums" style={{ color: 'var(--color-grey-500)' }}>
                      {Number(settlement.commissionAmount ?? 0).toLocaleString()}원
                      <span style={{ fontSize: '11px', color: 'var(--color-grey-400)', marginLeft: '2px' }}>
                        ({Number(settlement.commissionRate ?? 0)}%)
                      </span>
                    </td>
                    <td className="tabular-nums" style={{ fontWeight: 600 }}>
                      {Number(settlement.payoutAmount ?? 0).toLocaleString()}원
                    </td>
                    <td><span className={`partner-badge ${statusDef.color}`}>{statusDef.label}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--color-grey-500)' }}>
                      {settlement.paidAt
                        ? new Date(settlement.paidAt).toLocaleDateString('ko-KR')
                        : settlement.createdAt
                          ? new Date(settlement.createdAt).toLocaleDateString('ko-KR')
                          : '-'}
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

export default PayoutsTab;
