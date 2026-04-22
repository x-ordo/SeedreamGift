/**
 * @file PartnerPricesTab.tsx
 * @description 파트너 단가 관리 탭 - 파트너별 상품 단가 설정 및 삭제
 * @module pages/Admin/tabs
 */
import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Modal } from '../../../design-system';
import { ConfirmModal } from '../components/ConfirmModal';
import { AdminTable, Column } from '../../../components/admin';
import { formatPrice, formatRelativeTime } from '../../../utils';
import { COLORS } from '../../../constants/designTokens';
import { ADMIN_PAGINATION } from '../constants';
import { useAdminList } from '../hooks';

// ─── Types ──────────────────────────────────────────

interface PartnerPrice {
  id: number;
  partnerId: number;
  partnerName?: string;
  productId: number;
  productName?: string;
  customPrice: number;
  customDiscountRate?: number | null;
  createdAt: string;
  updatedAt: string;
}

interface UpsertForm {
  partnerId: string;
  productId: string;
  customPrice: string;
  customDiscountRate: string;
}

const EMPTY_FORM: UpsertForm = {
  partnerId: '',
  productId: '',
  customPrice: '',
  customDiscountRate: '',
};

// ─── Component ──────────────────────────────────────

const PartnerPricesTab: React.FC = () => {
  const { showToast } = useToast();

  const { items: prices, loading, page, total, setPage, reload } = useAdminList<PartnerPrice>(
    (params) => adminApi.getPartnerPrices(params),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      errorMessage: '파트너 단가 목록을 불러오는데 실패했습니다.',
    },
  );

  // 단가 설정 모달
  const [formModal, setFormModal] = useState(false);
  const [form, setForm] = useState<UpsertForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<UpsertForm>>({});
  const [submitting, setSubmitting] = useState(false);

  // 삭제 확인 모달
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number; label: string }>({
    open: false, id: 0, label: '',
  });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ─── Form Handlers ─────────────────────────────────

  const openFormModal = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormModal(true);
  };

  const handleFormChange = (field: keyof UpsertForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<UpsertForm> = {};
    if (!form.partnerId || isNaN(Number(form.partnerId)) || Number(form.partnerId) <= 0) {
      errors.partnerId = '유효한 파트너 ID를 입력해주세요.';
    }
    if (!form.productId || isNaN(Number(form.productId)) || Number(form.productId) <= 0) {
      errors.productId = '유효한 상품 ID를 입력해주세요.';
    }
    if (!form.customPrice || isNaN(Number(form.customPrice)) || Number(form.customPrice) < 0) {
      errors.customPrice = '유효한 단가를 입력해주세요.';
    }
    if (form.customDiscountRate !== '' && (isNaN(Number(form.customDiscountRate)) || Number(form.customDiscountRate) < 0 || Number(form.customDiscountRate) > 100)) {
      errors.customDiscountRate = '0~100 사이의 값을 입력해주세요.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      await adminApi.upsertPartnerPrice({
        partnerId: Number(form.partnerId),
        productId: Number(form.productId),
        customPrice: Number(form.customPrice),
        customDiscountRate: form.customDiscountRate !== '' ? Number(form.customDiscountRate) : undefined,
      });
      showToast({ message: '파트너 단가가 저장되었습니다.', type: 'success' });
      setFormModal(false);
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '파트너 단가 저장에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete Handler ────────────────────────────────

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await adminApi.deletePartnerPrice(deleteConfirm.id);
      showToast({ message: '파트너 단가가 삭제되었습니다.', type: 'success' });
      setDeleteConfirm({ open: false, id: 0, label: '' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '파트너 단가 삭제에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Columns ────────────────────────────────────────

  const columns: Column<PartnerPrice>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (p) => (
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: COLORS.grey500 }}>
          #{p.id}
        </span>
      ),
    },
    {
      key: 'partner',
      header: '파트너명',
      render: (p) => (
        <div>
          <div style={{ fontWeight: 500 }}>{p.partnerName || `파트너 #${p.partnerId}`}</div>
          <div className="admin-sub-text">ID: {p.partnerId}</div>
        </div>
      ),
    },
    {
      key: 'product',
      header: '상품명',
      render: (p) => (
        <div>
          <div style={{ fontWeight: 500 }}>{p.productName || `상품 #${p.productId}`}</div>
          <div className="admin-sub-text">ID: {p.productId}</div>
        </div>
      ),
    },
    {
      key: 'customPrice',
      header: '파트너 단가',
      align: 'right',
      render: (p) => (
        <span style={{ fontWeight: 600, color: COLORS.primary }}>
          {formatPrice(Number(p.customPrice))}
        </span>
      ),
    },
    {
      key: 'customDiscountRate',
      header: '할인율',
      align: 'right',
      render: (p) => p.customDiscountRate != null ? (
        <span style={{ fontSize: '13px' }}>{Number(p.customDiscountRate)}%</span>
      ) : (
        <span style={{ color: COLORS.grey400, fontSize: '13px' }}>-</span>
      ),
    },
    {
      key: 'createdAt',
      header: '설정일',
      render: (p) => (
        <div>
          <div style={{ fontSize: '13px' }}>{new Date(p.createdAt).toLocaleDateString('ko-KR')}</div>
          <div className="admin-sub-text">{formatRelativeTime(p.createdAt)}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '작업',
      align: 'right',
      render: (p) => (
        <div className="admin-actions">
          <Button
            variant="ghost"
            size="sm"
            style={{ color: COLORS.error }}
            aria-label={`파트너 단가 #${p.id} 삭제`}
            onClick={() => setDeleteConfirm({
              open: true,
              id: p.id,
              label: `${p.partnerName || `파트너 #${p.partnerId}`} / ${p.productName || `상품 #${p.productId}`}`,
            })}
          >
            삭제
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
          <h2 className="admin-page-title">파트너 단가 관리</h2>
          <p className="admin-page-desc">파트너별 상품 단가를 설정하고 관리합니다</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-btn-primary" onClick={openFormModal}>
            <Plus size={16} aria-hidden="true" />
            단가 설정
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={prices}
          keyField="id"
          isLoading={loading}
          pagination={{
            currentPage: page,
            totalItems: total,
            itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
            onPageChange: setPage,
          }}
          emptyMessage="설정된 파트너 단가가 없습니다."
          caption="파트너 단가 목록"
        />
      </div>

      {/* 단가 설정 모달 */}
      <Modal
        isOpen={formModal}
        onClose={() => setFormModal(false)}
        title="파트너 단가 설정"
        size="small"
      >
        <div style={{ padding: 'var(--space-4)' }}>
          <p style={{ marginBottom: 'var(--space-4)', fontSize: '13px', color: COLORS.grey600 }}>
            파트너와 상품 ID를 입력하면 기존 단가가 있을 경우 덮어씁니다.
          </p>

          {/* 파트너 ID */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label className="admin-form-label" htmlFor="partner-price-partner-id">
              파트너 ID <span style={{ color: COLORS.error }}>*</span>
            </label>
            <input
              id="partner-price-partner-id"
              type="number"
              className="admin-filter-select"
              style={{ width: '100%' }}
              value={form.partnerId}
              onChange={(e) => handleFormChange('partnerId', e.target.value)}
              placeholder="파트너 ID를 입력하세요"
              min={1}
              aria-describedby={formErrors.partnerId ? 'partner-id-error' : undefined}
              aria-invalid={!!formErrors.partnerId}
            />
            {formErrors.partnerId && (
              <p id="partner-id-error" role="alert" style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-caption)', color: COLORS.error }}>
                {formErrors.partnerId}
              </p>
            )}
          </div>

          {/* 상품 ID */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label className="admin-form-label" htmlFor="partner-price-product-id">
              상품 ID <span style={{ color: COLORS.error }}>*</span>
            </label>
            <input
              id="partner-price-product-id"
              type="number"
              className="admin-filter-select"
              style={{ width: '100%' }}
              value={form.productId}
              onChange={(e) => handleFormChange('productId', e.target.value)}
              placeholder="상품 ID를 입력하세요"
              min={1}
              aria-describedby={formErrors.productId ? 'product-id-error' : undefined}
              aria-invalid={!!formErrors.productId}
            />
            {formErrors.productId && (
              <p id="product-id-error" role="alert" style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-caption)', color: COLORS.error }}>
                {formErrors.productId}
              </p>
            )}
          </div>

          {/* 파트너 단가 */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label className="admin-form-label" htmlFor="partner-price-custom-price">
              파트너 단가 (원) <span style={{ color: COLORS.error }}>*</span>
            </label>
            <input
              id="partner-price-custom-price"
              type="number"
              className="admin-filter-select"
              style={{ width: '100%' }}
              value={form.customPrice}
              onChange={(e) => handleFormChange('customPrice', e.target.value)}
              placeholder="단가를 입력하세요"
              min={0}
              aria-describedby={formErrors.customPrice ? 'custom-price-error' : undefined}
              aria-invalid={!!formErrors.customPrice}
            />
            {formErrors.customPrice && (
              <p id="custom-price-error" role="alert" style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-caption)', color: COLORS.error }}>
                {formErrors.customPrice}
              </p>
            )}
          </div>

          {/* 할인율 (선택) */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label className="admin-form-label" htmlFor="partner-price-discount-rate">
              할인율 (%) <span style={{ fontSize: 'var(--text-caption)', color: COLORS.grey500 }}>선택</span>
            </label>
            <input
              id="partner-price-discount-rate"
              type="number"
              className="admin-filter-select"
              style={{ width: '100%' }}
              value={form.customDiscountRate}
              onChange={(e) => handleFormChange('customDiscountRate', e.target.value)}
              placeholder="할인율을 입력하세요 (0~100)"
              min={0}
              max={100}
              step={0.1}
              aria-describedby={formErrors.customDiscountRate ? 'discount-rate-error' : undefined}
              aria-invalid={!!formErrors.customDiscountRate}
            />
            {formErrors.customDiscountRate && (
              <p id="discount-rate-error" role="alert" style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-caption)', color: COLORS.error }}>
                {formErrors.customDiscountRate}
              </p>
            )}
          </div>

          {/* 버튼 */}
          <div className="admin-form-footer">
            <Button variant="ghost" onClick={() => setFormModal(false)} disabled={submitting}>
              취소
            </Button>
            <Button variant="primary" onClick={handleSubmit} loading={submitting}>
              저장
            </Button>
          </div>
        </div>
      </Modal>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: 0, label: '' })}
        onConfirm={handleDelete}
        title="파트너 단가 삭제"
        confirmLabel="삭제"
        danger
        loading={deleteLoading}
      >
        <p>
          <strong>{deleteConfirm.label}</strong>의 단가 설정을 삭제하시겠습니까?
        </p>
        <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-caption)', color: COLORS.grey500 }}>
          삭제 후에는 해당 파트너에게 기본 단가가 적용됩니다.
        </p>
      </ConfirmModal>
    </div>
  );
};

export default PartnerPricesTab;
