import { useState, useCallback } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Badge, Button } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatRelativeTime, maskEmail } from '../../../utils';
import { COLORS } from '../../../constants/designTokens';
import { ADMIN_PAGINATION } from '../constants';
import AdminDetailModal from '../components/AdminDetailModal';
import { exportToExcel } from '../utils/exportExcel';
import { useAdminList, useCheckboxSelect, useDebouncedSearch } from '../hooks';
import { useAdminContext } from '../AdminContext';

interface AdminGift {
  id: number;
  orderId: number;
  senderId: number;
  status?: string;
  sender?: { id: number; name: string; email: string };
  receiver?: { id: number; name: string; email: string };
  receiverPhone?: string;
  receiverName?: string;
  message?: string;
  expiresAt?: string;
  order?: { status: string; orderCode?: string | null };
  createdAt: string;
}

type GiftStatusFilter = '' | 'pending' | 'claimed' | 'expired';

const getGiftStatusDisplay = (g: AdminGift): { label: string; color: 'green' | 'yellow' | 'red' } => {
  const status = g.status?.toUpperCase();
  if (status === 'CLAIMED') return { label: '수령완료', color: 'green' };
  if (status === 'EXPIRED') return { label: '만료', color: 'red' };
  return { label: '대기중', color: 'yellow' };
};

const GIFT_EXPORT_COLUMNS = [
  { header: '선물번호', accessor: (g: AdminGift) => g.id },
  { header: '보낸사람', accessor: (g: AdminGift) => g.sender?.name || '-' },
  { header: '보낸사람 이메일', accessor: (g: AdminGift) => g.sender?.email || '-' },
  { header: '받는사람', accessor: (g: AdminGift) => g.receiver?.name || g.receiverName || '-' },
  { header: '받는사람 연락처', accessor: (g: AdminGift) => g.receiverPhone || g.receiver?.email || '-' },
  { header: '주문 번호', accessor: (g: AdminGift) => g.order?.orderCode || `#${g.orderId}` },
  { header: '메시지', accessor: (g: AdminGift) => g.message || '' },
  { header: '상태', accessor: (g: AdminGift) => getGiftStatusDisplay(g).label },
  { header: '발송일', accessor: (g: AdminGift) => new Date(g.createdAt).toLocaleString('ko-KR') },
];

const getId = (g: AdminGift) => g.id;

