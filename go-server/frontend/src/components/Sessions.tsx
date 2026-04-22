import React, { useState, useEffect, useRef } from 'react';
import { Users, RefreshCw, XCircle, Trash2 } from 'lucide-react';
import { GetActiveSessions, KillSession, KillAllSessions } from '../../wailsjs/go/gui/App';

interface Session {
  id: number;
  userId: number;
  userEmail: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * @description 날짜 문자열을 읽기 좋은 형식으로 변환하는 헬퍼 함수입니다.
 * @param dt ISO 날짜 문자열
 * @returns 포맷된 날짜 문자열
 */
const formatDate = (dt: string) => {
  try {
    return new Date(dt).toLocaleString([], {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dt;
  }
};

/**
 * @description User-Agent 문자열이 너무 길 경우 생략 처리합니다.
 * @param ua User-Agent 문자열
 * @returns 생략 처리된 문자열
 */
const truncateUA = (ua: string) => (ua.length > 40 ? ua.slice(0, 40) + '…' : ua);

/**
 * @component Sessions
 * @description 현재 서버에 접속 중인 활성 사용자 세션 목록을 조회하고,
 * 특정 세션 또는 전체 세션을 강제 종료할 수 있는 관리 기능을 제공합니다.
 */
const Sessions: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [terminating, setTerminating] = useState<number | null>(null);
  const [killAllConfirm, setKillAllConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const killAllTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchSessions = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await GetActiveSessions();
      setSessions((data as Session[]) ?? []);
    } catch (e) {
      if (!silent) showFeedback('error', '세션 목록 로드 실패: ' + String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(() => fetchSessions(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleKill = async (id: number) => {
    setTerminating(id);
    try {
      const result = await KillSession(id);
      showFeedback('success', String(result) || '세션이 종료되었습니다.');
      await fetchSessions(true);
    } catch (e) {
      showFeedback('error', '세션 종료 실패: ' + String(e));
    } finally {
      setTerminating(null);
    }
  };

  const handleKillAll = async () => {
    if (!killAllConfirm) {
      setKillAllConfirm(true);
      if (killAllTimerRef.current) clearTimeout(killAllTimerRef.current);
      killAllTimerRef.current = setTimeout(() => setKillAllConfirm(false), 4000);
      return;
    }
    setKillAllConfirm(false);
    if (killAllTimerRef.current) clearTimeout(killAllTimerRef.current);
    try {
      const result = await KillAllSessions();
      showFeedback('success', String(result) || '전체 세션이 종료되었습니다.');
      await fetchSessions(true);
    } catch (e) {
      showFeedback('error', '전체 세션 종료 실패: ' + String(e));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#E0E0E0] flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-normal text-[#003399]">세션 관리</h2>
            <p className="text-xs text-[#666666]">활성 사용자 세션 목록입니다. 10초마다 자동 새로고침합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSessions()}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1 text-[12px] border border-[#CCCCCC] bg-[#F5F5F5] hover:bg-[#E0E0E0] rounded disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
            <button
              onClick={handleKillAll}
              className={[
                'flex items-center gap-1.5 px-3 py-1 text-[12px] border rounded transition-colors',
                killAllConfirm
                  ? 'bg-[#CC0000] border-[#AA0000] text-white font-semibold'
                  : 'border-[#CC0000] text-[#CC0000] bg-white hover:bg-[#FFECEC]',
              ].join(' ')}
            >
              <Trash2 size={13} />
              {killAllConfirm ? '확인 — 전체 종료?' : '전체 세션 종료'}
            </button>
          </div>
        </div>
      </div>

      {/* Feedback */}
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
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#EAEAEA] border-b border-[#D4D4D4]">
              <th className="text-left px-3 py-2 font-semibold text-[11px] text-[#333333] whitespace-nowrap">
                <Users size={11} className="inline mr-1 text-[#0055CC]" />사용자
              </th>
              <th className="text-left px-3 py-2 font-semibold text-[11px] text-[#333333]">IP 주소</th>
              <th className="text-left px-3 py-2 font-semibold text-[11px] text-[#333333]">브라우저</th>
              <th className="text-left px-3 py-2 font-semibold text-[11px] text-[#333333] whitespace-nowrap">생성일</th>
              <th className="text-left px-3 py-2 font-semibold text-[11px] text-[#333333] whitespace-nowrap">만료일</th>
              <th className="text-right px-3 py-2 font-semibold text-[11px] text-[#333333]">작업</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#999999]">
                  {loading ? '세션 로딩 중...' : '활성 세션이 없습니다.'}
                </td>
              </tr>
            ) : (
              sessions.map((s, i) => (
                <tr
                  key={s.id}
                  className={['border-b border-[#F0F0F0]', i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'].join(' ')}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-[#333333]">{s.userEmail}</div>
                    <div className="text-[10px] text-[#999999]">uid:{s.userId}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-[#0055CC]">{s.ipAddress}</td>
                  <td className="px-3 py-2 text-[#666666]" title={s.userAgent}>
                    {truncateUA(s.userAgent)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-[#666666]">{formatDate(s.createdAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-[#666666]">{formatDate(s.expiresAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleKill(s.id)}
                      disabled={terminating === s.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] border border-[#CC0000] text-[#CC0000] rounded hover:bg-[#FFECEC] disabled:opacity-50 transition-colors"
                    >
                      <XCircle size={11} />
                      {terminating === s.id ? '...' : '종료'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[#E0E0E0] bg-[#F5F5F5] flex-shrink-0">
        <span className="text-[11px] text-[#666666]">{sessions.length}개 활성 세션</span>
      </div>
    </div>
  );
};

export default Sessions;
