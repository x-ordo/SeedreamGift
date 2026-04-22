/**
 * @file ProfileTab.tsx
 * @description Partner profile management — read-only info + editable fields + passkey management
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Fingerprint, Trash2, Plus, Globe, Monitor, AlertTriangle, Pencil, Check, X, Smartphone, KeyRound } from 'lucide-react';
import { partnerApi, webauthnApi, mfaApi, passwordApi } from '@/api/manual';
import type { WebAuthnCredential } from '@/api/manual';
import { isWebAuthnSupported, startWebAuthnRegistration } from '@/utils/webauthn';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileData {
  id: number;
  email: string;
  name: string;
  phone: string;
  role: string;
  partnerTier?: string;
  totalTransactionVolume?: number;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  createdAt: string;
}

const ProfileTab: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Business info state
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  const [businessForm, setBusinessForm] = useState({
    businessName: '',
    businessRegNo: '',
    representativeName: '',
    telecomSalesNo: '',
    businessAddress: '',
    businessType: '',
    businessCategory: '',
  });
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessEditing, setBusinessEditing] = useState(false);

  // Passkey state
  const [passkeyCredentials, setPasskeyCredentials] = useState<WebAuthnCredential[]>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [showPasskeyInput, setShowPasskeyInput] = useState(false);
  const [passkeyName, setPasskeyName] = useState('');
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null);
  const [editingPasskeyName, setEditingPasskeyName] = useState('');

  // OTP (MFA) state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [showMfaDisable, setShowMfaDisable] = useState(false);
  const [mfaQrUrl, setMfaQrUrl] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const passwordModalRef = useRef<HTMLDivElement>(null);
  const passwordModalPrevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (showPasswordModal) {
      passwordModalPrevFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        const focusable = passwordModalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.[0]?.focus();
      });
    } else if (passwordModalPrevFocusRef.current) {
      passwordModalPrevFocusRef.current.focus();
      passwordModalPrevFocusRef.current = null;
    }
  }, [showPasswordModal]);

  const passwordKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !passwordModalRef.current) return;
    const focusable = passwordModalRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await partnerApi.getProfile();
        setProfile(data);
        setEditName(data.name || '');
        setEditPhone(data.phone || '');
      } catch {
        // Fallback to auth user data
        if (user) {
          setProfile({
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone || '',
            role: user.role,
            createdAt: '',
          });
          setEditName(user.name || '');
          setEditPhone(user.phone || '');
        }
      } finally {
        setLoading(false);
      }
    };

    const loadBusinessInfo = async () => {
      try {
        const bizData = await partnerApi.getBusinessInfo();
        if (bizData) {
          setBusinessInfo(bizData);
          setBusinessForm({
            businessName: bizData.businessName || '',
            businessRegNo: bizData.businessRegNo || '',
            representativeName: bizData.representativeName || '',
            telecomSalesNo: bizData.telecomSalesNo || '',
            businessAddress: bizData.businessAddress || '',
            businessType: bizData.businessType || '',
            businessCategory: bizData.businessCategory || '',
          });
        }
      } catch { /* no business info yet */ }
    };

    loadProfile();
    loadBusinessInfo();
    // Load MFA status
    mfaApi.getStatus().then((data: any) => {
      setMfaEnabled(data?.mfa_enabled ?? false);
    }).catch(() => {});
  }, [user]);

  // Passkey handlers
  const loadPasskeys = useCallback(async () => {
    try {
      const creds = await webauthnApi.getCredentials();
      setPasskeyCredentials(Array.isArray(creds) ? creds : []);
    } catch {
      setPasskeyCredentials([]);
    }
  }, []);

  useEffect(() => { loadPasskeys(); }, [loadPasskeys]);

  const handleRegisterPasskey = async () => {
    if (!isWebAuthnSupported()) {
      showToast({ message: '이 브라우저는 패스키를 지원하지 않습니다.', type: 'error' });
      return;
    }
    setPasskeyLoading(true);
    try {
      const options = await webauthnApi.registerBegin();
      const attestation = await startWebAuthnRegistration(options);
      const name = passkeyName.trim() || `패스키 ${new Date().toLocaleDateString('ko-KR')}`;
      await webauthnApi.registerComplete({ name, credential: attestation });
      showToast({ message: '패스키가 등록되었습니다.', type: 'success' });
      setShowPasskeyInput(false);
      setPasskeyName('');
      await loadPasskeys();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : '패스키 등록에 실패했습니다.', type: 'error' });
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleDeletePasskey = async (credId: string) => {
    setPasskeyLoading(true);
    try {
      await webauthnApi.deleteCredential(credId);
      showToast({ message: '패스키가 삭제되었습니다.', type: 'success' });
      await loadPasskeys();
    } catch {
      showToast({ message: '패스키 삭제에 실패했습니다.', type: 'error' });
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleRenamePasskey = async () => {
    if (!editingPasskeyId || !editingPasskeyName.trim()) return;
    try {
      await webauthnApi.renameCredential(editingPasskeyId, editingPasskeyName.trim());
      showToast({ message: '패스키 이름이 변경되었습니다.', type: 'success' });
      setEditingPasskeyId(null);
      setEditingPasskeyName('');
      await loadPasskeys();
    } catch {
      showToast({ message: '이름 변경에 실패했습니다.', type: 'error' });
    }
  };

  const handleMfaSetup = async () => {
    try {
      const data = await mfaApi.setup();
      setMfaQrUrl(data?.qrUrl || '');
      setMfaSecret(data?.secret || '');
      setMfaCode('');
      setShowMfaSetup(true);
    } catch {
      showToast({ message: 'OTP 설정에 실패했습니다.', type: 'error' });
    }
  };

  const handleMfaVerify = async () => {
    try {
      await mfaApi.verify(mfaCode);
      setMfaEnabled(true);
      setShowMfaSetup(false);
      setMfaCode('');
      showToast({ message: 'Google OTP가 활성화되었습니다.', type: 'success' });
    } catch {
      showToast({ message: 'OTP 코드가 올바르지 않습니다.', type: 'error' });
    }
  };

  const handleMfaDisable = async () => {
    try {
      await mfaApi.disable(mfaCode);
      setMfaEnabled(false);
      setShowMfaDisable(false);
      setMfaCode('');
      showToast({ message: 'Google OTP가 비활성화되었습니다.', type: 'success' });
    } catch {
      showToast({ message: 'OTP 코드가 올바르지 않습니다.', type: 'error' });
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('모든 필드를 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setPasswordSaving(true);
    try {
      await passwordApi.change(currentPassword, newPassword);
      showToast({ message: '비밀번호가 변경되었습니다.', type: 'success' });
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPasswordError('비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인해주세요.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSaveBusinessInfo = async () => {
    if (!businessForm.businessName.trim() || !businessForm.businessRegNo.trim() || !businessForm.representativeName.trim()) {
      showToast({ message: '필수 항목을 입력해주세요.', type: 'warning' });
      return;
    }
    if (businessForm.businessRegNo.replace(/\D/g, '').length !== 10) {
      showToast({ message: '사업자등록번호는 10자리입니다.', type: 'warning' });
      return;
    }
    setBusinessSaving(true);
    try {
      const result = await partnerApi.updateBusinessInfo({
        ...businessForm,
        businessRegNo: businessForm.businessRegNo.replace(/\D/g, ''),
      });
      setBusinessInfo(result);
      setBusinessEditing(false);
      showToast({ message: '사업자 정보가 저장되었습니다.', type: 'success' });
    } catch {
      showToast({ message: '사업자 정보 저장에 실패했습니다.', type: 'error' });
    } finally {
      setBusinessSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      showToast({ message: '이름을 입력해주세요.', type: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await partnerApi.updateProfile({ name: editName, phone: editPhone });
      showToast({ message: '프로필이 수정되었습니다.', type: 'success' });
      setProfile(prev => prev ? { ...prev, name: editName, phone: editPhone } : null);
    } catch {
      showToast({ message: '프로필 수정에 실패했습니다.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="partner-tab">
        <div role="status" aria-busy="true" style={{ display: 'flex', justifyContent: 'center', padding: '48px 0', color: 'var(--color-grey-500)' }}>
          로딩 중...
        </div>
      </div>
    );
  }

  /** Mask account number: show first 3 and last 2 */
  const maskAccountNumber = (num?: string) => {
    if (!num) return '-';
    if (num.length <= 5) return num;
    return num.slice(0, 3) + '*'.repeat(num.length - 5) + num.slice(-2);
  };

  return (
    <div className="partner-tab">
      {/* Read-only Info */}
      <div>
        <h3 className="partner-section-title" style={{ marginBottom: '12px' }}>계정 정보</h3>
        <div className="partner-info-card">
          <div className="partner-info-row">
            <span className="partner-info-label">이메일</span>
            <span className="partner-info-value">{profile?.email || '-'}</span>
          </div>
          <div className="partner-info-row">
            <span className="partner-info-label">파트너 티어</span>
            <span className="partner-info-value">
              <span className="partner-badge green">{profile?.partnerTier || 'STANDARD'}</span>
            </span>
          </div>
          <div className="partner-info-row">
            <span className="partner-info-label">가입일</span>
            <span className="partner-info-value">
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('ko-KR') : '-'}
            </span>
          </div>
          <div className="partner-info-row">
            <span className="partner-info-label">누적 거래량</span>
            <span className="partner-info-value tabular-nums">
              {profile?.totalTransactionVolume
                ? `${Number(profile.totalTransactionVolume).toLocaleString()}원`
                : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Editable Fields */}
      <div>
        <h3 className="partner-section-title" style={{ marginBottom: '12px' }}>기본 정보 수정</h3>
        <div className="partner-info-card">
          <div className="partner-form-group">
            <label className="partner-form-label">이름</label>
            <input
              type="text"
              className="partner-form-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="이름"
            />
          </div>
          <div className="partner-form-group">
            <label className="partner-form-label">전화번호</label>
            <input
              type="tel"
              inputMode="numeric"
              className="partner-form-input"
              value={editPhone}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                let formatted = digits;
                if (digits.length > 7) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
                else if (digits.length > 3) formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                setEditPhone(formatted);
              }}
              placeholder="010-0000-0000"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" className="partner-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>

      {/* 사업자 정보 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 className="partner-section-title" style={{ marginBottom: 0 }}>사업자 정보</h3>
          {!businessEditing && (
            <button
              type="button"
              onClick={() => setBusinessEditing(true)}
              style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--color-grey-200)', background: 'white', fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer' }}
            >
              {businessInfo ? '수정' : '등록'}
            </button>
          )}
        </div>

        {businessInfo && !businessEditing ? (
          <div className="partner-info-card">
            <div className="partner-info-row">
              <span className="partner-info-label">상호(회사명)</span>
              <span className="partner-info-value">{businessInfo.businessName || '-'}</span>
            </div>
            <div className="partner-info-row">
              <span className="partner-info-label">사업자등록번호</span>
              <span className="partner-info-value" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{businessInfo.businessRegNo || '-'}</span>
            </div>
            <div className="partner-info-row">
              <span className="partner-info-label">대표자명</span>
              <span className="partner-info-value">{businessInfo.representativeName || '-'}</span>
            </div>
            <div className="partner-info-row">
              <span className="partner-info-label">통신판매업신고번호</span>
              <span className="partner-info-value">{businessInfo.telecomSalesNo || '-'}</span>
            </div>
            <div className="partner-info-row">
              <span className="partner-info-label">사업장 주소</span>
              <span className="partner-info-value">{businessInfo.businessAddress || '-'}</span>
            </div>
            <div className="partner-info-row">
              <span className="partner-info-label">업태 / 종목</span>
              <span className="partner-info-value">{[businessInfo.businessType, businessInfo.businessCategory].filter(Boolean).join(' / ') || '-'}</span>
            </div>
            <div className="partner-info-row">
              <span className="partner-info-label">검증 상태</span>
              <span className="partner-info-value" style={{ color: businessInfo.verificationStatus === 'VERIFIED' ? 'var(--color-success)' : businessInfo.verificationStatus === 'REJECTED' ? 'var(--color-error)' : 'var(--color-warning)', fontWeight: 600 }}>
                {businessInfo.verificationStatus === 'VERIFIED' ? '인증 완료' : businessInfo.verificationStatus === 'REJECTED' ? '반려' : '검토 대기'}
              </span>
            </div>
          </div>
        ) : businessEditing ? (
          <div className="partner-info-card" style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-700)', marginBottom: '6px' }}>상호(회사명) *</label>
                <input type="text" value={businessForm.businessName} onChange={e => setBusinessForm(f => ({ ...f, businessName: e.target.value }))} placeholder="회사명" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-grey-200)', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-700)', marginBottom: '6px' }}>사업자등록번호 *</label>
                <input type="text" value={businessForm.businessRegNo} onChange={e => setBusinessForm(f => ({ ...f, businessRegNo: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="1234567890" inputMode="numeric" maxLength={10} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-grey-200)', fontSize: '14px', fontFamily: 'var(--font-mono, monospace)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-700)', marginBottom: '6px' }}>대표자명 *</label>
                <input type="text" value={businessForm.representativeName} onChange={e => setBusinessForm(f => ({ ...f, representativeName: e.target.value }))} placeholder="홍길동" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-grey-200)', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-700)', marginBottom: '6px' }}>통신판매업신고번호</label>
                <input type="text" value={businessForm.telecomSalesNo} onChange={e => setBusinessForm(f => ({ ...f, telecomSalesNo: e.target.value }))} placeholder="2024-서울강남-01234" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-grey-200)', fontSize: '14px' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-700)', marginBottom: '6px' }}>사업장 주소</label>
                <input type="text" value={businessForm.businessAddress} onChange={e => setBusinessForm(f => ({ ...f, businessAddress: e.target.value }))} placeholder="서울시 강남구 ..." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-grey-200)', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-700)', marginBottom: '6px' }}>업태</label>
                <input type="text" value={businessForm.businessType} onChange={e => setBusinessForm(f => ({ ...f, businessType: e.target.value }))} placeholder="도소매" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-grey-200)', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-700)', marginBottom: '6px' }}>종목</label>
                <input type="text" value={businessForm.businessCategory} onChange={e => setBusinessForm(f => ({ ...f, businessCategory: e.target.value }))} placeholder="상품권" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-grey-200)', fontSize: '14px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" onClick={() => setBusinessEditing(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-grey-200)', background: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
              <button type="button" onClick={handleSaveBusinessInfo} disabled={businessSaving} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: businessSaving ? 0.6 : 1 }}>{businessSaving ? '저장 중...' : '저장'}</button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-grey-400)', marginTop: '12px' }}>* 사업자 정보를 수정하면 검증 상태가 초기화되어 관리자 재확인이 필요합니다.</p>
          </div>
        ) : (
          <div className="partner-info-card" style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--color-grey-500)', marginBottom: '12px' }}>등록된 사업자 정보가 없습니다.</p>
            <button type="button" onClick={() => setBusinessEditing(true)} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>사업자 정보 등록</button>
          </div>
        )}
      </div>

      {/* Bank Info (read-only) */}
      <div>
        <h3 className="partner-section-title" style={{ marginBottom: '12px' }}>정산 계좌</h3>
        <div className="partner-info-card">
          <div className="partner-info-row">
            <span className="partner-info-label">은행명</span>
            <span className="partner-info-value">{profile?.bankName || '-'}</span>
          </div>
          <div className="partner-info-row">
            <span className="partner-info-label">계좌번호</span>
            <span className="partner-info-value" style={{ fontFamily: 'var(--font-family-mono)' }}>
              {maskAccountNumber(profile?.accountNumber)}
            </span>
          </div>
          <div className="partner-info-row">
            <span className="partner-info-label">예금주</span>
            <span className="partner-info-value">{profile?.accountHolder || '-'}</span>
          </div>
          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--color-grey-50)', borderRadius: '8px', fontSize: '12px', color: 'var(--color-grey-500)' }}>
            정산 계좌 변경은 관리자에게 문의해주세요.
          </div>
        </div>
      </div>

      {/* Passkey Management */}
      {isWebAuthnSupported() && (
        <div>
          <h3 className="partner-section-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Fingerprint size={16} />
            패스키 관리
          </h3>
          <div className="partner-info-card">
            <p style={{ fontSize: '13px', color: 'var(--color-grey-500)', marginBottom: '12px' }}>
              지문, Face ID, 보안 키로 비밀번호 없이 로그인할 수 있습니다.
            </p>

            {/* Registered credentials list */}
            {passkeyCredentials.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                {passkeyCredentials.map(cred => (
                  <div
                    key={cred.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: '8px', background: 'var(--color-grey-50)',
                      marginBottom: '4px',
                    }}
                  >
                    {editingPasskeyId === cred.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, marginRight: '6px' }}>
                        <input
                          type="text"
                          value={editingPasskeyName}
                          onChange={e => setEditingPasskeyName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenamePasskey(); if (e.key === 'Escape') { setEditingPasskeyId(null); setEditingPasskeyName(''); } }}
                          autoFocus
                          className="partner-form-input"
                          style={{ flex: 1, padding: '4px 8px', height: 32, fontSize: '13px' }}
                        />
                        <button type="button" onClick={handleRenamePasskey} style={{ padding: '4px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--color-success)', cursor: 'pointer' }} aria-label="저장"><Check size={14} /></button>
                        <button type="button" onClick={() => { setEditingPasskeyId(null); setEditingPasskeyName(''); }} style={{ padding: '4px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--color-grey-400)', cursor: 'pointer' }} aria-label="취소"><X size={14} /></button>
                      </div>
                    ) : (
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-800)' }}>{cred.name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--color-grey-400)' }}>
                          {cred.createdAt ? new Date(cred.createdAt).toLocaleDateString('ko-KR') : ''}
                          {cred.lastUsedAt ? ` · 최근: ${new Date(cred.lastUsedAt).toLocaleDateString('ko-KR')}` : ''}
                        </p>
                      </div>
                    )}
                    {editingPasskeyId !== cred.id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <button
                          type="button"
                          onClick={() => { setEditingPasskeyId(cred.id); setEditingPasskeyName(cred.name); }}
                          disabled={passkeyLoading}
                          style={{ padding: '4px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--color-grey-400)', cursor: 'pointer' }}
                          aria-label={`${cred.name} 이름 변경`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePasskey(cred.id)}
                          disabled={passkeyLoading}
                          style={{ padding: '4px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--color-grey-400)', cursor: 'pointer' }}
                          aria-label={`${cred.name} 삭제`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Register new passkey */}
            {showPasskeyInput ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="partner-form-input"
                  placeholder="패스키 이름 (예: 회사 PC)"
                  value={passkeyName}
                  onChange={e => setPasskeyName(e.target.value)}
                  style={{ flex: 1 }}
                  autoFocus
                />
                <button type="button" className="partner-btn-primary" onClick={handleRegisterPasskey} disabled={passkeyLoading}>
                  {passkeyLoading ? '등록 중...' : '등록'}
                </button>
                <button
                  type="button"
                  className="partner-btn-secondary"
                  onClick={() => { setShowPasskeyInput(false); setPasskeyName(''); }}
                  style={{ padding: '6px 12px' }}
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="partner-btn-primary"
                onClick={() => setShowPasskeyInput(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} />
                새 패스키 등록
              </button>
            )}
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, marginBottom: 16 }}>
        💡 여러 기기에 패스키를 등록하면 기기 분실 시에도 안전합니다.
      </p>

      {/* OTP (MFA) Management */}
      <div>
        <h3 className="partner-section-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Smartphone size={16} />
          Google OTP
        </h3>
        <div className="partner-info-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-800)' }}>
                {mfaEnabled ? 'OTP 활성화됨' : 'OTP 비활성화됨'}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-grey-500)', marginTop: '2px' }}>
                비밀번호 로그인 시 추가 인증
              </p>
            </div>
            <div
              role="switch"
              aria-checked={mfaEnabled}
              tabIndex={0}
              onClick={() => mfaEnabled ? (setMfaCode(''), setShowMfaDisable(true)) : handleMfaSetup()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { mfaEnabled ? (setMfaCode(''), setShowMfaDisable(true)) : handleMfaSetup(); } }}
              style={{
                width: 40, height: 22, borderRadius: 11,
                background: mfaEnabled ? 'var(--color-success)' : 'var(--color-grey-300)',
                position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 9, background: 'white',
                position: 'absolute', top: 2, left: mfaEnabled ? 20 : 2,
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* OTP Setup Modal */}
      {showMfaSetup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 340, maxWidth: '90vw' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Google OTP 설정</h3>
            {mfaQrUrl && <img src={mfaQrUrl} alt="QR 코드" style={{ width: '100%', marginBottom: 12 }} />}
            {mfaSecret && <p style={{ fontSize: 12, color: '#8b95a1', marginBottom: 12, textAlign: 'center', fontFamily: 'monospace', letterSpacing: 2 }}>{mfaSecret}</p>}
            <p style={{ fontSize: 13, color: '#4e5968', marginBottom: 12 }}>인증 앱으로 QR을 스캔하고 생성된 6자리 코드를 입력하세요.</p>
            <input
              type="text" inputMode="numeric" maxLength={6} placeholder="000000"
              value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              style={{ width: '100%', padding: '10px', fontSize: 20, textAlign: 'center', letterSpacing: 6, border: '2px solid var(--color-success)', borderRadius: 8, boxSizing: 'border-box', marginBottom: 12, fontFamily: 'monospace' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setShowMfaSetup(false); setMfaCode(''); }} style={{ flex: 1, padding: '10px', border: '1px solid var(--color-grey-200)', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>취소</button>
              <button type="button" onClick={handleMfaVerify} disabled={mfaCode.length !== 6} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: mfaCode.length !== 6 ? 'var(--color-grey-300)' : 'var(--color-success)', color: 'white', cursor: mfaCode.length !== 6 ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>활성화</button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Disable Modal */}
      {showMfaDisable && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 340, maxWidth: '90vw' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>OTP 비활성화</h3>
            <p style={{ fontSize: 13, color: '#4e5968', marginBottom: 12 }}>현재 인증 코드를 입력하여 OTP를 비활성화합니다.</p>
            <input
              type="text" inputMode="numeric" maxLength={6} placeholder="000000"
              value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              style={{ width: '100%', padding: '10px', fontSize: 20, textAlign: 'center', letterSpacing: 6, border: '2px solid var(--color-grey-200)', borderRadius: 8, boxSizing: 'border-box', marginBottom: 12, fontFamily: 'monospace' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setShowMfaDisable(false); setMfaCode(''); }} style={{ flex: 1, padding: '10px', border: '1px solid var(--color-grey-200)', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>취소</button>
              <button type="button" onClick={handleMfaDisable} disabled={mfaCode.length !== 6} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: mfaCode.length !== 6 ? 'var(--color-grey-300)' : 'var(--color-error)', color: 'white', cursor: mfaCode.length !== 6 ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>비활성화</button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change */}
      <div>
        <h3 className="partner-section-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={16} />
          비밀번호 변경
        </h3>
        <div className="partner-info-card">
          <p style={{ fontSize: '13px', color: 'var(--color-grey-500)', marginBottom: '12px' }}>
            주기적인 비밀번호 변경으로 계정을 보호하세요.
          </p>
          <button type="button" className="partner-btn-secondary" onClick={() => setShowPasswordModal(true)} style={{ padding: '8px 16px' }}>
            비밀번호 변경
          </button>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            ref={passwordModalRef}
            onKeyDown={passwordKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="비밀번호 변경"
            style={{ background: 'white', borderRadius: 12, padding: 24, width: 360, maxWidth: '90vw' }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>비밀번호 변경</h3>
            {passwordError && (
              <p id="password-modal-error" role="alert" style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 12 }}>{passwordError}</p>
            )}
            {[
              { label: '현재 비밀번호', id: 'pwd-current', value: currentPassword, onChange: setCurrentPassword },
              { label: '새 비밀번호', id: 'pwd-new', value: newPassword, onChange: setNewPassword },
              { label: '새 비밀번호 확인', id: 'pwd-confirm', value: confirmPassword, onChange: setConfirmPassword },
            ].map(({ label, id, value, onChange }) => (
              <div key={id} style={{ marginBottom: 12 }}>
                <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-grey-700)', marginBottom: 4 }}>{label}</label>
                <input
                  id={id}
                  type="password"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  className="partner-form-input"
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? 'password-modal-error' : undefined}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => { setShowPasswordModal(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); }} style={{ flex: 1, padding: '10px', border: '1px solid var(--color-grey-200)', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>취소</button>
              <button type="button" onClick={handleChangePassword} disabled={passwordSaving} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: passwordSaving ? 'var(--color-grey-300)' : 'var(--color-primary)', color: 'white', cursor: passwordSaving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>{passwordSaving ? '변경 중...' : '변경'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 등록 문서 섹션 */}
      <section className="partner-section">
        <h3 className="partner-section-title" style={{ marginBottom: '12px' }}>등록 문서</h3>
        <PartnerDocumentList />
      </section>

      {/* IP Whitelist */}
      <PartnerIPWhitelistSection />
    </div>
  );
};

// ─────────────────────────────────────────
// Partner Document List (read-only)
// ─────────────────────────────────────────

interface PartnerDocument {
  id: number;
  fileName: string;
  category: string;
  createdAt: string;
}

const PartnerDocumentList = () => {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<PartnerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const data = await partnerApi.getMyDocuments();
        const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        setDocuments(items);
      } catch {
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, []);

  const handleDownload = async (doc: PartnerDocument) => {
    setDownloading(doc.id);
    try {
      const response = await partnerApi.downloadDocument(doc.id);
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast({ message: '파일 다운로드에 실패했습니다.', type: 'error' });
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="partner-info-card" style={{ textAlign: 'center', padding: '20px 0', fontSize: '13px', color: 'var(--color-grey-400)' }}>
        로딩 중...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="partner-info-card" style={{ textAlign: 'center', padding: '24px 0', fontSize: '13px', color: 'var(--color-grey-400)' }}>
        등록된 문서가 없습니다.
      </div>
    );
  }

  return (
    <div className="partner-info-card" style={{ padding: 0, overflow: 'hidden' }}>
      {documents.map((doc, idx) => (
        <div
          key={doc.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: idx < documents.length - 1 ? '1px solid var(--color-grey-100)' : 'none',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-grey-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.fileName}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--color-grey-400)', marginTop: '2px' }}>
              {doc.category}
              {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString('ko-KR')}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="partner-btn-secondary"
            onClick={() => handleDownload(doc)}
            disabled={downloading === doc.id}
            style={{ fontSize: '12px', padding: '4px 10px', marginLeft: '12px', flexShrink: 0 }}
          >
            {downloading === doc.id ? '...' : '다운로드'}
          </button>
        </div>
      ))}
    </div>
  );
};

/** Partner IP Whitelist Manager */
interface IPEntry {
  id: number;
  ipAddress: string;
  description: string;
  createdAt: string;
}

const PartnerIPWhitelistSection = () => {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<IPEntry[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentIP, setCurrentIP] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wl, ipRes] = await Promise.all([
        partnerApi.getIPWhitelist(),
        partnerApi.getCurrentIP(),
      ]);
      setEntries(Array.isArray(wl.entries) ? wl.entries : []);
      setEnabled(!!wl.enabled);
      setCurrentIP(ipRes.ip || '');
    } catch {
      showToast({ message: 'IP 화이트리스트 조회 실패', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async () => {
    const next = !enabled;
    if (next && entries.length === 0) {
      showToast({ message: 'IP를 최소 1개 등록한 후 활성화할 수 있습니다', type: 'warning' });
      return;
    }
    try {
      await partnerApi.toggleIPWhitelist(next);
      setEnabled(next);
      showToast({ message: next ? 'IP 화이트리스트 활성화' : 'IP 화이트리스트 비활성화', type: 'success' });
    } catch {
      showToast({ message: '설정 변경 실패', type: 'error' });
    }
  };

  const handleAdd = async () => {
    if (!ipInput.trim()) return;
    setAdding(true);
    try {
      await partnerApi.addIPWhitelist(ipInput.trim(), descInput.trim());
      setIpInput('');
      setDescInput('');
      setShowForm(false);
      await loadData();
      showToast({ message: 'IP 추가 완료', type: 'success' });
    } catch (err: any) {
      showToast({ message: err?.response?.data?.message || 'IP 추가 실패', type: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await partnerApi.deleteIPWhitelist(id);
      await loadData();
    } catch {
      showToast({ message: 'IP 삭제 실패', type: 'error' });
    }
  };

  const handleAddCurrentIP = () => {
    if (currentIP) {
      setIpInput(currentIP);
      setDescInput('현재 접속 IP');
      setShowForm(true);
    }
  };

  return (
    <div>
      <h3 className="partner-section-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Globe size={16} />
        IP 화이트리스트
      </h3>
      <div className="partner-info-card">
        <p style={{ fontSize: '13px', color: 'var(--color-grey-500)', marginBottom: '12px' }}>
          허용된 IP 주소에서만 파트너 기능에 접근할 수 있도록 제한합니다.
        </p>

        {/* Toggle + Add */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggle}
              className="sr-only"
              aria-label="IP 화이트리스트 활성화"
            />
            <div
              style={{
                width: 36, height: 20, borderRadius: 10,
                background: enabled ? 'var(--color-success)' : 'var(--color-grey-300)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div
                style={{
                  width: 16, height: 16, borderRadius: 8, background: 'white',
                  position: 'absolute', top: 2, left: enabled ? 18 : 2,
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }}
              />
            </div>
            <span style={{ fontSize: '13px', color: enabled ? 'var(--color-success)' : 'var(--color-grey-500)' }}>
              {enabled ? '활성화됨' : '비활성화'}
            </span>
          </label>
          <button
            type="button"
            className="partner-btn-primary"
            onClick={() => setShowForm(!showForm)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
          >
            <Plus size={14} /> IP 추가
          </button>
        </div>

        {/* Current IP */}
        {currentIP && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: '8px', background: 'var(--color-grey-50)',
            fontSize: '12px', color: 'var(--color-grey-500)', marginBottom: '12px',
          }}>
            <Monitor size={12} />
            현재 접속 IP: <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 600, color: 'var(--color-grey-700)' }}>{currentIP}</span>
            {!entries.some(e => e.ipAddress === currentIP) && (
              <button
                type="button"
                onClick={handleAddCurrentIP}
                style={{ fontSize: '12px', textDecoration: 'underline', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                현재 IP 추가
              </button>
            )}
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
            <input
              type="text"
              className="partner-form-input"
              placeholder="IP 주소 (예: 203.0.113.1)"
              value={ipInput}
              onChange={e => setIpInput(e.target.value)}
              style={{ flex: 1, fontFamily: 'var(--font-family-mono)' }}
              autoFocus
            />
            <input
              type="text"
              className="partner-form-input"
              placeholder="설명"
              value={descInput}
              onChange={e => setDescInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" className="partner-btn-primary" onClick={handleAdd} disabled={adding || !ipInput.trim()}>
              {adding ? '...' : '추가'}
            </button>
            <button
              type="button"
              className="partner-btn-secondary"
              onClick={() => { setShowForm(false); setIpInput(''); setDescInput(''); }}
              style={{ padding: '6px 12px' }}
            >
              취소
            </button>
          </div>
        )}

        {/* Entries list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '13px', color: 'var(--color-grey-400)' }}>로딩 중...</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '13px', color: 'var(--color-grey-400)' }}>
            등록된 IP가 없습니다.
          </div>
        ) : (
          <div>
            {entries.map(entry => (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: '8px', background: 'var(--color-grey-50)',
                  marginBottom: '4px',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-family-mono)', color: 'var(--color-grey-800)' }}>
                    {entry.ipAddress}
                    {entry.ipAddress === currentIP && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 400, color: 'var(--color-success)' }}>(현재 IP)</span>
                    )}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--color-grey-400)' }}>
                    {entry.description || '설명 없음'}
                    {' · '}
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('ko-KR') : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  style={{
                    padding: '4px', borderRadius: '6px', border: 'none', background: 'transparent',
                    color: 'var(--color-grey-400)', cursor: 'pointer',
                  }}
                  aria-label={`${entry.ipAddress} 삭제`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Warning when enabled */}
        {enabled && (
          <div style={{
            marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
            background: 'var(--color-yellow-50)', border: '1px solid var(--color-yellow-200)',
            fontSize: '12px', color: 'var(--color-yellow-800)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <AlertTriangle size={12} />
            화이트리스트가 활성화되어 있습니다. 등록되지 않은 IP에서는 파트너 기능을 사용할 수 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileTab;