const GiftsTab = () => {
  const { setActiveTab } = useAdminContext();
  const { searchQuery, debouncedQuery, setSearchQuery } = useDebouncedSearch(400);
  const [statusFilter, setStatusFilter] = useState<GiftStatusFilter>('');
  const [detailGift, setDetailGift] = useState<AdminGift | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { showToast } = useToast();

  const { items: gifts, loading, page, total, setPage } = useAdminList<AdminGift>(
    (params) => adminApi.getAllGifts(params),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters: { status: statusFilter || undefined, search: debouncedQuery || undefined },
      errorMessage: '선물 목록을 불러오는데 실패했습니다.',
    },
  );

  const { selectedIds, allSelected, toggleSelect, toggleSelectAll, getSelectedItems } = useCheckboxSelect(gifts, getId);

  const handleViewDetail = useCallback(async (giftId: number) => {
    setDetailLoading(true);
    try {
      const detail = await adminApi.getGift(giftId);
      setDetailGift(detail);
    } catch {
      showToast({ message: '선물 상세 정보를 불러오는데 실패했습니다.', type: 'error' });
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

  const handleExportSelected = useCallback(() => {
    const rows = getSelectedItems(gifts);
    if (rows.length === 0) { showToast({ message: '내보낼 항목을 선택해주세요.', type: 'warning' }); return; }
    exportToExcel(rows, GIFT_EXPORT_COLUMNS, `선물내역_선택_${new Date().toISOString().slice(0, 10)}`);
    showToast({ message: `${rows.length}건을 엑셀로 내보냈습니다.`, type: 'success' });
  }, [gifts, getSelectedItems, showToast]);

  const handleExportAll = useCallback(() => {
    if (gifts.length === 0) { showToast({ message: '내보낼 데이터가 없습니다.', type: 'warning' }); return; }
    exportToExcel(gifts, GIFT_EXPORT_COLUMNS, `선물내역_전체_${new Date().toISOString().slice(0, 10)}`);
    showToast({ message: `${gifts.length}건을 엑셀로 내보냈습니다.`, type: 'success' });
  }, [gifts, showToast]);

  const columns: Column<AdminGift>[] = [
    {
      key: 'select', header: '',
      headerRender: () => (
        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="전체 선택" style={{ cursor: 'pointer' }} />
      ),
      render: (g) => (
        <input type="checkbox" checked={selectedIds.has(g.id)} onChange={() => toggleSelect(g.id)} aria-label={`선물 #${g.id} 선택`} style={{ cursor: 'pointer' }} />
      ),
    },
    {
      key: 'id', header: 'ID',
      render: (g) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewDetail(g.id)}
        >
          #{g.id}
        </Button>
      )
    },
    {
      key: 'sender', header: '보낸 사람',
      render: (g) => (
        <div>
          <span className="admin-user-name" style={{ fontWeight: 600 }}>{g.sender?.name || '-'}</span>
          {g.sender?.email && <div className="admin-sub-text">{maskEmail(g.sender.email)}</div>}
        </div>
      )
    },
    {
      key: 'receiver', header: '받는 사람',
      render: (g) => (
        <div>
          <span className="admin-user-name" style={{ fontWeight: 600 }}>{g.receiver?.name || g.receiverName || '-'}</span>
          <div className="admin-sub-text">{g.receiverPhone || maskEmail(g.receiver?.email) || '-'}</div>
        </div>
      )
    },
    {
      key: 'order', header: '주문',
      render: (g) => (
        <Button
          variant="ghost"
          size="sm"
          style={{ fontFamily: g.order?.orderCode ? 'var(--font-mono, monospace)' : 'inherit', fontSize: g.order?.orderCode ? '12px' : 'inherit' }}
          onClick={() => setActiveTab('orders')}
        >
          {g.order?.orderCode || `#${g.orderId}`}
        </Button>
      )
    },
    {
      key: 'message', header: '메시지',
      render: (g) => (
        <div style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: COLORS.grey600 }}>
          {g.message || '-'}
        </div>
      )
    },
    {
      key: 'status', header: '상태',
      render: (g) => {
        const { label, color } = getGiftStatusDisplay(g);
        return <Badge color={color} variant="weak" size="small">{label}</Badge>;
      }
    },
    {
      key: 'date', header: '발송일',
      render: (g) => (
        <div>
          <div>{new Date(g.createdAt).toLocaleDateString()}</div>
          <div className="admin-sub-text">{formatRelativeTime(g.createdAt)}</div>
        </div>
      )
    },
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">선물 관리</h2>
          <p className="admin-page-desc">선물 발송 및 수령 내역을 관리합니다</p>
        </div>
        <div className="admin-page-actions">
          <Button variant="ghost" size="sm" onClick={handleExportSelected} disabled={selectedIds.size === 0}>
            선택 다운로드 ({selectedIds.size})
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportAll}>
            전체 다운로드
          </Button>
        </div>
      </div>

      <div className="admin-filter-card">
        <select
          className="admin-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as GiftStatusFilter)}
          aria-label="상태 필터"
        >
          <option value="">전체</option>
          <option value="pending">대기중</option>
          <option value="claimed">수령완료</option>
          <option value="expired">만료</option>
        </select>
        <input
          type="search"
          className="admin-search-input admin-filter-search"
          placeholder="보낸 사람, 받는 사람, 전화번호 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="선물 검색"
        />
      </div>

      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={gifts}
          keyField="id"
          isLoading={loading}
          pagination={{ currentPage: page, totalItems: total, itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE, onPageChange: setPage }}
          emptyMessage="조건에 맞는 선물이 없습니다."
          caption="선물 목록"
        />
      </div>

      {/* 선물 상세 모달 */}
      <AdminDetailModal
        isOpen={detailGift !== null}
        onClose={() => setDetailGift(null)}
        title={detailGift ? `선물 상세 #${detailGift.id}` : '선물 상세'}
        loading={detailLoading}
      >
        {detailGift && (
          <>
            <AdminDetailModal.Section title="발신자 정보">
              <AdminDetailModal.InfoGrid>
                <AdminDetailModal.InfoRow label="이름" value={detailGift.sender?.name || '-'} />
                <AdminDetailModal.InfoRow label="이메일" value={detailGift.sender?.email || '-'} />
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            <AdminDetailModal.Section title="수신자 정보">
              <AdminDetailModal.InfoGrid>
                <AdminDetailModal.InfoRow label="이름" value={detailGift.receiver?.name || detailGift.receiverName || '-'} />
                <AdminDetailModal.InfoRow label="연락처" value={detailGift.receiverPhone || detailGift.receiver?.email || '-'} />
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            <AdminDetailModal.Section title="주문 정보">
              <AdminDetailModal.InfoGrid>
                <AdminDetailModal.InfoRow label="주문 번호" value={detailGift.order?.orderCode || `#${detailGift.orderId}`} />
                <AdminDetailModal.StatusRow
                  label="주문 상태"
                  status={detailGift.order?.status || '-'}
                  color={detailGift.order?.status === 'PAID' ? 'green' : detailGift.order?.status === 'CANCELLED' ? 'red' : 'yellow'}
                />
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            {detailGift.message && (
              <AdminDetailModal.Section title="메시지">
                <div style={{ color: COLORS.grey700, whiteSpace: 'pre-wrap' }}>{detailGift.message}</div>
              </AdminDetailModal.Section>
            )}

            <AdminDetailModal.Section title="선물 상태">
              {(() => {
                const { label, color } = getGiftStatusDisplay(detailGift);
                return <AdminDetailModal.StatusRow label="상태" status={label} color={color} />;
              })()}
            </AdminDetailModal.Section>

            <AdminDetailModal.Section title="처리 이력">
              <AdminDetailModal.Timeline
                items={[
                  { label: '발송', date: new Date(detailGift.createdAt).toLocaleString('ko-KR'), active: true },
                  { label: '만료 예정', date: detailGift.expiresAt ? new Date(detailGift.expiresAt).toLocaleString('ko-KR') : null },
                ]}
              />
            </AdminDetailModal.Section>

            <AdminDetailModal.ActionBar>
              <Button variant="ghost" onClick={() => setDetailGift(null)}>닫기</Button>
            </AdminDetailModal.ActionBar>
          </>
        )}
      </AdminDetailModal>
    </div>
  );
};

export default GiftsTab;
