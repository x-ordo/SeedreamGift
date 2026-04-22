import { useState, useCallback, useEffect } from 'react';
import { Upload, AlertTriangle, Package } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Badge, Modal, Loader } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatRelativeTime } from '../../../utils';
import { COLORS, SPACING, RADIUS } from '../../../constants/designTokens';
import { VOUCHER_STATUS_COLOR_MAP, VOUCHER_STATUS_OPTIONS, VOUCHER_SOURCE_OPTIONS, VOUCHER_SOURCE_COLOR_MAP, ADMIN_PAGINATION } from '../constants';
import VoucherBulkModal from '../modals/VoucherBulkModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList } from '../hooks';

interface Voucher {
  id: number;
  product?: { id: number; name: string };
  status: string;
  source?: string;
  createdAt: string;
}

interface VoucherDetail {
  id: number;
  pinCode?: string;
  status: string;
  product?: { id: number; name: string };
  order?: { id: number };
  createdAt: string;
  updatedAt?: string;
}

interface Product {
  id: number;
  name: string;
  brandCode: string;
}

interface InventoryItem {
  productId: number;
  productName: string;
  brandCode: string;
  brandName: string;
  price: number;
  total: number;
  available: number;
  sold: number;
  used: number;
  expired: number;
  minStockAlert?: number;
}

const getStatusLabel = (status: string) =>
  VOUCHER_STATUS_OPTIONS.find(o => o.value === status)?.label || status;

