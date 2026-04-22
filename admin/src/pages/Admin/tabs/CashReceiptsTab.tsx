/**
 * @file CashReceiptsTab.tsx
 * @description 현금영수증 관리 탭 - 현금영수증 목록, 취소, 재발행, 동기화
 * @module pages/Admin/tabs
 */
import { useState, useMemo } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Badge } from '../../../design-system';
import { ConfirmModal } from '../components/ConfirmModal';
import { AdminTable, Column } from '../../../components/admin';
import { formatPrice, formatRelativeTime } from '../../../utils';
import { COLORS } from '../../../constants/designTokens';
import { ADMIN_PAGINATION } from '../constants';
import { useAdminList } from '../hooks';

// ─── Types ──────────────────────────────────────────

interface CashReceipt {
  id: number;
  orderId: number;
  type: string;
  identityNumber: string;
  amount: number;
  status: string;
  popbillNtsConfirmNum?: string | null;
  issuedAt?: string | null;
  createdAt: string;
}

// ─── Status Config ───────────────────────────────────

const CASH_RECEIPT_STATUS_OPTIONS = [
  { value: 'PENDING',   label: '처리중',  color: 'yellow' },
  { value: 'ISSUED',    label: '발행완료', color: 'green'  },
  { value: 'CANCELLED', label: '취소됨',  color: 'red'    },
  { value: 'FAILED',    label: '실패',    color: 'red'    },
] as const;

const STATUS_COLOR_MAP = new Map(CASH_RECEIPT_STATUS_OPTIONS.map(o => [o.value, o.color]));

const getStatusLabel = (status: string) =>
  CASH_RECEIPT_STATUS_OPTIONS.find(o => o.value === status)?.label ?? status;

const TYPE_LABEL_MAP: Record<string, string> = {
  INCOME:  '소득공제',
  EXPENSE: '지출증빙',
};

/** 식별번호 마스킹 — 마지막 4자리만 노출 */
const maskIdentity = (value: string): string => {
  if (!value) return '-';
  const clean = value.replace(/[^0-9]/g, '');
  if (clean.length <= 4) return value;
  return `${'*'.repeat(clean.length - 4)}${clean.slice(-4)}`;
};

// ─── Confirm Modal State Helpers ─────────────────────

interface ConfirmState {
  open: boolean;
  id: number;
  label: string;
}
const closedConfirm = (): ConfirmState => ({ open: false, id: 0, label: '' });

// ─── Component ──────────────────────────────────────

