/**
 * @file PartnersTab.tsx
 * @description 파트너 사업자 정보 관리 — 목록 조회 및 검증/반려 처리
 */
import { useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { adminPartnerBusinessInfoApi } from '../../../api/manual';
import { Badge, Button, Modal, TextField } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { maskEmail } from '../../../utils';
import { formatDateTime } from '../../../utils/dateUtils';
import { COLORS, SPACING } from '../../../constants/designTokens';
import { ADMIN_PAGINATION } from '../constants';
import AdminDetailModal from '../components/AdminDetailModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList } from '../hooks';

// ─── Types ────────────────────────────────────────────

type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

interface PartnerBusinessInfo {
  id: number;
  partnerId: number;
  businessName: string;
  businessRegNo: string;
  representativeName: string;
  telecomSalesNo?: string;
  businessAddress?: string;
  businessType?: string;
  businessCategory?: string;
  verificationStatus: VerificationStatus;
  verificationNote?: string;
  verifiedAt?: string;
  verifiedBy?: number;
  createdAt: string;
  updatedAt: string;
  partner?: {
    id: number;
    name: string;
    email: string;
  };
}

interface VerifyModalState {
  open: boolean;
  infoId: number;
  partnerName: string;
  action: 'VERIFIED' | 'REJECTED';
  note: string;
}

// ─── Status helpers ───────────────────────────────────

const STATUS_LABEL: Record<VerificationStatus, string> = {
  PENDING: '검토 대기',
  VERIFIED: '인증 완료',
  REJECTED: '반려',
};

const STATUS_COLOR: Record<VerificationStatus, 'yellow' | 'green' | 'red'> = {
  PENDING: 'yellow',
  VERIFIED: 'green',
  REJECTED: 'red',
};

// ─── Component ────────────────────────────────────────

const PartnersTab = () => {
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState('');
  const [detailInfo, setDetailInfo] = useState<PartnerBusinessInfo | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifyModal, setVerifyModal] = useState<VerifyModalState>({
    open: false, infoId: 0, partnerName: '', action: 'VERIFIED', note: '',
  });

  const { items, loading, page, total, setPage, reload } = useAdminList<PartnerBusinessInfo>(
    (params) => adminPartnerBusinessInfoApi.getAll(params as any).then(r => r.data),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters: { status: statusFilter || undefined },
      errorMessage: '파트너 사업자 정보 목록을 불러오는데 실패했습니다.',
    },
  );

  // ── Detail ────────────────────────────────────────

  const openDetail = async (row: PartnerBusinessInfo) => {
    setDetailInfo(row);
    setDetailLoading(true);
    try {
      const res = await adminPartnerBusinessInfoApi.getByPartnerId(row.partnerId);
      setDetailInfo(res.data);
    } catch {
      // fallback to list row data already set above
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Verify ────────────────────────────────────────

  const openVerify = (info: PartnerBusinessInfo, action: 'VERIFIED' | 'REJECTED') => {
    setVerifyModal({
      open: true,
      infoId: info.id,
      partnerName: info.partner?.name || info.businessName,
      action,
      note: '',
    });
  };

  const handleVerify = async () => {
    const { infoId, action, note } = verifyModal;
    try {
      await adminPartnerBusinessInfoApi.verify(infoId, { status: action, note: note.trim() || undefined });
      showToast({
        message: action === 'VERIFIED' ? '사업자 정보가 인증되었습니다.' : '사업자 정보가 반려되었습니다.',
        type: 'success',
      });
      reload();
      // Refresh detail if open
      if (detailInfo && detailInfo.id === infoId) {
        setDetailInfo(prev => prev ? { ...prev, verificationStatus: action, verificationNote: note } : null);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || '처리에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setVerifyModal(prev => ({ ...prev, open: false }));
    }
  };

  // ── Table columns ─────────────────────────────────

  const columns: Column<PartnerBusinessInfo>[] = [
    {
      key: 'partner',
      header: '파트너',
      render: (row) => (
        <div>
          <button
            type="button"
            onClick={() => openDetail(row)}
            style={{ fontWeight: 600, cursor: 'pointer', color: COLORS.primary, background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left' }}
          >
            {row.partner?.name || row.businessName}
          </button>
          {row.partner?.email && (
            <div style={{ fontSize: '12px', color: COLORS.grey500 }}>{maskEmail(row.partner.email)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'businessName',
      header: '상호',
      render: (row) => <span>{row.businessName}</span>,
    },
    {
      key: 'businessRegNo',
      header: '사업자등록번호',
      render: (row) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{row.businessRegNo}</span>
      ),
    },
    {
      key: 'representativeName',
      header: '대표자',
      render: (row) => <span>{row.representativeName}</span>,
    },
    {
      key: 'verificationStatus',
      header: '검증 상태',
      render: (row) => (
        <Badge
          color={STATUS_COLOR[row.verificationStatus] ?? 'elephant'}
          size="xs"
          variant="fill"
        >
          {STATUS_LABEL[row.verificationStatus] ?? row.verificationStatus}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: '등록일',
      render: (row) => <span style={{ fontSize: '12px' }}>{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '작업',
      align: 'right',
      render: (row) => (
        <div className="admin-actions">
          {row.verificationStatus !== 'VERIFIED' && (
            <Button variant="success" size="sm" onClick={() => openVerify(row, 'VERIFIED')}>인증</Button>
          )}
          {row.verificationStatus !== 'REJECTED' && (
            <Button variant="secondary" size="sm" onClick={() => openVerify(row, 'REJECTED')}>반려</Button>
          )}
        </div>
      ),
    },
  ];

  // ─── Render ──────────────────────────────────────

  return (
    <div className="admin-tab">
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">파트너 사업자 정보</h2>
          <p className="admin-page-desc">파트너사의 사업자 등록 정보를 검토하고 인증합니다.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-filter-card">
        <select
          className="admin-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="검증 상태 필터"
        >
          <option value="">전체 상태</option>
          <option value="PENDING">검토 대기</option>
          <option value="VERIFIED">인증 완료</option>
          <option value="REJECTED">반려</option>
        </select>
      </div>

      {/* Table */}
      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={items}
          keyField="id"
          isLoading={loading}
          pagination={{
            currentPage: page,
            totalItems: total,
            itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
            onPageChange: setPage,
          }}
          emptyMessage="등록된 사업자 정보가 없습니다."
          caption="파트너 사업자 정보 목록"
        />
      </div>

      {/* Detail Modal */}
      <AdminDetailModal
        isOpen={!!detailInfo}
        onClose={() => setDetailInfo(null)}
        title="사업자 정보 상세"
        loading={detailLoading}
      >
        {detailInfo && (
          <>
            <AdminDetailModal.Section title="파트너 계정">
              <AdminDetailModal.InfoGrid columns={2}>
                <AdminDetailModal.InfoRow label="이름" value={detailInfo.partner?.name} />
                <AdminDetailModal.InfoRow label="이메일" value={detailInfo.partner?.email ? maskEmail(detailInfo.partner.email) : undefined} />
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            <AdminDetailModal.Section title="사업자 정보">
              <AdminDetailModal.InfoGrid columns={2}>
                <AdminDetailModal.InfoRow label="상호(회사명)" value={detailInfo.businessName} />
                <AdminDetailModal.InfoRow label="사업자등록번호" value={detailInfo.businessRegNo} mono />
                <AdminDetailModal.InfoRow label="대표자명" value={detailInfo.representativeName} />
                <AdminDetailModal.InfoRow label="통신판매업신고번호" value={detailInfo.telecomSalesNo || undefined} />
                <AdminDetailModal.InfoRow label="업태" value={detailInfo.businessType || undefined} />
                <AdminDetailModal.InfoRow label="종목" value={detailInfo.businessCategory || undefined} />
              </AdminDetailModal.InfoGrid>
              {detailInfo.businessAddress && (
                <div style={{ marginTop: SPACING[2] }}>
                  <AdminDetailModal.InfoRow label="사업장 주소" value={detailInfo.businessAddress} />
                </div>
              )}
            </AdminDetailModal.Section>

            <AdminDetailModal.Section title="검증 정보">
              <AdminDetailModal.StatusRow
                label="검증 상태"
                status={STATUS_LABEL[detailInfo.verificationStatus] ?? detailInfo.verificationStatus}
                color={STATUS_COLOR[detailInfo.verificationStatus] ?? 'elephant'}
              />
              {detailInfo.verificationNote && (
                <div style={{ marginTop: SPACING[2] }}>
                  <AdminDetailModal.InfoRow label="검증 메모" value={detailInfo.verificationNote} />
                </div>
              )}
              {detailInfo.verifiedAt && (
                <div style={{ marginTop: SPACING[2] }}>
                  <AdminDetailModal.InfoRow label="처리일" value={formatDateTime(detailInfo.verifiedAt)} />
                </div>
              )}
              <div style={{ marginTop: SPACING[2] }}>
                <AdminDetailModal.InfoGrid columns={2}>
                  <AdminDetailModal.InfoRow label="등록일" value={formatDateTime(detailInfo.createdAt)} />
                  <AdminDetailModal.InfoRow label="최종 수정" value={formatDateTime(detailInfo.updatedAt)} />
                </AdminDetailModal.InfoGrid>
              </div>
            </AdminDetailModal.Section>

            {detailInfo.verificationStatus !== 'VERIFIED' && (
              <div style={{ padding: `0 ${SPACING[1]}`, marginTop: SPACING[2], display: 'flex', gap: SPACING[2] }}>
                <Button
                  variant="success"
                  onClick={() => openVerify(detailInfo, 'VERIFIED')}
                  fullWidth
                >
                  인증 승인
                </Button>
                {detailInfo.verificationStatus !== 'REJECTED' && (
                  <Button
                    variant="secondary"
                    onClick={() => openVerify(detailInfo, 'REJECTED')}
                    fullWidth
                  >
                    반려
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        <AdminDetailModal.ActionBar>
          <Button variant="ghost" onClick={() => setDetailInfo(null)}>닫기</Button>
        </AdminDetailModal.ActionBar>
      </AdminDetailModal>

      {/* Verify Confirm Modal */}
      <Modal
        isOpen={verifyModal.open}
        onClose={() => setVerifyModal(prev => ({ ...prev, open: false }))}
        title={verifyModal.action === 'VERIFIED' ? '사업자 인증' : '사업자 정보 반려'}
        footer={
          <div style={{ display: 'flex', gap: SPACING[2], width: '100%' }}>
            <Button variant="ghost" onClick={() => setVerifyModal(prev => ({ ...prev, open: false }))} fullWidth>취소</Button>
            <Button
              variant={verifyModal.action === 'VERIFIED' ? 'success' : 'primary'}
              onClick={handleVerify}
              fullWidth
            >
              {verifyModal.action === 'VERIFIED' ? '인증' : '반려'}
            </Button>
          </div>
        }
      >
        <div style={{ padding: SPACING[4] }}>
          <p style={{ marginBottom: SPACING[4], color: COLORS.grey700 }}>
            <strong>{verifyModal.partnerName}</strong>의 사업자 정보를{' '}
            {verifyModal.action === 'VERIFIED' ? (
              <Badge color="green" variant="fill" size="sm">인증</Badge>
            ) : (
              <Badge color="red" variant="fill" size="sm">반려</Badge>
            )}
            하시겠습니까?
          </p>
          <div>
            <label className="admin-form-label">
              {verifyModal.action === 'REJECTED' ? '반려 사유 (필수)' : '메모 (선택)'}
            </label>
            <TextField
              variant="box"
              value={verifyModal.note}
              onChange={(e) => setVerifyModal(prev => ({ ...prev, note: e.target.value }))}
              placeholder={verifyModal.action === 'REJECTED' ? '반려 사유를 입력하세요.' : '인증 메모 (선택 사항)'}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PartnersTab;
