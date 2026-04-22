import { useState } from 'react';

import { adminApi } from '../../../api';
import { Button } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatRelativeTime, maskEmail } from '../../../utils';
import { COLORS } from '../../../constants/designTokens';
import { ADMIN_PAGINATION } from '../constants';
import AdminDetailModal from '../components/AdminDetailModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList, useDeleteConfirm } from '../hooks';

interface AdminSession {
  id: number;
  user?: { id: number; name: string; email: string };
  ipAddress?: string;
  userAgent?: string;
  expiresAt: string;
  createdAt?: string;
}

const SessionsTab = () => {
  const [detailSession, setDetailSession] = useState<AdminSession | null>(null);

  const { items: sessions, loading, page, total, setPage, reload } = useAdminList<AdminSession>(
    (params) => adminApi.getAllSessions(params),
    { pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE },
  );

  const deleteConfirm = useDeleteConfirm<number>({
    deleteFn: (id) => adminApi.deleteSession(id),
    onSuccess: reload,
    successMessage: '세션이 종료되었습니다.',
    errorMessage: '세션 종료에 실패했습니다.',
  });

  const columns: Column<AdminSession>[] = [
    {
      key: 'id', header: 'ID',
      render: (s) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDetailSession(s)}
        >
          #{s.id}
        </Button>
      )
    },
    {
      key: 'user', header: '사용자',
      render: (s) => (
        <div>
          <div className="admin-user-name">{s.user?.name || 'N/A'}</div>
          {s.user?.email && <div className="admin-sub-text">{maskEmail(s.user.email)}</div>}
        </div>
      )
    },
    { key: 'ip', header: 'IP', render: (s) => <span className="admin-mono">{s.ipAddress || '-'}</span> },
    { key: 'userAgent', header: 'User Agent', render: (s) => <span style={{ fontSize: '11px', maxWidth: '200px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.userAgent || '-'}</span> },
    {
      key: 'expires', header: '만료일',
      render: (s) => (
        <div>
          <div>{new Date(s.expiresAt).toLocaleDateString()}</div>
          <div className="admin-sub-text">{formatRelativeTime(s.expiresAt)}</div>
        </div>
      )
    },
    { key: 'actions', header: '작업', align: 'right', render: (s) => <Button variant="ghost" size="sm" style={{ color: COLORS.error }} onClick={() => deleteConfirm.openConfirm(s.id, `세션 #${s.id}`)}>종료</Button> }
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">세션 관리</h2>
          <p className="admin-page-desc">로그인 세션과 보안 기록을 관리합니다</p>
        </div>
      </div>

      <div className="admin-table-card">
        <AdminTable columns={columns} data={sessions} keyField="id" isLoading={loading} pagination={{ currentPage: page, totalItems: total, itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE, onPageChange: setPage }} emptyMessage="활성 세션이 없습니다." caption="세션 목록" />
      </div>
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.closeConfirm}
        onConfirm={deleteConfirm.executeDelete}
        title="세션 종료"
        confirmLabel="종료"
        danger
      >
        <p>세션을 종료하시겠습니까?</p>
      </ConfirmModal>

      {/* 세션 상세 모달 */}
      <AdminDetailModal
        isOpen={detailSession !== null}
        onClose={() => setDetailSession(null)}
        title={detailSession ? `세션 상세 #${detailSession.id}` : '세션 상세'}
        loading={false}
      >
        {detailSession && (
          <>
            <AdminDetailModal.Section title="사용자 정보">
              <AdminDetailModal.InfoGrid>
                <AdminDetailModal.InfoRow label="이름" value={detailSession.user?.name || 'N/A'} />
                <AdminDetailModal.InfoRow label="이메일" value={detailSession.user?.email || 'N/A'} />
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            <AdminDetailModal.Section title="세션 정보">
              <AdminDetailModal.InfoGrid>
                <AdminDetailModal.InfoRow label="IP 주소" value={detailSession.ipAddress || '-'} mono />
                <AdminDetailModal.InfoRow label="User Agent" value={detailSession.userAgent || '-'} fullWidth />
                {detailSession.createdAt && (
                  <AdminDetailModal.InfoRow label="생성일" value={new Date(detailSession.createdAt).toLocaleString('ko-KR')} />
                )}
                <AdminDetailModal.InfoRow label="만료일" value={new Date(detailSession.expiresAt).toLocaleString('ko-KR')} />
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            <AdminDetailModal.ActionBar>
              <Button
                variant="secondary"
                size="sm"
                style={{ color: COLORS.error, borderColor: COLORS.error }}
                onClick={() => {
                  deleteConfirm.openConfirm(detailSession.id, `세션 #${detailSession.id}`);
                  setDetailSession(null);
                }}
              >
                세션 종료
              </Button>
              <Button variant="ghost" onClick={() => setDetailSession(null)}>닫기</Button>
            </AdminDetailModal.ActionBar>
          </>
        )}
      </AdminDetailModal>
    </div>
  );
};

export default SessionsTab;