const CashReceiptsTab: React.FC = () => {
  const { showToast } = useToast();

  // 필터
  const [statusFilter, setStatusFilter] = useState('');

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
  }), [statusFilter]);

  const { items: receipts, loading, page, total, setPage, reload } = useAdminList<CashReceipt>(
    (params) => adminApi.getAllCashReceipts(params),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters,
      errorMessage: '현금영수증 목록을 불러오는데 실패했습니다.',
    },
  );

  // 취소 확인 모달
  const [cancelConfirm, setCancelConfirm] = useState<ConfirmState>(closedConfirm());
  const [cancelLoading, setCancelLoading] = useState(false);

  // 재발행 확인 모달
  const [reissueConfirm, setReissueConfirm] = useState<ConfirmState>(closedConfirm());
  const [reissueLoading, setReissueLoading] = useState(false);

  // 동기화 확인 모달
  const [syncConfirm, setSyncConfirm] = useState<ConfirmState>(closedConfirm());
  const [syncLoading, setSyncLoading] = useState(false);

  // ─── Handlers ─────────────────────────────────────

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      await adminApi.cancelCashReceipt(cancelConfirm.id);
      showToast({ message: '현금영수증이 취소되었습니다.', type: 'success' });
      setCancelConfirm(closedConfirm());
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '현금영수증 취소에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReissue = async () => {
    setReissueLoading(true);
    try {
      await adminApi.reissueCashReceipt(reissueConfirm.id);
      showToast({ message: '현금영수증이 재발행되었습니다.', type: 'success' });
      setReissueConfirm(closedConfirm());
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '현금영수증 재발행에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setReissueLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      await adminApi.syncCashReceipt(syncConfirm.id);
      showToast({ message: '현금영수증 상태가 동기화되었습니다.', type: 'success' });
      setSyncConfirm(closedConfirm());
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '현금영수증 동기화에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setSyncLoading(false);
    }
  };

  // ─── Columns ────────────────────────────────────────

  const columns: Column<CashReceipt>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: COLORS.grey500 }}>
          #{r.id}
        </span>
      ),
    },
    {
      key: 'orderId',
      header: '주문번호',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '13px' }}>
          #{r.orderId}
        </span>
      ),
    },
    {
      key: 'type',
      header: '유형',
      render: (r) => (
        <span style={{ fontSize: '13px', color: COLORS.grey700 }}>
          {TYPE_LABEL_MAP[r.type] ?? r.type}
        </span>
      ),
    },
    {
      key: 'identityNumber',
      header: '식별번호',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '13px', color: COLORS.grey600 }}>
          {maskIdentity(r.identityNumber)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: '금액',
      align: 'right',
      render: (r) => (
        <span style={{ fontWeight: 600 }}>
          {formatPrice(Number(r.amount))}
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      render: (r) => {
        const color = STATUS_COLOR_MAP.get(r.status) ?? 'elephant';
        return (
          <Badge color={color as any} variant="weak" size="small">
            {getStatusLabel(r.status)}
          </Badge>
        );
      },
    },
    {
      key: 'popbillNtsConfirmNum',
      header: '팝빌 승인번호',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: COLORS.grey500 }}>
          {r.popbillNtsConfirmNum ?? '-'}
        </span>
      ),
    },
    {
      key: 'issuedAt',
      header: '발행일',
      render: (r) => r.issuedAt ? (
        <div>
          <div style={{ fontSize: '13px' }}>{new Date(r.issuedAt).toLocaleDateString('ko-KR')}</div>
          <div className="admin-sub-text">{formatRelativeTime(r.issuedAt)}</div>
        </div>
      ) : (
        <span style={{ color: COLORS.grey400, fontSize: '13px' }}>-</span>
      ),
    },
    {
      key: 'actions',
      header: '작업',
      align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCancelConfirm({ open: true, id: r.id, label: `#${r.id}` })}
            aria-label={`현금영수증 #${r.id} 취소`}
          >
            취소
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReissueConfirm({ open: true, id: r.id, label: `#${r.id}` })}
            aria-label={`현금영수증 #${r.id} 재발행`}
          >
            재발행
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSyncConfirm({ open: true, id: r.id, label: `#${r.id}` })}
            aria-label={`현금영수증 #${r.id} 동기화`}
          >
            동기화
          </Button>
        </div>
      ),
    },
  ];

  // ─── Render ─────────────────────────────────────────

  return (
    <div className="admin-tab">
      {/* 페이지 헤더 */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">현금영수증 관리</h2>
          <p className="admin-page-desc">현금영수증 발행, 취소, 재발행을 관리합니다</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="admin-filter-card" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="admin-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="현금영수증 상태 필터"
        >
          <option value="">전체 상태</option>
          {CASH_RECEIPT_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 테이블 */}
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

      {/* 취소 확인 모달 */}
      <ConfirmModal
        isOpen={cancelConfirm.open}
        onClose={() => setCancelConfirm(closedConfirm())}
        onConfirm={handleCancel}
        title="현금영수증 취소"
        confirmLabel="취소 처리"
        danger
        loading={cancelLoading}
      >
        <p>
          현금영수증 <strong>{cancelConfirm.label}</strong>을(를) 취소하시겠습니까?
        </p>
        <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-caption)', color: COLORS.grey500 }}>
          취소된 현금영수증은 복구할 수 없습니다.
        </p>
      </ConfirmModal>

      {/* 재발행 확인 모달 */}
      <ConfirmModal
        isOpen={reissueConfirm.open}
        onClose={() => setReissueConfirm(closedConfirm())}
        onConfirm={handleReissue}
        title="현금영수증 재발행"
        confirmLabel="재발행"
        loading={reissueLoading}
      >
        <p>
          현금영수증 <strong>{reissueConfirm.label}</strong>을(를) 재발행하시겠습니까?
        </p>
      </ConfirmModal>

      {/* 동기화 확인 모달 */}
      <ConfirmModal
        isOpen={syncConfirm.open}
        onClose={() => setSyncConfirm(closedConfirm())}
        onConfirm={handleSync}
        title="현금영수증 상태 동기화"
        confirmLabel="동기화"
        loading={syncLoading}
      >
        <p>
          현금영수증 <strong>{syncConfirm.label}</strong>의 상태를 팝빌과 동기화하시겠습니까?
        </p>
      </ConfirmModal>
    </div>
  );
};

export default CashReceiptsTab;
