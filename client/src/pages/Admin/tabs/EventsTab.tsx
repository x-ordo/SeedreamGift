import React, { useState } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Badge, Modal, TextField } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatRelativeTime } from '../../../utils';
import { COLORS, SPACING, RADIUS } from '../../../constants/designTokens';
import { ADMIN_PAGINATION, ACTIVE_STATUS_LABELS, EVENT_PERIOD_STATUS } from '../constants';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList, useDeleteConfirm } from '../hooks';

interface AdminEvent {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isFeatured: boolean;
  viewCount: number;
  createdAt: string;
}

const EventsTab = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AdminEvent | null>(null);

  const { items: events, loading, page, total, setPage, reload } = useAdminList<AdminEvent>(
    (params) => adminApi.getAllEvents(params),
    { pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE, errorMessage: '이벤트 목록을 불러오는데 실패했습니다.' },
  );

  const deleteConfirm = useDeleteConfirm<number>({
    deleteFn: (id) => adminApi.deleteEvent(id),
    onSuccess: reload,
    successMessage: '삭제되었습니다.',
    errorMessage: '이벤트 삭제에 실패했습니다.',
  });

  const handleView = (e: AdminEvent) => { setSelectedEvent(e); setDetailModalOpen(true); };
  const handleEdit = (e: AdminEvent) => { setSelectedEvent(e); setModalOpen(true); };

  const columns: Column<AdminEvent>[] = [
    { key: 'id', header: 'ID', render: (e) => <span className="admin-mono">#{e.id}</span> },
    {
      key: 'title', header: '이벤트명', render: (e) => (
        <button type="button" style={{ fontWeight: 600, cursor: 'pointer', color: COLORS.primary, background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left' }} onClick={() => handleView(e)}>{e.title}</button>
      )
    },
    {
      key: 'period', header: '기간',
      render: (e) => (
        <div>
          <div>{new Date(e.startDate).toLocaleDateString()} ~ {new Date(e.endDate).toLocaleDateString()}</div>
          <div className="admin-sub-text">{formatRelativeTime(e.startDate)}</div>
        </div>
      )
    },
    { key: 'status', header: '상태', render: (e) => <Badge color={e.isActive ? 'green' : 'elephant'} variant="weak" size="sm">{e.isActive ? ACTIVE_STATUS_LABELS.event.active : ACTIVE_STATUS_LABELS.event.inactive}</Badge> },
    {
      key: 'actions', header: '작업', align: 'right', render: (e) => (
        <div className="admin-actions">
          <Button variant="ghost" size="sm" onClick={() => handleView(e)}>보기</Button>
          <Button variant="ghost" size="sm" onClick={() => handleEdit(e)}>수정</Button>
          <Button variant="ghost" size="sm" style={{ color: COLORS.error }} onClick={() => deleteConfirm.openConfirm(e.id, e.title)}>삭제</Button>
        </div>
      )
    }
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">이벤트 관리</h2>
          <p className="admin-page-desc">이벤트와 프로모션을 관리합니다</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-btn-primary" onClick={() => { setSelectedEvent(null); setModalOpen(true); }}>
            <Plus size={16} aria-hidden="true" />
            새 이벤트
          </button>
        </div>
      </div>

      <div className="admin-table-card">
        <AdminTable columns={columns} data={events} keyField="id" isLoading={loading} pagination={{ currentPage: page, totalItems: total, itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE, onPageChange: setPage }} emptyMessage="이벤트가 없습니다." emptyAction={{ label: '첫 이벤트 작성', onClick: () => { setSelectedEvent(null); setModalOpen(true); } }} caption="이벤트 목록" />
      </div>

      {modalOpen && <EventFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} event={selectedEvent} onSuccess={() => { setModalOpen(false); reload(); }} />}
      {detailModalOpen && <EventDetailModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} event={selectedEvent} onEdit={() => { setDetailModalOpen(false); setModalOpen(true); }} />}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.closeConfirm}
        onConfirm={deleteConfirm.executeDelete}
        title="이벤트 삭제"
        confirmLabel="삭제"
        danger
      >
        <p>
          이벤트 <strong>"{deleteConfirm.targetLabel}"</strong>을(를) 삭제하시겠습니까?
          <br />
          <span style={{ fontSize: '13px', color: COLORS.grey500 }}>이 작업은 되돌릴 수 없습니다.</span>
        </p>
      </ConfirmModal>
    </div>
  );
};

