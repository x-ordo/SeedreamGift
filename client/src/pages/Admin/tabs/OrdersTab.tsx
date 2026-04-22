
import { useState, useCallback } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Badge, Button, TextField } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatPrice, formatRelativeTime, maskEmail } from '../../../utils';
import { COLORS, SPACING } from '../../../constants/designTokens';
import { ORDER_STATUS_COLOR_MAP, ORDER_STATUS_OPTIONS, ADMIN_PAGINATION } from '../constants';
import AdminDetailModal from '../components/AdminDetailModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { exportToExcel, exportBankReport } from '../utils/exportExcel';
import type { PinOption } from '../utils/exportExcel';
import { useAdminList, useCheckboxSelect, useDebouncedSearch } from '../hooks';

interface OrderItem {
  id: number;
  productName: string;
  product?: { id: number; name: string };
  quantity: number;
  unitPrice: number;
  subtotal: number;
  vouchers?: Array<{ id: number; pinCode?: string; status: string }>;
}

interface Order {
  id: number;
  orderCode?: string | null;
  user?: { id: number; name: string; email: string; phone?: string };
  totalAmount: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  items?: OrderItem[];
  gift?: {
    id: number;
    receiver?: { name: string; email: string };
    receiverName?: string;
    receiverPhone?: string;
    message?: string;
  };
  shippingMethod?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddr?: string;
  recipientZip?: string;
}

interface StatusChangeState {
  open: boolean;
  orderId: number;
  currentStatus: string;
  newStatus: string;
}

const ORDER_EXPORT_COLUMNS = [
  { header: '주문 번호', accessor: (o: Order) => o.orderCode || `#${o.id}` },
  { header: '고객명', accessor: (o: Order) => o.user?.name || '-' },
  { header: '이메일', accessor: (o: Order) => o.user?.email || '-' },
  { header: '총액', accessor: (o: Order) => Number(o.totalAmount) },
  { header: '상태', accessor: (o: Order) => ORDER_STATUS_OPTIONS.find(s => s.value === o.status)?.label || o.status },
  { header: '주문일', accessor: (o: Order) => new Date(o.createdAt).toLocaleString('ko-KR') },
];

const getStatusLabel = (status: string) =>
  ORDER_STATUS_OPTIONS.find(o => o.value === status)?.label || status;

const getId = (o: Order) => o.id;

