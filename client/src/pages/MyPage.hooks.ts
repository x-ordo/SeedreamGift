import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useMyOrders, useMyGifts, useMyTradeIns, useMyCashReceipts, useCancelOrder } from '../hooks';
import { useSeedreamCancel } from '../hooks/mutations/useSeedreamCancel';
import { giftApi, ordersExportApi } from '../api/manual';
import { exportUserTransactionReport, exportBankSubmissionReport } from './Admin/utils/exportExcel';
import type { UserTransactionRow, UserTransactionSummary, TradeInPayoutRow, TradeInPayoutSummary } from './Admin/utils/exportExcel';
import { axiosInstance } from '../lib/axios';
import { webauthnApi } from '../api';
import type { WebAuthnCredential } from '../api/manual';
import { getErrorMessage } from '../utils/errorUtils';
import { isWebAuthnSupported, startWebAuthnRegistration } from '../utils/webauthn';
import type { ProfileFormData } from '../components/mypage/ProfileModal';
import type { ExportOptions } from '../components/mypage/ExportOptionsModal';
import type { BankVerifiedData } from '../components/auth/BankVerification';
import { VALID_MYPAGE_TABS, MyPageTab, BankAccount, NotificationSettings } from '../types';
import siteConfig from '../../../site.config.json';

