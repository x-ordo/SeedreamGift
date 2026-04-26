import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Badge, Modal, TextField } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { maskEmail } from '../../../utils';
import { formatDateTime } from '../../../utils/dateUtils';
import { COLORS, SPACING, RADIUS } from '../../../constants/designTokens';
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
  canReceiveGift?: boolean;
  customLimitPerTx?: number;
  customLimitPerDay?: number;
  createdAt: string;
  lockedUntil?: string | null;
  lockedReason?: string | null;
  partnerTier?: string | null;
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

interface UserEditState {
  open: boolean;
  loading: boolean;
  userId: number;
  // Editable fields
  name: string;
  phone: string;
  canReceiveGift: boolean;
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
  name: '', phone: '', canReceiveGift: true, customLimitPerTx: '', customLimitPerDay: '',
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
  const [deleteModal, setDeleteModal] = useState<DeleteState>({ open: false, userId: 0, userName: '' });
  const [kycConfirm, setKycConfirm] = useState<{
    open: boolean; userId: number; userName: string; newStatus: string;
  }>({ open: false, userId: 0, userName: '', newStatus: '' });
  const [kycFilter, setKycFilter] = useState('');
  const [lockModal, setLockModal] = useState<{ open: boolean; userId: number; userName: string; until: string; reason: string }>({
    open: false, userId: 0, userName: '', until: '', reason: '',
  });
  const [partnerTier, setPartnerTier] = useState('');
  const [userSummary, setUserSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [userWebAuthn, setUserWebAuthn] = useState<{ credentials: any[]; mfaEnabled: boolean } | null>(null);
  const [webAuthnLoading, setWebAuthnLoading] = useState(false);
  const [resetWebAuthnConfirm, setResetWebAuthnConfirm] = useState(false);
  const [disableMfaConfirm, setDisableMfaConfirm] = useState(false);
  const [createUserModal, setCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'USER' });
  const [creating, setCreating] = useState(false);
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
      const msg = err?.response?.data?.error || 'KYC 처리에 실패했습니다.';
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
      const msg = err?.response?.data?.error || '권한 변경에 실패했습니다.';
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

