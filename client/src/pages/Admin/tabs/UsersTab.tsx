import { useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Badge, Modal, TextField } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { maskEmail } from '../../../utils';
import { formatDateTime } from '../../../utils/dateUtils';
import { COLORS, SPACING } from '../../../constants/designTokens';
import { ROLES, ADMIN_PAGINATION, KYC_STATUS_OPTIONS } from '../constants';
import AdminDetailModal from '../components/AdminDetailModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList, useDebouncedSearch } from '../hooks';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  kycStatus: string;
  customLimitPerTx?: number;
  customLimitPerDay?: number;
  createdAt: string;
}

interface ConfirmState {
  open: boolean;
  userId: number;
  userName: string;
  newRole: string;
}

interface PasswordResetState {
  open: boolean;
  userId: number;
  userName: string;
  password: string;
  confirmPassword: string;
  error: string;
}

interface DeleteState {
  open: boolean;
  userId: number;
  userName: string;
}

interface CreateState {
  open: boolean;
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  phone: string;
  role: string;
  error: string;
}

interface LockState {
  open: boolean;
  userId: number;
  userName: string;
  until: string; // datetime-local format
  isLocked: boolean; // true = lock action, false = unlock action
}

interface UserEditState {
  open: boolean;
  loading: boolean;
  userId: number;
  // Editable fields
  name: string;
  phone: string;
  customLimitPerTx: string;
  customLimitPerDay: string;
  // Read-only fields
  email: string;
  role: string;
  kycStatus: string;
  kycVerifiedBy: string;
  verifyAttemptCount: number;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  bankVerifiedAt: string | null;
  _count: {
    orders: number;
    tradeIns: number;
    sentGifts: number;
    receivedGifts: number;
  };
  createdAt: string | null;
  updatedAt: string | null;
}

const PASSWORD_RESET_INITIAL: PasswordResetState = {
  open: false, userId: 0, userName: '', password: '', confirmPassword: '', error: '',
};

const USER_EDIT_INITIAL: UserEditState = {
  open: false, loading: false, userId: 0,
  name: '', phone: '', customLimitPerTx: '', customLimitPerDay: '',
  email: '', role: '', kycStatus: '', kycVerifiedBy: '', verifyAttemptCount: 0,
  bankName: '', accountHolder: '', accountNumber: '', bankVerifiedAt: null,
  _count: { orders: 0, tradeIns: 0, sentGifts: 0, receivedGifts: 0 },
  createdAt: null, updatedAt: null,
};

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

/** 계좌번호 마스킹: 앞 4자리와 뒤 2자리만 노출 */
function maskAccountNumber(acc: string): string {
  if (!acc || acc.length <= 6) return acc || '—';
  return acc.slice(0, 4) + '*'.repeat(acc.length - 6) + acc.slice(-2);
}

/** KYC 인증 방법 한글 매핑 — 백엔드 kycVerifiedBy 값 기준 */
function getKycMethodLabel(method: string): string {
  const map: Record<string, string> = {
    BANK_API: '1원 계좌 인증',
    EXTERNAL_KYC: 'PASS 본인인증 + 1원 인증',
    ADMIN_OVERRIDE: '관리자 수동 변경',
  };
  return map[method] || method || '—';
}

