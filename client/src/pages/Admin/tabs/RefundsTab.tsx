import { useState, useCallback } from 'react';
import { AxiosError } from 'axios';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Badge, Button, Modal } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatRelativeTime } from '../../../utils';
import { COLORS, SPACING } from '../../../constants/designTokens';
import { ADMIN_PAGINATION, REFUND_STATUS_OPTIONS, REFUND_STATUS_COLOR_MAP } from '../constants';
import AdminDetailModal from '../components/AdminDetailModal';
import { useAdminList } from '../hooks';

interface Refund {
  id: number;
  orderId: number;
  amount: number;
  reason: string;
  status: string;
  processedBy?: number;
  processedAt?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt?: string;
  order?: {
    id: number;
    userId: number;
    totalAmount: number;
    status: string;
    user?: { id: number; email: string; name: string };
    items?: Array<{ product: { name: string }; quantity: number; price: number }>;
  };
}

const getStatusLabel = (status: string) =>
  REFUND_STATUS_OPTIONS.find(o => o.value === status)?.label || status;

const RefundsTab = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [detailRefund, setDetailRefund] = useState<Refund | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const { showToast } = useToast();

  const { items: refunds, loading, page, total, setPage, reload } = useAdminList<Refund>(
    (params) => adminApi.getAllRefunds(params),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters: { status: statusFilter || undefined },
      errorMessage: '환불 목록을 불러오는데 실패했습니다.',
    },
  );

  const handleViewDetail = useCallback(async (refundId: number) => {
    setDetailLoading(true);
    try {
      const detail = await adminApi.getRefund(refundId);
      setDetailRefund(detail);
      setAdminNote('');
    } catch {
      showToast({ message: '환불 상세 정보를 불러오는데 실패했습니다.', type: 'error' });
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

  const handleApprove = useCallback(async (refundId: number) => {
    setActionLoading(true);
    try {
      await adminApi.approveRefund(refundId, adminNote || undefined);
      showToast({ message: '환불이 승인되었습니다.', type: 'success' });
      setDetailRefund(null);
      reload();
    } catch (err: unknown) {
      const msg = err instanceof AxiosError ? (err.response?.data?.error || err.message) : err instanceof Error ? err.message : undefined;
      showToast({ message: msg || '환불 승인에 실패했습니다.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }, [adminNote, reload, showToast]);

  const handleReject = useCallback(async (refundId: number) => {
    setActionLoading(true);
    try {
      await adminApi.rejectRefund(refundId, adminNote || undefined);
      showToast({ message: '환불이 거부되었습니다.', type: 'success' });
      setDetailRefund(null);
      reload();
    } catch (err: unknown) {
      const msg = err instanceof AxiosError ? (err.response?.data?.error || err.message) : err instanceof Error ? err.message : undefined;
      showToast({ message: msg || '환불 거부에 실패했습니다.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }, [adminNote, reload, showToast]);

  const columns: Column<Refund>[] = [
    { key: 'id', header: 'ID', render: (r) => <span className="admin-mono">#{r.id}</span> },
    { key: 'orderId', header: '주문 번호', render: (r) => <span className="admin-mono">#{r.orderId}</span> },
    { key: 'amount', header: '환불금액', render: (r) => <span>{Number(r.amount).toLocaleString()}원</span> },
    {
      key: 'reason', header: '사유',
      render: (r) => (
        <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: COLORS.grey600 }}>
          {r.reason}
        </div>
      )
    },
    {
      key: 'status', header: '상태',
      render: (r) => (
        <Badge color={REFUND_STATUS_COLOR_MAP.get(r.status) || 'elephant'} variant="weak" size="sm">
          {getStatusLabel(r.status)}
        </Badge>
      )
    },
    {
      key: 'date', header: '요청일',
      render: (r) => (
        <div>
          <div>{new Date(r.createdAt).toLocaleDateString()}</div>
          <div className="admin-sub-text">{formatRelativeTime(r.createdAt)}</div>
        </div>
      )
    },
    {
      key: 'action', header: '',
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={() => handleViewDetail(r.id)}>상세</Button>
      )
    },
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">환불 관리</h2>
          <p className="admin-page-desc">환불 요청을 검토하고 처리합니다</p>
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
          {REFUND_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={refunds}
          keyField="id"
          isLoading={loading}
          pagination={{ currentPage: page, totalItems: total, itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE, onPageChange: setPage }}
          emptyMessage="환불 요청이 없습니다."
          caption="환불 목록"
        />
      </div>

      {/* 상세보기 모달 — 수제 div를 AdminDetailModal로 교체 */}
      <AdminDetailModal
        isOpen={detailRefund !== null}
        onClose={() => setDetailRefund(null)}
        title={detailRefund ? `환불 상세 #${detailRefund.id}` : '환불 상세'}
        loading={detailLoading}
      >
        {detailRefund && (
          <>
            <AdminDetailModal.Section title="환불 정보">
              <AdminDetailModal.InfoGrid>
                <AdminDetailModal.InfoRow label="주문 번호" value={`#${detailRefund.orderId}`} />
                <AdminDetailModal.InfoRow label="환불금액" value={`${Number(detailRefund.amount).toLocaleString()}원`} />
                <AdminDetailModal.InfoRow label="사유" value={detailRefund.reason} fullWidth />
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            <AdminDetailModal.Section title="처리 상태">
              <AdminDetailModal.StatusRow
                label="상태"
                status={getStatusLabel(detailRefund.status)}
                color={REFUND_STATUS_COLOR_MAP.get(detailRefund.status) || 'elephant'}
              />
              {detailRefund.processedAt && (
                <div style={{ marginTop: SPACING[2] }}>
                  <AdminDetailModal.InfoRow label="처리일" value={new Date(detailRefund.processedAt).toLocaleString('ko-KR')} />
                </div>
              )}
              {detailRefund.adminNote && (
                <div style={{ marginTop: SPACING[2] }}>
                  <AdminDetailModal.InfoRow label="관리자 메모" value={detailRefund.adminNote} fullWidth />
                </div>
              )}
            </AdminDetailModal.Section>

            {detailRefund.order?.user && (
              <AdminDetailModal.Section title="고객 정보">
                <AdminDetailModal.InfoGrid>
                  <AdminDetailModal.InfoRow label="이름" value={detailRefund.order.user.name} />
                  <AdminDetailModal.InfoRow label="이메일" value={detailRefund.order.user.email} />
                </AdminDetailModal.InfoGrid>
              </AdminDetailModal.Section>
            )}

            {detailRefund.order?.items && detailRefund.order.items.length > 0 && (
              <AdminDetailModal.Section title="주문 상품">
                <ul style={{ paddingLeft: '20px', margin: 0, color: COLORS.grey600, fontSize: '13px' }}>
                  {detailRefund.order.items.map((item, idx) => (
                    <li key={idx}>
                      {item.product?.name || '상품'} × {item.quantity} ({Number(item.price).toLocaleString()}원)
                    </li>
                  ))}
                </ul>
              </AdminDetailModal.Section>
            )}

            <AdminDetailModal.Section title="처리 이력">
              <AdminDetailModal.Timeline
                items={[
                  { label: '환불 요청', date: new Date(detailRefund.createdAt).toLocaleString('ko-KR'), active: detailRefund.status === 'REQUESTED' },
                  { label: '처리 완료', date: detailRefund.processedAt ? new Date(detailRefund.processedAt).toLocaleString('ko-KR') : null, active: detailRefund.status !== 'REQUESTED' },
                ]}
              />
            </AdminDetailModal.Section>

            {/* 관리자 메모 입력 + 승인/거부 버튼 (REQUESTED 상태에서만) */}
            {detailRefund.status === 'REQUESTED' && (
              <AdminDetailModal.Section title="처리">
                <textarea
                  className="form-control"
                  placeholder="관리자 메모 (선택)"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                  style={{ width: '100%', marginBottom: SPACING[3], resize: 'vertical' }}
                />
              </AdminDetailModal.Section>
            )}

            <AdminDetailModal.ActionBar>
              <Button variant="ghost" onClick={() => setDetailRefund(null)}>닫기</Button>
              {detailRefund.status === 'REQUESTED' && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => handleReject(detailRefund.id)} disabled={actionLoading}>거부</Button>
                  <Button variant="primary" size="sm" onClick={() => handleApprove(detailRefund.id)} disabled={actionLoading}>승인</Button>
                </>
              )}
            </AdminDetailModal.ActionBar>
          </>
        )}
      </AdminDetailModal>
    </div>
  );
};

export default RefundsTab;
