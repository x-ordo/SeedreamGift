import React, { useState, useEffect } from 'react';
import { Shield, Lock, RefreshCw, Save } from 'lucide-react';
import { GetSecurityConfig, SetSecurityConfig } from '../../wailsjs/go/gui/App';

/**
 * 보안 설정 인터페이스
 */
interface SecurityConfig {
  webAuthnEnabled: boolean;
  sessionTimeoutMin: number;
  ipWhitelistEnabled: boolean;
  adminIPWhitelist: string;
  maxLoginAttempts: number;
  lockDurationMinutes: number;
}

/**
 * 토글 스위치 컴포넌트
 */
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({
  checked,
  onChange,
  label,
}) => (
  <label className="flex items-center justify-between py-2 cursor-pointer select-none">
    <span className="text-[13px] text-[#333333] font-medium">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
        checked ? 'bg-[#0055CC]' : 'bg-[#D4D4D4]',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
        ].join(' ')}
      />
    </button>
  </label>
);

/**
 * 숫자 입력 필드 컴포넌트
 */
const NumberField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
}> = ({ label, value, onChange, unit, min = 1, max = 9999 }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-[13px] text-[#333333] font-medium">{label}</span>
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
        className="w-20 text-[13px] text-right border border-[#CCCCCC] rounded px-2 py-1 focus:outline-none focus:border-[#0055CC] bg-white font-mono"
      />
      {unit && <span className="text-[11px] text-[#888888] w-6">{unit}</span>}
    </div>
  </div>
);

/**
 * @component SecuritySettings
 * @description 보안 관련 설정(WebAuthn/패스키, 세션 타임아웃, IP 화이트리스트, 계정 잠금)을 관리하는 컴포넌트입니다.
 */
const SecuritySettings: React.FC = () => {
  const [config, setConfig] = useState<SecurityConfig>({
    webAuthnEnabled: false,
    sessionTimeoutMin: 30,
    ipWhitelistEnabled: false,
    adminIPWhitelist: '',
    maxLoginAttempts: 5,
    lockDurationMinutes: 15,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 5000);
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const data = await GetSecurityConfig();
      setConfig(data as SecurityConfig);
    } catch (e) {
      showFeedback('error', '보안 설정 로드 실패: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await SetSecurityConfig(config as any);
      showFeedback('success', String(result) || '보안 설정이 저장되었습니다.');
    } catch (e) {
      showFeedback('error', '보안 설정 저장 실패: ' + String(e));
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = <K extends keyof SecurityConfig>(key: K, value: SecurityConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#E0E0E0] flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-normal text-[#003399]">보안 설정</h2>
            <p className="text-xs text-[#666666]">인증, 세션, IP 화이트리스트 및 계정 보호 정책을 관리합니다.</p>
          </div>
          <button
            onClick={fetchConfig}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 text-[12px] border border-[#CCCCCC] bg-[#F5F5F5] hover:bg-[#E0E0E0] rounded disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Feedback */}
        {feedback && (
          <div
            className={[
              'rounded px-3 py-2 text-xs border',
              feedback.type === 'success'
                ? 'bg-[#E8F5E9] border-[#4CAF50] text-[#1B5E20]'
                : 'bg-[#FFECEC] border-[#CC0000] text-[#CC0000]',
            ].join(' ')}
          >
            {feedback.msg}
          </div>
        )}

        {/* WebAuthn & Session card */}
        <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-3">
            <Shield size={13} className="text-[#0055CC]" />
            인증 정책
          </div>
          <div className="space-y-1">
            <Toggle
              label="WebAuthn(패스키) 활성화"
              checked={config.webAuthnEnabled}
              onChange={(v) => updateConfig('webAuthnEnabled', v)}
            />
            <p className="text-[11px] text-[#888888] pb-1 pl-0.5">
              활성화 시 모든 사용자가 패스키로 로그인할 수 있습니다
            </p>
            <NumberField
              label="세션 타임아웃"
              value={config.sessionTimeoutMin}
              onChange={(v) => updateConfig('sessionTimeoutMin', v)}
              unit="분"
              min={5}
              max={1440}
            />
          </div>
        </div>

        {/* IP Whitelist card */}
        <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-3">
            <Shield size={13} className="text-[#0055CC]" />
            IP 화이트리스트
          </div>
          <div className="space-y-2">
            <Toggle
              label="IP 화이트리스트 활성화"
              checked={config.ipWhitelistEnabled}
              onChange={(v) => updateConfig('ipWhitelistEnabled', v)}
            />
            <div>
              <label className="block text-[12px] text-[#666666] mb-1">관리자 허용 IP 목록 (쉼표로 구분)</label>
              <textarea
                value={config.adminIPWhitelist}
                onChange={(e) => updateConfig('adminIPWhitelist', e.target.value)}
                placeholder="예: 192.168.1.100, 10.0.0.1"
                rows={3}
                className="w-full text-[13px] border border-[#CCCCCC] rounded px-3 py-2 focus:outline-none focus:border-[#0055CC] bg-white font-mono resize-none"
              />
            </div>
          </div>
        </div>

        {/* Account lock card */}
        <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-3">
            <Lock size={13} className="text-[#0055CC]" />
            계정 보호
          </div>
          <div className="space-y-1">
            <NumberField
              label="최대 로그인 시도"
              value={config.maxLoginAttempts}
              onChange={(v) => updateConfig('maxLoginAttempts', v)}
              unit="회"
              min={1}
              max={100}
            />
            <NumberField
              label="계정 잠금 시간"
              value={config.lockDurationMinutes}
              onChange={(v) => updateConfig('lockDurationMinutes', v)}
              unit="분"
              min={1}
              max={1440}
            />
          </div>
        </div>

        {/* Save button */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className={[
              'flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold border rounded shadow-sm transition-colors',
              saving
                ? 'bg-[#E0E0E0] border-[#CCCCCC] text-[#999999] cursor-not-allowed'
                : 'bg-[#0055CC] border-[#004499] hover:bg-[#004499] text-white',
            ].join(' ')}
          >
            {saving ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings;
