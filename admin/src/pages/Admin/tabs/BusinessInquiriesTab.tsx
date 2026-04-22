import { useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Badge, Modal } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatRelativeTime } from '../../../utils';
import { COLORS, SPACING } from '../../../constants/designTokens';
import { ADMIN_PAGINATION } from '../constants';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList, useDeleteConfirm } from '../hooks';

// ─── Types ──────────────────────────────────────────

interface BusinessInquiry {
  id: number;
  companyName: string;
  businessRegNo: string;
  businessOpenDate: string;
  repName: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
  message: string;
  status: 'NEW' | 'READ' | 'REPLIED';
  ipAddress: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ──────────────────────────────────────

const BUSINESS_INQUIRY_STATUS_OPTIONS = [
  { value: 'NEW', label: '신규', color: 'orange' },
  { value: 'READ', label: '확인됨', color: 'blue' },
  { value: 'REPLIED', label: '답변완료', color: 'green' },
] as const;

const BUSINESS_INQUIRY_STATUS_COLOR_MAP = new Map(
  BUSINESS_INQUIRY_STATUS_OPTIONS.map(o => [o.value, o.color]),
);

const BUSINESS_INQUIRY_CATEGORY_OPTIONS = [
  { value: '제휴문의', label: '제휴문의' },
  { value: '입점문의', label: '입점문의' },
  { value: '대량구매', label: '대량구매' },
  { value: '기타', label: '기타' },
];

const BUSINESS_INQUIRY_CATEGORY_LABEL_MAP = new Map(
  BUSINESS_INQUIRY_CATEGORY_OPTIONS.map(o => [o.value, o.label]),
);

// ─── Component ──────────────────────────────────────

const BusinessInquiriesTab = () => {
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<BusinessInquiry | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const { showToast } = useToast();

  const { items: inquiries, loading, page, total, setPage, reload } = useAdminList<BusinessInquiry>(
    (params) => adminApi.getBusinessInquiries(params as any),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      errorMessage: '사업 문의 목록을 불러오는데 실패했습니다.',
    },
  );

  const deleteConfirm = useDeleteConfirm<number>({
    deleteFn: (id) => adminApi.deleteBusinessInquiry(id),
    onSuccess: reload,
    successMessage: '삭제되었습니다.',
    errorMessage: '사업 문의 삭제에 실패했습니다.',
  });

  const handleOpenDetail = async (inquiry: BusinessInquiry) => {
    try {
      const detail = await adminApi.getBusinessInquiry(inquiry.id);
      setSelectedInquiry(detail);
      setDetailOpen(true);
      // If status is NEW, auto-advance to READ
      if (detail.status === 'NEW') {
        try {
          await adminApi.updateBusinessInquiryStatus(detail.id, 'READ');
          setSelectedInquiry((prev) => prev ? { ...prev, status: 'READ' } : prev);
          reload();
        } catch {
          // non-critical
        }
      }
    } catch {
      showToast({ message: '사업 문의 상세를 불러오는데 실패했습니다.', type: 'error' });
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedInquiry) return;
    setStatusUpdating(true);
    try {
      await adminApi.updateBusinessInquiryStatus(selectedInquiry.id, newStatus);
      setSelectedInquiry((prev) => prev ? { ...prev, status: newStatus as BusinessInquiry['status'] } : prev);
      showToast({ message: '상태가 변경되었습니다.', type: 'success' });
      reload();
    } catch {
      showToast({ message: '상태 변경에 실패했습니다.', type: 'error' });
    } finally {
      setStatusUpdating(false);
    }
  };

