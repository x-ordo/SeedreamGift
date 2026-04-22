import { useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import type { Inquiry } from '../../../api/manual';
import { Button, Badge, Modal } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatRelativeTime, maskEmail } from '../../../utils';
import { COLORS, SPACING } from '../../../constants/designTokens';
import {
  ADMIN_PAGINATION,
  INQUIRY_STATUS_OPTIONS,
  INQUIRY_CATEGORY_OPTIONS,
  INQUIRY_STATUS_COLOR_MAP,
  INQUIRY_CATEGORY_LABEL_MAP,
} from '../constants';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList, useDeleteConfirm } from '../hooks';

const InquiriesTab = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [answer, setAnswer] = useState('');
  const [answerLoading, setAnswerLoading] = useState(false);
  const { showToast } = useToast();

  const { items: inquiries, loading, page, total, setPage, reload } = useAdminList<Inquiry>(
    (params) => adminApi.getAllInquiries(params as any),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters: {
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      },
      errorMessage: '문의 목록을 불러오는데 실패했습니다.',
    },
  );

  const deleteConfirm = useDeleteConfirm<number>({
    deleteFn: (id) => adminApi.deleteInquiry(id),
    onSuccess: reload,
    successMessage: '삭제되었습니다.',
    errorMessage: '문의 삭제에 실패했습니다.',
  });

  const handleOpenDetail = async (inquiry: Inquiry) => {
    try {
      const detail = await adminApi.getInquiry(inquiry.id);
      setSelectedInquiry(detail);
      setAnswer(detail.answer || '');
      setDetailOpen(true);
    } catch {
      showToast({ message: '문의 상세를 불러오는데 실패했습니다.', type: 'error' });
    }
  };

  const handleAnswer = async () => {
    if (!selectedInquiry || !answer.trim()) {
      showToast({ message: '답변 내용을 입력해주세요.', type: 'error' });
      return;
    }
    setAnswerLoading(true);
    try {
      await adminApi.answerInquiry(selectedInquiry.id, { answer: answer.trim() });
      showToast({ message: '답변이 등록되었습니다.', type: 'success' });
      reload();
    } catch {
      showToast({ message: '답변 등록에 실패했습니다.', type: 'error' });
    } finally {
      setAnswerLoading(false);
      setDetailOpen(false);
    }
  };

  const handleClose = async () => {
    if (!selectedInquiry) return;
    try {
      await adminApi.closeInquiry(selectedInquiry.id);
      showToast({ message: '문의가 종료 처리되었습니다.', type: 'success' });
      reload();
    } catch {
      showToast({ message: '종료 처리에 실패했습니다.', type: 'error' });
    } finally {
      setDetailOpen(false);
    }
  };

  const columns: Column<Inquiry>[] = [
    { key: 'id', header: 'ID', render: (n) => <span className="admin-mono">#{n.id}</span> },
    {
      key: 'category', header: '카테고리', render: (n) => (
        <Badge color="blue" variant="weak">{INQUIRY_CATEGORY_LABEL_MAP.get(n.category) || n.category}</Badge>
      )
    },
    { key: 'subject', header: '제목', render: (n) => <div className="admin-user-name">{n.subject}</div> },
    {
      key: 'user', header: '작성자',
      render: (n) => {
        const user = (n as Record<string, any>).user;
        return (
          <div>
            <div className="admin-user-name">{user?.name || '-'}</div>
            {user?.email && <div className="admin-sub-text">{maskEmail(user.email)}</div>}
          </div>
        );
      }
    },
    {
      key: 'status', header: '상태', render: (n) => (
        <Badge color={(INQUIRY_STATUS_COLOR_MAP.get(n.status) || 'elephant') as any} variant="weak">
          {INQUIRY_STATUS_OPTIONS.find(o => o.value === n.status)?.label || n.status}
        </Badge>
      )
    },
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
          <Button variant="ghost" size="sm" onClick={() => handleOpenDetail(n)}>상세</Button>
          <Button variant="ghost" size="sm" style={{ color: COLORS.error }} onClick={() => deleteConfirm.openConfirm(n.id, n.subject)}>삭제</Button>
        </div>
      )
    },
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">1:1 문의 관리</h2>
          <p className="admin-page-desc">고객 문의에 답변하고 관리합니다</p>
        </div>
      </div>

      <div className="admin-filter-card">
        <select
          className="admin-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="상태 필터"
        >
          <option value="">전체 상태</option>
          {INQUIRY_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          className="admin-filter-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="카테고리 필터"
        >
          <option value="">전체 카테고리</option>
          {INQUIRY_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={inquiries}
          keyField="id"
          isLoading={loading}
          pagination={{ currentPage: page, totalItems: total, itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE, onPageChange: setPage }}
          emptyMessage="문의가 없습니다."
          caption="1:1 문의 목록"
        />
      </div>

      {/* Detail / Answer Modal */}
      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="문의 상세" size="lg">
        {selectedInquiry && (
          <div style={{ padding: SPACING[4] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING[3] }}>
              <div>
                <Badge color="blue" variant="weak">{INQUIRY_CATEGORY_LABEL_MAP.get(selectedInquiry.category) || selectedInquiry.category}</Badge>
                <span style={{ marginLeft: SPACING[2], color: COLORS.grey500, fontSize: '13px' }}>
                  {new Date(selectedInquiry.createdAt).toLocaleString()}
                </span>
              </div>
              <Badge color={(INQUIRY_STATUS_COLOR_MAP.get(selectedInquiry.status) || 'elephant') as any} variant="weak">
                {INQUIRY_STATUS_OPTIONS.find(o => o.value === selectedInquiry.status)?.label || selectedInquiry.status}
              </Badge>
            </div>
            <div style={{ marginBottom: SPACING[3], fontSize: '13px', color: COLORS.grey600 }}>
              작성자: {(selectedInquiry as any).user?.name || '-'} ({(selectedInquiry as any).user?.email || '-'})
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: SPACING[3] }}>{selectedInquiry.subject}</h3>
            <div style={{ backgroundColor: COLORS.grey50, borderRadius: 'var(--radius-md)', padding: SPACING[4], marginBottom: SPACING[4], whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {selectedInquiry.content}
            </div>
            <div>
              <label className="admin-form-label" style={{ marginBottom: SPACING[2], display: 'block' }}>답변</label>
              <textarea
                className="form-control"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={6}
                placeholder="답변 내용을 입력하세요..."
                maxLength={5000}
                disabled={selectedInquiry.status === 'CLOSED'}
              />
              <div style={{ textAlign: 'right', fontSize: '12px', color: COLORS.grey500, marginTop: '4px' }}>
                {answer.length}/5000
              </div>
            </div>
            <div className="admin-form-footer" style={{ marginTop: SPACING[4] }}>
              <Button variant="ghost" onClick={() => setDetailOpen(false)} type="button">닫기</Button>
              {selectedInquiry.status !== 'CLOSED' && (
                <>
                  <Button variant="ghost" onClick={handleClose} type="button" style={{ color: COLORS.grey600 }}>종료 처리</Button>
                  <Button variant="primary" onClick={handleAnswer} type="button" loading={answerLoading} disabled={!answer.trim()}>답변 저장</Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.closeConfirm}
        onConfirm={deleteConfirm.executeDelete}
        title="문의 삭제"
        confirmLabel="삭제"
        danger
      >
        <p>
          문의 <strong>"{deleteConfirm.targetLabel}"</strong>을(를) 삭제하시겠습니까?
          <br />
          <span style={{ fontSize: '13px', color: COLORS.grey500 }}>이 작업은 되돌릴 수 없습니다.</span>
        </p>
      </ConfirmModal>
    </div>
  );
};

export default InquiriesTab;
