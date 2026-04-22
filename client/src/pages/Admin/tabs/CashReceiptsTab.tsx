import { useState, useCallback } from 'react';
import { AxiosError } from 'axios';
import { useToast } from '../../../contexts/ToastContext';
import { axiosInstance } from '../../../lib/axios';
import { Badge, Button } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { ADMIN_PAGINATION, CASH_RECEIPT_STATUS_OPTIONS, CASH_RECEIPT_STATUS_COLOR_MAP } from '../constants';
import { useAdminList } from '../hooks';
import type { CashReceipt } from '../../../types/mypage';

const getStatusLabel = (status: string) =>
  CASH_RECEIPT_STATUS_OPTIONS.find(o => o.value === status)?.label || status;

const getTypeLabel = (type: string) =>
  type === 'INCOME_DEDUCTION' ? '소득공제' : '지출증빙';

const fetchCashReceipts = (params: Record<string, any>) =>
  axiosInstance.get('/admin/cash-receipts', { params }).then(r => r.data);

const CashReceiptsTab = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const { showToast } = useToast();

  const { items: receipts, loading, page, total, setPage, reload } = useAdminList<CashReceipt>(
    fetchCashReceipts,
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters: { status: statusFilter || undefined },
      errorMessage: '현금영수증 목록을 불러오는데 실패했습니다.',
    },
  );

  const handleCancel = useCallback(async (id: number) => {
    if (!confirm('이 현금영수증을 취소하시겠습니까?')) return;
    try {
      await axiosInstance.post(`/admin/cash-receipts/${id}/cancel`, { reason: '관리자 수동 취소' });
      showToast({ message: '현금영수증이 취소되었습니다.', type: 'success' });
      reload();
    } catch (err: unknown) {
      const msg = err instanceof AxiosError
        ? (err.response?.data?.error || err.message)
        : err instanceof Error ? err.message : undefined;
      showToast({ message: msg || '현금영수증 취소에 실패했습니다.', type: 'error' });
    }
  }, [reload, showToast]);

  const handleReissue = useCallback(async (id: number) => {
    try {
      await axiosInstance.post(`/admin/cash-receipts/${id}/reissue`);
      showToast({ message: '현금영수증이 재발급되었습니다.', type: 'success' });
      reload();
    } catch (err: unknown) {
      const msg = err instanceof AxiosError
        ? (err.response?.data?.error || err.message)
        : err instanceof Error ? err.message : undefined;
      showToast({ message: msg || '현금영수증 재발급에 실패했습니다.', type: 'error' });
    }
  }, [reload, showToast]);

  const columns: Column<CashReceipt>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="admin-mono">#{r.id}</span>,
    },
    {
      key: 'orderId',
      header: '주문#',
      render: (r) => <span className="admin-mono">#{r.orderId}</span>,
    },
    {
      key: 'type',
      header: '유형',
      render: (r) => (
        <Badge variant="secondary" size="sm">{getTypeLabel(r.type)}</Badge>
      ),
    },
    {
      key: 'maskedIdentity',
      header: '식별번호',
      render: (r) => <span className="admin-mono" style={{ fontSize: '12px' }}>{r.maskedIdentity}</span>,
    },
    {
      key: 'totalAmount',
      header: '금액',
      render: (r) => <span style={{ fontWeight: 700 }}>{Number(r.totalAmount).toLocaleString()}원</span>,
    },
    {
      key: 'status',
      header: '상태',
      render: (r) => (
        <Badge
          color={(CASH_RECEIPT_STATUS_COLOR_MAP.get(r.status) || 'elephant') as any}
          variant="weak"
          size="sm"
        >
          {getStatusLabel(r.status)}
        </Badge>
      ),
    },
    {
      key: 'isAutoIssued',
      header: '자진발급',
      render: (r) => r.isAutoIssued
        ? <Badge color="yellow" variant="weak" size="sm">자진</Badge>
        : <span>-</span>,
    },
    {
      key: 'confirmNum',
      header: '승인번호',
      render: (r) => (
        <span className="admin-mono" style={{ fontSize: '12px', opacity: 0.6 }}>
          {r.confirmNum || '-'}
        </span>
      ),
    },
    {
      key: 'issuedAt',
      header: '발급일',
      render: (r) => (
        <span style={{ fontSize: '12px', opacity: 0.6 }}>
          {r.issuedAt ? new Date(r.issuedAt).toLocaleDateString('ko-KR') : '-'}
        </span>
      ),
    },
    {
      key: 'action',
      header: '',
      render: (r) => (
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
          {r.status === 'ISSUED' && (
            <Button variant="danger" size="sm" onClick={() => handleCancel(r.id)}>취소</Button>
          )}
          {r.status === 'FAILED' && (
            <Button variant="primary" size="sm" onClick={() => handleReissue(r.id)}>재발급</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">현금영수증 관리</h2>
          <p className="admin-page-desc">현금영수증 발급 내역을 조회하고 관리합니다</p>
        </div>
      </div>

      <div className="admin-filter-card">
        <select
          className="admin-filter-select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); }}
          aria-label="상태 필터"
        >
          <option value="">전체 상태</option>
          {CASH_RECEIPT_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={receipts}
          keyField="id"
          isLoading={loading}
          pagination={{
            currentPage: page,
            totalItems: total,
            itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
            onPageChange: setPage,
          }}
          emptyMessage="현금영수증 내역이 없습니다."
          caption="현금영수증 목록"
        />
      </div>
    </div>
  );
};

export default CashReceiptsTab;
