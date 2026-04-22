/**
 * @file VouchersTab.tsx
 * @description Partner voucher (PIN) inventory management — list, bulk upload, inventory stats
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { partnerApi } from '@/api/manual';
import { usePartnerList } from '../hooks/usePartnerList';
import { useToast } from '@/contexts/ToastContext';
import { VOUCHER_STATUS_MAP, PARTNER_PAGINATION } from '../constants';

interface InventoryItem {
  productId: number;
  productName: string;
  available: number;
  sold: number;
  used: number;
  expired: number;
}

const VouchersTab: React.FC = () => {
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
  }), [statusFilter]);

  const { items, loading, page, total, setPage, reload } = usePartnerList<any>(
    (params) => partnerApi.getMyVouchers(params),
    { filters, errorMessage: 'PIN 목록을 불러오는데 실패했습니다.' }
  );

  const totalPages = Math.ceil(total / PARTNER_PAGINATION.DEFAULT_PAGE_SIZE);

  // Load inventory stats
  useEffect(() => {
    const loadInventory = async () => {
      try {
        const data = await partnerApi.getVoucherInventory();
        if (Array.isArray(data)) {
          setInventory(data);
        }
      } catch {
        // Ignore — inventory is supplementary
      }
    };
    loadInventory();
  }, []);

  // Bulk upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadProductId, setUploadProductId] = useState<number>(0);
  const [uploadPins, setUploadPins] = useState('');
  const [uploading, setUploading] = useState(false);

  // Focus trap for bulk upload modal
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (uploadOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.[0]?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [uploadOpen]);

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const handleBulkUpload = async () => {
    if (!uploadProductId) {
      showToast({ message: '상품을 선택해주세요.', type: 'warning' });
      return;
    }
    const pinCodes = uploadPins
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (pinCodes.length === 0) {
      showToast({ message: 'PIN 코드를 입력해주세요.', type: 'warning' });
      return;
    }

    setUploading(true);
    try {
      await partnerApi.bulkUploadVouchers({ productId: uploadProductId, pinCodes });
      showToast({ message: `${pinCodes.length}개 PIN이 등록되었습니다.`, type: 'success' });
      setUploadOpen(false);
      setUploadPins('');
      reload();
    } catch {
      showToast({ message: 'PIN 등록에 실패했습니다.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  // Summary stats from inventory
  const summaryStats = useMemo(() => {
    return inventory.reduce(
      (acc, item) => ({
        available: acc.available + (item.available || 0),
        sold: acc.sold + (item.sold || 0),
        used: acc.used + (item.used || 0),
        expired: acc.expired + (item.expired || 0),
      }),
      { available: 0, sold: 0, used: 0, expired: 0 }
    );
  }, [inventory]);

  return (
    <div className="partner-tab">
      {/* Header */}
      <div className="partner-page-header">
        <div />
        <div className="partner-page-actions">
          <button type="button" className="partner-btn-primary" onClick={() => setUploadOpen(true)}>
            <Upload size={16} /> PIN 일괄 등록
          </button>
        </div>
      </div>

      {/* Inventory Stats Bar */}
      <div className="partner-inventory-bar">
        <div className="partner-inventory-item">
          <span className="partner-inventory-dot green" />
          <span>사용가능 <strong>{summaryStats.available}</strong></span>
        </div>
        <div className="partner-inventory-item">
          <span className="partner-inventory-dot blue" />
          <span>판매됨 <strong>{summaryStats.sold}</strong></span>
        </div>
        <div className="partner-inventory-item">
          <span className="partner-inventory-dot gray" />
          <span>사용됨 <strong>{summaryStats.used}</strong></span>
        </div>
        <div className="partner-inventory-item">
          <span className="partner-inventory-dot red" />
          <span>만료 <strong>{summaryStats.expired}</strong></span>
        </div>
      </div>

      {/* Filter */}
      <div className="partner-filter-card">
        <select
          className="partner-filter-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="PIN 상태 필터"
        >
          <option value="">전체 상태</option>
          {Object.entries(VOUCHER_STATUS_MAP).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="partner-table-card">
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <caption className="sr-only">PIN 재고 목록</caption>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">상품</th>
              <th scope="col">PIN</th>
              <th scope="col">상태</th>
              <th scope="col">등록일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}><span role="status" aria-busy="true">로딩 중...</span></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}>등록된 PIN이 없습니다.</td></tr>
            ) : (
              items.map((voucher: any) => {
                const status = VOUCHER_STATUS_MAP[voucher.status] || { label: voucher.status || '-', color: 'gray' };
                // Mask PIN for display
                const maskedPin = voucher.pinCode
                  ? voucher.pinCode.slice(0, 4) + '****' + voucher.pinCode.slice(-2)
                  : '****-****';
                return (
                  <tr key={voucher.id}>
                    <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: 'var(--color-grey-500)' }}>
                      {voucher.id}
                    </td>
                    <td>{voucher.productName || voucher.product?.name || '-'}</td>
                    <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px' }}>{maskedPin}</td>
                    <td><span className={`partner-badge ${status.color}`}>{status.label}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--color-grey-500)' }}>
                      {voucher.createdAt ? new Date(voucher.createdAt).toLocaleDateString('ko-KR') : '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="partner-pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>다음</button>
          </div>
        )}
      </div>

      {/* Product Inventory Detail */}
      {inventory.length > 0 && (
        <div>
          <h3 className="partner-section-title" style={{ marginBottom: '12px' }}>상품별 재고 현황</h3>
          <div className="partner-table-card">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <caption className="sr-only">상품별 재고 현황</caption>
              <thead>
                <tr>
                  <th scope="col">상품</th>
                  <th scope="col">사용가능</th>
                  <th scope="col">판매됨</th>
                  <th scope="col">사용됨</th>
                  <th scope="col">만료</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((inv) => (
                  <tr key={inv.productId}>
                    <td style={{ fontWeight: 500 }}>{inv.productName}</td>
                    <td className="tabular-nums" style={{ color: 'var(--color-success)' }}>{inv.available}</td>
                    <td className="tabular-nums">{inv.sold}</td>
                    <td className="tabular-nums">{inv.used}</td>
                    <td className="tabular-nums" style={{ color: 'var(--color-error)' }}>{inv.expired}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {uploadOpen && (
        <div className="partner-modal-overlay" onClick={() => setUploadOpen(false)}>
          <div
            ref={modalRef}
            className="partner-modal"
            onClick={e => e.stopPropagation()}
            onKeyDown={handleModalKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="PIN 일괄 등록"
          >
            <div className="partner-modal-header">
              <h3>PIN 일괄 등록</h3>
              <button type="button" onClick={() => setUploadOpen(false)} aria-label="닫기"><X size={20} /></button>
            </div>
            <div className="partner-modal-body">
              <div className="partner-form-group">
                <label className="partner-form-label">상품 선택</label>
                <select
                  className="partner-form-select"
                  value={uploadProductId}
                  onChange={e => setUploadProductId(Number(e.target.value))}
                >
                  <option value={0}>상품을 선택하세요</option>
                  {inventory.map(inv => (
                    <option key={inv.productId} value={inv.productId}>{inv.productName}</option>
                  ))}
                </select>
              </div>
              <div className="partner-form-group">
                <label className="partner-form-label">PIN 코드 (줄바꿈으로 구분)</label>
                <textarea
                  className="partner-form-textarea"
                  style={{ minHeight: '160px', fontFamily: 'var(--font-family-mono)', fontSize: '13px' }}
                  value={uploadPins}
                  onChange={e => setUploadPins(e.target.value)}
                  placeholder={`1234-5678-9012-3456\n2345-6789-0123-4567\n\n* 줄바꿈으로 구분\n* 최소 8자 이상의 코드`}
                />
                {(() => {
                  const lines = uploadPins.split('\n').filter(s => s.trim());
                  const short = lines.filter(s => s.trim().replace(/[-\s]/g, '').length < 8);
                  return (
                    <div style={{ fontSize: '12px', color: 'var(--color-grey-400)', marginTop: '4px' }}>
                      입력된 PIN: {lines.length}개
                      {short.length > 0 && (
                        <span style={{ color: 'var(--color-warning)', marginLeft: '8px' }}>
                          (⚠ {short.length}개가 8자 미만)
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="partner-modal-footer">
              <button type="button" className="partner-btn-secondary" onClick={() => setUploadOpen(false)}>취소</button>
              <button type="button" className="partner-btn-primary" onClick={handleBulkUpload} disabled={uploading}>
                {uploading ? '등록 중...' : '일괄 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VouchersTab;