const OrdersTab = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const { searchQuery, debouncedQuery, setSearchQuery } = useDebouncedSearch(400);
  const [confirmModal, setConfirmModal] = useState<StatusChangeState>({
    open: false, orderId: 0, currentStatus: '', newStatus: ''
  });
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { showToast } = useToast();

  // Bank report state
  const [bankReportOpen, setBankReportOpen] = useState(false);
  const [bankStartDate, setBankStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [bankEndDate, setBankEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bankType, setBankType] = useState<'ALL' | 'SALE' | 'PURCHASE'>('ALL');
  const [bankStatuses, setBankStatuses] = useState<string[]>(['PAID', 'DELIVERED']);
  const [bankPinOption, setBankPinOption] = useState<PinOption>('masked');
  const [bankLoading, setBankLoading] = useState(false);

  const { items: orders, loading, page, total, setPage, reload } = useAdminList<Order>(
    (params) => adminApi.getAllOrders(params),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters: { status: statusFilter || undefined, search: debouncedQuery || undefined },
      errorMessage: '주문 목록을 불러오는데 실패했습니다.',
    },
  );

  const { selectedIds, allSelected, toggleSelect, toggleSelectAll, getSelectedItems } = useCheckboxSelect(orders, getId);

  const openStatusConfirm = (order: Order, newStatus: string) => {
    if (newStatus === order.status) return;
    setConfirmModal({
      open: true,
      orderId: order.id,
      currentStatus: order.status,
      newStatus
    });
  };

  const handleStatusChange = async () => {
    const { orderId, newStatus } = confirmModal;
    try {
      await adminApi.updateOrderStatus(orderId, newStatus);
      const label = getStatusLabel(newStatus);
      showToast({ message: `주문 상태가 ${label}(으)로 변경되었습니다.`, type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || '상태 변경에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setConfirmModal({ open: false, orderId: 0, currentStatus: '', newStatus: '' });
    }
  };

  const handleViewDetail = async (orderId: number) => {
    setDetailLoading(true);
    try {
      const detail = await adminApi.getOrder(orderId);
      setDetailOrder(detail);
    } catch {
      showToast({ message: '주문 상세 정보를 불러오는데 실패했습니다.', type: 'error' });
    } finally {
      setDetailLoading(false);
    }
  };

  // --- Excel Export ---
  const handleExportSelected = useCallback(() => {
    const rows = getSelectedItems(orders);
    if (rows.length === 0) { showToast({ message: '내보낼 항목을 선택해주세요.', type: 'warning' }); return; }
    exportToExcel(rows, ORDER_EXPORT_COLUMNS, `주문내역_선택_${new Date().toISOString().slice(0, 10)}`);
    showToast({ message: `${rows.length}건을 엑셀로 내보냈습니다.`, type: 'success' });
  }, [orders, getSelectedItems, showToast]);

  const handleExportAll = useCallback(() => {
    if (orders.length === 0) { showToast({ message: '내보낼 데이터가 없습니다.', type: 'warning' }); return; }
    exportToExcel(orders, ORDER_EXPORT_COLUMNS, `주문내역_전체_${new Date().toISOString().slice(0, 10)}`);
    showToast({ message: `${orders.length}건을 엑셀로 내보냈습니다.`, type: 'success' });
  }, [orders, showToast]);

  const handleBankReportDownload = async () => {
    setBankLoading(true);
    try {
      const data = await adminApi.getBankTransactionReport({
        startDate: bankStartDate,
        endDate: bankEndDate,
        type: bankType,
        status: bankStatuses.length > 0 ? bankStatuses.join(',') : undefined,
        pinOption: bankPinOption,
      });
      if (!data.items || data.items.length === 0) {
        showToast({ message: '해당 기간에 거래 내역이 없습니다.', type: 'warning' });
        return;
      }
      exportBankReport(data.items, data.summary, bankStartDate, bankEndDate, bankPinOption);
      showToast({ message: `${data.items.length}건의 거래내역을 다운로드했습니다.`, type: 'success' });
    } catch {
      showToast({ message: '보고서 다운로드에 실패했습니다.', type: 'error' });
    } finally {
      setBankLoading(false);
    }
  };

  const toggleBankStatus = (status: string) => {
    setBankStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  };

  const columns: Column<Order>[] = [
    {
      key: 'select', header: '',
      headerRender: () => (
        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="전체 선택" style={{ cursor: 'pointer' }} />
      ),
      render: (o) => (
        <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleSelect(o.id)} aria-label={`주문 #${o.id} 선택`} style={{ cursor: 'pointer' }} />
      ),
    },
    {
      key: 'id', header: '주문 번호',
      render: (o) => (
        <Button
          variant="ghost"
          size="sm"
          style={{ fontFamily: o.orderCode ? 'var(--font-mono, monospace)' : 'inherit', fontSize: o.orderCode ? '12px' : 'inherit' }}
          onClick={() => handleViewDetail(o.id)}
        >
          {o.orderCode || `#${o.id}`}
        </Button>
      )
    },
    {
      key: 'user', header: '고객',
      render: (o) => (
        <div>
          <span className="admin-user-name" style={{ fontWeight: 600 }}>{o.user?.name || 'N/A'}</span>
          <div className="admin-sub-text" title={o.user?.email}>{maskEmail(o.user?.email)}</div>
        </div>
      )
    },
    {
      key: 'totalAmount', header: '총액', align: 'right',
      render: (o) => (
        <span style={{ fontWeight: 600, color: COLORS.primary }}>
          {formatPrice(Number(o.totalAmount))}
        </span>
      )
    },
    {
      key: 'status', header: '상태',
      render: (o) => (
        <Badge
          color={ORDER_STATUS_COLOR_MAP.get(o.status) as any || 'elephant'}
          variant="weak"
          size="sm"
        >
          {getStatusLabel(o.status)}
        </Badge>
      )
    },
    {
      key: 'date', header: '일시',
      render: (o) => (
        <div>
          <div>{new Date(o.createdAt).toLocaleDateString()}</div>
          <div className="admin-sub-text">{formatRelativeTime(o.createdAt)}</div>
        </div>
      )
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (o) => (
        <select
          className="admin-status-select"
          value={o.status}
          onChange={e => {
            openStatusConfirm(o, e.target.value);
            e.target.value = o.status;
          }}
          aria-label={`주문 #${o.id} 상태 변경`}
        >
          {ORDER_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    }
  ];

  return (
    <div className="admin-tab">
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">주문 관리</h2>
          <p className="admin-page-desc">주문 현황과 결제 상태를 관리합니다</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-btn-secondary" onClick={handleExportSelected} disabled={selectedIds.size === 0}>
            선택 다운로드 ({selectedIds.size})
          </button>
          <button type="button" className="admin-btn-secondary" onClick={handleExportAll}>
            전체 다운로드
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-filter-card">
        <select
          className="admin-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="상태 필터"
        >
          <option value="">전체 상태</option>
          {ORDER_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="search"
          className="admin-search-input admin-filter-search"
          placeholder="주문코드, 고객명, 이메일 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="주문 검색"
        />
      </div>

      {/* 은행제출 보고서 다운로드 */}
      <div style={{
        border: '1px solid var(--color-grey-200)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-4)',
        overflow: 'hidden',
      }}>
        <button
          type="button"
          onClick={() => setBankReportOpen(!bankReportOpen)}
          style={{
            width: '100%',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-grey-50)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 'var(--text-body)',
            fontWeight: 600,
          }}
        >
          은행제출 거래내역 다운로드
          <span>{bankReportOpen ? '▲' : '▼'}</span>
        </button>

        {bankReportOpen && (
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--text-caption)', fontWeight: 500, minWidth: 40 }}>기간</label>
              <TextField variant="box" type="date" value={bankStartDate} onChange={(e) => setBankStartDate(e.target.value)} />
              <span>~</span>
              <TextField variant="box" type="date" value={bankEndDate} onChange={(e) => setBankEndDate(e.target.value)} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <label style={{ fontSize: 'var(--text-caption)', fontWeight: 500, minWidth: 40 }}>유형</label>
              {(['ALL', 'SALE', 'PURCHASE'] as const).map((t) => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-caption)', cursor: 'pointer' }}>
                  <input type="radio" name="bankType" checked={bankType === t} onChange={() => setBankType(t)} />
                  {{ ALL: '전체', SALE: '판매', PURCHASE: '매입' }[t]}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 'var(--text-caption)', fontWeight: 500, minWidth: 40 }}>상태</label>
              {['PAID', 'DELIVERED', 'CANCELLED', 'REQUESTED', 'VERIFIED', 'REJECTED'].map((s) => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-caption)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={bankStatuses.includes(s)} onChange={() => toggleBankStatus(s)} />
                  {{ PAID: '결제완료', DELIVERED: '배송완료', CANCELLED: '취소', REQUESTED: '요청', VERIFIED: '확인', REJECTED: '거부' }[s]}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <label style={{ fontSize: 'var(--text-caption)', fontWeight: 500, minWidth: 40 }}>PIN</label>
              {(['full', 'masked', 'none'] as const).map((opt) => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-caption)', cursor: 'pointer' }}>
                  <input type="radio" name="bankPinOption" checked={bankPinOption === opt} onChange={() => setBankPinOption(opt)} />
                  {{ full: '전체 표시', masked: '마스킹', none: '제외' }[opt]}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" size="sm" onClick={handleBankReportDownload} disabled={bankLoading}>
                {bankLoading ? '다운로드 중...' : 'Excel 다운로드'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table Card */}
      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={orders}
          keyField="id"
          isLoading={loading}
          pagination={{
            currentPage: page,
            totalItems: total,
            itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
            onPageChange: setPage
          }}
          emptyMessage="조건에 맞는 주문이 없습니다."
          caption="주문 목록"
        />
      </div>

      {/* 상태 변경 확인 모달 */}
      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ ...confirmModal, open: false })}
        onConfirm={handleStatusChange}
        title="주문 상태 변경"
        confirmLabel="변경"
      >
        <p>
          주문 <strong>#{confirmModal.orderId}</strong>의 상태를{' '}
          <Badge color={ORDER_STATUS_COLOR_MAP.get(confirmModal.currentStatus) as any || 'elephant'} variant="weak" size="sm">
            {getStatusLabel(confirmModal.currentStatus)}
          </Badge>
          에서{' '}
          <Badge color={ORDER_STATUS_COLOR_MAP.get(confirmModal.newStatus) as any || 'elephant'} variant="fill" size="sm">
            {getStatusLabel(confirmModal.newStatus)}
          </Badge>
          (으)로 변경하시겠습니까?
        </p>
      </ConfirmModal>

      {/* 주문 상세 모달 */}
      <AdminDetailModal
        isOpen={detailOrder !== null}
        onClose={() => setDetailOrder(null)}
        title={detailOrder ? `주문 상세 ${detailOrder.orderCode || '#' + detailOrder.id}` : '주문 상세'}
        loading={detailLoading}
      >
        {detailOrder && (
          <>
            {/* 고객 정보 */}
            <AdminDetailModal.Section title="고객 정보">
              <AdminDetailModal.InfoGrid>
                <AdminDetailModal.InfoRow label="이름" value={detailOrder.user?.name || 'N/A'} />
                <AdminDetailModal.InfoRow label="이메일" value={detailOrder.user?.email || 'N/A'} />
                {detailOrder.user?.phone && (
                  <AdminDetailModal.InfoRow label="전화" value={detailOrder.user.phone} />
                )}
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            {/* 배송 정보 (있을 경우만 표시) */}
            {(detailOrder.shippingMethod === 'DELIVERY' || detailOrder.shippingMethod === 'PICKUP' || detailOrder.recipientName) && (
              <AdminDetailModal.Section
                title={detailOrder.shippingMethod === 'PICKUP' ? '방문 수령 정보' : '배송 정보'}
              >
                {detailOrder.shippingMethod === 'PICKUP' ? (
                  <div>
                    <div><Badge color="blue" variant="weak" size="sm">방문 수령</Badge></div>
                    <div style={{ marginTop: '8px', color: COLORS.grey600 }}>매장에 방문하여 수령해주세요.</div>
                  </div>
                ) : (
                  <AdminDetailModal.InfoGrid>
                    <AdminDetailModal.InfoRow label="수령인" value={detailOrder.recipientName || '-'} />
                    <AdminDetailModal.InfoRow label="연락처" value={detailOrder.recipientPhone || '-'} />
                    <AdminDetailModal.InfoRow
                      label="주소"
                      value={`(${detailOrder.recipientZip}) ${detailOrder.recipientAddr}`}
                      fullWidth
                    />
                  </AdminDetailModal.InfoGrid>
                )}
              </AdminDetailModal.Section>
            )}

            {/* 주문 상품 */}
            {detailOrder.items && detailOrder.items.length > 0 && (
              <AdminDetailModal.Section title="주문 상품">
                <div style={{ border: `1px solid ${COLORS.grey200}`, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: COLORS.grey50 }}>
                        <th style={{ padding: SPACING[2], textAlign: 'left', fontWeight: 600 }}>상품명</th>
                        <th style={{ padding: SPACING[2], textAlign: 'center', fontWeight: 600 }}>수량</th>
                        <th style={{ padding: SPACING[2], textAlign: 'right', fontWeight: 600 }}>단가</th>
                        <th style={{ padding: SPACING[2], textAlign: 'right', fontWeight: 600 }}>소계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailOrder.items.map((item, idx) => (
                        <tr key={item.id || idx} style={{ borderTop: `1px solid ${COLORS.grey100}` }}>
                          <td style={{ padding: SPACING[2] }}>
                            <div>{item.productName || item.product?.name || '상품명 없음'}</div>
                            {item.vouchers && item.vouchers.length > 0 && (
                              <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {item.vouchers.map((v, vi) => (
                                  <Badge key={v.id || vi} color="elephant" variant="weak" size="xs">
                                    PIN: {v.pinCode ? `${v.pinCode.slice(0, 4)}****` : '****'}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: SPACING[2], textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: SPACING[2], textAlign: 'right' }}>{formatPrice(Number(item.unitPrice))}</td>
                          <td style={{ padding: SPACING[2], textAlign: 'right', fontWeight: 600 }}>{formatPrice(Number(item.subtotal))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AdminDetailModal.Section>
            )}

            {/* 결제 정보 */}
            <AdminDetailModal.Section title="결제 정보" variant="highlight">
              <AdminDetailModal.InfoGrid>
                {detailOrder.orderCode && (
                  <AdminDetailModal.InfoRow
                    label="주문코드"
                    value={
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                        {detailOrder.orderCode}
                      </span>
                    }
                  />
                )}
                <AdminDetailModal.InfoRow
                  label="총 결제금액"
                  value={
                    <span style={{ fontSize: '18px', fontWeight: 700, color: COLORS.primary }}>
                      {formatPrice(Number(detailOrder.totalAmount))}
                    </span>
                  }
                />
                <AdminDetailModal.StatusRow
                  label="주문 상태"
                  status={getStatusLabel(detailOrder.status)}
                  color={ORDER_STATUS_COLOR_MAP.get(detailOrder.status) || 'elephant'}
                />
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            {/* 선물 정보 */}
            {detailOrder.gift && (
              <AdminDetailModal.Section title="선물 정보">
                <AdminDetailModal.InfoGrid>
                  <AdminDetailModal.InfoRow
                    label="받는 분"
                    value={detailOrder.gift.receiver?.name || detailOrder.gift.receiverName || '-'}
                  />
                  {detailOrder.gift.message && (
                    <AdminDetailModal.InfoRow label="메시지" value={detailOrder.gift.message} fullWidth />
                  )}
                </AdminDetailModal.InfoGrid>
              </AdminDetailModal.Section>
            )}

            {/* 주문 타임라인 */}
            <AdminDetailModal.Section title="주문 이력">
              <AdminDetailModal.Timeline
                items={[
                  {
                    label: '주문 생성',
                    date: new Date(detailOrder.createdAt).toLocaleString('ko-KR'),
                    active: true,
                  },
                  {
                    label: '최종 수정',
                    date: detailOrder.updatedAt
                      ? new Date(detailOrder.updatedAt).toLocaleString('ko-KR')
                      : null,
                  },
                ]}
              />
            </AdminDetailModal.Section>

            <AdminDetailModal.ActionBar>
              <Button variant="ghost" onClick={() => setDetailOrder(null)}>닫기</Button>
            </AdminDetailModal.ActionBar>
          </>
        )}
      </AdminDetailModal>
    </div>
  );
};

export default OrdersTab;