  const columns: Column<BusinessInquiry>[] = [
    { key: 'id', header: 'ID', render: (n) => <span className="admin-mono">#{n.id}</span> },
    {
      key: 'companyName', header: '회사명',
      render: (n) => <div className="admin-user-name">{n.companyName}</div>,
    },
    { key: 'contactName', header: '담당자', render: (n) => n.contactName },
    { key: 'email', header: '이메일', render: (n) => <span className="admin-sub-text">{n.email}</span> },
    {
      key: 'category', header: '카테고리',
      render: (n) => (
        <Badge color="blue" variant="weak">
          {BUSINESS_INQUIRY_CATEGORY_LABEL_MAP.get(n.category) || n.category}
        </Badge>
      ),
    },
    {
      key: 'status', header: '상태',
      render: (n) => (
        <Badge color={(BUSINESS_INQUIRY_STATUS_COLOR_MAP.get(n.status) || 'elephant') as any} variant="weak">
          {BUSINESS_INQUIRY_STATUS_OPTIONS.find(o => o.value === n.status)?.label || n.status}
        </Badge>
      ),
    },
    {
      key: 'createdAt', header: '접수일',
      render: (n) => (
        <div>
          <div>{new Date(n.createdAt).toLocaleDateString()}</div>
          <div className="admin-sub-text">{formatRelativeTime(n.createdAt)}</div>
        </div>
      ),
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (n) => (
        <div className="admin-actions">
          <Button variant="ghost" size="sm" type="button" onClick={() => handleOpenDetail(n)}>상세</Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            style={{ color: COLORS.error }}
            onClick={() => deleteConfirm.openConfirm(n.id, n.companyName)}
          >
            삭제
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">사업 제휴 문의 관리</h2>
          <p className="admin-page-desc">기업 파트너십 및 대량 구매 문의를 관리합니다</p>
        </div>
      </div>

      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={inquiries}
          keyField="id"
          isLoading={loading}
          pagination={{
            currentPage: page,
            totalItems: total,
            itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
            onPageChange: setPage,
          }}
          emptyMessage="사업 문의가 없습니다."
          caption="사업 제휴 문의 목록"
        />
      </div>

      {/* Detail Modal */}
      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="사업 문의 상세" size="lg">
        {selectedInquiry && (
          <div style={{ padding: SPACING[4] }}>
            {/* Header row: category + status badge + date */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[3] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACING[2] }}>
                <Badge color="blue" variant="weak">
                  {BUSINESS_INQUIRY_CATEGORY_LABEL_MAP.get(selectedInquiry.category) || selectedInquiry.category}
                </Badge>
                <span style={{ fontSize: '13px', color: COLORS.grey500 }}>
                  {new Date(selectedInquiry.createdAt).toLocaleString()}
                </span>
              </div>
              <Badge
                color={(BUSINESS_INQUIRY_STATUS_COLOR_MAP.get(selectedInquiry.status) || 'elephant') as any}
                variant="weak"
              >
                {BUSINESS_INQUIRY_STATUS_OPTIONS.find(o => o.value === selectedInquiry.status)?.label || selectedInquiry.status}
              </Badge>
            </div>

            {/* Company / contact info */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: `${SPACING[2]} ${SPACING[4]}`,
              marginBottom: SPACING[4],
              padding: SPACING[3],
              background: COLORS.grey50,
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
            }}>
              <div>
                <span style={{ color: COLORS.grey500, fontWeight: 500 }}>회사명</span>
                <div style={{ marginTop: '2px', fontWeight: 600 }}>{selectedInquiry.companyName}</div>
              </div>
              <div>
                <span style={{ color: COLORS.grey500, fontWeight: 500 }}>사업자등록번호</span>
                <div style={{ marginTop: '2px', fontFamily: 'monospace' }}>{selectedInquiry.businessRegNo}</div>
              </div>
              <div>
                <span style={{ color: COLORS.grey500, fontWeight: 500 }}>개업일자</span>
                <div style={{ marginTop: '2px' }}>{selectedInquiry.businessOpenDate}</div>
              </div>
              <div>
                <span style={{ color: COLORS.grey500, fontWeight: 500 }}>대표자</span>
                <div style={{ marginTop: '2px' }}>{selectedInquiry.repName}</div>
              </div>
              <div>
                <span style={{ color: COLORS.grey500, fontWeight: 500 }}>담당자</span>
                <div style={{ marginTop: '2px' }}>{selectedInquiry.contactName}</div>
              </div>
              <div>
                <span style={{ color: COLORS.grey500, fontWeight: 500 }}>이메일</span>
                <div style={{ marginTop: '2px' }}>{selectedInquiry.email}</div>
              </div>
              <div>
                <span style={{ color: COLORS.grey500, fontWeight: 500 }}>연락처</span>
                <div style={{ marginTop: '2px' }}>{selectedInquiry.phone}</div>
              </div>
              <div>
                <span style={{ color: COLORS.grey500, fontWeight: 500 }}>접속 IP</span>
                <div style={{ marginTop: '2px', fontFamily: 'monospace', fontSize: '12px', color: COLORS.grey500 }}>{selectedInquiry.ipAddress}</div>
              </div>
            </div>

            {/* Message */}
            <div style={{ marginBottom: SPACING[4] }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: COLORS.grey700, marginBottom: SPACING[2] }}>문의 내용</div>
              <div style={{
                backgroundColor: COLORS.grey50, borderRadius: 'var(--radius-md)',
                padding: SPACING[4], whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '14px',
              }}>
                {selectedInquiry.message}
              </div>
            </div>

            {/* Admin note if present */}
            {selectedInquiry.adminNote && (
              <div style={{ marginBottom: SPACING[4] }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: COLORS.grey700, marginBottom: SPACING[2] }}>관리자 메모</div>
                <div style={{
                  backgroundColor: '#fffbeb', borderRadius: 'var(--radius-md)',
                  padding: SPACING[3], fontSize: '13px', color: COLORS.grey700,
                  border: '1px solid #fde68a',
                }}>
                  {selectedInquiry.adminNote}
                </div>
              </div>
            )}

            {/* Status update */}
            <div style={{ marginBottom: SPACING[4] }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: COLORS.grey700, display: 'block', marginBottom: SPACING[2] }}>
                상태 변경
              </label>
              <div style={{ display: 'flex', gap: SPACING[2] }}>
                {BUSINESS_INQUIRY_STATUS_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={selectedInquiry.status === opt.value ? 'primary' : 'ghost'}
                    size="sm"
                    type="button"
                    loading={statusUpdating && selectedInquiry.status !== opt.value}
                    disabled={selectedInquiry.status === opt.value}
                    onClick={() => handleStatusUpdate(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="admin-form-footer" style={{ marginTop: SPACING[2] }}>
              <Button variant="ghost" type="button" onClick={() => setDetailOpen(false)}>닫기</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.closeConfirm}
        onConfirm={deleteConfirm.executeDelete}
        title="사업 문의 삭제"
        confirmLabel="삭제"
        danger
      >
        <p>
          <strong>"{deleteConfirm.targetLabel}"</strong> 문의를 삭제하시겠습니까?
          <br />
          <span style={{ fontSize: '13px', color: COLORS.grey500 }}>이 작업은 되돌릴 수 없습니다.</span>
        </p>
      </ConfirmModal>
    </div>
  );
};

export default BusinessInquiriesTab;
