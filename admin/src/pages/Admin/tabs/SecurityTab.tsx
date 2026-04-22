import { useState, useEffect, useCallback } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, AlertTriangle, Clock, RefreshCw, Zap, Fingerprint, Trash2, Plus, Globe, Monitor, Pencil, Check, X, Smartphone, KeyRound,
} from 'lucide-react';
import { adminApi, webauthnApi } from '@/api';
import { Badge, Skeleton } from '@/design-system';
import { useToast } from '@/contexts/ToastContext';
import { isWebAuthnSupported, startWebAuthnRegistration } from '@/utils/webauthn';
import type { WebAuthnCredential } from '@/api/manual';

interface PatternRule {
  id: number;
  ruleId: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  blockDurationMinutes: number;
  maxAttempts: number;
  windowMinutes: number;
}

function getRuleIcon(ruleId: string) {
  switch (ruleId) {
    case 'SQL_INJECTION':
    case 'BOT_SCANNER':
      return ShieldAlert;
    case 'LOGIN_BRUTE_FORCE':
      return Shield;
    case 'TRANSACTION_FLOOD':
    case 'RAPID_CART':
      return Zap;
    case 'KYC_ABUSE':
    case 'LARGE_ORDER':
      return AlertTriangle;
    default:
      return Shield;
  }
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  SECURITY: { label: '보안', color: 'red' },
  RATE_LIMIT: { label: '속도 제한', color: 'blue' },
  PATTERN: { label: '패턴', color: 'purple' },
};

