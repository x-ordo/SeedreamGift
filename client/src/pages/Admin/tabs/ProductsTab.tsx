
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
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
  FULFILLMENT_TYPE_OPTIONS,
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
  isActive: boolean;
  imageUrl?: string;
  description?: string;
  deletedAt?: string | null;
  type: string;
  shippingMethod: string;
  minPurchaseQty?: number;
  maxPurchaseQty?: number;
  minStockAlert?: number;
  fulfillmentType?: string;
  rejectionReason?: string;
  approvalStatus?: string;
}

const ProductsTab = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { items: products, loading, page, total, setPage, reload } = useAdminList<Product>(
    (params) => adminApi.getAllProducts(params),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      errorMessage: '상품 목록을 불러오는데 실패했습니다.',
    },
  );

  const deleteConfirm = useDeleteConfirm<number>({
    deleteFn: (id) => adminApi.deleteProduct(id),
    onSuccess: reload,
    successMessage: '상품이 비활성화되었습니다.',
    errorMessage: '상품 비활성화에 실패했습니다.',
  });

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
      key: 'status', header: '상태',
      render: (p) => (
        <div>
          <div className="flex gap-1 flex-wrap">
            <Badge color={p.isActive ? 'green' : 'elephant'} variant="weak" size="sm">{p.isActive ? ACTIVE_STATUS_LABELS.product.active : ACTIVE_STATUS_LABELS.product.inactive}</Badge>
            {p.deletedAt && <Badge color="red" variant="weak" size="sm">삭제됨</Badge>}
            {p.approvalStatus === 'REJECTED' && <Badge color="red" variant="weak" size="sm">승인거절</Badge>}
          </div>
          {p.approvalStatus === 'REJECTED' && p.rejectionReason && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--color-red-50)', border: '1px solid var(--color-red-100)', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-error)' }}>거절 사유: </span>
              <span style={{ fontSize: '12px', color: 'var(--color-grey-700)' }}>{p.rejectionReason}</span>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (p) => (
        <div className="admin-actions">
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
    isActive: product?.isActive ?? true,
    imageUrl: product?.imageUrl || '',
    type: product?.type || PRODUCT_FORM_DEFAULTS.type,
    shippingMethod: product?.shippingMethod || PRODUCT_FORM_DEFAULTS.shippingMethod,
    minPurchaseQty: product?.minPurchaseQty ?? PRODUCT_FORM_DEFAULTS.minPurchaseQty,
    maxPurchaseQty: product?.maxPurchaseQty ?? PRODUCT_FORM_DEFAULTS.maxPurchaseQty,
    minStockAlert: product?.minStockAlert ?? PRODUCT_FORM_DEFAULTS.minStockAlert,
    fulfillmentType: product?.fulfillmentType || PRODUCT_FORM_DEFAULTS.fulfillmentType,
  });

  // 판매가 계산 (액면가 x (1 - 할인율/100))
  const calculatedBuyPrice = Math.round(formData.price * (1 - formData.discountRate / 100));

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { brand, isActive, ...rest } = formData;
      const base = { ...rest, brandCode: brand };
      if (product) {
        await adminApi.updateProduct(product.id, { ...base, isActive });
        showToast({ message: '상품이 수정되었습니다.', type: 'success' });
      } else {
        await adminApi.createProduct(base);
        showToast({ message: '상품이 등록되었습니다.', type: 'success' });
      }
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || '상품 저장에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={product ? '상품 수정' : '새 상품 등록'} footer={
      <div className="flex gap-2 w-full">
        <Button variant="ghost" onClick={onClose} type="button" fullWidth>취소</Button>
        <Button variant="primary" type="button" loading={loading} onClick={handleSubmit} fullWidth>
          {product ? '수정' : '등록'}
        </Button>
      </div>
    }>
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
              type="number"
              value={formData.price}
              onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
              min={1000}
              step={1000}
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

        {/* 구매 수량 제한 & 발급 방식 */}
        <div className="admin-form-row">
          <div className="admin-form-group">
            <label className="admin-form-label">최소 구매수량</label>
            <TextField
              variant="box"
              type="number"
              value={formData.minPurchaseQty}
              onChange={e => setFormData({ ...formData, minPurchaseQty: Number(e.target.value) })}
              min={1}
              step={1}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">최대 구매수량</label>
            <TextField
              variant="box"
              type="number"
              value={formData.maxPurchaseQty}
              onChange={e => setFormData({ ...formData, maxPurchaseQty: Number(e.target.value) })}
              min={1}
              step={1}
            />
          </div>
        </div>

        <div className="admin-form-row">
          <div className="admin-form-group">
            <label className="admin-form-label">재고 부족 알림 기준 <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--color-grey-500)' }}>(0 = 알림 없음)</span></label>
            <TextField
              variant="box"
              type="number"
              value={formData.minStockAlert}
              onChange={e => setFormData({ ...formData, minStockAlert: Number(e.target.value) })}
              min={0}
              step={1}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">발급 방식</label>
            <select
              className="select select-bordered w-full"
              value={formData.fulfillmentType}
              onChange={e => setFormData({ ...formData, fulfillmentType: e.target.value })}
            >
              {FULFILLMENT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

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
      </form>
    </Modal>
  );
};

export default ProductsTab;
