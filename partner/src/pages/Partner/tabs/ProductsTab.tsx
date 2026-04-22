/**
 * @file ProductsTab.tsx
 * @description Partner available products view — read-only list of AllowPartnerStock=true products with PIN upload
 */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { partnerApi } from '@/api/manual';
import { usePartnerList } from '../hooks/usePartnerList';
import { useToast } from '@/contexts/ToastContext';
import { BRAND_LABEL_MAP, PARTNER_PAGINATION } from '../constants';

const ProductsTab: React.FC = () => {
  const { showToast } = useToast();
  const [searchFilter, setSearchFilter] = useState('');

  const filters = useMemo(() => ({
    search: searchFilter || undefined,
  }), [searchFilter]);

  const { items, loading, page, total, setPage, reload } = usePartnerList<any>(
    (params) => partnerApi.getAvailableProducts(params),
    { filters, errorMessage: '상품 목록을 불러오는데 실패했습니다.' }
  );

  const totalPages = Math.ceil(total / PARTNER_PAGINATION.DEFAULT_PAGE_SIZE);

  // PIN upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadProduct, setUploadProduct] = useState<{ id: number; name: string } | null>(null);
  const [uploadPins, setUploadPins] = useState('');
  const [uploading, setUploading] = useState(false);

  // Focus trap
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

  const openUploadModal = (product: any) => {
    setUploadProduct({ id: product.id, name: product.name });
    setUploadPins('');
    setUploadOpen(true);
  };

  const handleBulkUpload = async () => {
    if (!uploadProduct) return;
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
      await partnerApi.bulkUploadVouchers({ productId: uploadProduct.id, pinCodes });
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

  return (
    <div className="partner-tab">
      {/* Header */}
      <div className="partner-page-header">
        <div />
      </div>

      {/* Filters */}
      <div className="partner-filter-card">
        <input
          type="text"
          className="partner-search-input"
          placeholder="상품명 검색..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          aria-label="상품 검색"
        />
      </div>

      {/* Table */}
      <div className="partner-table-card">
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <caption className="sr-only">등록 가능 상품 목록</caption>
          <thead>
            <tr>
              <th scope="col">상품명</th>
              <th scope="col">브랜드</th>
              <th scope="col">액면가</th>
              <th scope="col">판매가</th>
              <th scope="col">내 재고</th>
              <th scope="col">총 재고</th>
              <th scope="col">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}><span role="status" aria-busy="true">로딩 중...</span></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}>등록 가능한 상품이 없습니다.</td></tr>
            ) : (
              items.map((product: any) => (
                <tr key={product.id}>
                  <td style={{ fontWeight: 500 }}>{product.name}</td>
                  <td>{BRAND_LABEL_MAP.get(product.brandCode || product.brand) || product.brandCode || '-'}</td>
                  <td className="tabular-nums">{Number(product.price).toLocaleString()}원</td>
                  <td className="tabular-nums" style={{ color: 'var(--color-error)', fontWeight: 600 }}>
                    {Number(product.buyPrice ?? Math.round(product.price * (1 - (product.discountRate || 0) / 100))).toLocaleString()}원
                  </td>
                  <td className="tabular-nums" style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                    {product.myStock ?? product.partnerStock ?? 0}
                  </td>
                  <td className="tabular-nums">
                    {product.totalStock ?? product.availableStock ?? 0}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="partner-btn-primary"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => openUploadModal(product)}
                      aria-label={`${product.name} PIN 등록`}
                    >
                      <Upload size={14} /> PIN 등록
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="partner-pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>다음</button>
          </div>
        )}
      </div>

      {/* PIN Upload Modal */}
      {uploadOpen && uploadProduct && (
        <div className="partner-modal-overlay" onClick={() => setUploadOpen(false)}>
          <div
            ref={modalRef}
            className="partner-modal"
            onClick={e => e.stopPropagation()}
            onKeyDown={handleModalKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="PIN 등록"
          >
            <div className="partner-modal-header">
              <h3>PIN 등록 - {uploadProduct.name}</h3>
              <button type="button" onClick={() => setUploadOpen(false)} aria-label="닫기"><X size={20} /></button>
            </div>
            <div className="partner-modal-body">
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

export default ProductsTab;
