import React, { useState, useEffect } from 'react';
import { Server, Globe, Lock, RefreshCw, Clock, Shield } from 'lucide-react';
import { GetServerEnvConfig } from '../../wailsjs/go/gui/App';

/**
 * 서버 환경 설정 인터페이스
 */
interface ServerEnvConfig {
  port: number;
  environment: string;
  cookieDomain: string;
  cookieSecure: boolean;
  frontendURL: string;
  adminURL: string;
  jwtAccessExpiry: string;
  jwtRefreshExpiry: string;
  logLevel: string;
  trustedProxyIPs: string;
}

/**
 * 읽기 전용 정보 행 컴포넌트
 */
const InfoRow: React.FC<{ label: string; value: string | number | boolean; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="flex items-baseline py-1.5 border-b border-[#F0F0F0] last:border-0">
    <span className="w-40 text-[#666666] text-[12px] flex-shrink-0">{label}</span>
    <span className={['text-[13px] text-[#333333]', mono ? 'font-mono' : 'font-medium'].join(' ')}>
      {typeof value === 'boolean' ? (
        <span
          className={[
            'inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border',
            value
              ? 'bg-[#E8F5E9] text-[#1B5E20] border-[#A5D6A7]'
              : 'bg-[#F5F5F5] text-[#888888] border-[#E0E0E0]',
          ].join(' ')}
        >
          {value ? 'ON' : 'OFF'}
        </span>
      ) : (
        String(value) || '(미설정)'
      )}
    </span>
  </div>
);

/**
 * 환경 모드에 따른 배지를 렌더링합니다.
 */
const EnvironmentBadge: React.FC<{ mode: string }> = ({ mode }) => {
  const isRelease = mode === 'release';
  return (
    <span
      className={[
        'inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border font-semibold',
        isRelease
          ? 'bg-[#E8F5E9] text-[#1B5E20] border-[#A5D6A7]'
          : 'bg-[#FFF3CD] text-[#856404] border-[#FFE082]',
      ].join(' ')}
    >
      {isRelease ? 'Production' : mode === 'test' ? 'Test' : 'Development'}
    </span>
  );
};

/**
 * @component ServerInfo
 * @description 현재 서버의 환경 설정을 읽기 전용으로 표시하는 컴포넌트입니다.
 * 포트, 환경 모드, 쿠키 설정, JWT 만료 시간 등의 정보를 제공합니다.
 */
const ServerInfo: React.FC = () => {
  const [config, setConfig] = useState<ServerEnvConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetServerEnvConfig();
      setConfig(data as ServerEnvConfig);
    } catch (e) {
      setError('서버 설정 로드 실패: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#E0E0E0] flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-normal text-[#003399]">서버 환경 정보</h2>
            <p className="text-xs text-[#666666]">현재 실행 중인 서버의 환경 설정입니다. 변경하려면 .env 파일을 수정하세요.</p>
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
        {error && (
          <div className="rounded px-3 py-2 text-xs border bg-[#FFECEC] border-[#CC0000] text-[#CC0000]">
            {error}
          </div>
        )}

        {config ? (
          <>
            {/* Server core */}
            <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-3">
                <Server size={13} className="text-[#0055CC]" />
                서버 핵심 설정
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[12px] text-[#666666]">환경:</span>
                <EnvironmentBadge mode={config.environment} />
              </div>
              <InfoRow label="포트" value={config.port} mono />
              <InfoRow label="로그 레벨" value={config.logLevel} mono />
              <InfoRow label="신뢰 프록시 IP" value={config.trustedProxyIPs || '(미설정)'} mono />
            </div>

            {/* URLs */}
            <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-3">
                <Globe size={13} className="text-[#0055CC]" />
                URL 설정
              </div>
              <InfoRow label="프론트엔드 URL" value={config.frontendURL} mono />
              <InfoRow label="관리자 URL" value={config.adminURL} mono />
            </div>

            {/* Cookie */}
            <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-3">
                <Lock size={13} className="text-[#0055CC]" />
                쿠키 설정
              </div>
              <InfoRow label="쿠키 도메인" value={config.cookieDomain} mono />
              <InfoRow label="Secure 플래그" value={config.cookieSecure} />
            </div>

            {/* JWT */}
            <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-3">
                <Clock size={13} className="text-[#0055CC]" />
                JWT 토큰 설정
              </div>
              <InfoRow label="Access 만료" value={config.jwtAccessExpiry} mono />
              <InfoRow label="Refresh 만료" value={config.jwtRefreshExpiry} mono />
            </div>

            {/* Read-only notice */}
            <div className="flex items-start gap-2 px-3 py-2 bg-[#E5F3FF] border border-[#B3D9FF] rounded">
              <Shield size={14} className="text-[#0055CC] flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#333333] leading-relaxed">
                이 정보는 서버 시작 시 로드된 환경 변수 값입니다. 변경하려면{' '}
                <span className="font-mono bg-[#F0F0F0] px-1 rounded">.env</span> 파일을 수정한 후
                서버를 재시작하세요.
              </p>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-[12px] text-[#999999]">
            {loading ? '서버 환경 정보 로딩 중...' : '서버 데이터를 사용할 수 없습니다.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerInfo;
