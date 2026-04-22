/**
 * @file SettlementsTab.tsx
 * @description Admin settlement management — list, status updates, batch creation
 */
import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Badge, Modal, TextField } from '../../../design-system';
import { ConfirmModal } from '../components/ConfirmModal';
import AdminDetailModal from '../components/AdminDetailModal';
import { AdminTable, Column } from '../../../components/admin';
import { formatPrice } from '../../../utils';
import { formatDateTime } from '../../../utils/dateUtils';
import { COLORS } from '../../../constants/designTokens';
import {
  ADMIN_PAGINATION,
  SETTLEMENT_STATUS_OPTIONS,
  SETTLEMENT_STATUS_COLOR_MAP,
  SETTLEMENT_FREQUENCY_OPTIONS,
} from '../constants';
import { useAdminList } from '../hooks';

// ─── Types ──────────────────────────────────────────

interface Settlement {
  id: number;
  partnerId: number;
  partnerName?: string;
  partnerEmail?: string;
  period: string;
  frequency: string;
  totalSales: number;
  totalQuantity: number;
  commissionRate: number;
  commissionAmount: number;
  payoutAmount: number;
  status: string;
  transferRef?: string | null;
  paidAt?: string | null;
  failureReason?: string | null;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ────────────────────────────────────────

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

const getStatusLabel = (status: string) =>
  SETTLEMENT_STATUS_OPTIONS.find(o => o.value === status)?.label || status;

const getFrequencyLabel = (freq: string) =>
  SETTLEMENT_FREQUENCY_OPTIONS.find(o => o.value === freq)?.label || freq;

// ─── Component ──────────────────────────────────────

const SettlementsTab: React.FC = () => {
  const { showToast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [partnerSearch, setPartnerSearch] = useState('');
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [fromDate, setFromDate] = useState(formatDate(firstOfMonth));
  const [toDate, setToDate] = useState(formatDate(now));

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
    search: partnerSearch || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
  }), [statusFilter, partnerSearch, fromDate, toDate]);

  const { items: settlements, loading, page, total, setPage, reload } = useAdminList<Settlement>(
    (params) => adminApi.getSettlements(params),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters,
      errorMessage: '정산 목록을 불러오는데 실패했습니다.',
    },
  );

  // Detail modal
  const [detailModal, setDetailModal] = useState<{ open: boolean; settlement: Settlement | null }>({
    open: false, settlement: null,
  });

  // Batch creation modal
  const [batchModal, setBatchModal] = useState(false);
  const [batchFrequency, setBatchFrequency] = useState('WEEKLY');
  const [batchCreating, setBatchCreating] = useState(false);

  // Status change: PENDING -> CONFIRMED
  const [confirmAction, setConfirmAction] = useState<{ open: boolean; id: number; name: string }>({
    open: false, id: 0, name: '',
  });

  // Status change: CONFIRMED -> PAID (needs transferRef)
  const [paidModal, setPaidModal] = useState<{ open: boolean; id: number; transferRef: string }>({
    open: false, id: 0, transferRef: '',
  });

  // Status change: CONFIRMED -> FAILED (needs reason)
  const [failModal, setFailModal] = useState<{ open: boolean; id: number; reason: string }>({
    open: false, id: 0, reason: '',
  });

  // ─── Handlers ───────────────────────────────────────

  const handleCreateBatch = async () => {
    setBatchCreating(true);
    try {
      await adminApi.createSettlementBatch(batchFrequency);
      showToast({ message: `${getFrequencyLabel(batchFrequency)} 정산 배치가 생성되었습니다.`, type: 'success' });
      setBatchModal(false);
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '정산 배치 생성에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setBatchCreating(false);
    }
  };

  const handleConfirm = async () => {
    try {
      await adminApi.updateSettlementStatus(confirmAction.id, 'CONFIRMED');
      showToast({ message: '정산이 확인되었습니다.', type: 'success' });
      reload();
      setDetailModal({ open: false, settlement: null });
    } catch (err: any) {
      const msg = err?.response?.data?.error || '상태 변경에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setConfirmAction({ open: false, id: 0, name: '' });
    }
  };

  const handlePaid = async () => {
    if (!paidModal.transferRef.trim()) {
      showToast({ message: '이체 참조번호를 입력해주세요.', type: 'warning' });
      return;
    }
    try {
      await adminApi.updateSettlementStatus(paidModal.id, 'PAID', paidModal.transferRef.trim());
      showToast({ message: '입금 완료 처리되었습니다.', type: 'success' });
      reload();
      setDetailModal({ open: false, settlement: null });
    } catch (err: any) {
      const msg = err?.response?.data?.error || '상태 변경에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setPaidModal({ open: false, id: 0, transferRef: '' });
    }
  };

  const handleFail = async () => {
    if (!failModal.reason.trim()) {
      showToast({ message: '실패 사유를 입력해주세요.', type: 'warning' });
      return;
    }
    try {
      await adminApi.updateSettlementStatus(failModal.id, 'FAILED', undefined, failModal.reason.trim());
      showToast({ message: '실패 처리되었습니다.', type: 'success' });
      reload();
      setDetailModal({ open: false, settlement: null });
    } catch (err: any) {
      const msg = err?.response?.data?.error || '상태 변경에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setFailModal({ open: false, id: 0, reason: '' });
    }
  };

  // ─── Columns ────────────────────────────────────────

  const columns: Column<Settlement>[] = [
    {
      key: 'id', header: 'ID',
      render: (s) => (
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: COLORS.grey500 }}>
          #{s.id}
        </span>
      ),
    },
    {
      key: 'partner', header: '파트너',
      render: (s) => (
        <div>
          <div style={{ fontWeight: 500 }}>{s.partnerName || `P#${s.partnerId}`}</div>
          {s.partnerEmail && <div className="admin-sub-text">{s.partnerEmail}</div>}
        </div>
      ),
    },
    {
      key: 'period', header: '기간',
      render: (s) => (
        <div>
          <div style={{ fontSize: '13px' }}>{s.period}</div>
          <div className="admin-sub-text">{getFrequencyLabel(s.frequency)}</div>
        </div>
      ),
    },
    {
      key: 'totalSales', header: '매출', align: 'right',
      render: (s) => formatPrice(Number(s.totalSales)),
    },
    {
      key: 'commissionAmount', header: '수수료', align: 'right',
      render: (s) => (
        <div>
          <div>{formatPrice(Number(s.commissionAmount))}</div>
          <div className="admin-sub-text">{Number(s.commissionRate)}%</div>
        </div>
      ),
    },
    {
      key: 'payoutAmount', header: '정산액', align: 'right',
      render: (s) => (
        <span style={{ fontWeight: 600, color: COLORS.primary }}>
          {formatPrice(Number(s.payoutAmount))}
        </span>
      ),
    },
    {
      key: 'status', header: '상태',
      render: (s) => {
        const color = SETTLEMENT_STATUS_COLOR_MAP.get(s.status) || 'elephant';
        return (
          <Badge color={color as any} variant="weak" size="small">
            {getStatusLabel(s.status)}
          </Badge>
        );
      },
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (s) => (
        <div className="admin-actions">
          <Button variant="ghost" size="sm" onClick={() => setDetailModal({ open: true, settlement: s })}>
            상세
          </Button>
        </div>
      ),
    },
  ];

  // ─── Render ─────────────────────────────────────────

  return (
    <div className="admin-tab">
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">정산 관리</h2>
          <p className="admin-page-desc">파트너 정산을 관리하고 입금 처리합니다</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-btn-primary" onClick={() => setBatchModal(true)}>
            <Plus size={16} aria-hidden="true" />
            수동 정산 생성
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-filter-card" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="admin-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="정산 상태 필터"
        >
          <option value="">전체 상태</option>
          {SETTLEMENT_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="text"
          className="admin-filter-select"
          placeholder="파트너 검색..."
          value={partnerSearch}
          onChange={(e) => setPartnerSearch(e.target.value)}
          aria-label="파트너 검색"
          style={{ minWidth: '140px' }}
        />
        <label style={{ fontSize: '12px', color: 'var(--color-grey-500)', fontWeight: 500 }}>기간</label>
        <input
          type="date"
          className="admin-filter-select"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          aria-label="시작일"
        />
        <span style={{ color: 'var(--color-grey-400)' }}>~</span>
        <input
          type="date"
          className="admin-filter-select"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          aria-label="종료일"
        />
      </div>

      {/* Table */}
      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={settlements}
          keyField="id"
          isLoading={loading}
          pagination={{
            currentPage: page,
            totalItems: total,
            itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
            onPageChange: setPage,
          }}
          emptyMessage="정산 내역이 없습니다."
          caption="정산 목록"
        />
      </div>

      {/* ── Detail Modal ── */}
      <AdminDetailModal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, settlement: null })}
        title="정산 상세"
        loading={false}
      >
        {detailModal.settlement && (() => {
          const s = detailModal.settlement;
          const statusColor = SETTLEMENT_STATUS_COLOR_MAP.get(s.status) || 'elephant';
          return (
            <>
              <AdminDetailModal.Section title="정산 정보">
                <AdminDetailModal.InfoGrid columns={2}>
                  <AdminDetailModal.InfoRow label="정산 ID" value={`#${s.id}`} mono />
                  <AdminDetailModal.InfoRow label="파트너" value={s.partnerName || `P#${s.partnerId}`} />
                  <AdminDetailModal.InfoRow label="기간" value={s.period} />
                  <AdminDetailModal.InfoRow label="정산 주기" value={getFrequencyLabel(s.frequency)} />
                  <AdminDetailModal.InfoRow label="생성일" value={formatDateTime(s.createdAt)} />
                  <AdminDetailModal.InfoRow label="수정일" value={formatDateTime(s.updatedAt)} />
                </AdminDetailModal.InfoGrid>
              </AdminDetailModal.Section>

              <AdminDetailModal.Section title="금액 정보">
                <AdminDetailModal.InfoGrid columns={2}>
                  <AdminDetailModal.InfoRow label="총 매출" value={formatPrice(Number(s.totalSales))} />
                  <AdminDetailModal.InfoRow label="판매 수량" value={`${s.totalQuantity}건`} />
                  <AdminDetailModal.InfoRow label="수수료율" value={`${Number(s.commissionRate)}%`} />
                  <AdminDetailModal.InfoRow label="수수료" value={formatPrice(Number(s.commissionAmount))} />
                  <AdminDetailModal.InfoRow
                    label="정산액"
                    value={<span style={{ fontWeight: 700, color: COLORS.primary }}>{formatPrice(Number(s.payoutAmount))}</span>}
                  />
                </AdminDetailModal.InfoGrid>
              </AdminDetailModal.Section>

              <AdminDetailModal.Section title="상태">
                <AdminDetailModal.StatusRow label="정산 상태" status={getStatusLabel(s.status)} color={statusColor as string} />
                {s.transferRef && (
                  <AdminDetailModal.InfoGrid columns={1}>
                    <AdminDetailModal.InfoRow label="이체 참조번호" value={s.transferRef} mono />
                  </AdminDetailModal.InfoGrid>
                )}
                {s.paidAt && (
                  <AdminDetailModal.InfoGrid columns={1}>
                    <AdminDetailModal.InfoRow label="입금일시" value={formatDateTime(s.paidAt)} />
                  </AdminDetailModal.InfoGrid>
                )}
                {s.failureReason && (
                  <AdminDetailModal.InfoGrid columns={1}>
                    <AdminDetailModal.InfoRow label="실패 사유" value={s.failureReason} />
                  </AdminDetailModal.InfoGrid>
                )}
              </AdminDetailModal.Section>

              <AdminDetailModal.Divider />

              <AdminDetailModal.Section title="상태 변경">
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {s.status === 'PENDING' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setConfirmAction({ open: true, id: s.id, name: `#${s.id}` })}
                    >
                      확인 처리
                    </Button>
                  )}
                  {s.status === 'CONFIRMED' && (
                    <>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => setPaidModal({ open: true, id: s.id, transferRef: '' })}
                      >
                        입금완료
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setFailModal({ open: true, id: s.id, reason: '' })}
                      >
                        실패 처리
                      </Button>
                    </>
                  )}
                  {s.status === 'PAID' && (
                    <span style={{ fontSize: '13px', color: COLORS.grey500 }}>
                      입금 완료 (최종)
                    </span>
                  )}
                  {s.status === 'FAILED' && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setConfirmAction({ open: true, id: s.id, name: `#${s.id}` })}
                    >
                      재시도 (확인 처리)
                    </Button>
                  )}
                </div>
              </AdminDetailModal.Section>

              <AdminDetailModal.ActionBar>
                <Button variant="ghost" onClick={() => setDetailModal({ open: false, settlement: null })}>닫기</Button>
              </AdminDetailModal.ActionBar>
            </>
          );
        })()}
      </AdminDetailModal>

      {/* ── Batch Creation Modal ── */}
      <Modal
        isOpen={batchModal}
        onClose={() => setBatchModal(false)}
        title="수동 정산 생성"
        size="small"
      >
        <div style={{ padding: 'var(--space-4)' }}>
          <p style={{ marginBottom: 'var(--space-3)', color: 'var(--color-grey-700)', fontSize: '14px' }}>
            선택한 주기에 해당하는 파트너들의 정산 레코드를 일괄 생성합니다.
          </p>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label className="admin-form-label">정산 주기</label>
            <select
              className="select select-bordered w-full"
              value={batchFrequency}
              onChange={(e) => setBatchFrequency(e.target.value)}
            >
              {SETTLEMENT_FREQUENCY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="admin-form-footer">
            <Button variant="ghost" onClick={() => setBatchModal(false)}>취소</Button>
            <Button variant="primary" onClick={handleCreateBatch} loading={batchCreating}>
              생성
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Confirm (PENDING -> CONFIRMED) ── */}
      <ConfirmModal
        isOpen={confirmAction.open}
        onClose={() => setConfirmAction({ open: false, id: 0, name: '' })}
        onConfirm={handleConfirm}
        title="정산 확인"
        confirmLabel="확인 처리"
      >
        <p>
          정산 <strong>{confirmAction.name}</strong>을(를) 확인 처리하시겠습니까?
        </p>
      </ConfirmModal>

      {/* ── Paid Modal (CONFIRMED -> PAID) ── */}
      <Modal
        isOpen={paidModal.open}
        onClose={() => setPaidModal({ open: false, id: 0, transferRef: '' })}
        title="입금완료 처리"
        size="small"
      >
        <div style={{ padding: 'var(--space-4)' }}>
          <p style={{ marginBottom: 'var(--space-3)', color: 'var(--color-grey-700)' }}>
            정산 <strong>#{paidModal.id}</strong>을(를) 입금완료 처리합니다.
          </p>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label className="admin-form-label">이체 참조번호 *</label>
            <TextField
              variant="box"
              value={paidModal.transferRef}
              onChange={(e) => setPaidModal(prev => ({ ...prev, transferRef: e.target.value }))}
              placeholder="이체 참조번호를 입력하세요"
              required
            />
          </div>
          <div className="admin-form-footer">
            <Button variant="ghost" onClick={() => setPaidModal({ open: false, id: 0, transferRef: '' })}>취소</Button>
            <Button
              variant="primary"
              onClick={handlePaid}
              disabled={!paidModal.transferRef.trim()}
            >
              입금완료
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Fail Modal (CONFIRMED -> FAILED) ── */}
      <Modal
        isOpen={failModal.open}
        onClose={() => setFailModal({ open: false, id: 0, reason: '' })}
        title="실패 처리"
        size="small"
      >
        <div style={{ padding: 'var(--space-4)' }}>
          <p style={{ marginBottom: 'var(--space-3)', color: 'var(--color-grey-700)' }}>
            정산 <strong>#{failModal.id}</strong>을(를) 실패 처리합니다.
          </p>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label className="admin-form-label">실패 사유 *</label>
            <textarea
              className="textarea textarea-bordered w-full resize-y"
              value={failModal.reason}
              onChange={(e) => setFailModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="실패 사유를 입력해주세요"
              rows={3}
              required
            />
          </div>
          <div className="admin-form-footer">
            <Button variant="ghost" onClick={() => setFailModal({ open: false, id: 0, reason: '' })}>취소</Button>
            <Button
              variant="danger"
              onClick={handleFail}
              disabled={!failModal.reason.trim()}
            >
              실패 처리
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettlementsTab;