const VouchersTab = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [detailVoucher, setDetailVoucher] = useState<VoucherDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expiringCount, setExpiringCount] = useState(0);
  const [stockProductId, setStockProductId] = useState('');
  const [stockData, setStockData] = useState<any>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<{
    open: boolean; voucherId: number; currentStatus: string; newStatus: string;
  }>({ open: false, voucherId: 0, currentStatus: '', newStatus: '' });
  const { showToast } = useToast();

  // 상품 목록 + 인벤토리 + 만료 예정 로드
  const loadMetadata = useCallback(async () => {
    try {
      const [productsRes, inventoryRes, expiringRes] = await Promise.all([
        adminApi.getAllProducts({ page: 1, limit: 100 }),
        adminApi.getVoucherInventory(),
        adminApi.getExpiringVouchers(30).catch(() => null),
      ]);
      setProducts(productsRes?.items ?? []);
      setInventory(Array.isArray(inventoryRes) ? inventoryRes : []);
      if (expiringRes) {
        const count = Array.isArray(expiringRes) ? expiringRes.length : (expiringRes?.count ?? 0);
        setExpiringCount(count);
      }
    } catch {
      // non-critical, silently fail
    }
  }, []);

  useEffect(() => { loadMetadata(); }, [loadMetadata]);

  const { items: vouchers, loading, page, total, setPage, reload } = useAdminList<Voucher>(
    (params) => adminApi.getAllVouchers(params),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters: {
        status: statusFilter || undefined,
        productId: productFilter ? Number(productFilter) : undefined,
        source: sourceFilter || undefined,
      },
      errorMessage: '바우처 목록을 불러오는데 실패했습니다.',
    },
  );

  const openStatusConfirm = (v: Voucher, newStatus: string) => {
    if (newStatus === v.status) return;
    setStatusConfirm({ open: true, voucherId: v.id, currentStatus: v.status, newStatus });
  };

  const handleStatusChange = async () => {
    const { voucherId, newStatus } = statusConfirm;
    try {
      await adminApi.updateVoucher(voucherId, { status: newStatus });
      const label = getStatusLabel(newStatus);
      showToast({ message: `상태가 ${label}(으)로 변경되었습니다.`, type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '상태 변경에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setStatusConfirm({ open: false, voucherId: 0, currentStatus: '', newStatus: '' });
    }
  };

  const handleViewDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const detail = await adminApi.getVoucher(id);
      setDetailVoucher(detail);
    } catch {
      showToast({ message: '바우처 상세 정보를 불러오는데 실패했습니다.', type: 'error' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopyPin = async (pin: string) => {
    try {
      await navigator.clipboard.writeText(pin);
      showToast({ message: 'PIN이 클립보드에 복사되었습니다.', type: 'success' });
    } catch {
      showToast({ message: '복사에 실패했습니다.', type: 'error' });
    }
  };

  // --- 상품별 재고 조회 ---
  const handleStockQuery = async () => {
    const pid = Number(stockProductId);
    if (!pid) {
      showToast({ message: '상품 ID를 입력해주세요.', type: 'warning' });
      return;
    }
    setStockLoading(true);
    setStockData(null);
    try {
      const data = await adminApi.getVoucherStock(pid);
      setStockData(data);
    } catch (err: any) {
      showToast({ message: err?.response?.data?.error || '재고 조회 실패', type: 'error' });
    } finally {
      setStockLoading(false);
    }
  };

  // 인벤토리 기반 전체 통계
  const inventoryTotals = inventory.reduce(
    (acc, item) => ({
      available: acc.available + item.available,
      sold: acc.sold + item.sold,
      used: acc.used + item.used,
      expired: acc.expired + item.expired,
    }),
    { available: 0, sold: 0, used: 0, expired: 0 },
  );
  const statusCounts: Record<string, number> = {
    AVAILABLE: inventoryTotals.available,
    SOLD: inventoryTotals.sold,
    USED: inventoryTotals.used,
    EXPIRED: inventoryTotals.expired,
  };

  const columns: Column<Voucher>[] = [
    { key: 'id', header: 'ID', render: (v) => <span className="admin-mono">#{v.id}</span> },
    { key: 'product', header: '상품', render: (v) => v.product?.name || '-' },
    { key: 'pin', header: 'PIN', render: () => <span style={{ color: COLORS.grey400 }}>●●●●-●●●●-●●●●</span> },
    {
      key: 'status', header: '상태',
      render: (v) => (
        <Badge
          color={VOUCHER_STATUS_COLOR_MAP.get(v.status) as any || 'elephant'}
          variant="weak"
          size="small"
        >
          {getStatusLabel(v.status)}
        </Badge>
      )
    },
    {
      key: 'source', header: '출처',
      render: (v) => {
        const src = v.source || 'ADMIN';
        const color = VOUCHER_SOURCE_COLOR_MAP.get(src) || 'elephant';
        const label = VOUCHER_SOURCE_OPTIONS.find(o => o.value === src)?.label || src;
        return (
          <Badge color={color as any} variant="weak" size="small">
            {label}
          </Badge>
        );
      }
    },
    {
      key: 'date', header: '등록일',
      render: (v) => (
        <div>
          <div>{new Date(v.createdAt).toLocaleDateString()}</div>
          <div className="admin-sub-text">{formatRelativeTime(v.createdAt)}</div>
        </div>
      )
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (v) => (
        <div className="admin-actions">
          <Button variant="ghost" size="sm" onClick={() => handleViewDetail(v.id)}>상세</Button>
          <select
            className="admin-status-select"
            value={v.status}
            onChange={e => {
              openStatusConfirm(v, e.target.value);
              e.target.value = v.status;
            }}
            aria-label={`바우처 #${v.id} 상태 변경`}
          >
            {VOUCHER_STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )
    }
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">재고(PIN) 관리</h2>
          <p className="admin-page-desc">바우처 PIN 재고와 발급 현황을 관리합니다</p>
        </div>
        <div className="admin-page-actions">
          <Button variant="primary" size="md" icon={<Upload size={16} aria-hidden="true" />} onClick={() => setModalOpen(true)}>
            대량 등록
          </Button>
        </div>
      </div>

      {/* 만료 예정 바우처 알림 */}
      {expiringCount > 0 && (
        <div className="admin-alert warning" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0 }} aria-hidden="true" />
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-grey-800)' }}>
            30일 내 만료 예정 바우처 <strong>{expiringCount}건</strong>
          </span>
        </div>
      )}

      {/* 상태별 통계 */}
      <div className="admin-stats-row">
        {VOUCHER_STATUS_OPTIONS.map(opt => (
          <div
            key={opt.value}
            className="admin-stat-card"
            style={{ cursor: 'pointer' }}
            onClick={() => setStatusFilter(statusFilter === opt.value ? '' : opt.value)}
            role="button"
            tabIndex={0}
            aria-pressed={statusFilter === opt.value}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter(statusFilter === opt.value ? '' : opt.value); } }}
          >
            <span className="admin-stat-label">{opt.label}</span>
            <span className="admin-stat-value">{statusCounts[opt.value] || 0}</span>
          </div>
        ))}
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
          {VOUCHER_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="admin-filter-select"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          aria-label="출처 필터"
        >
          <option value="">전체 출처</option>
          {VOUCHER_SOURCE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="admin-filter-select"
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          aria-label="상품 필터"
        >
          <option value="">전체 상품</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* 상품별 재고 조회 */}
      <div className="admin-table-card" style={{ padding: SPACING[4] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING[2], marginBottom: SPACING[3] }}>
          <Package size={16} style={{ color: COLORS.grey600 }} aria-hidden="true" />
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: COLORS.grey800, margin: 0 }}>상품별 재고 조회</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING[2], marginBottom: SPACING[3] }}>
          <input
            type="number"
            min="1"
            className="admin-search-input"
            placeholder="상품 ID 입력"
            value={stockProductId}
            onChange={(e) => setStockProductId(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleStockQuery(); }}
            style={{ width: '160px' }}
            aria-label="재고 조회할 상품 ID"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleStockQuery}
            disabled={stockLoading}
          >
            {stockLoading ? '조회 중...' : '조회'}
          </Button>
        </div>
        {stockData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: SPACING[3] }}>
            {([
              { label: '전체', value: stockData.total ?? stockData.totalCount ?? 0, color: COLORS.grey800 },
              { label: '사용가능', value: stockData.available ?? stockData.availableCount ?? 0, color: COLORS.success },
              { label: '판매', value: stockData.sold ?? stockData.soldCount ?? 0, color: COLORS.primary },
              { label: '만료', value: stockData.expired ?? stockData.expiredCount ?? 0, color: COLORS.error },
            ] as { label: string; value: number; color: string }[]).map((item) => (
              <div
                key={item.label}
                style={{
                  padding: SPACING[3],
                  background: COLORS.grey50,
                  borderRadius: RADIUS.md,
                  textAlign: 'center',
                  border: `1px solid ${COLORS.grey200}`,
                }}
              >
                <p style={{ fontSize: '12px', color: COLORS.grey500, marginBottom: SPACING[1] }}>{item.label}</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: item.color, margin: 0 }}>
                  {item.value.toLocaleString('ko-KR')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={vouchers}
          keyField="id"
          isLoading={loading}
          pagination={{
            currentPage: page,
            totalItems: total,
            itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
            onPageChange: setPage
          }}
          emptyMessage="조건에 맞는 바우처가 없습니다."
          caption="바우처(PIN) 목록"
        />
      </div>

      {/* 상품별 재고 현황 */}
      {inventory.length > 0 && (
        <details className="admin-table-card" style={{ marginTop: 'var(--space-4)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: COLORS.grey700, padding: 'var(--space-3) var(--space-4)' }}>
            상품별 재고 현황
          </summary>
          <div style={{ overflowX: 'auto', padding: '0 var(--space-4) var(--space-4)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <caption className="sr-only">상품별 재고 현황 테이블</caption>
              <thead>
                <tr style={{ borderBottom: `2px solid ${COLORS.grey200}` }}>
                  <th scope="col" style={{ textAlign: 'left', padding: '8px' }}>상품</th>
                  <th scope="col" style={{ textAlign: 'right', padding: '8px' }}>전체</th>
                  <th scope="col" style={{ textAlign: 'right', padding: '8px' }}>사용가능</th>
                  <th scope="col" style={{ textAlign: 'right', padding: '8px' }}>판매완료</th>
                  <th scope="col" style={{ textAlign: 'right', padding: '8px' }}>사용완료</th>
                  <th scope="col" style={{ textAlign: 'right', padding: '8px' }}>만료</th>
                  <th scope="col" style={{ textAlign: 'center', padding: '8px' }}>재고 상태</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => (
                  <tr key={item.productId} style={{ borderBottom: `1px solid ${COLORS.grey200}` }}>
                    <td style={{ padding: '8px' }}>
                      <div style={{ fontWeight: 500 }}>{item.productName}</div>
                      <div style={{ fontSize: '11px', color: COLORS.grey500 }}>{item.brandName}</div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px', fontWeight: 600 }}>{item.total}</td>
                    <td style={{ textAlign: 'right', padding: '8px', color: COLORS.success }}>{item.available}</td>
                    <td style={{ textAlign: 'right', padding: '8px', color: COLORS.primary }}>{item.sold}</td>
                    <td style={{ textAlign: 'right', padding: '8px', color: COLORS.grey500 }}>{item.used}</td>
                    <td style={{ textAlign: 'right', padding: '8px', color: COLORS.error }}>{item.expired}</td>
                    <td style={{ textAlign: 'center', padding: '8px' }}>
                      {item.minStockAlert != null && item.minStockAlert > 0 ? (
                        item.available < item.minStockAlert ? (
                          <Badge color="red" variant="weak" size="xsmall">재고 부족</Badge>
                        ) : (
                          <Badge color="green" variant="weak" size="xsmall">정상</Badge>
                        )
                      ) : (
                        <span style={{ fontSize: '11px', color: COLORS.grey400 }}>미설정</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {modalOpen && (
        <VoucherBulkModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); reload(); loadMetadata(); }}
        />
      )}

      {/* 상태 변경 확인 모달 */}
      <ConfirmModal
        isOpen={statusConfirm.open}
        onClose={() => setStatusConfirm({ ...statusConfirm, open: false })}
        onConfirm={handleStatusChange}
        title="바우처 상태 변경"
        confirmLabel="변경"
      >
        <p>
          바우처 <strong>#{statusConfirm.voucherId}</strong>의 상태를{' '}
          <Badge color={VOUCHER_STATUS_COLOR_MAP.get(statusConfirm.currentStatus) as any || 'elephant'} variant="weak" size="small">
            {getStatusLabel(statusConfirm.currentStatus)}
          </Badge>
          에서{' '}
          <Badge color={VOUCHER_STATUS_COLOR_MAP.get(statusConfirm.newStatus) as any || 'elephant'} variant="fill" size="small">
            {getStatusLabel(statusConfirm.newStatus)}
          </Badge>
          (으)로 변경하시겠습니까?
        </p>
      </ConfirmModal>

      {/* 바우처 상세 모달 */}
      <Modal
        isOpen={detailVoucher !== null || detailLoading}
        onClose={() => { setDetailVoucher(null); setDetailLoading(false); }}
        title={detailVoucher ? `바우처 상세 #${detailVoucher.id}` : '바우처 상세'}
      >
        {detailLoading ? (
          <div style={{ padding: SPACING[5], textAlign: 'center' }}>
            <Loader size="medium" label="불러오는 중..." />
          </div>
        ) : detailVoucher && (
          <div style={{ padding: SPACING[4] }}>
            {/* PIN 번호 */}
            <div style={{ marginBottom: SPACING[4] }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: COLORS.grey900, marginBottom: SPACING[2] }}>PIN 번호</h4>
              <div style={{ padding: SPACING[3], background: COLORS.grey50, borderRadius: RADIUS.md, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, letterSpacing: '2px', color: COLORS.grey900 }}>
                  {detailVoucher.pinCode || '(복호화 실패)'}
                </span>
                {detailVoucher.pinCode && (
                  <Button variant="secondary" size="sm" onClick={() => handleCopyPin(detailVoucher.pinCode!)}>
                    복사
                  </Button>
                )}
              </div>
            </div>

            {/* 바우처 정보 */}
            <div style={{ marginBottom: SPACING[4] }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: COLORS.grey900, marginBottom: SPACING[2] }}>바우처 정보</h4>
              <div style={{ padding: SPACING[3], background: COLORS.grey50, borderRadius: RADIUS.md, fontSize: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING[2] }}>
                  <div><span style={{ color: COLORS.grey500 }}>ID:</span> #{detailVoucher.id}</div>
                  <div><span style={{ color: COLORS.grey500 }}>상품:</span> {detailVoucher.product?.name || '-'}</div>
                  <div>
                    <span style={{ color: COLORS.grey500 }}>상태:</span>{' '}
                    <Badge
                      color={VOUCHER_STATUS_COLOR_MAP.get(detailVoucher.status) as any || 'elephant'}
                      variant="weak"
                      size="xsmall"
                    >
                      {getStatusLabel(detailVoucher.status)}
                    </Badge>
                  </div>
                  {detailVoucher.order && (
                    <div><span style={{ color: COLORS.grey500 }}>주문 ID:</span> #{detailVoucher.order.id}</div>
                  )}
                  <div><span style={{ color: COLORS.grey500 }}>등록일:</span> {new Date(detailVoucher.createdAt).toLocaleString('ko-KR')}</div>
                  {detailVoucher.updatedAt && (
                    <div><span style={{ color: COLORS.grey500 }}>수정:</span> {formatRelativeTime(detailVoucher.updatedAt)}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="admin-form-footer">
              <Button variant="ghost" onClick={() => setDetailVoucher(null)}>닫기</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VouchersTab;
