/**
 * @file PaymentsTab.tsx
 * @description 어드민 결제현황 리스트 뷰 — 결제 상태별 요약 카드 + 필터 + 테이블.
 *              주문 단위 상세 드릴다운(결제 시도 타임라인)은 OrdersTab 상세 모달에서 확인.
 */
import { useState, useMemo, useEffect } from 'react';
import { adminApi } from '../../../api';
import { Badge, TextField } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatPrice, formatRelativeTime, maskEmail } from '../../../utils';
import { COLORS } from '../../../constants/designTokens';
import {
  PAYMENT_STATUS_COLOR_MAP,
  PAYMENT_STATUS_OPTIONS,
  ADMIN_PAGINATION,
} from '../constants';
import { useAdminList, useDebouncedSearch } from '../hooks';

interface PaymentRow {
  paymentId: number;
  orderId: number;
  orderCode?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  method: string;
  status: string;
  amount: number;
  failReason?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
}

interface PaymentSummary {
  totalCount: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  cancelledCount: number;
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
  const { searchQuery, debouncedQuery, setSearchQuery } = useDebouncedSearch(400);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
    method: methodFilter || undefined,
    from: from || undefined,
    to: to || undefined,
    search: debouncedQuery || undefined,
  }), [statusFilter, methodFilter, from, to, debouncedQuery]);

  // Go 백엔드는 `{ items, total, summary }` flat 구조를 반환하지만
  // useAdminList는 `{ items, meta: { total } }` 형태를 기대하므로 래핑.
  const { items, loading, page, total, setPage } = useAdminList<PaymentRow>(
    async (params) => {
      const resp = await adminApi.getAllPayments(params);
      return { items: resp.items, meta: { total: resp.total } };
    },
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters,
      errorMessage: '결제현황을 불러오는데 실패했습니다.',
    },
  );

  // Summary는 status 필터 미적용 기준 (상태별 토글 UX). 별도 호출로 받아옴.
  useEffect(() => {
    const loadSummary = async () => {
      try {
        const resp = await adminApi.getAllPayments({
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
  }, [from, to, methodFilter, debouncedQuery]);

  const columns: Column<PaymentRow>[] = [
    {
      key: 'orderCode',
      header: '주문코드',
      render: (p) => (
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px' }}>
          {p.orderCode || `#${p.orderId}`}
        </span>
      ),
    },
    {
      key: 'customer',
      header: '고객',
      render: (p) => (
        <div>
          <span style={{ fontWeight: 600 }}>{p.customerName || '-'}</span>
          <div className="admin-sub-text" title={p.customerEmail ?? undefined}>
            {maskEmail(p.customerEmail ?? undefined)}
          </div>
        </div>
      ),
    },
    {
      key: 'method',
      header: '수단',
      render: (p) => METHOD_OPTIONS.find((m) => m.value === p.method)?.label || p.method,
    },
    {
      key: 'amount',
      header: '금액',
      align: 'right',
      render: (p) => (
        <span style={{ fontWeight: 600, color: COLORS.primary }}>
          {formatPrice(Number(p.amount))}
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      render: (p) => (
        <Badge
          color={(PAYMENT_STATUS_COLOR_MAP.get(p.status) as any) || 'elephant'}
          variant="weak"
          size="small"
        >
          {PAYMENT_STATUS_OPTIONS.find((o) => o.value === p.status)?.label || p.status}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: '결제일시',
      render: (p) => (
        <div>
          <div>{new Date(p.createdAt).toLocaleDateString('ko-KR')}</div>
          <div className="admin-sub-text">{formatRelativeTime(p.createdAt)}</div>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">결제현황</h2>
          <p className="admin-page-desc">
            결제 상태별 리스트. 상세 시도 이력은 주문 관리 → 주문 상세에서 확인합니다.
          </p>
        </div>
      </div>

      {summary && (
        <div
          className="admin-stat-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div className="admin-stat-card">
            <span className="admin-stat-label">총 결제</span>
            <span className="admin-stat-value">{summary.totalCount}건</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">성공</span>
            <span className="admin-stat-value" style={{ color: 'var(--color-success)' }}>
              {summary.successCount}건
            </span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">실패</span>
            <span className="admin-stat-value" style={{ color: 'var(--color-error)' }}>
              {summary.failedCount}건
            </span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">대기</span>
            <span className="admin-stat-value" style={{ color: 'var(--color-warning)' }}>
              {summary.pendingCount}건
            </span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">취소</span>
            <span className="admin-stat-value" style={{ color: 'var(--color-grey-600)' }}>
              {summary.cancelledCount}건
            </span>
          </div>
        </div>
      )}

      <div className="admin-filter-card">
        <TextField variant="box" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="시작일" />
        <span>~</span>
        <TextField variant="box" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="종료일" />
        <select
          className="admin-filter-select"
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          aria-label="결제 수단 필터"
        >
          {METHOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="admin-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="결제 상태 필터"
        >
          <option value="">전체 상태</option>
          {PAYMENT_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="search"
          className="admin-search-input admin-filter-search"
          placeholder="주문코드, 고객명 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="결제 검색"
        />
      </div>

      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={items}
          keyField="paymentId"
          isLoading={loading}
          pagination={{
            currentPage: page,
            totalItems: total,
            itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
            onPageChange: setPage,
          }}
          emptyMessage="조건에 맞는 결제 내역이 없습니다."
          caption="결제 목록"
        />
      </div>
    </div>
  );
};

export default PaymentsTab;