/** Admin Passkey Manager (My passkeys) */
const AdminPasskeySection = () => {
  const { showToast } = useToast();
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [credName, setCredName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const loadCreds = useCallback(async () => {
    setLoading(true);
    try {
      const creds = await webauthnApi.getCredentials();
      setCredentials(Array.isArray(creds) ? creds : []);
    } catch {
      setCredentials([]);
      showToast({ message: '패스키 목록을 불러오지 못했습니다', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCreds(); }, [loadCreds]);

  const handleRegister = async () => {
    if (!isWebAuthnSupported()) return;
    setRegistering(true);
    try {
      const options = await webauthnApi.registerBegin();
      const attestation = await startWebAuthnRegistration(options);
      const name = credName.trim() || `관리자 패스키 ${new Date().toLocaleDateString('ko-KR')}`;
      await webauthnApi.registerComplete({ name, credential: attestation });
      setShowNameInput(false);
      setCredName('');
      await loadCreds();
    } catch {
      showToast({ message: '패스키 등록에 실패했습니다', type: 'error' });
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await webauthnApi.deleteCredential(id);
      await loadCreds();
    } catch {
      showToast({ message: '패스키 삭제에 실패했습니다', type: 'error' });
    }
  };

  const handleRename = async () => {
    if (!editingId || !editingName.trim()) return;
    try {
      await webauthnApi.renameCredential(editingId, editingName.trim());
      showToast({ message: '패스키 이름이 변경되었습니다', type: 'success' });
      setEditingId(null);
      setEditingName('');
      await loadCreds();
    } catch {
      showToast({ message: '이름 변경에 실패했습니다', type: 'error' });
    }
  };

  if (!isWebAuthnSupported()) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Fingerprint size={16} className="text-blue-500" />
          <span className="text-sm font-semibold text-slate-700">내 패스키 관리</span>
          <span className="text-xs text-slate-400">{credentials.length}개 등록됨</span>
        </div>
        <button
          type="button"
          onClick={() => setShowNameInput(!showNameInput)}
          className="admin-btn-primary"
          style={{ padding: '4px 10px', fontSize: '12px' }}
        >
          <Plus size={12} /> 패스키 등록
        </button>
      </div>

      {showNameInput && (
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 bg-slate-50">
          <input
            type="text"
            placeholder="패스키 이름 (예: 관리 PC)"
            value={credName}
            onChange={e => setCredName(e.target.value)}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
            autoFocus
          />
          <button
            type="button"
            onClick={handleRegister}
            disabled={registering}
            className="admin-btn-primary"
            style={{ padding: '6px 14px', fontSize: '12px' }}
          >
            {registering ? '등록 중...' : '등록'}
          </button>
          <button
            type="button"
            onClick={() => { setShowNameInput(false); setCredName(''); }}
            className="admin-btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px' }}
          >
            취소
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-4 text-center text-sm text-slate-400">로딩 중...</div>
      ) : credentials.length === 0 ? (
        <div className="p-4 text-center text-sm text-slate-400">
          등록된 패스키가 없습니다. 패스키를 등록하면 비밀번호 없이 로그인할 수 있습니다.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {credentials.map(cred => (
            <div key={cred.id} className="flex items-center justify-between px-4 py-2.5">
              {editingId === cred.id ? (
                <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditingId(null); setEditingName(''); } }}
                    autoFocus
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
                  />
                  <button type="button" onClick={handleRename} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors" aria-label="저장">
                    <Check size={14} />
                  </button>
                  <button type="button" onClick={() => { setEditingId(null); setEditingName(''); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors" aria-label="취소">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">{cred.name}</p>
                  <p className="text-xs text-slate-400">
                    등록: {cred.createdAt ? new Date(cred.createdAt).toLocaleDateString('ko-KR') : '-'}
                    {cred.lastUsedAt ? ` / 최근 사용: ${new Date(cred.lastUsedAt).toLocaleDateString('ko-KR')}` : ''}
                  </p>
                </div>
              )}
              {editingId !== cred.id && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setEditingId(cred.id); setEditingName(cred.name); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                    aria-label={`${cred.name} 이름 변경`}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(cred.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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

      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
        💡 여러 기기에 패스키를 등록하면 기기 분실 시에도 안전합니다.
      </p>
    </div>
  );
};

/** Admin OTP (MFA) Manager */
const AdminOtpSection = () => {
  const { showToast } = useToast();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    adminApi.getMfaStatus().then(data => {
      setMfaEnabled(data?.mfa_enabled ?? false);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSetup = async () => {
    try {
      const data = await adminApi.mfaSetup();
      setQrUrl(data?.qrUrl || '');
      setSecret(data?.secret || '');
      setShowSetupModal(true);
    } catch {
      showToast({ message: 'OTP 설정에 실패했습니다', type: 'error' });
    }
  };

  const handleVerify = async () => {
    try {
      await adminApi.mfaVerify(code);
      setMfaEnabled(true);
      setShowSetupModal(false);
      setCode('');
      showToast({ message: 'Google OTP가 활성화되었습니다', type: 'success' });
    } catch {
      showToast({ message: 'OTP 코드가 올바르지 않습니다', type: 'error' });
    }
  };

  const handleDisable = async () => {
    try {
      await adminApi.mfaDisable(code);
      setMfaEnabled(false);
      setShowDisableModal(false);
      setCode('');
      showToast({ message: 'Google OTP가 비활성화되었습니다', type: 'success' });
    } catch {
      showToast({ message: 'OTP 코드가 올바르지 않습니다', type: 'error' });
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-blue-500" />
          <span className="text-sm font-semibold text-slate-700">Google OTP</span>
          <span className="text-xs text-slate-400">비밀번호 로그인 시 추가 인증</span>
        </div>
        {!loading && (
          <label className="inline-flex items-center cursor-pointer gap-2">
            <span className="text-xs text-slate-500">{mfaEnabled ? '활성' : '비활성'}</span>
            <div
              role="switch"
              aria-checked={mfaEnabled}
              tabIndex={0}
              onClick={() => mfaEnabled ? setShowDisableModal(true) : handleSetup()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { mfaEnabled ? setShowDisableModal(true) : handleSetup(); } }}
              style={{
                width: 36, height: 20, borderRadius: 10,
                background: mfaEnabled ? 'var(--color-primary)' : 'var(--color-grey-300)',
                position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 8, background: 'white',
                position: 'absolute', top: 2, left: mfaEnabled ? 18 : 2,
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </div>
          </label>
        )}
      </div>
      <div className="px-4 py-2.5 text-xs text-slate-500">
        {mfaEnabled ? 'OTP 인증이 활성화되어 있습니다. 비밀번호 로그인 시 인증 앱의 코드가 필요합니다.' : 'OTP를 활성화하면 비밀번호 로그인 시 추가 인증이 필요합니다.'}
      </div>

      {/* Setup Modal */}
      {showSetupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 340, maxWidth: '90vw' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Google OTP 설정</h3>
            {qrUrl && <img src={qrUrl} alt="QR 코드" style={{ width: '100%', marginBottom: 12 }} loading="lazy" decoding="async" />}
            {secret && <p style={{ fontSize: 12, color: '#8b95a1', marginBottom: 12, textAlign: 'center', fontFamily: 'monospace', letterSpacing: 2 }}>{secret}</p>}
            <p style={{ fontSize: 13, color: '#4e5968', marginBottom: 12 }}>인증 앱으로 QR을 스캔하고 생성된 6자리 코드를 입력하세요.</p>
            <input
              type="text" inputMode="numeric" maxLength={6} placeholder="000000"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              style={{ width: '100%', padding: '10px', fontSize: 20, textAlign: 'center', letterSpacing: 6, border: '2px solid #3182f6', borderRadius: 8, boxSizing: 'border-box', marginBottom: 12, fontFamily: 'monospace' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setShowSetupModal(false); setCode(''); }} style={{ flex: 1, padding: '10px', border: '1px solid #d1d6db', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>취소</button>
              <button type="button" onClick={handleVerify} disabled={code.length !== 6} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: code.length !== 6 ? '#8b95a1' : '#3182f6', color: 'white', cursor: code.length !== 6 ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>활성화</button>
            </div>
          </div>
        </div>
      )}

      {/* Disable Modal */}
      {showDisableModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 340, maxWidth: '90vw' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>OTP 비활성화</h3>
            <p style={{ fontSize: 13, color: '#4e5968', marginBottom: 12 }}>현재 인증 코드를 입력하여 OTP를 비활성화합니다.</p>
            <input
              type="text" inputMode="numeric" maxLength={6} placeholder="000000"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              style={{ width: '100%', padding: '10px', fontSize: 20, textAlign: 'center', letterSpacing: 6, border: '2px solid #d1d6db', borderRadius: 8, boxSizing: 'border-box', marginBottom: 12, fontFamily: 'monospace' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setShowDisableModal(false); setCode(''); }} style={{ flex: 1, padding: '10px', border: '1px solid #d1d6db', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>취소</button>
              <button type="button" onClick={handleDisable} disabled={code.length !== 6} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: code.length !== 6 ? '#8b95a1' : '#dc2626', color: 'white', cursor: code.length !== 6 ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>비활성화</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Admin Password Change */
const AdminPasswordChangeSection = () => {
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('모든 필드를 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setSaving(true);
    try {
      await adminApi.changePassword(currentPassword, newPassword);
      showToast({ message: '비밀번호가 변경되었습니다', type: 'success' });
      setShowModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">비밀번호 변경</span>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="admin-btn-secondary"
          style={{ padding: '4px 12px', fontSize: '12px' }}
        >
          변경
        </button>
      </div>
      <div className="px-4 py-2.5 text-xs text-slate-500">주기적인 비밀번호 변경으로 계정을 보호하세요.</div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 360, maxWidth: '90vw' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>비밀번호 변경</h3>
            {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            {[
              { label: '현재 비밀번호', value: currentPassword, onChange: setCurrentPassword },
              { label: '새 비밀번호', value: newPassword, onChange: setNewPassword },
              { label: '새 비밀번호 확인', value: confirmPassword, onChange: setConfirmPassword },
            ].map(({ label, value, onChange }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4e5968', marginBottom: 4 }}>{label}</label>
                <input
                  type="password" value={value} onChange={e => onChange(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 15, border: '1px solid #d1d6db', borderRadius: 8, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => { setShowModal(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setError(''); }} style={{ flex: 1, padding: '10px', border: '1px solid #d1d6db', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>취소</button>
              <button type="button" onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: saving ? '#8b95a1' : '#3182f6', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>{saving ? '변경 중...' : '변경'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Admin IP Whitelist Manager */
interface IPEntry {
  id: number;
  ipAddress: string;
  description: string;
  createdAt: string;
}

const AdminIPWhitelistSection = () => {
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
        adminApi.getIPWhitelist(),
        adminApi.getCurrentIP(),
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
      await adminApi.toggleIPWhitelist(next);
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
      await adminApi.addIPWhitelist(ipInput.trim(), descInput.trim());
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
      await adminApi.deleteIPWhitelist(id);
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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Globe size={16} style={{ color: 'var(--color-primary)' }} />
          <span className="text-sm font-semibold text-slate-700">IP 화이트리스트</span>
          <span className="text-xs text-slate-400">{entries.length}개 등록</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle */}
          <label className="inline-flex items-center cursor-pointer gap-2">
            <span className="text-xs text-slate-500">{enabled ? '활성' : '비활성'}</span>
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
                background: enabled ? 'var(--color-primary)' : 'var(--color-grey-300)',
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
          </label>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="admin-btn-primary"
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            <Plus size={12} /> IP 추가
          </button>
        </div>
      </div>

      {/* Current IP info */}
      {currentIP && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-500">
          <Monitor size={12} />
          현재 접속 IP: <span className="font-mono font-medium text-slate-700">{currentIP}</span>
          {!entries.some(e => e.ipAddress === currentIP) && (
            <button
              type="button"
              onClick={handleAddCurrentIP}
              className="text-xs underline"
              style={{ color: 'var(--color-primary)' }}
            >
              현재 IP 추가
            </button>
          )}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 bg-slate-50">
          <input
            type="text"
            placeholder="IP 주소 (예: 203.0.113.1)"
            value={ipInput}
            onChange={e => setIpInput(e.target.value)}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
            style={{ fontFamily: 'var(--font-family-mono)', minWidth: 160 }}
            autoFocus
          />
          <input
            type="text"
            placeholder="설명 (선택)"
            value={descInput}
            onChange={e => setDescInput(e.target.value)}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
            style={{ minWidth: 120 }}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !ipInput.trim()}
            className="admin-btn-primary"
            style={{ padding: '6px 14px', fontSize: '12px' }}
          >
            {adding ? '추가 중...' : '추가'}
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(false); setIpInput(''); setDescInput(''); }}
            className="admin-btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px' }}
          >
            취소
          </button>
        </div>
      )}

      {/* Entries list */}
      {loading ? (
        <div className="p-4 text-center text-sm text-slate-400">로딩 중...</div>
      ) : entries.length === 0 ? (
        <div className="p-4 text-center text-sm text-slate-400">
          등록된 IP가 없습니다. IP를 등록하면 해당 IP에서만 관리자 패널에 접근할 수 있습니다.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700" style={{ fontFamily: 'var(--font-family-mono)' }}>
                  {entry.ipAddress}
                  {entry.ipAddress === currentIP && (
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-success)' }}>(현재 IP)</span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {entry.description || '설명 없음'}
                  {' · '}
                  {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('ko-KR') : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(entry.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                aria-label={`${entry.ipAddress} 삭제`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Warning */}
      {enabled && (
        <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 flex items-center gap-1.5">
          <AlertTriangle size={12} />
          화이트리스트가 활성화되어 있습니다. 등록되지 않은 IP에서는 관리자 기능을 사용할 수 없습니다.
        </div>
      )}
    </div>
  );
};

const SecurityTab = () => {
  const { showToast } = useToast();
  const [rules, setRules] = useState<PatternRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getPatternRules();
      setRules(Array.isArray(res) ? res : res?.data || []);
    } catch {
      showToast({ message: '보안 규칙을 불러오지 못했습니다', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleToggle = async (rule: PatternRule) => {
    const newEnabled = !rule.enabled;
    const prev = [...rules];

    // Optimistic update
    setRules(r => r.map(x => x.ruleId === rule.ruleId ? { ...x, enabled: newEnabled } : x));
    setTogglingId(rule.ruleId);

    try {
      await adminApi.togglePatternRule(rule.ruleId, newEnabled);
    } catch {
      setRules(prev);
      showToast({ message: '규칙 변경에 실패했습니다', type: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  const enabledCount = rules.filter(r => r.enabled).length;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton height={40} style={{ borderRadius: 12 }} />
        <Skeleton height={400} style={{ borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* My Passkeys */}
      <AdminPasskeySection />

      {/* OTP Management */}
      <AdminOtpSection />

      {/* Password Change */}
      <AdminPasswordChangeSection />

      {/* IP Whitelist */}
      <AdminIPWhitelistSection />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
            <Shield size={18} className="text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">보안 및 패턴 탐지</h2>
            <p className="text-xs text-slate-500">비정상 패턴을 탐지하여 자동 차단하는 규칙을 관리합니다</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>{enabledCount}/{rules.length} 활성화</span>
          </div>
          <button type="button" onClick={fetchRules} disabled={loading} className="admin-btn-secondary">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {/* Rules Table */}
      <div className="admin-table-card">
        <table className="table w-full">
          <thead>
            <tr>
              <th>규칙명</th>
              <th>설명</th>
              <th style={{ textAlign: 'center' }}>카테고리</th>
              <th style={{ textAlign: 'center' }}>차단 시간</th>
              <th style={{ textAlign: 'center' }}>임계값</th>
              <th style={{ textAlign: 'center' }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-grey-500)' }}>
                  <Shield size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                  <p>등록된 패턴 규칙이 없습니다</p>
                </td>
              </tr>
            ) : (
              rules.map(rule => {
                const Icon = getRuleIcon(rule.ruleId);
                const cat = CATEGORY_LABELS[rule.category] || { label: rule.category, color: 'gray' };
                const isToggling = togglingId === rule.ruleId;

                return (
                  <tr key={rule.ruleId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon
                          size={16}
                          style={{ flexShrink: 0, color: rule.enabled ? 'var(--color-primary)' : 'var(--color-grey-400)' }}
                        />
                        <span style={{ fontWeight: 600 }}>{rule.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-grey-500)', fontSize: 13 }}>
                      {rule.description}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`admin-badge ${cat.color}`}>{cat.label}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                      {rule.blockDurationMinutes > 0 ? `${rule.blockDurationMinutes}분` : '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                      {rule.maxAttempts}회/{rule.windowMinutes}분
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => handleToggle(rule)}
                          disabled={isToggling}
                          className="sr-only"
                          aria-label={`${rule.name} ${rule.enabled ? '비활성화' : '활성화'}`}
                        />
                        <div
                          style={{
                            width: 36,
                            height: 20,
                            borderRadius: 10,
                            background: rule.enabled ? 'var(--color-primary)' : 'var(--color-grey-300)',
                            position: 'relative',
                            transition: 'background 0.2s',
                            opacity: isToggling ? 0.5 : 1,
                          }}
                        >
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              background: 'white',
                              position: 'absolute',
                              top: 2,
                              left: rule.enabled ? 18 : 2,
                              transition: 'left 0.2s',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                            }}
                          />
                        </div>
                      </label>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 안내 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <AlertTriangle size={14} className="text-amber-500" />
          주의사항
        </h4>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-500">
          <li>보안 규칙(SQL 인젝션, 봇 차단)은 항상 활성화 상태를 유지하는 것을 권장합니다.</li>
          <li>규칙 비활성화 시 해당 패턴에 대한 차단이 해제됩니다.</li>
          <li>차단된 사용자는 설정된 차단 시간이 지나면 자동으로 해제됩니다.</li>
          <li>임계값과 차단 시간은 서버에서 관리되며, 변경이 필요한 경우 개발팀에 요청하세요.</li>
        </ul>
      </div>
    </div>
  );
};

export default SecurityTab;