export const useMyPage = () => {
  const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  // URL에서 탭 파라미터 읽기, 없으면 'orders' 기본값
  const tabFromUrl = searchParams.get('tab') as MyPageTab | null;
  const initialTab = tabFromUrl && VALID_MYPAGE_TABS.includes(tabFromUrl) ? tabFromUrl : 'orders';

  // 현재 활성 탭
  const [activeTab, setActiveTab] = useState<MyPageTab>(initialTab);

  // URL 파라미터 변경 시 탭 상태 동기화
  useEffect(() => {
    const targetTab = (tabFromUrl && VALID_MYPAGE_TABS.includes(tabFromUrl)) ? tabFromUrl : 'orders';
    setActiveTab(targetTab);
  }, [tabFromUrl]);

  // React Query 기반 데이터 조회
  const { data: orders = [], isLoading: ordersLoading } = useMyOrders(activeTab === 'orders');
  const { data: gifts = [], isLoading: giftsLoading, refetch: refetchGifts } = useMyGifts(activeTab === 'gifts');
  const { data: tradeIns = [], isLoading: tradeInsLoading } = useMyTradeIns(activeTab === 'tradeins');
  const { data: cashReceipts = [], isLoading: receiptsLoading, refetch: refetchReceipts } = useMyCashReceipts(activeTab === 'receipts');
  const cancelOrderMutation = useCancelOrder();
  const seedreamCancelMutation = useSeedreamCancel();

  const loading = activeTab === 'orders' ? ordersLoading
    : activeTab === 'gifts' ? giftsLoading
      : activeTab === 'tradeins' ? tradeInsLoading
        : activeTab === 'receipts' ? receiptsLoading
          : false;

  // 설정 탭 상태
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [withdrawError, setWithdrawError] = useState('');

  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    name: '',
    email: '',
    zipCode: '',
    address: '',
    addressDetail: ''
  });
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);

  // MFA 상태
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaSetupModal, setShowMfaSetupModal] = useState(false);
  const [mfaQrUrl, setMfaQrUrl] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');

  // WebAuthn (Passkey) 상태
  const [passkeyCredentials, setPasskeyCredentials] = useState<WebAuthnCredential[]>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // Settings 탭 로드 여부 추적 (탭 재진입 시 중복 API 호출 방지)
  const settingsLoadedRef = useRef(false);

  // 로그아웃 시 settingsLoadedRef 초기화
  useEffect(() => {
    if (!isAuthenticated) {
      settingsLoadedRef.current = false;
    }
  }, [isAuthenticated]);

  // 계좌 정보 상태
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);

  // 초기화 - 유저 정보 로드
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

  // 탭 변경 핸들러 (URL 동기화 + 스크롤 리셋)
  const handleTabChange = useCallback((tabId: string) => {
    const newTab = tabId as MyPageTab;
    setActiveTab(newTab);
    setSearchParams({ tab: newTab }, { replace: true });
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }, [setSearchParams]);

  /**
   * PIN 번호 복사
   */
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: 'PIN 번호가 복사되었어요', type: 'success' });
    } catch {
      showToast({ message: '복사에 실패했어요', type: 'error' });
    }
  }, [showToast]);

  /**
   * 주문 취소 (PENDING 상태만)
   */
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);

  const handleCancelOrder = useCallback((orderId: number) => {
    setCancelTarget(orderId);
  }, []);

  const handleConfirmCancel = useCallback(() => {
    if (!cancelTarget) return;
    cancelOrderMutation.mutate(cancelTarget, {
      onSuccess: () => {
        showToast({ message: '주문이 취소되었습니다', type: 'success' });
        setCancelTarget(null);
      },
      onError: (err) => {
        showToast({ message: err.message || '주문 취소에 실패했습니다', type: 'error' });
        setCancelTarget(null);
      },
    });
  }, [cancelTarget, cancelOrderMutation, showToast]);

  /**
   * 가상계좌 결제 취소 (입금 전, ISSUED 상태) — orderCode 기반
   * Seedream POST /payment/seedream/cancel + payMethod=VACCOUNT-ISSUECAN
   */
  const [vaCancelTarget, setVaCancelTarget] = useState<string | null>(null);
  const handleVACancelOpen = useCallback((orderCode: string) => {
    setVaCancelTarget(orderCode);
  }, []);
  const handleVACancelClose = useCallback(() => {
    setVaCancelTarget(null);
  }, []);
  const handleVACancelConfirm = useCallback((reason: string) => {
    if (!vaCancelTarget) return;
    seedreamCancelMutation.mutate(
      { orderCode: vaCancelTarget, payMethod: 'VACCOUNT-ISSUECAN', cancelReason: reason },
      {
        onSuccess: (res) => {
          showToast({
            message: res.alreadyDone
              ? '이미 취소 완료된 건입니다'
              : '결제 취소가 접수되었습니다. 잠시 후 상태가 갱신됩니다',
            type: 'success',
          });
          setVaCancelTarget(null);
        },
        onError: (err) => {
          showToast({ message: getErrorMessage(err) || '결제 취소에 실패했습니다', type: 'error' });
        },
      }
    );
  }, [vaCancelTarget, seedreamCancelMutation, showToast]);

  /**
   * 가상계좌 결제 환불 (입금 후, PAID/DELIVERED 상태) — orderCode + 환불 계좌
   * Seedream POST /payment/seedream/cancel + payMethod=BANK
   */
  const [vaRefundTarget, setVaRefundTarget] = useState<string | null>(null);
  const handleVARefundOpen = useCallback((orderCode: string) => {
    setVaRefundTarget(orderCode);
  }, []);
  const handleVARefundClose = useCallback(() => {
    setVaRefundTarget(null);
  }, []);
  const handleVARefundConfirm = useCallback(
    (params: { cancelReason: string; bankCode: string; accountNo: string }) => {
      if (!vaRefundTarget) return;
      seedreamCancelMutation.mutate(
        {
          orderCode: vaRefundTarget,
          payMethod: 'BANK',
          cancelReason: params.cancelReason,
          bankCode: params.bankCode,
          accountNo: params.accountNo,
        },
        {
          onSuccess: (res) => {
            showToast({
              message: res.alreadyDone
                ? '이미 환불 처리된 건입니다'
                : '환불 요청이 접수되었습니다. 영업일 1~2일 내 입금됩니다',
              type: 'success',
            });
            setVaRefundTarget(null);
          },
          onError: (err) => {
            showToast({ message: getErrorMessage(err) || '환불 요청에 실패했습니다', type: 'error' });
          },
        }
      );
    },
    [vaRefundTarget, seedreamCancelMutation, showToast]
  );

  /**
   * 선물 수령 (SENT 상태만)
   */
  const [claimingGiftId, setClaimingGiftId] = useState<number | null>(null);
  const handleClaimGift = useCallback(async (giftId: number) => {
    setClaimingGiftId(giftId);
    try {
      await giftApi.claimGift(giftId);
      showToast({ message: '선물을 수령했습니다', type: 'success' });
      refetchGifts();
    } catch (err: unknown) {
      showToast({ message: (err instanceof Error ? err.message : '') || '선물 수령에 실패했습니다', type: 'error' });
    } finally {
      setClaimingGiftId(null);
    }
  }, [refetchGifts, showToast]);

  /**
   * 거래내역 증빙 엑셀 다운로드
   */
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const handleExportWithOptions = useCallback(async (options: ExportOptions) => {
    setExporting(true);
    try {
      const result = await ordersExportApi.getMyTransactionExport({
        pinOption: options.pinOption,
        type: options.type,
      });
      const items = result?.items as UserTransactionRow[] || [];
      const summary = result?.summary as UserTransactionSummary;
      if (items.length === 0) {
        showToast({ message: '내보낼 거래내역이 없습니다', type: 'info' });
        return;
      }
      exportUserTransactionReport(items, summary, user?.name, options.pinOption);
      showToast({ message: '거래내역 엑셀이 다운로드되었습니다', type: 'success' });
      setShowExportModal(false);
    } catch {
      showToast({ message: '거래내역 다운로드에 실패했습니다', type: 'error' });
    } finally {
      setExporting(false);
    }
  }, [showToast, user?.name]);

  /**
   * 은행제출 매입 증빙 엑셀 다운로드
   */
  const [exportingBankSubmission, setExportingBankSubmission] = useState(false);

  const handleExportBankSubmission = useCallback(async () => {
    setExportingBankSubmission(true);
    try {
      const result = await ordersExportApi.getMyBankSubmission({ type: 'PURCHASE' });
      const items = result?.items as TradeInPayoutRow[] || [];
      const summary = result?.summary as TradeInPayoutSummary;
      if (items.length === 0) {
        showToast({ message: '내보낼 매입 내역이 없습니다', type: 'info' });
        return;
      }
      exportBankSubmissionReport(items, summary, { buyerName: siteConfig.company.nameShort, role: 'user' });
      showToast({ message: '은행제출 증빙이 다운로드되었습니다', type: 'success' });
    } catch {
      showToast({ message: '증빙 다운로드에 실패했습니다', type: 'error' });
    } finally {
      setExportingBankSubmission(false);
    }
  }, [showToast]);

  /**
   * 로그아웃
   */
  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
    showToast({ message: '로그아웃 되었습니다', type: 'success' });
  }, [logout, navigate, showToast]);

  /**
   * 프로필 수정
   */
  const handleUpdateProfile = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      // 이름/이메일은 KYC/회원가입 시 확정 — 배송지만 전송
      const { zipCode, address, addressDetail } = profileForm;
      await axiosInstance.patch('/auth/profile', { zipCode, address, addressDetail });
      await checkAuth();
      setShowProfileModal(false);
      showToast({ message: '배송지가 수정되었습니다', type: 'success' });
    } catch (e) {
      let msg = '배송지 수정에 실패했습니다.';
      if (isAxiosError(e) && e.response?.status === 401) {
        msg = '로그인이 만료되었습니다. 다시 로그인해주세요.';
      }
      showToast({ message: msg, type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [saving, profileForm, checkAuth, showToast]);

  /**
   * 알림 설정 토글
   */
  const handleToggleNotification = useCallback(async (key: 'emailNotification' | 'pushNotification', value: boolean) => {
    if (!notifications) return;
    const previousSettings = { ...notifications };
    try {
      setNotifications(prev => prev ? { ...prev, [key]: value } : prev);
      await axiosInstance.patch('/auth/profile', { [key]: value });
      await checkAuth();
    } catch (e) {
      setNotifications(previousSettings);
      showToast({ message: '설정 저장 실패', type: 'error' });
    }
  }, [notifications, checkAuth, showToast]);

  /**
   * 계좌 정보 로드
   */
  const loadBankAccount = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/kyc/bank-account');
      setBankAccount(res.data);
    } catch {
      // 계좌 미등록 상태
      setBankAccount(null);
    }
  }, []);

  /**
   * 전체 프로필 로드 (알림 설정 포함)
   */
  const loadFullProfile = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/auth/me');
      setNotifications({
        emailNotification: res.data.emailNotification ?? true,
        pushNotification: res.data.pushNotification ?? true,
      });
    } catch {
      // 실패 시 기존 user 값 유지
    }
  }, []);

  /**
   * MFA 상태 로드
   */
  const loadMfaStatus = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/auth/mfa/status');
      setMfaEnabled(res.data?.mfa_enabled ?? false);
    } catch {
      setMfaEnabled(false);
    }
  }, []);

  /**
   * MFA 설정 시작 (비밀번호 재확인 후 QR 코드 생성)
   */
  const handleMfaSetup = useCallback(async (password: string) => {
    try {
      const res = await axiosInstance.post('/auth/mfa/setup', { password });
      setMfaQrUrl(res.data?.qrUrl || '');
      setMfaSecret(res.data?.secret || '');
      setShowMfaSetupModal(true);
    } catch (err: unknown) {
      const axiosErr = err as import('axios').AxiosError<{ error?: string }>;
      const msg = axiosErr.response?.status === 401
        ? '비밀번호가 올바르지 않습니다.'
        : 'OTP 설정에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    }
  }, [showToast]);

  /**
   * MFA 활성화 (TOTP 코드 검증)
   */
  const [mfaProcessing, setMfaProcessing] = useState(false);

  const handleMfaVerify = useCallback(async (code: string) => {
    setMfaProcessing(true);
    try {
      await axiosInstance.post('/auth/mfa/verify', { code });
      setMfaEnabled(true);
      setShowMfaSetupModal(false);
      showToast({ message: 'Google OTP가 활성화되었습니다', type: 'success' });
    } catch {
      showToast({ message: 'OTP 코드가 올바르지 않습니다. 다시 입력해주세요.', type: 'error' });
    } finally {
      setMfaProcessing(false);
    }
  }, [showToast]);

  /**
   * MFA 비활성화
   */
  const handleMfaDisable = useCallback(async (code: string) => {
    setMfaProcessing(true);
    try {
      await axiosInstance.post('/auth/mfa/disable', { code });
      setMfaEnabled(false);
      showToast({ message: 'Google OTP가 비활성화되었습니다', type: 'success' });
    } catch {
      showToast({ message: 'OTP 코드가 올바르지 않습니다.', type: 'error' });
    } finally {
      setMfaProcessing(false);
    }
  }, [showToast]);

  /**
   * 패스키 목록 로드
   */
  const loadPasskeyCredentials = useCallback(async () => {
    try {
      const creds = await webauthnApi.getCredentials();
      setPasskeyCredentials(Array.isArray(creds) ? creds : []);
    } catch {
      setPasskeyCredentials([]);
    }
  }, []);

  /**
   * 새 패스키 등록
   */
  const handleRegisterPasskey = useCallback(async (credentialName: string) => {
    if (!isWebAuthnSupported()) {
      showToast({ message: '이 브라우저는 패스키를 지원하지 않습니다', type: 'error' });
      return;
    }
    setPasskeyLoading(true);
    try {
      // 1. Get registration options from server
      const options = await webauthnApi.registerBegin();
      // 2. Browser WebAuthn ceremony
      const attestation = await startWebAuthnRegistration(options);
      // 3. Send to server with name
      await webauthnApi.registerComplete({ name: credentialName, credential: attestation });
      showToast({ message: '패스키가 등록되었습니다', type: 'success' });
      await loadPasskeyCredentials();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '패스키 등록에 실패했습니다';
      showToast({ message: msg, type: 'error' });
    } finally {
      setPasskeyLoading(false);
    }
  }, [showToast, loadPasskeyCredentials]);

  /**
   * 패스키 이름 변경
   */
  const handleRenamePasskey = useCallback(async (credId: string, newName: string) => {
    try {
      await webauthnApi.renameCredential(credId, newName);
      showToast({ message: '패스키 이름이 변경되었습니다', type: 'success' });
      await loadPasskeyCredentials();
    } catch (err) {
      showToast({ message: getErrorMessage(err, '이름 변경에 실패했습니다'), type: 'error' });
    }
  }, [loadPasskeyCredentials, showToast]);

  /**
   * 패스키 삭제
   */
  const handleDeletePasskey = useCallback(async (credId: string) => {
    setPasskeyLoading(true);
    try {
      await webauthnApi.deleteCredential(credId);
      showToast({ message: '패스키가 삭제되었습니다', type: 'success' });
      await loadPasskeyCredentials();
    } catch {
      showToast({ message: '패스키 삭제에 실패했습니다', type: 'error' });
    } finally {
      setPasskeyLoading(false);
    }
  }, [showToast, loadPasskeyCredentials]);

  useEffect(() => {
    if (activeTab === 'settings' && isAuthenticated && !settingsLoadedRef.current) {
      loadBankAccount();
      loadFullProfile();
      loadMfaStatus();
      loadPasskeyCredentials();
      settingsLoadedRef.current = true;
    }
  }, [activeTab, isAuthenticated, loadBankAccount, loadFullProfile, loadMfaStatus, loadPasskeyCredentials]);

  /**
   * 계좌 변경 완료 핸들러
   */
  const handleBankVerified = useCallback(async (_data: BankVerifiedData) => {
    setShowBankModal(false);
    await loadBankAccount();
    showToast({ message: '계좌가 변경되었습니다', type: 'success' });
  }, [loadBankAccount, showToast]);

  /**
   * 회원 탈퇴
   */
  const handleWithdraw = useCallback(async () => {
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
      setWithdrawError((e instanceof Error ? e.message : '') || '탈퇴 처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }, [saving, withdrawPassword, logout, navigate, showToast]);

  // ── Phone Change (KCB 본인인증 후 전화번호 변경) ──
  const handleChangePhone = useCallback(async (newPhone: string) => {
    try {
      await axiosInstance.post('/kyc/change-phone', { phone: newPhone });
      showToast({ message: '전화번호가 변경되었습니다', type: 'success' });
      checkAuth(); // 사용자 정보 새로고침
    } catch (e) {
      const msg = isAxiosError(e)
        ? (e.response?.data?.error || e.message)
        : (e instanceof Error ? e.message : '알 수 없는 오류');
      showToast({ message: msg || '전화번호 변경에 실패했습니다', type: 'error' });
    }
  }, [showToast, checkAuth]);

  return {
    user,
    isAuthenticated,
    isLoading,
    activeTab,
    loading,
    orders,
    gifts,
    tradeIns,
    cashReceipts,
    refetchReceipts,
    showProfileModal,
    setShowProfileModal,
    showPasswordModal,
    setShowPasswordModal,
    showBankModal,
    setShowBankModal,
    showWithdrawModal,
    setShowWithdrawModal,
    withdrawPassword,
    setWithdrawPassword,
    withdrawError,
    profileForm,
    setProfileForm,
    notifications,
    saving,
    bankAccount,
    showExportModal,
    setShowExportModal,
    exporting,
    exportingBankSubmission,
    cancelTarget,
    setCancelTarget,
    claimingGiftId,
    cancelOrderMutation,
    seedreamCancelMutation,
    vaCancelTarget,
    vaRefundTarget,
    handleVACancelOpen,
    handleVACancelClose,
    handleVACancelConfirm,
    handleVARefundOpen,
    handleVARefundClose,
    handleVARefundConfirm,
    handleTabChange,
    copyToClipboard,
    handleCancelOrder,
    handleConfirmCancel,
    handleClaimGift,
    handleExportWithOptions,
    handleExportBankSubmission,
    handleLogout,
    handleUpdateProfile,
    handleToggleNotification,
    handleBankVerified,
    handleWithdraw,
    // MFA
    mfaEnabled,
    showMfaSetupModal, setShowMfaSetupModal,
    mfaQrUrl, setMfaQrUrl, mfaSecret, setMfaSecret,
    handleMfaSetup,
    handleMfaVerify,
    handleMfaDisable,
    mfaProcessing,
    // WebAuthn (Passkey)
    passkeyCredentials,
    passkeyLoading,
    handleRegisterPasskey,
    handleRenamePasskey,
    handleDeletePasskey,
    // Phone change
    handleChangePhone,
  };
};
