import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Search, ArrowDownToLine, Copy, Check, Download } from 'lucide-react';
import { ReadLogs, CopyToClipboard, SaveLogToFile } from '../../wailsjs/go/gui/App';

const LOG_TYPES = [
  { value: 'api', label: '전체 로그 (api.log)' },
  { value: 'error', label: '에러만 필터' },
];

const ERROR_PATTERN = /\b(ERROR|error|FATAL|fatal|PANIC|panic)\b/;

/**
 * @description 로그 메시지 내의 특정 검색어를 하이라이트 처리하는 헬퍼 함수입니다.
 * @param line 원본 로그 라인
 * @param search 검색어
 * @returns 하이라이트된 React 노드
 */
const highlightLine = (line: string, search: string): React.ReactNode => {
  if (!search) return line;
  const parts = line.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === search.toLowerCase() ? (
      <mark key={i} className="bg-yellow-300 text-black rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
};

/**
 * @component LogViewer
 * @description 시스템 및 API 서버 로그를 실시간으로 조회하고 필터링하는 컴포넌트입니다.
 * 자동 스크롤, 검색, 로그 복사 및 파일 저장 기능을 제공합니다.
 */
const LogViewer: React.FC = () => {
  const [logType, setLogType] = useState('api');
  const [rawLogs, setRawLogs] = useState('');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async (type = logType) => {
    setLoading(true);
    try {
      const content = await ReadLogs(type);
      setRawLogs(content ?? '');
    } catch (e) {
      setRawLogs('로그 읽기 오류: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [logType]);

  useEffect(() => {
    if (autoScroll && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [rawLogs, autoScroll]);

  const lines = rawLogs.split('\n');

  const filteredLines = lines.filter((line) => {
    // 에러 필터 모드: ERROR/FATAL/PANIC 줄만 표시
    if (logType === 'error' && !ERROR_PATTERN.test(line)) return false;
    // 검색 필터
    if (search && !line.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLogType(e.target.value);
    setRawLogs('');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E5E7EB] flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-black text-[#111827] tracking-tight">이벤트 뷰어</h2>
            <p className="text-[12px] text-[#6B7280] font-medium">시스템 및 보안 로그를 실시간으로 모니터링합니다</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <select
              className="text-[12px] font-bold border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-[#F9FAFB] focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none transition-all cursor-pointer"
              value={logType}
              onChange={handleTypeChange}
            >
              {LOG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <div className="flex items-center border border-[#E5E7EB] rounded-lg bg-[#F9FAFB] focus-within:ring-2 focus-within:ring-[#2563EB] focus-within:bg-white transition-all overflow-hidden">
              <Search size={14} className="text-[#9CA3AF] ml-3 flex-shrink-0" />
              <input
                type="text"
                placeholder="로그 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-[12px] font-medium px-3 py-1.5 bg-transparent outline-none w-40"
              />
            </div>

            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[12px] font-bold text-[#4B5563] cursor-pointer select-none hover:bg-white transition-all">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
              />
              <span>자동 스크롤</span>
            </label>

            <button
              onClick={async () => {
                try {
                  await CopyToClipboard(rawLogs);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  try { await navigator.clipboard.writeText(rawLogs); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
                }
              }}
              disabled={!rawLogs}
              className="flex items-center gap-2 px-4 py-1.5 text-[12px] font-black border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] active:scale-95 rounded-lg disabled:opacity-50 shadow-sm transition-all"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-[#2563EB]" />}
              {copied ? '복사됨' : '복사'}
            </button>

            <button
              onClick={async () => {
                try {
                  const path = await SaveLogToFile(rawLogs);
                  if (path) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
                } catch {}
              }}
              disabled={!rawLogs}
              className="flex items-center gap-2 px-4 py-1.5 text-[12px] font-black border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] active:scale-95 rounded-lg disabled:opacity-50 shadow-sm transition-all"
            >
              <Download size={14} className="text-[#2563EB]" />
              파일 저장
            </button>

            <button
              onClick={() => fetchLogs()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-1.5 text-[12px] font-black border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] active:scale-95 rounded-lg disabled:opacity-50 shadow-sm transition-all"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : 'text-[#2563EB]'} />
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* Column header */}
      <div className="flex bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-black text-[#6B7280] uppercase tracking-widest px-6 py-2 flex-shrink-0">
        <div className="w-20">수준</div>
        <div className="flex-1">로그 메시지</div>
      </div>

      {/* Log content */}
      <div
        ref={preRef}
        className="flex-1 overflow-auto bg-white border-0 font-mono text-[12px] text-[#374151] leading-relaxed select-text"
        style={{ fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace" }}
      >
        {filteredLines.length === 0 || (filteredLines.length === 1 && !filteredLines[0]) ? (
          <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF] gap-2 py-20">
            <Search size={32} strokeWidth={1} />
            <p className="text-sm font-medium">표시할 로그 이벤트가 없습니다</p>
          </div>
        ) : (
          <div className="min-w-fit">
            {filteredLines.map((line, i) => {
              const isError = ERROR_PATTERN.test(line);
              return (
                <div
                  key={i}
                  className={[
                    'flex px-6 py-1 border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group',
                    isError ? 'bg-[#FEF2F2]' : 'bg-white',
                  ].join(' ')}
                >
                  <div className="w-20 flex-shrink-0 flex items-start pt-0.5">
                    <span className={[
                      'px-1.5 py-0.5 rounded-md text-[10px] font-black',
                      isError ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#E0F2FE] text-[#0284C7]'
                    ].join(' ')}>
                      {isError ? 'ERROR' : 'INFO'}
                    </span>
                  </div>
                  <div className="flex-1 break-all whitespace-pre-wrap font-medium">
                    {highlightLine(line, search)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-2 border-t border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-bold text-[#6B7280]">
            전체: <span className="text-[#111827]">{lines.filter(Boolean).length}</span> 줄
          </span>
          {search && (
            <span className="text-[11px] font-bold text-[#2563EB]">
              필터: <span className="font-black">{filteredLines.filter(Boolean).length}</span>
            </span>
          )}
        </div>
        <span className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-wider">
          소스: {logType}.log
        </span>
      </div>
    </div>
  );
};

export default LogViewer;