const UsersTab = () => {
  const [confirmModal, setConfirmModal] = useState<ConfirmState>({ open: false, userId: 0, userName: '', newRole: '' });
  const [passwordModal, setPasswordModal] = useState<PasswordResetState>(PASSWORD_RESET_INITIAL);
  const [editModal, setEditModal] = useState<UserEditState>(USER_EDIT_INITIAL);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<DeleteState>({ open: false, userId: 0, userName: '' });
  const [createModal, setCreateModal] = useState<CreateState>({ open: false, email: '', password: '', confirmPassword: '', name: '', phone: '', role: 'USER', error: '' });
  const [lockModal, setLockModal] = useState<LockState>({ open: false, userId: 0, userName: '', until: '', isLocked: false });
  const [kycConfirm, setKycConfirm] = useState<{
    open: boolean; userId: number; userName: string; newStatus: string;
  }>({ open: false, userId: 0, userName: '', newStatus: '' });
  const [kycFilter, setKycFilter] = useState('');
  const { showToast } = useToast();

  const { searchQuery, debouncedQuery, setSearchQuery } = useDebouncedSearch(300);

  const { items: users, loading, page, total, setPage, reload } = useAdminList<User>(
    (params) => adminApi.getAllUsers(params),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      filters: {
        search: debouncedQuery || undefined,
        kycStatus: kycFilter || undefined,
      },
      errorMessage: '회원 목록을 불러오는데 실패했습니다.',
    },
  );

  const openKycConfirm = (u: User, newStatus: string) => {
    setKycConfirm({ open: true, userId: u.id, userName: u.name || u.email, newStatus });
  };

  const handleKyc = async () => {
    const { userId, newStatus } = kycConfirm;
    try {
      await adminApi.processKyc(userId, newStatus);
      showToast({ message: `KYC가 ${newStatus === 'VERIFIED' ? '승인' : '거절'}되었습니다.`, type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'KYC 처리에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setKycConfirm({ open: false, userId: 0, userName: '', newStatus: '' });
    }
  };

  const handleRoleChange = async () => {
    const { userId, newRole } = confirmModal;
    try {
      await adminApi.updateUserRole(userId, newRole);
      showToast({ message: '권한이 변경되었습니다.', type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || '권한 변경에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setConfirmModal({ open: false, userId: 0, userName: '', newRole: '' });
    }
  };

  const openRoleConfirm = (user: User, newRole: string) => {
    setConfirmModal({
      open: true,
      userId: user.id,
      userName: user.name || user.email,
      newRole,
    });
  };

  // --- Password Reset ---
  const openPasswordReset = (user: User) => {
    setPasswordModal({ ...PASSWORD_RESET_INITIAL, open: true, userId: user.id, userName: user.name || user.email });
  };

  const validatePassword = (pw: string): string => {
    if (pw.length < PASSWORD_MIN_LENGTH) return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
    if (!PASSWORD_REGEX.test(pw)) return '영문, 숫자, 특수문자를 모두 포함해야 합니다.';
    return '';
  };

  const handlePasswordReset = async () => {
    const { userId, password, confirmPassword } = passwordModal;
    const validationError = validatePassword(password);
    if (validationError) {
      setPasswordModal(prev => ({ ...prev, error: validationError }));
      return;
    }
    if (password !== confirmPassword) {
      setPasswordModal(prev => ({ ...prev, error: '비밀번호가 일치하지 않습니다.' }));
      return;
    }
    try {
      await adminApi.resetUserPassword(userId, password);
      showToast({ message: '비밀번호가 초기화되었습니다.', type: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || '비밀번호 초기화에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setPasswordModal(PASSWORD_RESET_INITIAL);
    }
  };

  // --- Create User ---
  const handleCreateUser = async () => {
    const { email, password, confirmPassword, name, phone, role } = createModal;
    if (!email.trim() || !name.trim()) {
      setCreateModal(prev => ({ ...prev, error: '이메일과 이름은 필수입니다.' }));
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) { setCreateModal(prev => ({ ...prev, error: pwError })); return; }
    if (password !== confirmPassword) { setCreateModal(prev => ({ ...prev, error: '비밀번호가 일치하지 않습니다.' })); return; }
    try {
      await adminApi.createUser({ email, password, name, phone, role });
      showToast({ message: '회원이 생성되었습니다.', type: 'success' });
      reload();
      setCreateModal({ open: false, email: '', password: '', confirmPassword: '', name: '', phone: '', role: 'USER', error: '' });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || '회원 생성에 실패했습니다.';
      setCreateModal(prev => ({ ...prev, error: msg }));
    }
  };

  // --- Lock / Unlock ---
  const handleLockToggle = async () => {
    const { userId, isLocked, until } = lockModal;
    try {
      if (isLocked) {
        await adminApi.lockUser(userId, until);
        showToast({ message: '계정이 잠금되었습니다.', type: 'success' });
      } else {
        await adminApi.unlockUser(userId);
        showToast({ message: '계정 잠금이 해제되었습니다.', type: 'success' });
      }
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || '처리에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setLockModal({ open: false, userId: 0, userName: '', until: '', isLocked: false });
    }
  };

  // --- User Edit ---
  const openUserEdit = async (user: User) => {
    setEditModal(prev => ({ ...prev, open: true, loading: true, userId: user.id }));
    try {
      const detail = await adminApi.getUser(user.id);
      const counts = detail._count ?? {};
      setEditModal({
        open: true,
        loading: false,
        userId: user.id,
        // Editable
        name: detail.name || '',
        phone: detail.phone || '',
        customLimitPerTx: detail.customLimitPerTx != null ? String(detail.customLimitPerTx) : '',
        customLimitPerDay: detail.customLimitPerDay != null ? String(detail.customLimitPerDay) : '',
        // Read-only
        email: detail.email || '',
        role: detail.role || '',
        kycStatus: detail.kycStatus || '',
        kycVerifiedBy: detail.kycVerifiedBy || '',
        verifyAttemptCount: detail.verifyAttemptCount ?? 0,
        bankName: detail.bankName || '',
        accountHolder: detail.accountHolder || '',
        accountNumber: detail.accountNumber || '',
        bankVerifiedAt: detail.bankVerifiedAt || null,
        _count: {
          orders: counts.orders ?? 0,
          tradeIns: counts.tradeIns ?? 0,
          sentGifts: counts.sentGifts ?? 0,
          receivedGifts: counts.receivedGifts ?? 0,
        },
        createdAt: detail.createdAt || null,
        updatedAt: detail.updatedAt || null,
      });
    } catch {
      showToast({ message: '회원 정보를 불러오는데 실패했습니다.', type: 'error' });
      setEditModal(USER_EDIT_INITIAL);
    }
  };

  const handleUserEditSave = async () => {
    if (!editModal.name.trim()) {
      showToast({ message: '이름을 입력해주세요.', type: 'warning' });
      return;
    }
    setEditSaving(true);
    const { userId, name, phone, customLimitPerTx, customLimitPerDay } = editModal;
    const data: Record<string, any> = { name, phone };
    if (customLimitPerTx !== '') data.customLimitPerTx = Number(customLimitPerTx);
    if (customLimitPerDay !== '') data.customLimitPerDay = Number(customLimitPerDay);
    try {
      await adminApi.updateUser(userId, data);
      showToast({ message: '회원 정보가 수정되었습니다.', type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || '회원 정보 수정에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setEditSaving(false);
      setEditModal(USER_EDIT_INITIAL);
    }
  };

  const handleDelete = async () => {
    const { userId } = deleteModal;
    if (!userId) return;
    try {
      await adminApi.deleteUser(userId);
      showToast({ message: '계정이 삭제(익명화)되었습니다.', type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || '삭제에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setDeleteModal({ open: false, userId: 0, userName: '' });
    }
  };

  const columns: Column<User>[] = [
    {
      key: 'user', header: '회원',
      render: (u) => (
        <div>
          <button
            type="button"
            className="admin-user-name"
            onClick={() => openUserEdit(u)}
            style={{ fontWeight: 600, cursor: 'pointer', color: COLORS.primary, background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left' }}
          >
            {u.name || 'N/A'}
          </button>
          <div className="admin-sub-text" title={u.email}>{maskEmail(u.email)}</div>
        </div>
      )
    },
    { key: 'phone', header: '연락처' },
    {
      key: 'role', header: '역할',
      render: (u) => (
        <select
          className="admin-status-select"
          value={u.role}
          onChange={(e) => {
            const newRole = e.target.value;
            if (newRole !== u.role) {
              openRoleConfirm(u, newRole);
              e.target.value = u.role;
            }
          }}
          aria-label={`${u.name || u.email} 역할 변경`}
          style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
        >
          {Object.values(ROLES).map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      )
    },
    {
      key: 'kycStatus', header: 'KYC',
      render: (u) => {
        const opt = KYC_STATUS_OPTIONS.find(o => o.value === u.kycStatus);
        return (
          <Badge
            color={(opt?.color ?? 'elephant') as any}
            size="xs"
            variant="fill"
          >
            {opt?.label ?? u.kycStatus}
          </Badge>
        );
      }
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (u) => (
        <div className="admin-actions">
          {u.kycStatus === 'PENDING' && (
            <>
              <Button variant="success" size="sm" onClick={() => openKycConfirm(u, 'VERIFIED')}>승인</Button>
              <Button variant="secondary" size="sm" onClick={() => openKycConfirm(u, 'REJECTED')}>거절</Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => openPasswordReset(u)}>비밀번호 초기화</Button>
          <Button variant="ghost" size="sm" onClick={() => {
            const defaultUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
            setLockModal({ open: true, userId: u.id, userName: u.name || u.email, until: defaultUntil, isLocked: true });
          }}>잠금</Button>
          {u.role !== 'ADMIN' && (
            <Button variant="ghost" size="sm" style={{ color: COLORS.error }} onClick={() => setDeleteModal({ open: true, userId: u.id, userName: u.name || u.email })}>삭제</Button>
          )}
        </div>
      )
    }
  ];

  // KYC status color for AdminDetailModal.StatusRow
  const kycOpt = KYC_STATUS_OPTIONS.find(o => o.value === editModal.kycStatus);

  return (
    <div className="admin-tab">
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">회원 관리</h2>
          <p className="admin-page-desc">회원 정보, KYC 인증, 역할을 관리합니다</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreateModal({ open: true, email: '', password: '', confirmPassword: '', name: '', phone: '', role: 'USER', error: '' })}>
          새 회원 추가
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="admin-filter-card">
        <select
          className="admin-filter-select"
          value={kycFilter}
          onChange={(e) => setKycFilter(e.target.value)}
          aria-label="KYC 상태 필터"
        >
          <option value="">전체 KYC</option>
          {KYC_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="search"
          className="admin-search-input admin-filter-search"
          placeholder="이름, 이메일, 연락처 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="회원 검색"
        />
      </div>

      {/* Table Card */}
      <div className="admin-table-card">
        <AdminTable
          columns={columns}
          data={users}
          keyField="id"
          isLoading={loading}
          pagination={{
            currentPage: page,
            totalItems: total,
            itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
            onPageChange: setPage
          }}
          emptyMessage="조건에 맞는 회원이 없습니다."
          caption="회원 목록"
        />
      </div>

      {/* 권한 변경 확인 모달 */}
      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ ...confirmModal, open: false })}
        onConfirm={handleRoleChange}
        title="권한 변경 확인"
        confirmLabel="변경"
      >
        <p>
          <strong>{confirmModal.userName}</strong>님의 권한을{' '}
          <Badge color="blue" variant="fill" size="sm">{confirmModal.newRole}</Badge>
          (으)로 변경하시겠습니까?
        </p>
      </ConfirmModal>

      {/* KYC 승인/거절 확인 모달 */}
      <ConfirmModal
        isOpen={kycConfirm.open}
        onClose={() => setKycConfirm({ ...kycConfirm, open: false })}
        onConfirm={handleKyc}
        title="KYC 처리 확인"
        confirmLabel={kycConfirm.newStatus === 'VERIFIED' ? '승인' : '거절'}
        danger={kycConfirm.newStatus === 'REJECTED'}
      >
        <p>
          <strong>{kycConfirm.userName}</strong>님의 KYC를{' '}
          {kycConfirm.newStatus === 'VERIFIED' ? (
            <Badge color="green" variant="fill" size="sm">승인</Badge>
          ) : (
            <Badge color="red" variant="fill" size="sm">거절</Badge>
          )}
          하시겠습니까?
        </p>
      </ConfirmModal>

      {/* 비밀번호 초기화 모달 */}
      <Modal
        isOpen={passwordModal.open}
        onClose={() => setPasswordModal(PASSWORD_RESET_INITIAL)}
        title="비밀번호 초기화"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="ghost" onClick={() => setPasswordModal(PASSWORD_RESET_INITIAL)} fullWidth>취소</Button>
            <Button variant="primary" onClick={handlePasswordReset} fullWidth>초기화</Button>
          </div>
        }
      >
        <div style={{ padding: SPACING[4] }}>
          <p style={{ marginBottom: SPACING[4], color: COLORS.grey700 }}>
            <strong>{passwordModal.userName}</strong>님의 비밀번호를 초기화합니다.
          </p>
          <div style={{ marginBottom: SPACING[3] }}>
            <label className="admin-form-label">새 비밀번호</label>
            <TextField
              variant="box"
              type="password"
              value={passwordModal.password}
              onChange={(e) => setPasswordModal(prev => ({ ...prev, password: e.target.value, error: '' }))}
              placeholder="8자 이상, 영문/숫자/특수문자 포함"
              autoComplete="new-password"
            />
          </div>
          <div style={{ marginBottom: SPACING[3] }}>
            <label className="admin-form-label">비밀번호 확인</label>
            <TextField
              variant="box"
              type="password"
              value={passwordModal.confirmPassword}
              onChange={(e) => setPasswordModal(prev => ({ ...prev, confirmPassword: e.target.value, error: '' }))}
              placeholder="비밀번호 재입력"
              autoComplete="new-password"
            />
          </div>
          {passwordModal.error && (
            <p role="alert" style={{ color: COLORS.error, fontSize: '13px' }}>
              {passwordModal.error}
            </p>
          )}
        </div>
      </Modal>

      {/* 계정 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, userId: 0, userName: '' })}
        onConfirm={handleDelete}
        title="계정 삭제"
        confirmLabel="삭제"
        danger
      >
        <p>
          <strong>{deleteModal.userName}</strong>님의 계정을 삭제하시겠습니까?
          <br />
          <span style={{ fontSize: '13px', color: 'var(--color-error)' }}>이 계정과 관련된 모든 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</span>
        </p>
      </ConfirmModal>

      {/* 새 회원 생성 모달 */}
      <Modal
        isOpen={createModal.open}
        onClose={() => setCreateModal({ open: false, email: '', password: '', confirmPassword: '', name: '', phone: '', role: 'USER', error: '' })}
        title="새 회원 추가"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="ghost" onClick={() => setCreateModal({ open: false, email: '', password: '', confirmPassword: '', name: '', phone: '', role: 'USER', error: '' })} fullWidth>취소</Button>
            <Button variant="primary" onClick={handleCreateUser} fullWidth>생성</Button>
          </div>
        }
      >
        <div style={{ padding: SPACING[4], display: 'flex', flexDirection: 'column', gap: SPACING[3] }}>
          <div>
            <label className="admin-form-label">이메일 *</label>
            <TextField variant="box" type="email" value={createModal.email} onChange={(e) => setCreateModal(prev => ({ ...prev, email: e.target.value, error: '' }))} placeholder="user@example.com" />
          </div>
          <div>
            <label className="admin-form-label">이름 *</label>
            <TextField variant="box" value={createModal.name} onChange={(e) => setCreateModal(prev => ({ ...prev, name: e.target.value, error: '' }))} placeholder="홍길동" />
          </div>
          <div>
            <label className="admin-form-label">연락처</label>
            <TextField variant="box" value={createModal.phone} onChange={(e) => setCreateModal(prev => ({ ...prev, phone: e.target.value }))} placeholder="01012345678" />
          </div>
          <div>
            <label className="admin-form-label">역할</label>
            <select className="admin-filter-select" style={{ width: '100%' }} value={createModal.role} onChange={(e) => setCreateModal(prev => ({ ...prev, role: e.target.value }))}>
              {Object.values(ROLES).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="admin-form-label">비밀번호 *</label>
            <TextField variant="box" type="password" value={createModal.password} onChange={(e) => setCreateModal(prev => ({ ...prev, password: e.target.value, error: '' }))} placeholder="8자 이상, 영문/숫자/특수문자" autoComplete="new-password" />
          </div>
          <div>
            <label className="admin-form-label">비밀번호 확인 *</label>
            <TextField variant="box" type="password" value={createModal.confirmPassword} onChange={(e) => setCreateModal(prev => ({ ...prev, confirmPassword: e.target.value, error: '' }))} placeholder="비밀번호 재입력" autoComplete="new-password" />
          </div>
          {createModal.error && <p role="alert" style={{ color: COLORS.error, fontSize: '13px' }}>{createModal.error}</p>}
        </div>
      </Modal>

      {/* 계정 잠금 모달 */}
      <Modal
        isOpen={lockModal.open}
        onClose={() => setLockModal({ open: false, userId: 0, userName: '', until: '', isLocked: false })}
        title={lockModal.isLocked ? '계정 잠금' : '잠금 해제'}
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="ghost" onClick={() => setLockModal({ open: false, userId: 0, userName: '', until: '', isLocked: false })} fullWidth>취소</Button>
            <Button variant={lockModal.isLocked ? 'danger' : 'primary'} onClick={handleLockToggle} fullWidth>{lockModal.isLocked ? '잠금' : '해제'}</Button>
          </div>
        }
      >
        <div style={{ padding: SPACING[4] }}>
          <p style={{ marginBottom: SPACING[4], color: COLORS.grey700 }}>
            <strong>{lockModal.userName}</strong>님의 계정을 {lockModal.isLocked ? '잠금' : '잠금 해제'}합니다.
          </p>
          {lockModal.isLocked && (
            <div>
              <label className="admin-form-label">잠금 해제 시간</label>
              <input
                type="datetime-local"
                value={lockModal.until}
                onChange={(e) => setLockModal(prev => ({ ...prev, until: e.target.value }))}
                className="admin-filter-select"
                style={{ width: '100%', padding: '10px 12px' }}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* 회원 상세/편집 모달 */}
      <AdminDetailModal
        isOpen={editModal.open}
        onClose={() => setEditModal(USER_EDIT_INITIAL)}
        title="회원 상세"
        loading={editModal.loading}
      >
        {/* 기본 정보 (read-only) */}
        <AdminDetailModal.Section title="기본 정보">
          <AdminDetailModal.InfoGrid columns={2}>
            <AdminDetailModal.InfoRow label="이메일" value={editModal.email} />
            <AdminDetailModal.InfoRow label="역할" value={editModal.role} />
            <AdminDetailModal.InfoRow label="가입일" value={editModal.createdAt ? formatDateTime(editModal.createdAt) : undefined} />
            <AdminDetailModal.InfoRow label="최종 수정일" value={editModal.updatedAt ? formatDateTime(editModal.updatedAt) : undefined} />
          </AdminDetailModal.InfoGrid>
        </AdminDetailModal.Section>

        {/* KYC 인증 정보 (read-only) */}
        <AdminDetailModal.Section title="KYC 인증 정보">
          <AdminDetailModal.StatusRow
            label="KYC 상태"
            status={(kycOpt?.label ?? editModal.kycStatus) || '—'}
            color={kycOpt?.color ?? 'elephant'}
          />
          <div style={{ marginTop: SPACING[2] }}>
            <AdminDetailModal.InfoGrid columns={2}>
              <AdminDetailModal.InfoRow label="인증 방법" value={getKycMethodLabel(editModal.kycVerifiedBy)} />
              <AdminDetailModal.InfoRow label="인증 시도 횟수" value={`${editModal.verifyAttemptCount}회`} />
            </AdminDetailModal.InfoGrid>
          </div>
        </AdminDetailModal.Section>

        {/* 계좌 정보 (read-only) */}
        <AdminDetailModal.Section title="계좌 정보">
          <AdminDetailModal.InfoGrid columns={2}>
            <AdminDetailModal.InfoRow label="은행" value={editModal.bankName || undefined} />
            <AdminDetailModal.InfoRow label="예금주" value={editModal.accountHolder || undefined} />
            <AdminDetailModal.InfoRow label="계좌번호" value={maskAccountNumber(editModal.accountNumber)} mono />
            <AdminDetailModal.InfoRow label="인증일" value={editModal.bankVerifiedAt ? formatDateTime(editModal.bankVerifiedAt) : undefined} />
          </AdminDetailModal.InfoGrid>
        </AdminDetailModal.Section>

        {/* 활동 요약 (read-only) */}
        <AdminDetailModal.Section title="활동 요약">
          <AdminDetailModal.InfoGrid columns={2}>
            <AdminDetailModal.InfoRow label="주문 수" value={`${editModal._count.orders}건`} />
            <AdminDetailModal.InfoRow label="매입 수" value={`${editModal._count.tradeIns}건`} />
            <AdminDetailModal.InfoRow label="보낸 선물" value={`${editModal._count.sentGifts}건`} />
            <AdminDetailModal.InfoRow label="받은 선물" value={`${editModal._count.receivedGifts}건`} />
          </AdminDetailModal.InfoGrid>
        </AdminDetailModal.Section>

        <AdminDetailModal.Divider />

        {/* 정보 수정 (editable) */}
        <AdminDetailModal.Section title="정보 수정" variant="highlight">
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING[3] }}>
            <div>
              <label className="admin-form-label">이름</label>
              <TextField
                variant="box"
                value={editModal.name}
                onChange={(e) => setEditModal(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="admin-form-label">연락처</label>
              <TextField
                variant="box"
                value={editModal.phone}
                onChange={(e) => setEditModal(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="admin-form-row">
              <div style={{ flex: 1 }}>
                <label className="admin-form-label">건당 한도 (원)</label>
                <TextField
                  variant="box"
                  type="number"
                  value={editModal.customLimitPerTx}
                  onChange={(e) => setEditModal(prev => ({ ...prev, customLimitPerTx: e.target.value }))}
                  placeholder="미설정 시 기본값 적용"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="admin-form-label">일일 한도 (원)</label>
                <TextField
                  variant="box"
                  type="number"
                  value={editModal.customLimitPerDay}
                  onChange={(e) => setEditModal(prev => ({ ...prev, customLimitPerDay: e.target.value }))}
                  placeholder="미설정 시 기본값 적용"
                />
              </div>
            </div>
          </div>
        </AdminDetailModal.Section>

        <AdminDetailModal.ActionBar>
          <Button variant="ghost" onClick={() => setEditModal(USER_EDIT_INITIAL)}>취소</Button>
          <Button variant="primary" onClick={handleUserEditSave} isLoading={editSaving}>저장</Button>
        </AdminDetailModal.ActionBar>
      </AdminDetailModal>
    </div>
  );
};



export default UsersTab;
