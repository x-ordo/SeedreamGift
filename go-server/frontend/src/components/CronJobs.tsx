import React, { useState, useEffect } from 'react';
import { Clock, Play, RefreshCw, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import { GetCronStatus, RunCronJob } from '../../wailsjs/go/gui/App';

/**
 * 예약 작업 인터페이스
 */
interface CronJob {
  name: string;
  schedule: string;
  lastRun: string;
  status: string;
}

/**
 * 작업 상태에 따른 상태 배지를 렌더링합니다.
 */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status.toLowerCase()) {
    case 'ok':
    case 'success':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7]">
          <CheckCircle size={10} /> 정상
        </span>
      );
    case 'error':
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#FFECEC] text-[#CC0000] border border-[#FFCCCC]">
          <XCircle size={10} /> 오류
        </span>
      );
    case 'never':
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#F5F5F5] text-[#888888] border border-[#E0E0E0]">
          <MinusCircle size={10} /> 미실행
        </span>
      );
  }
};

/**
 * 타임스탬프 문자열을 읽기 쉬운 형식으로 변환합니다.
 */
const formatLastRun = (dt: string): string => {
  if (!dt || dt === '0001-01-01T00:00:00Z' || dt === '') return '—';
  try {
    return new Date(dt).toLocaleString([], {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dt;
  }
};

/**
 * 예약 작업 관리 컴포넌트
 * 서버에 설정된 크론 작업 목록을 표시하고 수동 실행 기능을 제공합니다.
 */
const CronJobs: React.FC = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchJobs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await GetCronStatus();
      setJobs((data as CronJob[]) ?? []);
    } catch (e) {
      if (!silent) showFeedback('error', '예약 작업 상태 로드 실패: ' + String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(() => fetchJobs(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRunNow = async (name: string) => {
    setRunning(name);
    try {
      const result = await RunCronJob(name);
      showFeedback('success', String(result) || `"${name}" 실행 완료되었습니다.`);
      // Refresh after a short delay to let the job complete
      setTimeout(() => fetchJobs(true), 1500);
    } catch (e) {
      showFeedback('error', `"${name}" 실행 실패: ` + String(e));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#E0E0E0] flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-normal text-[#003399]">예약 작업</h2>
            <p className="text-xs text-[#666666]">예약된 작업 목록입니다. 30초마다 상태가 자동 새로고침됩니다.</p>
          </div>
          <button
            onClick={() => fetchJobs()}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 text-[12px] border border-[#CCCCCC] bg-[#F5F5F5] hover:bg-[#E0E0E0] rounded disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={[
            'mx-4 mt-3 rounded px-3 py-1.5 text-xs border flex-shrink-0',
            feedback.type === 'success'
              ? 'bg-[#E8F5E9] border-[#4CAF50] text-[#1B5E20]'
              : 'bg-[#FFECEC] border-[#CC0000] text-[#CC0000]',
          ].join(' ')}
        >
          {feedback.msg}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#EAEAEA] border-b border-[#D4D4D4]">
              <th className="text-left px-4 py-2 font-semibold text-[11px] text-[#333333]">
                <Clock size={11} className="inline mr-1 text-[#0055CC]" />작업명
              </th>
              <th className="text-left px-4 py-2 font-semibold text-[11px] text-[#333333]">스케줄</th>
              <th className="text-left px-4 py-2 font-semibold text-[11px] text-[#333333]">마지막 실행</th>
              <th className="text-left px-4 py-2 font-semibold text-[11px] text-[#333333]">상태</th>
              <th className="text-right px-4 py-2 font-semibold text-[11px] text-[#333333]">작업</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#999999]">
                  {loading ? '예약 작업 로딩 중...' : '설정된 예약 작업이 없습니다.'}
                </td>
              </tr>
            ) : (
              jobs.map((job, i) => (
                <tr
                  key={job.name}
                  className={['border-b border-[#F0F0F0]', i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'].join(' ')}
                >
                  <td className="px-4 py-2.5 font-medium text-[#333333]">{job.name}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-[#555555]">{job.schedule}</td>
                  <td className="px-4 py-2.5 text-[#666666]">{formatLastRun(job.lastRun)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleRunNow(job.name)}
                      disabled={running === job.name}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] border border-[#0055CC] text-[#0055CC] rounded hover:bg-[#E5F3FF] disabled:opacity-50 transition-colors"
                    >
                      {running === job.name ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : (
                        <Play size={11} />
                      )}
                      {running === job.name ? '실행 중...' : '지금 실행'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-[#E0E0E0] bg-[#F5F5F5] flex-shrink-0">
        <span className="text-[11px] text-[#666666]">{jobs.length}개 예약 작업</span>
      </div>
    </div>
  );
};

export default CronJobs;
