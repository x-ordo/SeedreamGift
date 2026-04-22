import { Badge, TextField } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatRelativeTime } from '../../../utils';
import { ADMIN_PAGINATION } from '../constants';
import { useAdminList, useDebouncedSearch } from '../hooks';
import { adminApi } from '../../../api';
import { useState } from 'react';

interface AuditLog {
  id: number;
  action: string;
  resource: string;
  userId?: number;
  ip?: string;
  createdAt: string;
}

const ACTION_OPTIONS = [
  { value: 'CREATE', label: 'CREATE' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'LOGIN', label: 'LOGIN' },
  { value: 'LOGOUT', label: 'LOGOUT' },
];

const RESOURCE_OPTIONS = [
  { value: 'USER', label: 'USER' },
  { value: 'ORDER', label: 'ORDER' },
  { value: 'PRODUCT', label: 'PRODUCT' },
  { value: 'VOUCHER', label: 'VOUCHER' },
  { value: 'BRAND', label: 'BRAND' },
  { value: 'TRADEIN', label: 'TRADEIN' },
  { value: 'GIFT', label: 'GIFT' },
  { value: 'SITE_CONFIG', label: 'SITE_CONFIG' },
  { value: 'NOTICE', label: 'NOTICE' },
  { value: 'FAQ', label: 'FAQ' },
];

const AuditLogsTab = () => {
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const { searchQuery, debouncedQuery, setSearchQuery } = useDebouncedSearch(300);

  const { items: logs, loading, page, total, setPage } = useAdminList<AuditLog>(
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

  const columns: Column<AuditLog>[] = [
    { key: 'id', header: 'ID', render: (l) => <span className="admin-mono">#{l.id}</span> },
    { key: 'action', header: '액션', render: (l) => <span className="admin-mono" style={{ fontSize: '12px' }}>{l.action}</span> },
    { key: 'resource', header: '리소스', render: (l) => <Badge color="blue" variant="weak" size="sm">{l.resource}</Badge> },
    { key: 'user', header: '사용자', render: (l) => l.userId ? <span className="admin-mono">#{l.userId}</span> : '-' },
    { key: 'ip', header: 'IP', render: (l) => <span className="admin-mono">{l.ip || '-'}</span> },
    {
      key: 'date', header: '일시',
      render: (l) => (
        <div>
          <div>{new Date(l.createdAt).toLocaleString('ko-KR')}</div>
          <div className="admin-sub-text">{formatRelativeTime(l.createdAt)}</div>
        </div>
      )
    },
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">감사 로그</h2>
          <p className="admin-page-desc">관리자 작업 이력을 조회합니다</p>
        </div>
      </div>

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
        <TextField
          variant="box"
          type="search"
          placeholder="사용자 ID 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-search-input admin-filter-search"
          aria-label="사용자 ID 검색"
        />
      </div>

      <div className="admin-table-card">
        <AdminTable columns={columns} data={logs} keyField="id" isLoading={loading} pagination={{ currentPage: page, totalItems: total, itemsPerPage: ADMIN_PAGINATION.AUDIT_LOG_PAGE_SIZE, onPageChange: setPage }} caption="감사 로그 목록" />
      </div>
    </div>
  );
};

export default AuditLogsTab;