  const [pwResetting, setPwResetting] = useState(false);

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
    setPwResetting(true);
    try {
      await adminApi.resetUserPassword(userId, password);
      showToast({ message: '비밀번호가 초기화되었습니다.', type: 'success' });
      setPasswordModal(PASSWORD_RESET_INITIAL);
    } catch (err: any) {
      const msg = err?.response?.data?.error || '비밀번호 초기화에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setPwResetting(false);
    }
  };

  // --- User Edit ---
  const openUserEdit = async (user: User) => {
    setEditModal(prev => ({ ...prev, open: true, loading: true, userId: user.id }));
    setUserSummary(null);
    try {
      const detail = await adminApi.getUser(user.id);
      const counts = detail._count ?? {};
      setPartnerTier(detail.partnerTier || '');
      setEditModal({
        open: true,
        loading: false,
        userId: user.id,
        // Editable
        name: detail.name || '',
        phone: detail.phone || '',
        canReceiveGift: detail.canReceiveGift ?? true,
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
      // Load transaction summary and security info in background
      loadUserSummary(user.id);
      loadUserWebAuthn(user.id);
    } catch {
      showToast({ message: '회원 정보를 불러오는데 실패했습니다.', type: 'error' });
      setEditModal(USER_EDIT_INITIAL);
    }
  };

  const handleUserEditSave = async () => {
    const { userId, name, phone, canReceiveGift, customLimitPerTx, customLimitPerDay } = editModal;
    const data: Record<string, any> = { name, phone, canReceiveGift };
    if (customLimitPerTx !== '') data.customLimitPerTx = Number(customLimitPerTx);
    if (customLimitPerDay !== '') data.customLimitPerDay = Number(customLimitPerDay);
    try {
      await adminApi.updateUser(userId, data);
      showToast({ message: '회원 정보가 수정되었습니다.', type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '회원 정보 수정에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
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
      const msg = err?.response?.data?.error || '삭제에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setDeleteModal({ open: false, userId: 0, userName: '' });
    }
  };

  // --- Lock User ---
  const handleLockUser = async () => {
    const { userId, until, reason } = lockModal;
    if (!until || !reason.trim()) {
      showToast({ message: '잠금 기한과 사유를 입력해주세요.', type: 'error' });
      return;
    }
    try {
      await adminApi.lockUser(userId, until, reason.trim());
      showToast({ message: '계정이 잠금되었습니다.', type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '계정 잠금에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setLockModal({ open: false, userId: 0, userName: '', until: '', reason: '' });
    }
  };

  const handleUnlockUser = async (userId: number) => {
    try {
      await adminApi.unlockUser(userId);
      showToast({ message: '계정 잠금이 해제되었습니다.', type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '잠금 해제에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    }
  };

  // --- Partner Tier ---
  const handlePartnerTierSave = async () => {
    if (!editModal.userId) return;
    try {
      await adminApi.updatePartnerTier(editModal.userId, partnerTier);
      showToast({ message: '파트너 등급이 변경되었습니다.', type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '등급 변경에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    }
  };

  // --- User Summary ---
  const loadUserSummary = async (userId: number) => {
    setSummaryLoading(true);
    try {
      const summary = await adminApi.getUserSummary(userId);
      setUserSummary(summary);
    } catch {
      setUserSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  // --- User WebAuthn & MFA ---
  const loadUserWebAuthn = async (userId: number) => {
    setWebAuthnLoading(true);
    try {
      const data = await adminApi.getUserWebAuthn(userId);
      setUserWebAuthn({
        credentials: Array.isArray(data?.credentials) ? data.credentials : [],
        mfaEnabled: data?.mfaEnabled ?? false,
      });
    } catch {
      setUserWebAuthn({ credentials: [], mfaEnabled: false });
    } finally {
      setWebAuthnLoading(false);
    }
  };

  const handleResetUserWebAuthn = async () => {
    if (!editModal.userId) return;
    try {
      await adminApi.resetUserWebAuthn(editModal.userId);
      showToast({ message: '패스키가 초기화되었습니다', type: 'success' });
      setResetWebAuthnConfirm(false);
      await loadUserWebAuthn(editModal.userId);
    } catch {
      showToast({ message: '패스키 초기화에 실패했습니다', type: 'error' });
    }
  };

  const handleForceDisableMfa = async () => {
    if (!editModal.userId) return;
    try {
      await adminApi.updateUser(editModal.userId, { mfaEnabled: false });
      showToast({ message: 'OTP가 강제 비활성화되었습니다', type: 'success' });
      setDisableMfaConfirm(false);
      setUserWebAuthn(prev => prev ? { ...prev, mfaEnabled: false } : null);
    } catch {
      showToast({ message: 'OTP 비활성화에 실패했습니다', type: 'error' });
    }
  };

  const isUserLocked = (u: User) => {
    return u.lockedUntil && new Date(u.lockedUntil) > new Date();
  };

  // --- 사용자 생성 ---
  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      showToast({ message: '이메일과 비밀번호는 필수입니다.', type: 'warning' });
      return;
    }
    const pwError = validatePassword(newUser.password);
    if (pwError) {
      showToast({ message: pwError, type: 'warning' });
      return;
    }
    setCreating(true);
    try {
      await adminApi.createUser(newUser);
      showToast({ message: '사용자가 생성되었습니다.', type: 'success' });
      setCreateUserModal(false);
      setNewUser({ email: '', password: '', name: '', role: 'USER' });
      reload();
    } catch (err: any) {
      showToast({ message: err?.response?.data?.error || '사용자 생성에 실패했습니다.', type: 'error' });
    } finally {
      setCreating(false);
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
            size="xsmall"
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
          {isUserLocked(u) ? (
            <Button variant="secondary" size="sm" style={{ color: COLORS.warning }} onClick={() => handleUnlockUser(u.id)}>
              잠금해제
            </Button>
          ) : (
            u.role !== 'ADMIN' && (
              <Button variant="ghost" size="sm" onClick={() => setLockModal({ open: true, userId: u.id, userName: u.name || u.email, until: '', reason: '' })}>
                계정잠금
              </Button>
            )
          )}
          <Button variant="ghost" size="sm" onClick={() => openPasswordReset(u)}>비밀번호 초기화</Button>
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
        <div className="admin-page-actions">
          <Button
            variant="primary"
            size="md"
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={() => setCreateUserModal(true)}
          >
            사용자 추가
          </Button>
        </div>
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
          <Badge color="blue" variant="fill" size="small">{confirmModal.newRole}</Badge>
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
            <Badge color="green" variant="fill" size="small">승인</Badge>
          ) : (
            <Badge color="red" variant="fill" size="small">거절</Badge>
          )}
          하시겠습니까?
        </p>
      </ConfirmModal>

      {/* 비밀번호 초기화 모달 */}
      <Modal
        isOpen={passwordModal.open}
        onClose={() => setPasswordModal(PASSWORD_RESET_INITIAL)}
        title="비밀번호 초기화"
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
            <p role="alert" style={{ color: COLORS.error, fontSize: '13px', marginBottom: SPACING[3] }}>
              {passwordModal.error}
            </p>
          )}
          <div className="admin-form-footer">
            <Button variant="ghost" onClick={() => setPasswordModal(PASSWORD_RESET_INITIAL)} disabled={pwResetting}>취소</Button>
            <Button variant="primary" onClick={handlePasswordReset} loading={pwResetting} disabled={pwResetting || !passwordModal.password || !passwordModal.confirmPassword}>초기화</Button>
          </div>
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
          <span style={{ fontSize: '13px', color: 'var(--color-error)' }}>개인정보가 익명화되며 복구할 수 없습니다.</span>
        </p>
      </ConfirmModal>

      {/* 계정 잠금 모달 */}
      <Modal
        isOpen={lockModal.open}
        onClose={() => setLockModal({ ...lockModal, open: false })}
        title="계정 잠금"
      >
        <div style={{ padding: SPACING[4] }}>
          <p style={{ marginBottom: SPACING[4], color: COLORS.grey700 }}>
            <strong>{lockModal.userName}</strong>님의 계정을 잠금 처리합니다.
          </p>
          <div style={{ marginBottom: SPACING[3] }}>
            <label className="admin-form-label" style={{ display: 'block', marginBottom: SPACING[1], fontSize: '13px', fontWeight: 600 }}>잠금 기한</label>
            <TextField
              variant="box"
              type="datetime-local"
              value={lockModal.until}
              onChange={(e) => setLockModal(prev => ({ ...prev, until: e.target.value }))}
              aria-label="잠금 기한"
            />
          </div>
          <div style={{ marginBottom: SPACING[3] }}>
            <label className="admin-form-label" style={{ display: 'block', marginBottom: SPACING[1], fontSize: '13px', fontWeight: 600 }}>잠금 사유</label>
            <textarea
              className="form-control"
              value={lockModal.reason}
              onChange={(e) => setLockModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="잠금 사유를 입력해주세요"
              rows={3}
              style={{
                resize: 'vertical',
                width: '100%',
                padding: SPACING[2],
                border: `1px solid ${COLORS.grey200}`,
                borderRadius: 'var(--radius-sm, 8px)',
                fontSize: '13px',
              }}
            />
          </div>
          <div className="admin-form-footer">
            <Button variant="ghost" onClick={() => setLockModal({ ...lockModal, open: false })}>취소</Button>
            <Button
              variant="primary"
              style={{ backgroundColor: COLORS.error }}
              onClick={handleLockUser}
              disabled={!lockModal.until || !lockModal.reason.trim()}
            >
              잠금
            </Button>
          </div>
        </div>
      </Modal>

      {/* 회원 상세/편집 모달 */}
      <AdminDetailModal
        isOpen={editModal.open}
        onClose={() => { setEditModal(USER_EDIT_INITIAL); setUserWebAuthn(null); setResetWebAuthnConfirm(false); setDisableMfaConfirm(false); }}
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

        {/* 파트너 등급 */}
        <AdminDetailModal.Section title="파트너 등급">
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING[2] }}>
            <select
              className="admin-filter-select"
              value={partnerTier}
              onChange={(e) => setPartnerTier(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '13px' }}
              aria-label="파트너 등급 선택"
            >
              <option value="">없음</option>
              <option value="BRONZE">BRONZE</option>
              <option value="SILVER">SILVER</option>
              <option value="GOLD">GOLD</option>
              <option value="PLATINUM">PLATINUM</option>
            </select>
            <Button size="sm" variant="primary" onClick={handlePartnerTierSave}>
              저장
            </Button>
          </div>
        </AdminDetailModal.Section>

        {/* 거래 요약 */}
        <AdminDetailModal.Section title="거래 요약">
          {summaryLoading ? (
            <div style={{ textAlign: 'center', padding: SPACING[3], color: COLORS.grey500, fontSize: '13px' }}>
              불러오는 중...
            </div>
          ) : userSummary ? (
            <div>
              <AdminDetailModal.InfoGrid columns={2}>
                <AdminDetailModal.InfoRow
                  label="총 주문 금액"
                  value={userSummary.totalOrderAmount != null ? `${Number(userSummary.totalOrderAmount).toLocaleString('ko-KR')}원 (${userSummary.totalOrderCount || 0}건)` : undefined}
                />
                <AdminDetailModal.InfoRow
                  label="총 매입 금액"
                  value={userSummary.totalTradeInAmount != null ? `${Number(userSummary.totalTradeInAmount).toLocaleString('ko-KR')}원 (${userSummary.totalTradeInCount || 0}건)` : undefined}
                />
              </AdminDetailModal.InfoGrid>

              {/* 최근 주문 */}
              {userSummary.recentOrders && userSummary.recentOrders.length > 0 && (
                <div style={{ marginTop: SPACING[3] }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: COLORS.grey600, marginBottom: SPACING[1] }}>최근 주문</div>
                  <div style={{ border: `1px solid ${COLORS.grey200}`, borderRadius: 'var(--radius-sm, 8px)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <caption className="sr-only">최근 주문 내역</caption>
                      <thead>
                        <tr style={{ background: COLORS.grey50 }}>
                          <th scope="col" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>주문코드</th>
                          <th scope="col" style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>금액</th>
                          <th scope="col" style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 500 }}>상태</th>
                          <th scope="col" style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>일시</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userSummary.recentOrders.slice(0, 5).map((o: any) => (
                          <tr key={o.id} style={{ borderTop: `1px solid ${COLORS.grey100}` }}>
                            <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '11px' }}>{o.orderCode || `#${o.id}`}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(o.totalAmount).toLocaleString('ko-KR')}원</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <Badge color="elephant" variant="weak" size="xsmall">{o.status}</Badge>
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', color: COLORS.grey500 }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 최근 매입 */}
              {userSummary.recentTradeIns && userSummary.recentTradeIns.length > 0 && (
                <div style={{ marginTop: SPACING[3] }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: COLORS.grey600, marginBottom: SPACING[1] }}>최근 매입</div>
                  <div style={{ border: `1px solid ${COLORS.grey200}`, borderRadius: 'var(--radius-sm, 8px)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <caption className="sr-only">최근 매입 내역</caption>
                      <thead>
                        <tr style={{ background: COLORS.grey50 }}>
                          <th scope="col" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>상품</th>
                          <th scope="col" style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>금액</th>
                          <th scope="col" style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 500 }}>상태</th>
                          <th scope="col" style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>일시</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userSummary.recentTradeIns.slice(0, 5).map((t: any) => (
                          <tr key={t.id} style={{ borderTop: `1px solid ${COLORS.grey100}` }}>
                            <td style={{ padding: '6px 8px' }}>{t.productName || '-'}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(t.amount).toLocaleString('ko-KR')}원</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <Badge color="elephant" variant="weak" size="xsmall">{t.status}</Badge>
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', color: COLORS.grey500 }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: COLORS.grey500 }}>거래 요약 정보가 없습니다.</div>
          )}
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
                type="tel"
                inputMode="numeric"
                placeholder="010-0000-0000"
                value={editModal.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                  let formatted = digits;
                  if (digits.length > 7) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
                  else if (digits.length > 3) formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                  setEditModal(prev => ({ ...prev, phone: formatted }));
                }}
              />
            </div>
            <div>
              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={editModal.canReceiveGift}
                  onChange={(e) => setEditModal(prev => ({ ...prev, canReceiveGift: e.target.checked }))}
                />
                선물 받기 허용
              </label>
            </div>
            <div className="admin-form-row">
              <div style={{ flex: 1 }}>
                <label className="admin-form-label">건당 한도 (원)</label>
                <TextField
                  variant="box"
                  inputMode="numeric"
                  value={editModal.customLimitPerTx ? Number(editModal.customLimitPerTx).toLocaleString() : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, '');
                    setEditModal(prev => ({ ...prev, customLimitPerTx: raw }));
                  }}
                  placeholder="미설정 시 기본값 적용"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="admin-form-label">일일 한도 (원)</label>
                <TextField
                  variant="box"
                  inputMode="numeric"
                  value={editModal.customLimitPerDay ? Number(editModal.customLimitPerDay).toLocaleString() : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, '');
                    setEditModal(prev => ({ ...prev, customLimitPerDay: raw }));
                  }}
                  placeholder="미설정 시 기본값 적용"
                />
              </div>
            </div>
          </div>
        </AdminDetailModal.Section>

        <AdminDetailModal.Divider />

        {/* 보안 관리 */}
        <AdminDetailModal.Section title="보안 관리">
          {webAuthnLoading ? (
            <div style={{ fontSize: '13px', color: COLORS.grey500 }}>보안 정보 로딩 중...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING[3] }}>
              {/* OTP status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${SPACING[2]} ${SPACING[3]}`, background: COLORS.grey50, borderRadius: 'var(--radius-sm, 8px)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: COLORS.grey700 }}>Google OTP</div>
                  <div style={{ fontSize: '12px', color: COLORS.grey500 }}>
                    {userWebAuthn?.mfaEnabled ? '활성화됨' : '비활성화됨'}
                  </div>
                </div>
                {userWebAuthn?.mfaEnabled && (
                  <Button
                    size="sm"
                    variant="ghost"
                    style={{ color: COLORS.error, fontSize: '12px' }}
                    onClick={() => setDisableMfaConfirm(true)}
                  >
                    강제 비활성화
                  </Button>
                )}
              </div>

              {/* WebAuthn credentials */}
              <div style={{ padding: `${SPACING[2]} ${SPACING[3]}`, background: COLORS.grey50, borderRadius: 'var(--radius-sm, 8px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING[1] }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: COLORS.grey700 }}>
                    패스키 ({userWebAuthn?.credentials.length ?? 0}개)
                  </div>
                  {(userWebAuthn?.credentials.length ?? 0) > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      style={{ color: COLORS.error, fontSize: '12px' }}
                      onClick={() => setResetWebAuthnConfirm(true)}
                    >
                      전체 초기화
                    </Button>
                  )}
                </div>
                {userWebAuthn?.credentials.length === 0 ? (
                  <div style={{ fontSize: '12px', color: COLORS.grey500 }}>등록된 패스키가 없습니다.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {userWebAuthn?.credentials.map((c: any) => (
                      <div key={c.id} style={{ fontSize: '12px', color: COLORS.grey600 }}>
                        {c.name || '이름 없음'} · {c.createdAt ? new Date(c.createdAt).toLocaleDateString('ko-KR') : '-'}
                        {c.lastUsedAt ? ` · 최근 사용: ${new Date(c.lastUsedAt).toLocaleDateString('ko-KR')}` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reset WebAuthn confirm */}
              {resetWebAuthnConfirm && (
                <div style={{ padding: SPACING[3], background: COLORS.errorBg, borderRadius: RADIUS.sm, border: `1px solid ${COLORS.errorBorder}` }}>
                  <p style={{ fontSize: '13px', color: COLORS.error, marginBottom: SPACING[2] }}>
                    모든 패스키({userWebAuthn?.credentials.length}개)를 삭제합니다. 계속하시겠습니까?
                  </p>
                  <div style={{ display: 'flex', gap: SPACING[2] }}>
                    <Button size="sm" variant="ghost" onClick={() => setResetWebAuthnConfirm(false)}>취소</Button>
                    <Button size="sm" variant="primary" style={{ backgroundColor: COLORS.error }} onClick={handleResetUserWebAuthn}>삭제</Button>
                  </div>
                </div>
              )}

              {/* Disable MFA confirm */}
              {disableMfaConfirm && (
                <div style={{ padding: SPACING[3], background: COLORS.errorBg, borderRadius: RADIUS.sm, border: `1px solid ${COLORS.errorBorder}` }}>
                  <p style={{ fontSize: '13px', color: COLORS.error, marginBottom: SPACING[2] }}>
                    사용자의 OTP를 강제 비활성화합니다. 계속하시겠습니까?
                  </p>
                  <div style={{ display: 'flex', gap: SPACING[2] }}>
                    <Button size="sm" variant="ghost" onClick={() => setDisableMfaConfirm(false)}>취소</Button>
                    <Button size="sm" variant="primary" style={{ backgroundColor: COLORS.error }} onClick={handleForceDisableMfa}>비활성화</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </AdminDetailModal.Section>

        <AdminDetailModal.ActionBar>
          <Button variant="ghost" onClick={() => setEditModal(USER_EDIT_INITIAL)}>취소</Button>
          <Button variant="primary" onClick={handleUserEditSave}>저장</Button>
        </AdminDetailModal.ActionBar>
      </AdminDetailModal>

      {/* 사용자 생성 모달 */}
      <Modal
        isOpen={createUserModal}
        onClose={() => { setCreateUserModal(false); setNewUser({ email: '', password: '', name: '', role: 'USER' }); }}
        title="사용자 추가"
      >
        <div style={{ padding: SPACING[4] }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING[3] }}>
            <div>
              <label className="admin-form-label">
                이메일 <span style={{ color: COLORS.error }}>*</span>
              </label>
              <TextField
                variant="box"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                placeholder="example@email.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="admin-form-label">
                비밀번호 <span style={{ color: COLORS.error }}>*</span>
              </label>
              <TextField
                variant="box"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                placeholder="8자 이상, 영문/숫자/특수문자 포함"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="admin-form-label">이름</label>
              <TextField
                variant="box"
                value={newUser.name}
                onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="admin-form-label">역할</label>
              <select
                className="admin-filter-select"
                value={newUser.role}
                onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', fontSize: '14px' }}
                aria-label="역할 선택"
              >
                <option value="USER">USER</option>
                <option value="PARTNER">PARTNER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>
          <div className="admin-form-footer" style={{ marginTop: SPACING[4] }}>
            <Button
              variant="ghost"
              onClick={() => { setCreateUserModal(false); setNewUser({ email: '', password: '', name: '', role: 'USER' }); }}
            >
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateUser}
              disabled={creating || !newUser.email || !newUser.password}
            >
              {creating ? '생성 중...' : '생성'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};



export default UsersTab;
