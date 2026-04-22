import React, { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Badge, Modal, TextField } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { COLORS, SPACING } from '../../../constants/designTokens';
import { ACTIVE_STATUS_LABELS, BRAND_FORM_DEFAULTS } from '../constants';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList, useDeleteConfirm } from '../hooks';

interface AdminBrand {
  code: string;
  name: string;
  color: string;
  order: number;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
}

type StatusFilter = '' | 'active' | 'inactive';

const BrandsTab = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<AdminBrand | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [productCounts, setProductCounts] = useState<Map<string, number>>(new Map());

  const { items: brands, loading, reload } = useAdminList<AdminBrand>(
    (params) => adminApi.getAllBrands(params),
  );

  const deleteConfirm = useDeleteConfirm<string>({
    deleteFn: (code) => adminApi.deleteBrand(code),
    onSuccess: reload,
    successMessage: '삭제되었습니다.',
    errorMessage: '브랜드 삭제에 실패했습니다.',
  });

  // 브랜드별 상품 수 조회
  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.getAllProducts({ page: 1, limit: 100 });
        const items = res?.items ?? [];
        const counts = new Map<string, number>();
        items.forEach((p: any) => {
          const code = p.brand || p.brandCode;
          if (code) counts.set(code, (counts.get(code) || 0) + 1);
        });
        setProductCounts(counts);
      } catch { /* non-critical */ }
    })();
  }, []);

  const filteredBrands = useMemo(() => {
    if (!statusFilter) return brands;
    return brands.filter(b => statusFilter === 'active' ? b.isActive : !b.isActive);
  }, [brands, statusFilter]);

  const columns: Column<AdminBrand>[] = [
    { key: 'code', header: '코드', render: (b) => <span className="admin-mono" style={{ fontWeight: 600 }}>{b.code}</span> },
    { key: 'name', header: '브랜드명', render: (b) => <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '20px', height: '20px', borderRadius: 'var(--radius-sm)', backgroundColor: b.color }} />{b.name}</div> },
    { key: 'order', header: '순서', align: 'right' },
    {
      key: 'status', header: '상태', render: (b) => {
        const count = productCounts.get(b.code) || 0;
        return (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge color={b.isActive ? 'green' : 'elephant'} variant="weak" size="small">{b.isActive ? ACTIVE_STATUS_LABELS.brand.active : ACTIVE_STATUS_LABELS.brand.inactive}</Badge>
            {b.isActive && count === 0 && <Badge color="yellow" variant="weak" size="xsmall">상품 0종</Badge>}
          </div>
        );
      }
    },
    {
      key: 'actions', header: '작업', align: 'right', render: (b) => (
        <div className="admin-actions">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedBrand(b); setModalOpen(true); }}>수정</Button>
          <Button variant="ghost" size="sm" style={{ color: COLORS.error }} onClick={() => deleteConfirm.openConfirm(b.code, b.name)}>삭제</Button>
        </div>
      )
    }
  ];

  return (
    <div className="admin-tab">
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">브랜드 관리</h2>
          <p className="admin-page-desc">상품권 브랜드 정보를 관리합니다</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-btn-primary" onClick={() => { setSelectedBrand(null); setModalOpen(true); }}>
            <Plus size={16} aria-hidden="true" />
            브랜드 추가
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-filter-card">
        {([['', '전체'], ['active', '활성'], ['inactive', '비활성']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value as StatusFilter)}
            className="admin-btn-secondary"
            style={{
              fontWeight: statusFilter === value ? 600 : 400,
              background: statusFilter === value ? COLORS.primaryLight : undefined,
              borderColor: statusFilter === value ? COLORS.primary : undefined,
              color: statusFilter === value ? COLORS.primary : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table Card */}
      <div className="admin-table-card">
        <AdminTable columns={columns} data={filteredBrands} keyField="code" isLoading={loading} emptyMessage="등록된 브랜드가 없습니다." emptyAction={{ label: '첫 브랜드 등록', onClick: () => { setSelectedBrand(null); setModalOpen(true); } }} caption="브랜드 목록" />
      </div>

      {modalOpen && <BrandFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} brand={selectedBrand} onSuccess={() => { setModalOpen(false); reload(); }} />}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.closeConfirm}
        onConfirm={deleteConfirm.executeDelete}
        title="브랜드 삭제"
        confirmLabel="삭제"
        danger
      >
        <p>
          브랜드 <strong>{deleteConfirm.targetLabel}</strong>을(를) 삭제하시겠습니까?
        </p>
      </ConfirmModal>
    </div>
  );
};

const BrandFormModal: React.FC<{ isOpen: boolean; onClose: () => void; brand: AdminBrand | null; onSuccess: () => void }> = ({ isOpen, onClose, brand, onSuccess }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: brand?.code || '',
    name: brand?.name || '',
    color: brand?.color || BRAND_FORM_DEFAULTS.color,
    order: brand?.order || BRAND_FORM_DEFAULTS.order,
    description: brand?.description || '',
    imageUrl: brand?.imageUrl || '',
    isActive: brand?.isActive ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (brand) {
        const { code: _code, ...updateData } = formData;
        await adminApi.updateBrand(brand.code, updateData);
      }
      else await adminApi.createBrand(formData);
      showToast({ message: '저장되었습니다.', type: 'success' });
      onSuccess();
    } catch { showToast({ message: '브랜드 저장에 실패했습니다.', type: 'error' }); } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={brand ? '브랜드 수정' : '새 브랜드'}>
      <form onSubmit={handleSubmit} className="admin-form-body">
        <div>
          <label className="admin-form-label">코드</label>
          <TextField
            variant="box"
            value={formData.code}
            onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
            required
            disabled={!!brand}
            placeholder="예: SHINSEGAE (영문 대문자)"
            style={{ fontFamily: 'var(--font-family-mono, monospace)', textTransform: 'uppercase' }}
          />
        </div>
        <div>
          <label className="admin-form-label">브랜드명</label>
          <TextField variant="box" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
        </div>
        <div className="admin-form-row">
          <div style={{ flex: 1 }}>
            <label className="admin-form-label">색상</label>
            <input type="color" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} style={{ width: '100%', height: '40px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="admin-form-label">순서</label>
            <TextField variant="box" type="number" value={String(formData.order)} onChange={e => setFormData({ ...formData, order: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="admin-form-label">설명</label>
          <TextField variant="box" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
        </div>
        <div>
          <label className="admin-form-label">로고 이미지 URL</label>
          <div style={{ display: 'flex', gap: SPACING[2], alignItems: 'center' }}>
            <TextField
              variant="box"
              value={formData.imageUrl}
              onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
              placeholder="https://..."
              style={{ flex: 1 }}
            />
            {formData.imageUrl && (
              <img
                src={formData.imageUrl}
                alt="로고 미리보기"
                style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 'var(--radius-sm)', border: `1px solid ${COLORS.grey200}` }}
                width={40}
                height={40}
                decoding="async"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block'; }}
              />
            )}
          </div>
        </div>
        <div className="admin-form-footer">
          <Button variant="ghost" onClick={onClose} type="button">취소</Button>
          <Button variant="primary" type="submit" loading={loading}>저장</Button>
        </div>
      </form>
    </Modal>
  );
};

export default BrandsTab;
