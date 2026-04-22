
import React, { useState } from 'react';
import { Plus, Check, Minus } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Badge, Modal, TextField } from '../../../design-system';
import { ConfirmModal } from '../components/ConfirmModal';
import { AdminTable, Column } from '../../../components/admin';
import { formatPrice } from '../../../utils';

import {
  BRAND_OPTIONS,
  BRAND_LABEL_MAP,
  ProductFormData,
  ACTIVE_STATUS_LABELS,
  PRODUCT_FORM_DEFAULTS,
  ADMIN_PAGINATION,
  PRODUCT_TYPE_OPTIONS,
  SHIPPING_METHOD_OPTIONS,
  APPROVAL_STATUS_OPTIONS,
  APPROVAL_STATUS_COLOR_MAP,
  FULFILLMENT_TYPE_OPTIONS,
  PROVIDER_OPTIONS,
} from '../constants';
import { useAdminList, useDeleteConfirm } from '../hooks';

interface Product {
  id: number;
  name: string;
  brandCode: string;
  price: number;
  buyPrice: number;
  discountRate: number;
  tradeInRate: number;
  allowTradeIn: boolean;
  allowPartnerStock: boolean;
  isActive: boolean;
  imageUrl?: string;
  description?: string;
  deletedAt?: string | null;
  type: string;
  shippingMethod: string;
  partnerId?: number | null;
  partnerName?: string | null;
  approvalStatus?: string;
  approvalReason?: string;
  fulfillmentType?: string;
  providerCode?: string;
  providerProductCode?: string;
}