const EventFormModal: React.FC<{ isOpen: boolean; onClose: () => void; event: AdminEvent | null; onSuccess: () => void }> = ({ isOpen, onClose, event, onSuccess }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    startDate: event?.startDate ? event.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
    endDate: event?.endDate ? event.endDate.split('T')[0] : new Date().toISOString().split('T')[0],
    imageUrl: event?.imageUrl || '',
    isActive: event?.isActive ?? true,
    isFeatured: event?.isFeatured ?? false,
  });

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (formData.endDate && formData.startDate && new Date(formData.endDate) <= new Date(formData.startDate)) {
      showToast({ message: '종료일은 시작일보다 이후여야 합니다.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      if (event) await adminApi.updateEvent(event.id, formData);
      else await adminApi.createEvent(formData);
      showToast({ message: '저장되었습니다.', type: 'success' });
      onSuccess();
    } catch { showToast({ message: '이벤트 저장에 실패했습니다.', type: 'error' }); } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={event ? '이벤트 수정' : '새 이벤트'} footer={
      <div className="flex gap-2 w-full">
        <Button variant="ghost" onClick={onClose} type="button" fullWidth>취소</Button>
        <Button variant="primary" type="button" loading={loading} onClick={handleSubmit} fullWidth>저장</Button>
      </div>
    }>
      <form onSubmit={handleSubmit} className="admin-form-body">
        {event && new Date(event.endDate) < new Date() && (
          <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--color-yellow-50)', border: '1px solid var(--color-yellow-200)', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-warning)', fontWeight: 600 }}>이 이벤트는 이미 종료되었습니다.</span>
          </div>
        )}
        <div>
          <label className="admin-form-label">이벤트명</label>
          <TextField variant="box" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
        </div>
        <div>
          <label className="admin-form-label">설명</label>
          <TextField variant="box" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
        </div>
        <div className="admin-form-row">
          <div style={{ flex: 1 }}>
            <label className="admin-form-label">시작일</label>
            <TextField variant="box" type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
          </div>
          <div style={{ flex: 1 }}>
            <label className="admin-form-label">종료일</label>
            <TextField variant="box" type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} required />
          </div>
        </div>
        <div>
          <label className="admin-form-label">이미지 URL</label>
          <TextField variant="box" value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="https://example.com/image.jpg" />
        </div>
        <div className="admin-form-row" style={{ marginTop: SPACING[3] }}>
          <label className="admin-checkbox-label">
            <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
            활성화 (사용자에게 노출)
          </label>
          <label className="admin-checkbox-label" style={{ marginLeft: SPACING[4] }}>
            <input type="checkbox" checked={formData.isFeatured} onChange={e => setFormData({ ...formData, isFeatured: e.target.checked })} />
            메인 노출 (Featured)
          </label>
        </div>
      </form>
    </Modal>
  );
};

const EventDetailModal: React.FC<{ isOpen: boolean; onClose: () => void; event: AdminEvent | null; onEdit: () => void }> = ({ isOpen, onClose, event, onEdit }) => {
  if (!event) return null;

  const getEventStatus = () => {
    const now = new Date();
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    if (now < start) return EVENT_PERIOD_STATUS.UPCOMING;
    if (now > end) return EVENT_PERIOD_STATUS.ENDED;
    return EVENT_PERIOD_STATUS.ONGOING;
  };

  const status = getEventStatus();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="이벤트 상세" footer={
      <div className="flex gap-2 w-full">
        <Button variant="ghost" onClick={onClose} fullWidth>닫기</Button>
        <Button variant="primary" onClick={onEdit} fullWidth>수정하기</Button>
      </div>
    }>
      <div style={{ padding: SPACING[4] }}>
        {event.imageUrl && (
          <div style={{ marginBottom: SPACING[4], borderRadius: RADIUS.md, overflow: 'hidden' }}>
            <img src={event.imageUrl} alt={event.title} style={{ width: '100%', height: 'auto', display: 'block' }} width={200} height={100} loading="lazy" decoding="async" />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING[2], marginBottom: SPACING[3] }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{event.title}</h3>
          <Badge color={status.color} variant="weak" size="sm">{status.label}</Badge>
          {event.isFeatured && <Badge color="yellow" variant="weak" size="sm">메인노출</Badge>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING[2], marginBottom: SPACING[3], color: COLORS.grey500 }}>
          <Calendar size={16} aria-hidden="true" />
          <span>{new Date(event.startDate).toLocaleDateString('ko-KR')} ~ {new Date(event.endDate).toLocaleDateString('ko-KR')}</span>
        </div>
        <div style={{ padding: SPACING[4], background: COLORS.grey50, borderRadius: RADIUS.md, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: SPACING[4] }}>
          {event.description || '설명이 없습니다.'}
        </div>
        <div style={{ display: 'flex', gap: SPACING[4], fontSize: '13px', color: COLORS.grey400 }}>
          <span>조회수: {event.viewCount || 0}</span>
          <span>생성: {new Date(event.createdAt).toLocaleDateString('ko-KR')}</span>
        </div>
      </div>
    </Modal>
  );
};

export default EventsTab;
