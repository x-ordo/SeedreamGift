import { useState } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';
import { AdminTable, Column } from '../../../components/admin';
import { formatRelativeTime } from '../../../utils';
import { ADMIN_PAGINATION } from '../constants';
import { useAdminList, useDebouncedSearch } from '../hooks';
import { adminApi } from '../../../api';

interface AuditLog {
  id: number;
  action: string;
  resource: string;
  userId?: number;
  ip?: string;
  method?: string;
  statusCode?: number;
  createdAt: string;
}

// blacklist-frontend 패턴: 이벤트 유형별 색상 맵
const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-green-100 text-green-800',
  LOGOUT: 'bg-slate-100 text-slate-800',
  READ: 'bg-purple-100 text-purple-800',
};

const RESOURCE_COLORS: Record<string, string> = {
  USER: 'bg-blue-50 text-blue-700',
  ORDER: 'bg-emerald-50 text-emerald-700',
  PRODUCT: 'bg-purple-50 text-purple-700',
  VOUCHER: 'bg-amber-50 text-amber-700',
  BRAND: 'bg-teal-50 text-teal-700',
  TRADEIN: 'bg-orange-50 text-orange-700',
  GIFT: 'bg-pink-50 text-pink-700',
  SITE_CONFIG: 'bg-slate-100 text-slate-700',
  NOTICE: 'bg-cyan-50 text-cyan-700',
  FAQ: 'bg-indigo-50 text-indigo-700',
  POLICY: 'bg-violet-50 text-violet-700',
  PATTERN_RULE: 'bg-red-50 text-red-700',
};

const ACTION_OPTIONS = [
  { value: 'CREATE', label: '생성' },
  { value: 'UPDATE', label: '수정' },
  { value: 'DELETE', label: '삭제' },
  { value: 'LOGIN', label: '로그인' },
  { value: 'LOGOUT', label: '로그아웃' },
];

const RESOURCE_OPTIONS = [
  { value: 'USER', label: '사용자' },
  { value: 'ORDER', label: '주문' },
  { value: 'PRODUCT', label: '상품' },
  { value: 'VOUCHER', label: '바우처' },
  { value: 'BRAND', label: '브랜드' },
  { value: 'TRADEIN', label: '매입' },
  { value: 'GIFT', label: '선물' },
  { value: 'SITE_CONFIG', label: '설정' },
  { value: 'NOTICE', label: '공지' },
  { value: 'FAQ', label: 'FAQ' },
  { value: 'POLICY', label: '정책' },
];

const AuditLogsTab = () => {
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const { searchQuery, debouncedQuery, setSearchQuery } = useDebouncedSearch(300);

  const { items: logs, loading, page, total, setPage, reload } = useAdminList<AuditLog>(
    (params) => adminApi.getAllAuditLogs(params),
    {
      pageSize: ADMIN_PAGINATION.AUDIT_LOG_PAGE_SIZE,
      filters: {
        action: actionFilter || undefined,
        resource: resourceFilter || undefined,
        userId: debouncedQuery ? (Number(debouncedQuery) || undefined) : undefined,
      },
    },
  );

  // 액션별 통계 계산 (현재 페이지 기준)
  const actionCounts: Record<string, number> = {};
  logs.forEach(l => { actionCounts[l.action] = (actionCounts[l.action] || 0) + 1; });

  const columns: Column<AuditLog>[] = [
    {
      key: 'action', header: '액션',
      render: (l) => (
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[l.action] || 'bg-slate-100 text-slate-700'}`}>
          {l.action}
        </span>
      ),
    },
    {
      key: 'resource', header: '리소스',
      render: (l) => (
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${RESOURCE_COLORS[l.resource] || 'bg-slate-100 text-slate-700'}`}>
          {l.resource}
        </span>
      ),
    },
    {
      key: 'user', header: '사용자',
      render: (l) => l.userId
        ? <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>#{l.userId}</span>
        : <span style={{ color: 'var(--color-grey-400)' }}>—</span>,
    },
    {
      key: 'ip', header: 'IP',
      render: (l) => (
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12, color: 'var(--color-grey-500)' }}>
          {l.ip || '—'}
        </span>
      ),
    },
    {
      key: 'date', header: '일시',
      render: (l) => (
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-grey-700)' }}>
            {new Date(l.createdAt).toLocaleString('ko-KR')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-grey-400)', marginTop: 1 }}>
            {formatRelativeTime(l.createdAt)}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
            <BookOpen size={18} className="text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">감사 로그</h2>
            <p className="text-xs text-slate-500">
              관리자 작업 이력을 조회합니다
              {total > 0 && <span className="ml-1 text-slate-400">· 총 {total.toLocaleString('ko-KR')}건</span>}
            </p>
          </div>
        </div>
        <button type="button" onClick={reload} className="admin-btn-secondary" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {/* 액션별 통계 뱃지 (blacklist-frontend 패턴) */}
      {Object.keys(actionCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(actionCounts).map(([action, count]) => (
            <span
              key={action}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${ACTION_COLORS[action] || 'bg-slate-100 text-slate-700'}`}
            >
              {action}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="admin-filter-card">
        <select
          className="admin-filter-select"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="액션 필터"
        >
          <option value="">전체 액션</option>
          {ACTION_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="admin-filter-select"
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          aria-label="리소스 필터"
        >
          <option value="">전체 리소스</option>
          {RESOURCE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="search"
          className="admin-search-input"
          style={{ marginLeft: 'auto', minWidth: 180 }}
          placeholder="사용자 ID 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="사용자 ID 검색"
        />
      </div>

      {/* Table */}
      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={logs}
          keyField="id"
          isLoading={loading}
          pagination={{
            currentPage: page,
            totalItems: total,
            itemsPerPage: ADMIN_PAGINATION.AUDIT_LOG_PAGE_SIZE,
            onPageChange: setPage,
          }}
          caption="감사 로그 목록"
        />
      </div>
    </div>
  );
};

export default AuditLogsTab;
