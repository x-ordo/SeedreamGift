import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Badge, Modal, TextField } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { COLORS, SPACING } from '../../../constants/designTokens';
import { FAQ_CATEGORY_OPTIONS, ADMIN_PAGINATION, FAQ_FORM_DEFAULTS } from '../constants';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList, useDeleteConfirm } from '../hooks';

interface AdminFaq {
  id: number;
  question: string;
  answer: string;
  category: string;
  order: number;
  helpfulCount: number;
  isActive: boolean;
  createdAt: string;
}

const FaqsTab = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<AdminFaq | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  const { items: faqs, loading, page, total, setPage, reload } = useAdminList<AdminFaq>(
    (params) => adminApi.getAllFaqs(params),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters: { category: categoryFilter || undefined },
      errorMessage: 'FAQ 목록을 불러오는데 실패했습니다.',
    },
  );

  const deleteConfirm = useDeleteConfirm<number>({
    deleteFn: (id) => adminApi.deleteFaq(id),
    onSuccess: reload,
    successMessage: '삭제되었습니다.',
    errorMessage: 'FAQ 삭제에 실패했습니다.',
  });

  const columns: Column<AdminFaq>[] = [
    { key: 'id', header: 'ID', render: (f) => <span className="admin-mono">#{f.id}</span> },
    { key: 'category', header: '카테고리', render: (f) => <Badge color="blue" variant="weak" size="sm">{f.category}</Badge> },
    { key: 'question', header: '질문', render: (f) => <div style={{ fontWeight: 600, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.question}</div> },
    { key: 'order', header: '순서', align: 'right', render: (f) => f.order },
    { key: 'helpful', header: '도움됨', align: 'right', render: (f) => (f.helpfulCount || 0).toLocaleString() },
    { key: 'status', header: '상태', render: (f) => <Badge color={f.isActive ? 'green' : 'elephant'} variant="weak" size="sm">{f.isActive ? '공개' : '비공개'}</Badge> },
    {
      key: 'actions', header: '작업', align: 'right', render: (f) => (
        <div className="admin-actions">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedFaq(f); setModalOpen(true); }}>수정</Button>
          <Button variant="ghost" size="sm" style={{ color: COLORS.error }} onClick={() => deleteConfirm.openConfirm(f.id, f.question)}>삭제</Button>
        </div>
      )
    }
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">FAQ 관리</h2>
          <p className="admin-page-desc">자주 묻는 질문을 관리합니다</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-btn-primary" onClick={() => { setSelectedFaq(null); setModalOpen(true); }}>
            <Plus size={16} aria-hidden="true" />
            새 FAQ
          </button>
        </div>
      </div>

      <div className="admin-filter-card">
        <select
          className="admin-filter-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="카테고리 필터"
        >
          <option value="">전체 카테고리</option>
          {FAQ_CATEGORY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="admin-table-card">
        <AdminTable columns={columns} data={faqs} keyField="id" isLoading={loading} pagination={{ currentPage: page, totalItems: total, itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE, onPageChange: setPage }} emptyMessage="FAQ가 없습니다." emptyAction={{ label: '첫 FAQ 작성', onClick: () => { setSelectedFaq(null); setModalOpen(true); } }} caption="FAQ 목록" />
      </div>

      {modalOpen && <FaqFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} faq={selectedFaq} onSuccess={() => { setModalOpen(false); reload(); }} />}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.closeConfirm}
        onConfirm={deleteConfirm.executeDelete}
        title="FAQ 삭제"
        confirmLabel="삭제"
        danger
      >
        <p>
          FAQ <strong>"{deleteConfirm.targetLabel.length > 30 ? deleteConfirm.targetLabel.slice(0, 30) + '...' : deleteConfirm.targetLabel}"</strong>을(를) 삭제하시겠습니까?
          <br />
          <span style={{ fontSize: '13px', color: COLORS.grey500 }}>이 작업은 되돌릴 수 없습니다.</span>
        </p>
      </ConfirmModal>
    </div>
  );
};

const FaqFormModal: React.FC<{ isOpen: boolean; onClose: () => void; faq: AdminFaq | null; onSuccess: () => void }> = ({ isOpen, onClose, faq, onSuccess }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    question: faq?.question || '',
    answer: faq?.answer || '',
    category: faq?.category || FAQ_FORM_DEFAULTS.category,
    order: faq?.order || FAQ_FORM_DEFAULTS.order,
    isActive: faq?.isActive ?? true,
  });

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (faq) await adminApi.updateFaq(faq.id, formData);
      else await adminApi.createFaq(formData);
      showToast({ message: '저장되었습니다.', type: 'success' });
      onSuccess();
    } catch { showToast({ message: 'FAQ 저장에 실패했습니다.', type: 'error' }); } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={faq ? 'FAQ 수정' : '새 FAQ'} footer={
      <div className="flex gap-2 w-full">
        <Button variant="ghost" onClick={onClose} type="button" fullWidth>취소</Button>
        <Button variant="primary" type="button" loading={loading} onClick={handleSubmit} fullWidth>저장</Button>
      </div>
    }>
      <form onSubmit={handleSubmit} className="admin-form-body">
        <div className="admin-form-row">
          <div style={{ flex: 2 }}>
            <label className="admin-form-label">카테고리</label>
            <select className="form-control" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
              {FAQ_CATEGORY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="admin-form-label">순서</label>
            <TextField variant="box" type="number" value={String(formData.order)} onChange={e => setFormData({ ...formData, order: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="admin-form-label">질문</label>
          <TextField variant="box" value={formData.question} onChange={e => setFormData({ ...formData, question: e.target.value })} required />
        </div>
        <div>
          <label className="admin-form-label">답변</label>
          <TextField variant="box" value={formData.answer} onChange={e => setFormData({ ...formData, answer: e.target.value })} required />
        </div>
        <div style={{ marginTop: SPACING[3] }}>
          <label className="admin-checkbox-label">
            <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
            게시 (사용자에게 노출)
          </label>
        </div>
      </form>
    </Modal>
  );
};

export default FaqsTab;
