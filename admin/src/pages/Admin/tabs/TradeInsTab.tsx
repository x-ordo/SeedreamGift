import { useState, useCallback } from 'react';
import siteConfig from '../../../../../site.config.json';
import { Download } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import type { PinOption } from '../../../api/manual';
import { Badge, Modal, Button, TextField } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatPrice, formatRelativeTime, maskEmail } from '../../../utils';
import { COLORS, SPACING } from '../../../constants/designTokens';
import { TRADEIN_STATUS_COLOR_MAP, TRADEIN_STATUS_OPTIONS, ADMIN_PAGINATION, BRAND_LABEL_MAP, BRAND_OPTIONS } from '../constants';
import { exportBankSubmissionReport } from '../utils/exportExcel';
import type { TradeInPayoutRow, TradeInPayoutSummary } from '../utils/exportExcel';
import AdminDetailModal from '../components/AdminDetailModal';
import { useAdminList, useDebouncedSearch } from '../hooks';

interface TradeIn {
  id: number;
  user?: { id: number; name: string; email: string; phone?: string; bankName?: string; accountNumber?: string; accountHolder?: string };
  brandCode: string;
  productName: string;
  amount: number;
  tradeInRate?: number;
  buyPrice?: number;
  status: string;
  adminNote?: string;
  rejectionReason?: string;
  createdAt: string;
  verifiedAt?: string;
  paidAt?: string;
  receivedAt?: string;
  trackingNumber?: string;
  carrier?: string;
  transferRef?: string;
  inspectionNote?: string;
}

interface RejectModalState {
  open: boolean;
  tradeInId: number;
  reason: string;
}

interface ReceiveModalState {
  open: boolean;
  tradeInId: number;
  carrier: string;
  trackingNumber: string;
}

const CARRIER_OPTIONS = [
  { value: 'CJ대한통운', label: 'CJ대한통운' },
  { value: '한진택배', label: '한진택배' },
  { value: '우체국', label: '우체국' },
  { value: '로젠', label: '로젠' },
  { value: '롯데', label: '롯데' },
  { value: '기타', label: '기타' },
];

const getStatusLabel = (status: string) =>
  TRADEIN_STATUS_OPTIONS.find(o => o.value === status)?.label || status;

