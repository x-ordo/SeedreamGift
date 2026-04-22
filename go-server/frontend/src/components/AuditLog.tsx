import React, { useState, useEffect, useCallback } from 'react';
import { ScrollText, ChevronLeft, ChevronRight, RefreshCw, Download, Copy, Check } from 'lucide-react';
import { GetAuditLogs, ExportAuditLogs, SaveAuditLogsToFile, CopyToClipboard } from '../../wailsjs/go/gui/App';

interface AuditLogEntry {
  id: number;
  timestamp: string;
  userId?: number;
  userEmail?: string;
  action: string;
  resource: string;
  method: string;
  statusCode: number;
  ipAddress: string;
}

interface AuditLogsResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

const PAGE_SIZE = 20;

const statusColor = (code: number): string => {
  if (code >= 500) return 'bg-[#FFECEC] text-[#CC0000] border border-[#FFCCCC]';
  if (code >= 400) return 'bg-[#FFF3CD] text-[#856404] border border-[#FFE082]';
  if (code >= 200 && code < 300) return 'bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7]';
  return 'bg-[#F5F5F5] text-[#666666] border border-[#E0E0E0]';
};

const formatTime = (dt: string) => {
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

const AuditLog: React.FC = () => {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditLogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchPage = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await GetAuditLogs(p, PAGE_SIZE);
      setData(result as AuditLogsResponse);
    } catch (e) {
      setError('감사 로그 로드 실패: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(page);
  }, [page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const items = data?.items ?? [];

  const goTo = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  /** 현재 페이지 감사로그를 클립보드에 복사 */
  const handleCopy = useCallback(async () => {
    try {
      const tsv = await ExportAuditLogs(page, PAGE_SIZE);
      await CopyToClipboard(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError('복사 실패: ' + String(e));
    }
  }, [page]);

  /** 전체 감사로그를 파일로 저장 */
  const handleSaveFile = useCallback(async () => {
    try {
      const total = data?.total ?? 100;
      const tsv = await ExportAuditLogs(1, Math.min(total, 500));
      const path = await SaveAuditLogsToFile(tsv);
      if (path) {
        setError(null);
      }
    } catch (e) {
      setError('파일 저장 실패: ' + String(e));
    }
  }, [data]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#E0E0E0] flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-normal text-[#003399]">감사 로그</h2>
            <p className="text-xs text-[#666666]">보안 관련 API 활동 로그입니다. 페이지네이션을 지원합니다.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              disabled={loading || items.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 text-[12px] border border-[#CCCCCC] bg-[#F5F5F5] hover:bg-[#E0E0E0] rounded disabled:opacity-50"
              title="현재 페이지를 클립보드에 복사"
            >
              {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
              {copied ? '복사됨' : '복사'}
            </button>
            <button
              onClick={handleSaveFile}
              disabled={loading || items.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 text-[12px] border border-[#CCCCCC] bg-[#F5F5F5] hover:bg-[#E0E0E0] rounded disabled:opacity-50"
              title="감사 로그를 파일로 저장"
            >
              <Download size={12} />
              파일 저장
            </button>
            <button
              onClick={() => fetchPage(page)}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1 text-[12px] border border-[#CCCCCC] bg-[#F5F5F5] hover:bg-[#E0E0E0] rounded disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded px-3 py-1.5 text-xs border bg-[#FFECEC] border-[#CC0000] text-[#CC0000] flex-shrink-0">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#EAEAEA] border-b border-[#D4D4D4]">
              <th className="text-left px-3 py-2 font-semibold text-[11px] text-[#333333] whitespace-nowrap">
                <ScrollText size={11} className="inline mr-1 text-[#0055CC]" />시간
              </th>
              <th className="text-left px-3 py-2 font-semibold text-[11px] text-[#333333]">사용자</th>
              <th className="text-left px-3 py-2 font-semibold text-[11px] text-[#333333]">동작</th>
              <th className="text-left px-3 py-2 font-semibold text-[11px] text-[#333333]">리소스</th>
              <th className="text-left px-3 py-2 font-semibold text-[11px] text-[#333333]">메서드</th>
              <th className="text-left px-3 py-2 font-semibold text-[11px] text-[#333333]">상태</th>
              <th className="text-left px-3 py-2 font-semibold text-[11px] text-[#333333]">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#999999]">감사 로그 로딩 중...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#999999]">감사 로그 항목이 없습니다.</td>
              </tr>
            ) : (
              items.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={['border-b border-[#F0F0F0]', i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'].join(' ')}
                >
                  <td className="px-3 py-1.5 whitespace-nowrap text-[#666666]">{formatTime(entry.timestamp)}</td>
                  <td className="px-3 py-1.5">
                    {entry.userEmail ? (
                      <span className="font-medium text-[#333333]">{entry.userEmail}</span>
                    ) : (
                      <span className="text-[#AAAAAA] italic">익명</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[#333333]">{entry.action}</td>
                  <td className="px-3 py-1.5 font-mono text-[#0055CC] max-w-[160px] truncate" title={entry.resource}>
                    {entry.resource}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="font-mono text-[11px] bg-[#F0F0F0] border border-[#E0E0E0] px-1.5 py-0.5 rounded text-[#555555]">
                      {entry.method}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={['inline-block text-[11px] font-mono px-1.5 py-0.5 rounded', statusColor(entry.statusCode)].join(' ')}>
                      {entry.statusCode}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[#666666]">{entry.ipAddress}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="px-4 py-2 border-t border-[#E0E0E0] bg-[#F5F5F5] flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] text-[#666666]">
          {data ? `${data.total}개 항목` : '—'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page <= 1 || loading}
            className="p-1 border border-[#CCCCCC] rounded bg-white hover:bg-[#E0E0E0] disabled:opacity-40"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-[12px] text-[#333333]">
            페이지 {page} / {totalPages}
          </span>
          <button
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages || loading}
            className="p-1 border border-[#CCCCCC] rounded bg-white hover:bg-[#E0E0E0] disabled:opacity-40"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditLog;