const ProductsTab = () => {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [approvalFilter, setApprovalFilter] = useState('');
  const [approveConfirm, setApproveConfirm] = useState<{ open: boolean; productId: number; productName: string }>({
    open: false, productId: 0, productName: '',
  });
  const [rejectModal, setRejectModal] = useState<{ open: boolean; productId: number; productName: string; reason: string }>({
    open: false, productId: 0, productName: '', reason: '',
  });
  const [rejecting, setRejecting] = useState(false);

  const { items: products, loading, page, total, setPage, reload } = useAdminList<Product>(
    (params) => adminApi.getAllProducts(params),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters: {
        approvalStatus: approvalFilter || undefined,
      },
      errorMessage: '상품 목록을 불러오는데 실패했습니다.',
    },
  );

  const deleteConfirm = useDeleteConfirm<number>({
    deleteFn: (id) => adminApi.deleteProduct(id),
    onSuccess: reload,
    successMessage: '상품이 비활성화되었습니다.',
    errorMessage: '상품 비활성화에 실패했습니다.',
  });

  const handleApprove = async () => {
    const { productId } = approveConfirm;
    try {
      await adminApi.approveProduct(productId, 'APPROVED');
      showToast({ message: '상품이 승인되었습니다.', type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '상품 승인에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setApproveConfirm({ open: false, productId: 0, productName: '' });
    }
  };

  const handleReject = async () => {
    const { productId, reason } = rejectModal;
    if (!reason.trim()) {
      showToast({ message: '거절 사유를 입력해주세요.', type: 'error' });
      return;
    }
    setRejecting(true);
    try {
      await adminApi.approveProduct(productId, 'REJECTED', reason.trim());
      showToast({ message: '상품이 거절되었습니다.', type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '상품 거절에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setRejectModal({ open: false, productId: 0, productName: '', reason: '' });
      setRejecting(false);
    }
  };

  const getApprovalLabel = (status?: string) =>
    APPROVAL_STATUS_OPTIONS.find(o => o.value === status)?.label || status || '-';

  const columns: Column<Product>[] = [
    {
      key: 'name', header: '상품명',
      render: (p) => (
        <div>
          <div className="admin-user-name">{p.name}</div>
          <div className="text-xs text-primary">
            {BRAND_LABEL_MAP.get(p.brandCode as import('../constants').BrandCode) || p.brandCode} · <span className="text-base-content/60">{PRODUCT_TYPE_OPTIONS.find(t => t.value === p.type)?.label || p.type}</span>
          </div>
        </div>
      )
    },
    { key: 'price', header: '액면가', align: 'right', render: (p) => formatPrice(Number(p.price)) },
    {
      key: 'buyPrice', header: '판매가', align: 'right',
      render: (p) => (
        <div>
          <span className="text-error font-bold">{formatPrice(Number(p.buyPrice))}</span>
          <span className="text-xs text-base-content/50 ml-1">({p.discountRate}%)</span>
        </div>
      )
    },
    {
      key: 'partner', header: '파트너',
      render: (p) =>
        p.partnerId ? (
          <Badge color="teal" variant="weak" size="small">
            {p.partnerName || `P#${p.partnerId}`}
          </Badge>
        ) : (
          <Badge color="elephant" variant="weak" size="small">직영</Badge>
        )
    },
    {
      key: 'allowPartnerStock', header: '파트너 허용',
      align: 'center',
      render: (p) => p.allowPartnerStock ? (
        <Check size={16} style={{ color: 'var(--color-success)', margin: '0 auto' }} aria-label="허용" />
      ) : (
        <Minus size={16} style={{ color: 'var(--color-grey-300)', margin: '0 auto' }} aria-label="비허용" />
      )
    },
    {
      key: 'approval', header: '승인',
      render: (p) => {
        const color = APPROVAL_STATUS_COLOR_MAP.get(p.approvalStatus || '') || 'elephant';
        return (
          <Badge color={color as any} variant="weak" size="small">
            {getApprovalLabel(p.approvalStatus)}
          </Badge>
        );
      }
    },
    {
      key: 'status', header: '상태',
      render: (p) => (
        <div className="flex gap-1 flex-wrap">
          <Badge color={p.isActive ? 'green' : 'elephant'} variant="weak" size="small">{p.isActive ? ACTIVE_STATUS_LABELS.product.active : ACTIVE_STATUS_LABELS.product.inactive}</Badge>
          {p.deletedAt && <Badge color="red" variant="weak" size="small">삭제됨</Badge>}
        </div>
      )
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (p) => (
        <div className="admin-actions">
          {p.approvalStatus === 'PENDING' && (
            <>
              <Button variant="success" size="sm" onClick={() => setApproveConfirm({ open: true, productId: p.id, productName: p.name })}>승인</Button>
              <Button variant="danger" size="sm" onClick={() => setRejectModal({ open: true, productId: p.id, productName: p.name, reason: '' })}>거절</Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => { setSelectedProduct(p); setModalOpen(true); }}>수정</Button>
          <Button variant="ghost" size="sm" className="text-error" onClick={() => deleteConfirm.openConfirm(p.id, p.name)}>비활성화</Button>
        </div>
      )
    }
  ];

  return (
    <div className="admin-tab">
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">상품 관리</h2>
          <p className="admin-page-desc">상품권 상품의 가격, 할인율을 관리합니다</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-btn-primary" onClick={() => { setSelectedProduct(null); setModalOpen(true); }}>
            <Plus size={16} aria-hidden="true" />
            상품 추가
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-filter-card">
        <select
          className="admin-filter-select"
          value={approvalFilter}
          onChange={(e) => setApprovalFilter(e.target.value)}
          aria-label="승인 상태 필터"
        >
          <option value="">전체 승인 상태</option>
          {APPROVAL_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table Card */}
      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={products}
          keyField="id"
          isLoading={loading}
          pagination={{
            currentPage: page,
            totalItems: total,
            itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
            onPageChange: setPage,
          }}
          emptyMessage="등록된 상품이 없습니다."
          emptyAction={{ label: '첫 상품 등록', onClick: () => { setSelectedProduct(null); setModalOpen(true); } }}
          caption="상품 목록"
        />
      </div>

      {/* 상품 생성/수정 모달 */}
      {modalOpen && (
        <ProductFormModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          product={selectedProduct}
          onSuccess={() => { setModalOpen(false); reload(); }}
        />
      )}

      {/* 비활성화 확인 모달 */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.closeConfirm}
        onConfirm={deleteConfirm.executeDelete}
        title="상품 비활성화 확인"
        confirmLabel="비활성화"
        danger
      >
        <p>
          <strong>{deleteConfirm.targetLabel}</strong> 상품을 비활성화하시겠습니까?
          <br />
          <span style={{ fontSize: '13px', color: 'var(--color-grey-500)' }}>상품이 비활성화되며 판매 목록에서 숨겨집니다.</span>
        </p>
      </ConfirmModal>

      {/* 승인 확인 모달 */}
      <ConfirmModal
        isOpen={approveConfirm.open}
        onClose={() => setApproveConfirm({ open: false, productId: 0, productName: '' })}
        onConfirm={handleApprove}
        title="상품 승인 확인"
        confirmLabel="승인"
      >
        <p>
          <strong>{approveConfirm.productName}</strong> 상품을 승인하시겠습니까?
        </p>
      </ConfirmModal>

      {/* 거절 모달 (사유 입력) */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, productId: 0, productName: '', reason: '' })}
        title="상품 거절"
        size="small"
      >
        <div style={{ padding: 'var(--space-4)' }}>
          <p style={{ marginBottom: 'var(--space-3)', color: 'var(--color-grey-700)' }}>
            <strong>{rejectModal.productName}</strong> 상품을 거절합니다.
          </p>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label className="admin-form-label">거절 사유 *</label>
            <textarea
              className="textarea textarea-bordered w-full resize-y"
              value={rejectModal.reason}
              onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="거절 사유를 입력해주세요"
              rows={3}
              required
            />
          </div>
          <div className="admin-form-footer">
            <Button variant="ghost" type="button" onClick={() => setRejectModal({ open: false, productId: 0, productName: '', reason: '' })} disabled={rejecting}>취소</Button>
            <Button
              variant="danger"
              onClick={handleReject}
              loading={rejecting}
              disabled={!rejectModal.reason.trim() || rejecting}
            >
              거절
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const ProductFormModal: React.FC<{ isOpen: boolean; onClose: () => void; product: Product | null; onSuccess: () => void }> = ({ isOpen, onClose, product, onSuccess }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    brand: product?.brandCode || 'SHINSEGAE',
    name: product?.name || '',
    description: product?.description || '',
    price: product ? Number(product.price) : PRODUCT_FORM_DEFAULTS.price,
    discountRate: product ? Number(product.discountRate) : PRODUCT_FORM_DEFAULTS.discountRate,
    tradeInRate: product ? Number(product.tradeInRate) : PRODUCT_FORM_DEFAULTS.tradeInRate,
    allowTradeIn: product?.allowTradeIn ?? PRODUCT_FORM_DEFAULTS.allowTradeIn,
    allowPartnerStock: product?.allowPartnerStock ?? PRODUCT_FORM_DEFAULTS.allowPartnerStock,
    isActive: product?.isActive ?? true,
    imageUrl: product?.imageUrl || '',
    type: product?.type || PRODUCT_FORM_DEFAULTS.type,
    shippingMethod: product?.shippingMethod || PRODUCT_FORM_DEFAULTS.shippingMethod,
    fulfillmentType: product?.fulfillmentType || PRODUCT_FORM_DEFAULTS.fulfillmentType,
    providerCode: product?.providerCode || PRODUCT_FORM_DEFAULTS.providerCode,
    providerProductCode: product?.providerProductCode || PRODUCT_FORM_DEFAULTS.providerProductCode,
  });

  // 판매가 계산 (액면가 x (1 - 할인율/100))
  const calculatedBuyPrice = Math.round(formData.price * (1 - formData.discountRate / 100));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { brand, isActive, allowPartnerStock, ...rest } = formData;
      const base = { ...rest, brandCode: brand, allowPartnerStock };
      if (product) {
        await adminApi.updateProduct(product.id, { ...base, isActive });
        showToast({ message: '상품이 수정되었습니다.', type: 'success' });
      } else {
        await adminApi.createProduct(base);
        showToast({ message: '상품이 등록되었습니다.', type: 'success' });
      }
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '상품 저장에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={product ? '상품 수정' : '새 상품 등록'}>
      <form onSubmit={handleSubmit} className="admin-form-body">
        {/* Type & Brand (1st Row) */}
        <div className="admin-form-row">
          <div className="admin-form-group">
            <label className="admin-form-label">상품 유형 *</label>
            <select
              className="select select-bordered w-full"
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
              required
            >
              {PRODUCT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">브랜드 *</label>
            <select
              className="select select-bordered w-full"
              value={formData.brand}
              onChange={e => setFormData({ ...formData, brand: e.target.value })}
              required
            >
              {BRAND_OPTIONS.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 상품명 */}
        <div className="admin-form-group">
          <label className="admin-form-label">상품명 *</label>
          <TextField
            variant="box"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="예: 신세계상품권 5만원"
            required
          />
        </div>

        {/* 가격 정보 - 2열 그리드 */}
        <div className="admin-form-row">
          <div className="admin-form-group">
            <label className="admin-form-label">액면가 (원) *</label>
            <TextField
              variant="box"
              inputMode="numeric"
              value={formData.price ? formData.price.toLocaleString() : ''}
              onChange={e => {
                const raw = e.target.value.replace(/[^\d]/g, '');
                setFormData({ ...formData, price: raw ? Number(raw) : 0 });
              }}
              placeholder="예: 100,000"
              required
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">할인율 (%) *</label>
            <TextField
              variant="box"
              type="number"
              value={formData.discountRate}
              onChange={e => setFormData({ ...formData, discountRate: Number(e.target.value) })}
              min={0}
              max={100}
              step={0.1}
              required
            />
          </div>
        </div>

        {/* 계산된 판매가 표시 */}
        <div className="admin-form-info bg-primary/10 p-3 rounded-lg mb-4">
          <span className="text-base-content/60 text-sm">계산된 판매가: </span>
          <span className="text-primary font-bold text-base">{formatPrice(calculatedBuyPrice)}</span>
          <span className="text-base-content/50 text-xs ml-2">
            ({formData.price.toLocaleString()}원 x {(100 - formData.discountRate).toFixed(1)}%)
          </span>
        </div>

        {/* 매입율 & Shipping Method */}
        <div className="admin-form-row">
          <div className="admin-form-group">
            <label className="admin-form-label">매입율 (%) *</label>
            <TextField
              variant="box"
              type="number"
              value={formData.tradeInRate}
              onChange={e => setFormData({ ...formData, tradeInRate: Number(e.target.value) })}
              min={0}
              max={100}
              step={0.1}
              required
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">배송 방법</label>
            <select
              className="select select-bordered w-full"
              value={formData.shippingMethod}
              onChange={e => setFormData({ ...formData, shippingMethod: e.target.value })}
              disabled={formData.type === 'DIGITAL'}
            >
              {SHIPPING_METHOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-form-group flex items-center mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={formData.allowTradeIn}
              onChange={e => setFormData({ ...formData, allowTradeIn: e.target.checked })}
            />
            <span className="text-sm">매입 허용</span>
          </label>
        </div>

        <div className="admin-form-group flex items-center mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={formData.allowPartnerStock}
              onChange={e => setFormData({ ...formData, allowPartnerStock: e.target.checked })}
            />
            <span className="text-sm">파트너 재고 허용</span>
          </label>
          <span className="text-xs text-base-content/50 ml-2">파트너가 이 상품에 PIN을 등록할 수 있습니다</span>
        </div>

        {/* 발급 방식 */}
        <div className="admin-form-group">
          <label className="admin-form-label">발급 방식</label>
          <select
            className="admin-filter-select"
            value={formData.fulfillmentType}
            onChange={e => setFormData({ ...formData, fulfillmentType: e.target.value })}
          >
            {FULFILLMENT_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {formData.fulfillmentType === 'API' && (
          <>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">제공업체</label>
                <select
                  className="admin-filter-select"
                  value={formData.providerCode}
                  onChange={e => setFormData({ ...formData, providerCode: e.target.value })}
                >
                  <option value="">선택</option>
                  {PROVIDER_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">외부 상품코드</label>
                <TextField
                  variant="box"
                  value={formData.providerProductCode}
                  onChange={e => setFormData({ ...formData, providerProductCode: e.target.value })}
                  placeholder="외부 API 상품 코드"
                />
              </div>
            </div>
          </>
        )}

        {/* 이미지 URL */}
        <div className="admin-form-group">
          <label className="admin-form-label">이미지 URL</label>
          <TextField
            variant="box"
            type="url"
            value={formData.imageUrl}
            onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
            placeholder="https://example.com/image.jpg"
          />
        </div>

        {/* 설명 */}
        <div className="admin-form-group">
          <label className="admin-form-label">설명</label>
          <textarea
            className="textarea textarea-bordered w-full resize-y"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="상품 설명을 입력하세요"
            rows={3}
          />
        </div>

        {/* 활성 상태 (수정 시에만) */}
        {product && (
          <div className="admin-form-group">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={formData.isActive}
                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span className="text-sm">판매 활성화</span>
            </label>
          </div>
        )}

        <div className="admin-form-footer">
          <Button variant="ghost" onClick={onClose} type="button">취소</Button>
          <Button variant="primary" type="submit" loading={loading}>
            {product ? '수정' : '등록'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ProductsTab;
