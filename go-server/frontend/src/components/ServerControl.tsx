import React, { useState, useEffect } from 'react';
import { Server, Database, Cpu, RefreshCw, Activity, Info } from 'lucide-react';
import { GetServerStatus, ReloadConfig } from '../../wailsjs/go/gui/App';

interface ServerStatus {
  version: string;
  goVersion: string;
  goroutines: number;
  heapAlloc: number;
  heapSys: number;
  totalAlloc: number;
  numGC: number;
}

/**
 * @interface InfoRowProps
 * @description 정보 표시 줄의 속성을 정의합니다.
 */
interface InfoRowProps {
  label: string;
  value: string | number;
  mono?: boolean;
}

/**
 * @description 라벨과 값을 정렬하여 표시하는 단순 정보 행 컴포넌트입니다.
 */
const InfoRow: React.FC<InfoRowProps> = ({ label, value, mono }) => (
  <div className="flex items-baseline py-1.5 border-b border-[#F0F0F0] last:border-0">
    <span className="w-36 text-[#666666] text-[12px] flex-shrink-0">{label}</span>
    <span className={['text-[13px] text-[#333333]', mono ? 'font-mono' : 'font-medium'].join(' ')}>
      {value}
    </span>
  </div>
);

/**
 * @component ServerControl
 * @description Go 백엔드 서버의 상태(버전, 메모리 사용량, 고루틴 등)를 모니터링하고
 * 실시간 설정 리로드 기능을 제공하는 관리자용 컴포넌트입니다.
 */
const ServerControl: React.FC = () => {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [reloadConfirm, setReloadConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 5000);
  };

  const fetchStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await GetServerStatus();
      setStatus(data as ServerStatus);
    } catch (e) {
      if (!silent) showFeedback('error', '서버 상태 로드 실패: ' + String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleReload = async () => {
    if (!reloadConfirm) {
      setReloadConfirm(true);
      setTimeout(() => setReloadConfirm(false), 4000);
      return;
    }
    setReloadConfirm(false);
    setReloading(true);
    try {
      const result = await ReloadConfig();
      showFeedback('success', String(result) || '설정이 성공적으로 리로드되었습니다.');
    } catch (e) {
      showFeedback('error', '리로드 실패: ' + String(e));
    } finally {
      setReloading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#E0E0E0] flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-normal text-[#003399]">서버 관리</h2>
            <p className="text-xs text-[#666666]">런타임 정보 및 설정을 관리합니다.</p>
          </div>
          <button
            onClick={() => fetchStatus()}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 text-[12px] border border-[#CCCCCC] bg-[#F5F5F5] hover:bg-[#E0E0E0] rounded disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

        {/* Server info card */}
        <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-3">
            <Server size={13} className="text-[#0055CC]" />
            서버 정보
          </div>
          {status ? (
            <div>
              <InfoRow label="버전" value={status.version} />
              <InfoRow label="Go 버전" value={status.goVersion} mono />
              <InfoRow label="고루틴" value={status.goroutines} />
              <div className="mt-3 pt-3 border-t border-[#E0E0E0]">
                <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-2">
                  <Database size={12} className="text-[#0055CC]" />
                  메모리
                </div>
                <InfoRow label="힙 사용" value={`${status.heapAlloc} MB`} />
                <InfoRow label="힙 시스템" value={`${status.heapSys} MB`} />
                <InfoRow label="총 할당" value={`${status.totalAlloc} MB`} />
              </div>
              <div className="mt-3 pt-3 border-t border-[#E0E0E0]">
                <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-2">
                  <Cpu size={12} className="text-[#0055CC]" />
                  가비지 컬렉터
                </div>
                <InfoRow label="GC 사이클" value={status.numGC} />
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-[12px] text-[#999999]">
              {loading ? '서버 상태 로딩 중...' : '서버 데이터를 사용할 수 없습니다.'}
            </div>
          )}
        </div>

        {/* Memory bars */}
        {status && (
          <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-4">
            <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-3">
              <Activity size={13} className="text-[#0055CC]" />
              메모리 할당
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-[#666666]">힙 사용</span>
                  <span className="font-semibold">{status.heapAlloc} MB</span>
                </div>
                <div className="w-full bg-[#E0E0E0] h-3 rounded overflow-hidden">
                  <div
                    className="bg-[#0055CC] h-3 rounded transition-all duration-500"
                    style={{ width: `${Math.min((status.heapAlloc / 500) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-[#999999] mt-0.5">최대 스케일: 500 MB</div>
              </div>
              <div>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-[#666666]">시스템 예약</span>
                  <span className="font-semibold">{status.heapSys} MB</span>
                </div>
                <div className="w-full bg-[#E0E0E0] h-3 rounded overflow-hidden">
                  <div
                    className="bg-[#666666] h-3 rounded transition-all duration-500"
                    style={{ width: `${Math.min((status.heapSys / 1000) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-[#999999] mt-0.5">최대 스케일: 1000 MB</div>
              </div>
            </div>
          </div>
        )}

        {/* Config reload card */}
        <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-3">
            <RefreshCw size={13} className="text-[#0055CC]" />
            설정 리로드
          </div>
          <div className="flex items-start gap-3 mb-4">
            <Info size={14} className="text-[#0055CC] flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#555555] leading-relaxed">
              아래 버튼을 클릭하면 <span className="font-mono bg-[#F0F0F0] px-1 rounded">.env</span> 파일의 환경 변수를 서비스 중단 없이 메모리에 다시 로드합니다. 환경 설정을 변경한 후 사용하세요. 리로드 중에도 요청 처리가 계속됩니다.
            </p>
          </div>
          <button
            onClick={handleReload}
            disabled={reloading}
            className={[
              'flex items-center gap-2 px-4 py-2 text-[13px] border rounded shadow-sm transition-colors',
              reloadConfirm
                ? 'bg-[#FFF3CD] border-[#FFC107] text-[#856404] font-semibold'
                : 'bg-[#E1E1E1] border-[#ADADAD] hover:bg-[#E5F1FB] hover:border-[#0078D7] text-[#333333]',
              reloading ? 'opacity-60 cursor-not-allowed' : '',
            ].join(' ')}
          >
            <RefreshCw size={14} className={reloading ? 'animate-spin' : ''} />
            {reloading
              ? '리로드 중...'
              : reloadConfirm
              ? '다시 클릭하여 리로드 확인'
              : '설정 리로드'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServerControl;
