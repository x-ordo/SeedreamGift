/**
 * @file SettingsTab.tsx
 * @description 마이페이지 설정 탭 - 프로필, 알림, 계좌, 보안, 탈퇴
 * @module components/mypage
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bell, Building2, ShieldCheck, LogOut, UserX, Phone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AxiosError } from 'axios';
import { axiosInstance } from '../../lib/axios';
import { Card, Button, ListRow, ListRowAssetIcon, ListRowTexts, Border, Stack } from '../../design-system';
import { Switch } from '../../design-system';
import type { BankVerifiedData } from '../auth/BankVerification';
import { ProfileModal } from './ProfileModal';
import type { ProfileFormData } from './ProfileModal';
import { PasswordModal } from './PasswordModal';
import { BankModal } from './BankModal';
import { WithdrawModal } from './WithdrawModal';

export function SettingsTab() {
  const { user, isAuthenticated, logout, checkAuth } = useAuth();

  // ── KCB 전화번호 변경 팝업 라이프사이클 ──
  const phonePopupRef = useRef<Window | null>(null);
  const phonePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const openPhoneChangePopup = useCallback(() => {
    // 기존 팝업이 열려있으면 포커스
    if (phonePopupRef.current && !phonePopupRef.current.closed) {
      phonePopupRef.current.focus();
      return;
    }
    const w = 500, h = 600;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    phonePopupRef.current = window.open(
      `http://103.97.209.176:8091/coocon-kyc.html?company=dodong&mode=change-phone`,
      'KCB_PHONE_CHANGE',
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
    // 팝업 닫힘 감지 (1.5초 간격 폴링)
    phonePollingRef.current = setInterval(() => {
      if (phonePopupRef.current && phonePopupRef.current.closed) {
        stopPhonePolling();
        // 팝업이 닫혔으면 인증 완료 가능성 → 사용자 정보 새로고침
        checkAuth();
      }
    }, 1500);
  }, [checkAuth]);

  const stopPhonePolling = useCallback(() => {
    if (phonePollingRef.current) {
      clearInterval(phonePollingRef.current);
      phonePollingRef.current = null;
    }
    phonePopupRef.current = null;
  }, []);

  // 언마운트 시 팝업 + 폴링 정리
  useEffect(() => {
    return () => {
      stopPhonePolling();
      if (phonePopupRef.current && !phonePopupRef.current.closed) {
        phonePopupRef.current.close();
      }
    };
  }, [stopPhonePolling]);
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Modal states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [withdrawError, setWithdrawError] = useState('');

  // Form states
  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    name: '', email: '', zipCode: '', address: '', addressDetail: '',
  });
  const [notifications, setNotifications] = useState({
    emailNotification: true, pushNotification: true,
  });
  const [saving, setSaving] = useState(false);
  const settingsLoadedRef = useRef(false);

  // Bank account state
  const [bankAccount, setBankAccount] = useState<{
    bankName: string | null;
    accountNumber: string | null;
    accountHolder: string | null;
    bankVerifiedAt: string | null;
  } | null>(null);

  // Initialize form from user
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        email: user.email,
        zipCode: user.zipCode || '',
        address: user.address || '',
        addressDetail: user.addressDetail || '',
      });
      setNotifications({
        emailNotification: user.emailNotification ?? true,
        pushNotification: user.pushNotification ?? true,
      });
    }
  }, [user]);

  // Load bank account
  const loadBankAccount = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/kyc/bank-account');
      setBankAccount(res.data);
    } catch {
      setBankAccount(null);
    }
  }, []);

  // Load full profile (notifications)
  const loadFullProfile = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/auth/me');
      setNotifications({
        emailNotification: res.data.emailNotification ?? true,
        pushNotification: res.data.pushNotification ?? true,
      });
    } catch {
      // keep existing values
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    if (isAuthenticated && !settingsLoadedRef.current) {
      loadBankAccount();
      loadFullProfile();
      settingsLoadedRef.current = true;
    }
  }, [isAuthenticated, loadBankAccount, loadFullProfile]);

  // Handlers
  const handleUpdateProfile = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await axiosInstance.patch('/auth/profile', profileForm);
      await checkAuth();
      showToast({ message: '프로필이 수정되었습니다', type: 'success' });
    } catch (e: unknown) {
      const msg = e instanceof AxiosError ? (e.response?.data?.error || e.message) : e instanceof Error ? e.message : undefined;
      showToast({ message: msg || '프로필 수정 실패', type: 'error' });
    } finally {
      setSaving(false);
      setShowProfileModal(false);
    }
  };

  const handleToggleNotification = async (key: 'emailNotification' | 'pushNotification', value: boolean) => {
    const previousSettings = { ...notifications };
    try {
      setNotifications(prev => ({ ...prev, [key]: value }));
      await axiosInstance.patch('/auth/profile', { [key]: value });
      await checkAuth();
    } catch {
      setNotifications(previousSettings);
      showToast({ message: '설정 저장 실패', type: 'error' });
    }
  };

  const handleBankVerified = async (_data: BankVerifiedData) => {
    setShowBankModal(false);
    await loadBankAccount();
    showToast({ message: '계좌가 변경되었습니다', type: 'success' });
  };

  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
    showToast({ message: '로그아웃 되었습니다', type: 'success' });
  }, [logout, navigate, showToast]);

  const handleWithdraw = async () => {
    if (saving) return;
    setSaving(true);
    setWithdrawError('');
    try {
      await axiosInstance.delete('/users/me', { data: { password: withdrawPassword } });
      setShowWithdrawModal(false);
      await logout();
      navigate('/');
      showToast({ message: '탈퇴가 완료되었습니다', type: 'success' });
    } catch (e: unknown) {
      const msg = e instanceof AxiosError ? (e.response?.data?.error || e.message) : e instanceof Error ? e.message : undefined;
      setWithdrawError(msg || '탈퇴 처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap={3}>
      <Card padding="none">
        <ListRow
          left={<ListRowAssetIcon icon={User} shape="squircle" size="md" backgroundColor="var(--color-grey-100)" />}
          contents={<ListRowTexts type="2RowTypeA" top="프로필 설정" bottom="이름, 이메일, 주소 변경" />}
          withArrow
          verticalPadding="md"
          onClick={() => setShowProfileModal(true)}
        />
        <ListRow
          left={<ListRowAssetIcon icon={Phone} shape="squircle" size="md" backgroundColor="var(--color-grey-100)" />}
          contents={<ListRowTexts type="2RowTypeA" top="전화번호" bottom={user?.phone || '미등록 — 본인인증 후 등록 가능'} />}
          right={<Button size="sm" variant="ghost" onClick={openPhoneChangePopup}>변경</Button>}
          verticalPadding="md"
        />
        <ListRow
          left={<ListRowAssetIcon icon={Bell} shape="squircle" size="md" backgroundColor="var(--color-grey-100)" />}
          contents={<ListRowTexts type="2RowTypeA" top="이메일 알림" bottom="주요 정보 이메일 수신" />}
          right={<Switch checked={notifications.emailNotification} onChange={(v) => handleToggleNotification('emailNotification', v)} label="이메일 알림" />}
          verticalPadding="md"
        />
        <ListRow
          left={<ListRowAssetIcon icon={Bell} shape="squircle" size="md" backgroundColor="var(--color-grey-100)" />}
          contents={<ListRowTexts type="2RowTypeA" top="푸시 알림" bottom="앱 푸시 알림 수신" />}
          right={<Switch checked={notifications.pushNotification} onChange={(v) => handleToggleNotification('pushNotification', v)} label="푸시 알림" />}
          verticalPadding="md"
        />
        <ListRow
          left={<ListRowAssetIcon icon={Building2} shape="squircle" size="md" backgroundColor="var(--color-grey-100)" />}
          contents={
            <ListRowTexts
              type="2RowTypeA"
              top="계좌 관리"
              bottom={bankAccount
                ? `${bankAccount.bankName} ${bankAccount.accountNumber} (${bankAccount.accountHolder})`
                : '등록된 계좌가 없습니다'}
            />
          }
          withArrow
          verticalPadding="md"
          onClick={() => setShowBankModal(true)}
        />
        <ListRow
          left={<ListRowAssetIcon icon={ShieldCheck} shape="squircle" size="md" backgroundColor="var(--color-grey-100)" />}
          contents={<ListRowTexts type="2RowTypeA" top="보안 설정" bottom="비밀번호 변경" />}
          withArrow
          verticalPadding="md"
          onClick={() => setShowPasswordModal(true)}
        />
        <Border />
        <ListRow
          left={<ListRowAssetIcon icon={LogOut} shape="squircle" size="md" backgroundColor="var(--color-error-light)" />}
          contents={<ListRowTexts type="1RowTypeA" top="로그아웃" />}
          onClick={handleLogout}
          verticalPadding="md"
        />
        <ListRow
          left={<ListRowAssetIcon icon={UserX} shape="squircle" size="md" backgroundColor="var(--color-error-light)" />}
          contents={<ListRowTexts type="2RowTypeA" top="회원 탈퇴" bottom="계정 및 개인정보 영구 삭제" />}
          withArrow
          onClick={() => { setShowWithdrawModal(true); setWithdrawPassword(''); setWithdrawError(''); }}
          verticalPadding="md"
          border="none"
        />
      </Card>

      {/* Modals */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        profileForm={profileForm}
        onFormChange={setProfileForm}
        saving={saving}
        onSave={handleUpdateProfile}
      />
      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        userId={user?.id}
      />
      <BankModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        bankAccount={bankAccount}
        userId={user?.id}
        onVerified={handleBankVerified}
      />
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        saving={saving}
        password={withdrawPassword}
        onPasswordChange={setWithdrawPassword}
        error={withdrawError}
        onWithdraw={handleWithdraw}
      />
    </Stack>
  );
}
