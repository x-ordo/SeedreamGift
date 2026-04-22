import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Badge, Modal, TextField } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatRelativeTime } from '../../../utils';
import { COLORS, SPACING } from '../../../constants/designTokens';
import { ADMIN_PAGINATION } from '../constants';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList, useDeleteConfirm } from '../hooks';

interface AdminNotice {
  id: number;
  title: string;
  content: string;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
}

const NoticesTab = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<AdminNotice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminNotice | null>(null);

  const { items: notices, loading, page, total, setPage, reload } = useAdminList<AdminNotice>(
    (params) => adminApi.getAllNotices(params),
    { pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE, errorMessage: '공지사항 목록을 불러오는데 실패했습니다.' },
  );

  const deleteConfirm = useDeleteConfirm<number>({
    deleteFn: (id) => adminApi.deleteNotice(id),
    onSuccess: reload,
    successMessage: '삭제되었습니다.',
    errorMessage: '공지사항 삭제에 실패했습니다.',
  });

  const handleEdit = (notice: AdminNotice) => {
    setSelectedNotice(notice);
    setModalOpen(true);
  };

  const handleDeleteClick = (notice: AdminNotice) => {
    setDeleteTarget(notice);
    deleteConfirm.openConfirm(notice.id, notice.title);
  };

  const columns: Column<AdminNotice>[] = [
    { key: 'id', header: 'ID', render: (n) => <span className="admin-mono">#{n.id}</span> },
    { key: 'title', header: '제목', render: (n) => <div className="admin-user-name">{n.title}</div> },
    { key: 'views', header: '조회수', align: 'right', render: (n) => (n.viewCount || 0).toLocaleString() },
    { key: 'status', header: '상태', render: (n) => <Badge color={n.isActive ? 'green' : 'elephant'} variant="weak" size="sm">{n.isActive ? '게시중' : '비공개'}</Badge> },
    {
      key: 'date', header: '작성일',
      render: (n) => (
        <div>
          <div>{new Date(n.createdAt).toLocaleDateString()}</div>
          <div className="admin-sub-text">{formatRelativeTime(n.createdAt)}</div>
        </div>
      )
    },
    {
      key: 'actions', header: '작업', align: 'right', render: (n) => (
        <div className="admin-actions">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(n)}>수정</Button>
          <Button variant="ghost" size="sm" style={{ color: COLORS.error }} onClick={() => handleDeleteClick(n)}>삭제</Button>
        </div>
      )
    }
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">공지사항 관리</h2>
          <p className="admin-page-desc">공지사항을 작성하고 관리합니다</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-btn-primary" onClick={() => { setSelectedNotice(null); setModalOpen(true); }}>
            <Plus size={16} aria-hidden="true" />
            새 공지사항
          </button>
        </div>
      </div>

      <div className="admin-table-card">
        <AdminTable columns={columns} data={notices} keyField="id" isLoading={loading} pagination={{ currentPage: page, totalItems: total, itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE, onPageChange: setPage }} emptyMessage="공지사항이 없습니다." emptyAction={{ label: '첫 공지사항 작성', onClick: () => { setSelectedNotice(null); setModalOpen(true); } }} caption="공지사항 목록" />
      </div>

      {modalOpen && (
        <NoticeFormModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          notice={selectedNotice}
          onSuccess={() => { setModalOpen(false); reload(); }}
        />
      )}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.closeConfirm}
        onConfirm={deleteConfirm.executeDelete}
        title="공지사항 삭제"
        confirmLabel="삭제"
        danger
      >
        <p>
          공지사항 <strong>"{deleteConfirm.targetLabel}"</strong>을(를) 삭제하시겠습니까?
          {deleteTarget && deleteTarget.viewCount > 0 && (
            <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-warning)', marginTop: '4px' }}>
              이 공지사항은 {deleteTarget.viewCount}회 조회되었습니다.
            </span>
          )}
          <span style={{ display: 'block', fontSize: '12px', color: COLORS.error, marginTop: '4px' }}>
            삭제된 공지사항은 복구할 수 없습니다.
          </span>
        </p>
      </ConfirmModal>
    </div>
  );

};

const NoticeFormModal: React.FC<{ isOpen: boolean; onClose: () => void; notice: AdminNotice | null; onSuccess: () => void }> = ({ isOpen, onClose, notice, onSuccess }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: notice?.title || '',
    content: notice?.content || '',
    isActive: notice?.isActive ?? true,
  });

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    const trimmedTitle = formData.title.trim();
    const trimmedContent = formData.content.trim();
    if (!trimmedTitle) {
      showToast({ message: '제목을 입력해주세요.', type: 'error' });
      return;
    }
    if (trimmedTitle.length > 100) {
      showToast({ message: '제목은 100자 이내로 입력해주세요.', type: 'error' });
      return;
    }
    if (!trimmedContent) {
      showToast({ message: '내용을 입력해주세요.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      if (notice) await adminApi.updateNotice(notice.id, { ...formData, title: trimmedTitle, content: trimmedContent });
      else await adminApi.createNotice({ ...formData, title: trimmedTitle, content: trimmedContent });
      showToast({ message: '저장되었습니다.', type: 'success' });
      onSuccess();
    } catch { showToast({ message: '공지사항 저장에 실패했습니다.', type: 'error' }); } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={notice ? '공지사항 수정' : '새 공지사항'} footer={
      <div className="flex gap-2 w-full">
        <Button variant="ghost" onClick={onClose} type="button" fullWidth>취소</Button>
        <Button variant="primary" type="button" loading={loading} onClick={handleSubmit} fullWidth>저장</Button>
      </div>
    }>
      <form onSubmit={handleSubmit} className="admin-form-body">
        <div>
          <label className="admin-form-label">제목</label>
          <TextField variant="box" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
        </div>
        <div>
          <label className="admin-form-label">내용</label>
          <textarea className="form-control" value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} rows={6} required />
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

export default NoticesTab;
