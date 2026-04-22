import React, { useState, useEffect } from 'react';
import { ShieldBan, ShieldCheck, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { GetBlockedIPs, BlockIP, UnblockIP } from '../../wailsjs/go/gui/App';

interface BlockedIPInfo {
  ipAddress: string;
  reason: string;
  source: string;  // AUTO | MANUAL | BRUTE_FORCE | RUNTIME
  createdAt: string;
}

const isValidIP = (ip: string): boolean =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
  ip.split('.').every((n) => parseInt(n, 10) <= 255);

const sourceBadge = (source: string) => {
  switch (source) {
    case 'AUTO':
      return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]">자동</span>;
    case 'MANUAL':
      return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#DBEAFE] text-[#1E40AF] border border-[#93C5FD]">수동</span>;
    case 'BRUTE_FORCE':
      return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">브루트포스</span>;
    default:
      return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#F3F4F6] text-[#6B7280] border border-[#D1D5DB]">런타임</span>;
  }
};

const IPSecurity: React.FC = () => {
  const [blockedIPs, setBlockedIPs] = useState<BlockedIPInfo[]>([]);
  const [newIP, setNewIP] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchIPs = async () => {
    setLoading(true);
    try {
      const data = await GetBlockedIPs();
      setBlockedIPs((data as unknown as BlockedIPInfo[]) ?? []);
    } catch (e) {
      showFeedback('error', '차단 IP 목록 로드 실패: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIPs(); }, []);

  const handleBlock = async () => {
    const ip = newIP.trim();
    if (!ip) return;
    if (!isValidIP(ip)) {
      showFeedback('error', `"${ip}" 유효한 IPv4 주소가 아닙니다.`);
      return;
    }
    if (blockedIPs.some(b => b.ipAddress === ip)) {
      showFeedback('error', `${ip} 이미 차단되어 있습니다.`);
      return;
    }
    try {
      await BlockIP(ip);
      showFeedback('success', `${ip} 차단 완료`);
      setNewIP('');
      await fetchIPs();
    } catch (e) {
      showFeedback('error', 'IP 차단 실패: ' + String(e));
    }
  };

  const handleUnblock = async (ip: string) => {
    setUnblocking(ip);
    try {
      await UnblockIP(ip);
      showFeedback('success', `${ip} 해제 완료`);
      await fetchIPs();
    } catch (e) {
      showFeedback('error', 'IP 해제 실패: ' + String(e));
    } finally {
      setUnblocking(null);
    }
  };

  const autoCount = blockedIPs.filter(b => b.source === 'AUTO').length;
  const manualCount = blockedIPs.filter(b => b.source === 'MANUAL').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#E5E7EB] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">IP 보안</h2>
            <p className="text-xs text-[#6B7280]">차단된 IP 주소를 관리합니다. 침해 시도 5회 누적 시 자동 차단됩니다.</p>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            {autoCount > 0 && (
              <span className="px-2 py-1 rounded-md bg-[#FEE2E2] text-[#991B1B] font-bold">자동 {autoCount}</span>
            )}
            {manualCount > 0 && (
              <span className="px-2 py-1 rounded-md bg-[#DBEAFE] text-[#1E40AF] font-bold">수동 {manualCount}</span>
            )}
            <button
              onClick={fetchIPs}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1 text-[12px] border border-[#D1D5DB] bg-white hover:bg-[#F9FAFB] rounded-lg disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {feedback && (
          <div className={[
            'rounded-lg px-3 py-2 text-xs font-medium border',
            feedback.type === 'success'
              ? 'bg-[#ECFDF5] border-[#6EE7B7] text-[#065F46]'
              : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]',
          ].join(' ')}>
            {feedback.msg}
          </div>
        )}

        {/* Block IP form */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280] font-semibold uppercase tracking-wider mb-3">
            <ShieldBan size={13} className="text-[#EF4444]" />
            IP 주소 차단
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="예: 192.168.1.100"
              value={newIP}
              onChange={(e) => setNewIP(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBlock()}
              className="flex-1 text-[13px] border border-[#D1D5DB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] bg-white"
            />
            <button
              onClick={handleBlock}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg shadow-sm transition-colors"
            >
              <Plus size={14} />
              차단
            </button>
          </div>
        </div>

        {/* Blocked IPs table */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280] font-semibold uppercase tracking-wider">
              <ShieldCheck size={13} className="text-[#2563EB]" />
              차단 목록 ({blockedIPs.length})
            </div>
          </div>

          {blockedIPs.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[#9CA3AF]">
              {loading ? '로딩 중...' : '차단된 IP가 없습니다.'}
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="text-left px-4 py-2 font-semibold text-[#374151] text-[11px]">IP 주소</th>
                  <th className="text-left px-4 py-2 font-semibold text-[#374151] text-[11px]">유형</th>
                  <th className="text-left px-4 py-2 font-semibold text-[#374151] text-[11px]">사유</th>
                  <th className="text-left px-4 py-2 font-semibold text-[#374151] text-[11px]">차단일</th>
                  <th className="text-right px-4 py-2 font-semibold text-[#374151] text-[11px]">작업</th>
                </tr>
              </thead>
              <tbody>
                {blockedIPs.map((entry, i) => (
                  <tr
                    key={entry.ipAddress}
                    className={['border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors', i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'].join(' ')}
                  >
                    <td className="px-4 py-2.5 font-mono font-semibold text-[#EF4444]">{entry.ipAddress}</td>
                    <td className="px-4 py-2.5">{sourceBadge(entry.source)}</td>
                    <td className="px-4 py-2.5 text-[#6B7280] max-w-[200px] truncate" title={entry.reason}>{entry.reason || '—'}</td>
                    <td className="px-4 py-2.5 text-[#9CA3AF] font-mono">{entry.createdAt || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleUnblock(entry.ipAddress)}
                        disabled={unblocking === entry.ipAddress}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 border border-[#D1D5DB] text-[#6B7280] rounded-lg hover:bg-[#FEF2F2] hover:border-[#FCA5A5] hover:text-[#EF4444] disabled:opacity-50 transition-colors"
                      >
                        <Trash2 size={11} />
                        {unblocking === entry.ipAddress ? '해제 중...' : '해제'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default IPSecurity;