const TradeInsTab = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const { searchQuery, debouncedQuery, setSearchQuery } = useDebouncedSearch(400);
  const [rejectModal, setRejectModal] = useState<RejectModalState>({ open: false, tradeInId: 0, reason: '' });
  const [receiveModal, setReceiveModal] = useState<ReceiveModalState>({ open: false, tradeInId: 0, carrier: 'CJ대한통운', trackingNumber: '' });
  const [detailTradeIn, setDetailTradeIn] = useState<TradeIn | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { showToast } = useToast();

  // 증빙 다운로드 상태
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportPinOption, setExportPinOption] = useState<PinOption>('masked');
  const [exporting, setExporting] = useState(false);

  const { items: tradeIns, loading, page, total, setPage, reload } = useAdminList<TradeIn>(
    (params) => adminApi.getAllTradeIns(params),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters: {
        status: statusFilter || undefined,
        search: debouncedQuery || undefined,
        brandCode: brandFilter || undefined,
      },
      errorMessage: '매입 신청 목록을 불러오는데 실패했습니다.',
    },
  );

  const handleStatusChange = async (id: number, newStatus: string) => {
    if (newStatus === 'REJECTED') {
      setRejectModal({ open: true, tradeInId: id, reason: '' });
      return;
    }
    if (newStatus === 'RECEIVED') {
      setReceiveModal({ open: true, tradeInId: id, carrier: 'CJ대한통운', trackingNumber: '' });
      return;
    }

    try {
      await adminApi.updateTradeInStatus(id, { status: newStatus });
      showToast({ message: `상태가 ${getStatusLabel(newStatus)}(으)로 변경되었습니다.`, type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '상태 변경에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    }
  };

  const handleReject = async () => {
    const { tradeInId, reason } = rejectModal;
    if (!reason.trim()) {
      showToast({ message: '거절 사유를 입력해주세요.', type: 'error' });
      return;
    }

    try {
      await adminApi.updateTradeInStatus(tradeInId, { status: 'REJECTED', reason });
      showToast({ message: '매입 신청이 거절되었습니다.', type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '거절 처리에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setRejectModal({ open: false, tradeInId: 0, reason: '' });
    }
  };

  const handleReceive = async () => {
    const { tradeInId, trackingNumber, carrier } = receiveModal;
    if (!trackingNumber.trim()) {
      showToast({ message: '송장번호를 입력해주세요.', type: 'error' });
      return;
    }

    try {
      await adminApi.receiveTradeIn(tradeInId, trackingNumber.trim(), carrier);
      showToast({ message: '수령 확인이 완료되었습니다.', type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '수령 확인 처리에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setReceiveModal({ open: false, tradeInId: 0, carrier: 'CJ대한통운', trackingNumber: '' });
    }
  };

  const handleViewDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const detail = await adminApi.getTradeIn(id);
      setDetailTradeIn(detail);
    } catch {
      showToast({ message: '매입 상세 정보를 불러오는데 실패했습니다.', type: 'error' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExportPayoutReport = useCallback(async () => {
    if (!exportStartDate || !exportEndDate) {
      showToast({ message: '시작일과 종료일을 선택해주세요.', type: 'error' });
      return;
    }
    setExporting(true);
    try {
      const result = await adminApi.getTradeInPayoutReport({
        startDate: exportStartDate,
        endDate: exportEndDate,
        status: statusFilter || undefined,
        brandCode: brandFilter || undefined,
        pinOption: exportPinOption,
      });
      const items = result?.items as TradeInPayoutRow[] || [];
      const summary = result?.summary as TradeInPayoutSummary;
      if (items.length === 0) {
        showToast({ message: '해당 기간에 매입 내역이 없습니다.', type: 'info' });
        return;
      }
      exportBankSubmissionReport(items, summary, { buyerName: siteConfig.company.nameShort, role: 'admin' });
      showToast({ message: '매입 증빙 엑셀이 다운로드되었습니다.', type: 'success' });
      setShowExportModal(false);
    } catch {
      showToast({ message: '매입 증빙 다운로드에 실패했습니다.', type: 'error' });
    } finally {
      setExporting(false);
    }
  }, [exportStartDate, exportEndDate, exportPinOption, statusFilter, brandFilter, showToast]);

  const columns: Column<TradeIn>[] = [
    {
      key: 'id', header: 'ID',
      render: (t) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewDetail(t.id)}
        >
          #{t.id}
        </Button>
      )
    },
    {
      key: 'user', header: '신청자',
      render: (t) => (
        <div>
          <span className="admin-user-name" style={{ fontWeight: 600 }}>{t.user?.name || 'N/A'}</span>
          {t.user?.email && <div className="admin-sub-text">{maskEmail(t.user.email)}</div>}
        </div>
      )
    },
    {
      key: 'product', header: '상품',
      render: (t) => (
        <div>
          <div className="admin-user-name">{t.productName || '-'}</div>
          <div className="admin-sub-text" style={{ color: COLORS.primary }}>
            {BRAND_LABEL_MAP.get(t.brandCode as any) || t.brandCode}
          </div>
        </div>
      )
    },
    { key: 'amount', header: '금액', align: 'right', render: (t) => formatPrice(Number(t.amount)) },
    {
      key: 'status', header: '상태',
      render: (t) => (
        <Badge
          color={TRADEIN_STATUS_COLOR_MAP.get(t.status) as any || 'elephant'}
          variant="weak"
          size="small"
        >
          {getStatusLabel(t.status)}
        </Badge>
      )
    },
    {
      key: 'date', header: '신청일',
      render: (t) => (
        <div>
          <div>{new Date(t.createdAt).toLocaleDateString()}</div>
          <div className="admin-sub-text">{formatRelativeTime(t.createdAt)}</div>
        </div>
      )
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (t) => (
        <select
          className="admin-status-select"
          value={t.status}
          onChange={e => {
            const newStatus = e.target.value;
            e.target.value = t.status;
            if (newStatus !== t.status) {
              handleStatusChange(t.id, newStatus);
            }
          }}
          aria-label={`매입 신청 #${t.id} 상태 변경`}
        >
          {TRADEIN_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    }
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">매입 관리</h2>
          <p className="admin-page-desc">상품권 매입 신청을 검증하고 정산합니다</p>
        </div>
        <div className="admin-page-actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowExportModal(true)}
            aria-label="매입 증빙 엑셀 다운로드"
          >
            <Download size={14} aria-hidden="true" style={{ marginRight: '4px' }} />
            증빙 다운로드
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <div className="admin-filter-card">
        <select
          className="admin-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="상태 필터"
        >
          <option value="">전체 상태</option>
          {TRADEIN_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="admin-filter-select"
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          aria-label="브랜드 필터"
        >
          <option value="">전체 브랜드</option>
          {BRAND_OPTIONS.map(brand => (
            <option key={brand.value} value={brand.value}>{brand.label}</option>
          ))}
        </select>
        <input
          type="search"
          className="admin-search-input admin-filter-search"
          placeholder="신청자 이름, 이메일 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="매입 검색"
        />
      </div>

      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={tradeIns}
          keyField="id"
          isLoading={loading}
          pagination={{
            currentPage: page,
            totalItems: total,
            itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
            onPageChange: setPage
          }}
          emptyMessage="조건에 맞는 매입 신청이 없습니다."
          caption="매입 신청 목록"
        />
      </div>

      {/* 거절 사유 입력 모달 */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ ...rejectModal, open: false })}
        title="매입 거절 사유"
      >
        <div style={{ padding: SPACING[4] }}>
          <p style={{ marginBottom: SPACING[3], color: COLORS.grey600, fontSize: '14px' }}>
            거절 사유를 입력해주세요. 이 사유는 사용자에게 안내됩니다.
          </p>
          <textarea
            className="form-control"
            value={rejectModal.reason}
            onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
            placeholder="예: PIN 번호가 유효하지 않습니다."
            rows={4}
            style={{ resize: 'vertical', marginBottom: SPACING[4] }}
            autoFocus
          />
          <div className="admin-form-footer">
            <Button variant="ghost" onClick={() => setRejectModal({ ...rejectModal, open: false })}>
              취소
            </Button>
            <Button
              variant="primary"
              style={{ backgroundColor: COLORS.error }}
              onClick={handleReject}
              disabled={!rejectModal.reason.trim()}
            >
              거절
            </Button>
          </div>
        </div>
      </Modal>

      {/* 수령 확인 모달 */}
      <Modal
        isOpen={receiveModal.open}
        onClose={() => setReceiveModal({ ...receiveModal, open: false })}
        title="수령 확인"
      >
        <div style={{ padding: SPACING[4] }}>
          <p style={{ marginBottom: SPACING[3], color: COLORS.grey600, fontSize: '14px' }}>
            택배 정보를 입력하여 수령을 확인합니다.
          </p>
          <div style={{ marginBottom: SPACING[3] }}>
            <label className="admin-form-label" style={{ display: 'block', marginBottom: SPACING[1], fontSize: '13px', fontWeight: 600 }}>택배사</label>
            <select
              className="admin-filter-select"
              value={receiveModal.carrier}
              onChange={(e) => setReceiveModal({ ...receiveModal, carrier: e.target.value })}
              style={{ width: '100%', padding: '8px 12px' }}
              aria-label="택배사 선택"
            >
              {CARRIER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: SPACING[4] }}>
            <label className="admin-form-label" style={{ display: 'block', marginBottom: SPACING[1], fontSize: '13px', fontWeight: 600 }}>송장번호</label>
            <TextField
              variant="box"
              value={receiveModal.trackingNumber}
              onChange={(e) => setReceiveModal({ ...receiveModal, trackingNumber: e.target.value })}
              placeholder="송장번호를 입력해주세요"
              aria-label="송장번호"
            />
          </div>
          <div className="admin-form-footer">
            <Button variant="ghost" onClick={() => setReceiveModal({ ...receiveModal, open: false })}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleReceive}
              disabled={!receiveModal.trackingNumber.trim()}
            >
              수령 확인
            </Button>
          </div>
        </div>
      </Modal>

      {/* 증빙 다운로드 모달 */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="매입 증빙 다운로드"
        size="small"
        footer={
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowExportModal(false)} disabled={exporting}>
              취소
            </Button>
            <Button variant="primary" onClick={handleExportPayoutReport} loading={exporting}>
              다운로드
            </Button>
          </div>
        }
      >
        <div style={{ marginBottom: SPACING[4] }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: SPACING[2] }}>조회 기간</div>
          <div style={{ display: 'flex', gap: SPACING[2], alignItems: 'center' }}>
            <TextField
              variant="box"
              type="date"
              value={exportStartDate}
              onChange={(e) => setExportStartDate(e.target.value)}
              aria-label="시작일"
            />
            <span>~</span>
            <TextField
              variant="box"
              type="date"
              value={exportEndDate}
              onChange={(e) => setExportEndDate(e.target.value)}
              aria-label="종료일"
            />
          </div>
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: SPACING[2] }}>PIN 번호</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING[2] }} role="radiogroup" aria-label="PIN 옵션">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <input type="radio" name="exportPin" value="full" checked={exportPinOption === 'full'} onChange={() => setExportPinOption('full')} />
              전체 표시
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <input type="radio" name="exportPin" value="masked" checked={exportPinOption === 'masked'} onChange={() => setExportPinOption('masked')} />
              마스킹 (앞 4자리만)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <input type="radio" name="exportPin" value="none" checked={exportPinOption === 'none'} onChange={() => setExportPinOption('none')} />
              제외
            </label>
          </div>
        </div>
        <p style={{ marginTop: SPACING[3], fontSize: '12px', color: COLORS.grey600 }}>
          현재 상태/브랜드 필터가 적용됩니다. 2-Sheet 은행제출용 엑셀이 생성됩니다.
        </p>
      </Modal>

      {/* 매입 상세 모달 */}
      <AdminDetailModal
        isOpen={detailTradeIn !== null}
        onClose={() => setDetailTradeIn(null)}
        title={detailTradeIn ? `매입 신청 상세 #${detailTradeIn.id}` : '매입 상세'}
        loading={detailLoading}
      >
        {detailTradeIn && (
          <>
            {/* 신청자 정보 */}
            <AdminDetailModal.Section title="신청자 정보">
              <AdminDetailModal.InfoGrid>
                <AdminDetailModal.InfoRow label="이름" value={detailTradeIn.user?.name || 'N/A'} />
                <AdminDetailModal.InfoRow label="이메일" value={detailTradeIn.user?.email || 'N/A'} />
                {detailTradeIn.user?.phone && (
                  <AdminDetailModal.InfoRow label="전화" value={detailTradeIn.user.phone} />
                )}
                {detailTradeIn.user?.bankName && (
                  <AdminDetailModal.InfoRow label="은행" value={detailTradeIn.user.bankName} />
                )}
                {detailTradeIn.user?.accountHolder && (
                  <AdminDetailModal.InfoRow label="예금주" value={detailTradeIn.user.accountHolder} />
                )}
                {detailTradeIn.user?.accountNumber && (
                  <AdminDetailModal.InfoRow
                    label="계좌"
                    value={detailTradeIn.user.accountNumber.replace(/(.{4}).*(.{4})/, '$1****$2')}
                    mono
                  />
                )}
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            {/* 상품 정보 */}
            <AdminDetailModal.Section title="상품 정보">
              <AdminDetailModal.InfoGrid>
                <AdminDetailModal.InfoRow label="브랜드" value={BRAND_LABEL_MAP.get(detailTradeIn.brandCode as any) || detailTradeIn.brandCode} />
                <AdminDetailModal.InfoRow label="상품명" value={detailTradeIn.productName || '-'} />
                <AdminDetailModal.InfoRow label="액면가" value={formatPrice(Number(detailTradeIn.amount))} />
                {detailTradeIn.tradeInRate != null && (
                  <AdminDetailModal.InfoRow label="매입률" value={`${detailTradeIn.tradeInRate}%`} />
                )}
                {detailTradeIn.buyPrice != null && (
                  <AdminDetailModal.InfoRow
                    label="매입가"
                    value={<span style={{ fontWeight: 700, color: COLORS.primary }}>{formatPrice(Number(detailTradeIn.buyPrice))}</span>}
                    fullWidth
                  />
                )}
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            {/* 처리 상태 */}
            <AdminDetailModal.Section title="처리 상태">
              <AdminDetailModal.StatusRow
                label="상태"
                status={getStatusLabel(detailTradeIn.status)}
                color={TRADEIN_STATUS_COLOR_MAP.get(detailTradeIn.status) || 'elephant'}
              />
              {detailTradeIn.adminNote && (
                <div style={{ marginTop: SPACING[2] }}>
                  <AdminDetailModal.InfoRow label="관리자 메모" value={detailTradeIn.adminNote} fullWidth />
                </div>
              )}
            </AdminDetailModal.Section>

            {/* 택배 / 수령 정보 */}
            {(detailTradeIn.carrier || detailTradeIn.trackingNumber || detailTradeIn.receivedAt || detailTradeIn.transferRef || detailTradeIn.inspectionNote) && (
              <AdminDetailModal.Section title="수령 / 정산 정보">
                <AdminDetailModal.InfoGrid>
                  {detailTradeIn.carrier && (
                    <AdminDetailModal.InfoRow label="택배사" value={detailTradeIn.carrier} />
                  )}
                  {detailTradeIn.trackingNumber && (
                    <AdminDetailModal.InfoRow label="송장번호" value={detailTradeIn.trackingNumber} mono />
                  )}
                  {detailTradeIn.receivedAt && (
                    <AdminDetailModal.InfoRow label="수령 확인일" value={new Date(detailTradeIn.receivedAt).toLocaleString('ko-KR')} />
                  )}
                  {detailTradeIn.transferRef && (
                    <AdminDetailModal.InfoRow label="이체 확인번호" value={detailTradeIn.transferRef} mono />
                  )}
                  {detailTradeIn.inspectionNote && (
                    <AdminDetailModal.InfoRow label="검수 메모" value={detailTradeIn.inspectionNote} fullWidth />
                  )}
                </AdminDetailModal.InfoGrid>
              </AdminDetailModal.Section>
            )}

            {/* 거절 사유 */}
            {detailTradeIn.rejectionReason && (
              <AdminDetailModal.Section title="거절 사유" variant="error">
                <div style={{ color: COLORS.grey700 }}>{detailTradeIn.rejectionReason}</div>
              </AdminDetailModal.Section>
            )}

            {/* 처리 타임라인 */}
            <AdminDetailModal.Section title="처리 이력">
              <AdminDetailModal.Timeline
                items={[
                  {
                    label: '신청',
                    date: new Date(detailTradeIn.createdAt).toLocaleString('ko-KR'),
                    active: !detailTradeIn.verifiedAt && !detailTradeIn.paidAt,
                  },
                  {
                    label: '검증',
                    date: detailTradeIn.verifiedAt
                      ? new Date(detailTradeIn.verifiedAt).toLocaleString('ko-KR')
                      : null,
                    active: !!detailTradeIn.verifiedAt && !detailTradeIn.paidAt,
                  },
                  {
                    label: '지급',
                    date: detailTradeIn.paidAt
                      ? new Date(detailTradeIn.paidAt).toLocaleString('ko-KR')
                      : null,
                    active: !!detailTradeIn.paidAt,
                  },
                ]}
              />
            </AdminDetailModal.Section>

            <AdminDetailModal.ActionBar>
              <Button variant="ghost" onClick={() => setDetailTradeIn(null)}>닫기</Button>
            </AdminDetailModal.ActionBar>
          </>
        )}
      </AdminDetailModal>
    </div>
  );
};

export default TradeInsTab;
