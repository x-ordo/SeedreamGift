import React, { useState, useEffect, useRef } from 'react';
import { Activity, Cpu, MemoryStick, GitBranch, Zap, AlertTriangle, Database } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { GetDashboardStats, GetDashboardHistory, GetServerStatus } from '../../wailsjs/go/gui/App';

/**
 * 대시보드 통계 인터페이스
 */
interface DashboardStats {
  uptime: string;
  cpuUsage: number;
  memoryUsage: number;
  systemMemoryUsage: number;
  goroutineCount: number;
  requestRate: number;
  errorRate: number;
  dbConnections: number;
}

/**
 * 성능 히스토리 데이터 포인트 인터페이스
 */
interface HistoryPoint {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: number;
  goroutines: number;
  requestRate: number;
  errorRate: number;
}

/**
 * 서버 상태 정보 인터페이스
 */
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
 * 지표 카드 컴포넌트 속성
 */
interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color?: string;
}

/**
 * 주요 지표를 시각화하는 카드 컴포넌트
 */
const MetricCard: React.FC<MetricCardProps> = ({ label, value, unit, icon, color = '#0055CC' }) => (
  <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-3 flex flex-col gap-1">
    <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide">
      <span style={{ color }}>{icon}</span>
      {label}
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-light" style={{ color }}>{value}</span>
      {unit && <span className="text-xs text-[#666666]">{unit}</span>}
    </div>
  </div>
);

const MAX_HISTORY = 60;

/** Go Duration 문자열을 읽기 쉬운 형식으로 변환 */
const formatUptime = (raw: string): string => {
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/);
  if (!match) return raw;
  const h = parseInt(match[1] || '0');
  const m = parseInt(match[2] || '0');
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}일 ${rh}시간 ${m}분`;
  }
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
};

/**
 * 대시보드 메인 컴포넌트
 * 서버의 실시간 상태 및 리소스 사용률을 차트와 카드로 시각화합니다.
 */
const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [chartData, setChartData] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const fetchAll = async () => {
    try {
      const [s, status] = await Promise.all([
        GetDashboardStats(),
        GetServerStatus(),
      ]);
      setStats(s as DashboardStats);
      setServerStatus(status as ServerStatus);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const fetchHistory = async () => {
    try {
      const history = await GetDashboardHistory();
      const points = (history as HistoryPoint[]).slice(-MAX_HISTORY);
      setChartData(points);
    } catch {
      // History endpoint may not be available yet; silently skip
    }
  };

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchAll();
      fetchHistory();
    }

    const statsInterval = setInterval(fetchAll, 3000);
    const historyInterval = setInterval(fetchHistory, 5000);
    return () => {
      clearInterval(statsInterval);
      clearInterval(historyInterval);
    };
  }, []);

  const formatTimestamp = (ts: number | string) => {
    try {
      const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return String(ts);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="px-5 py-3 border-b border-[#E0E0E0] flex-shrink-0">
        <h2 className="text-lg font-normal text-[#003399]">대시보드</h2>
        <p className="text-xs text-[#666666]">서버 성능 및 상태를 실시간으로 모니터링합니다.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="bg-[#FFF3CD] border border-[#FFC107] rounded px-3 py-2 text-xs text-[#856404]">
            연결 오류: {error}
          </div>
        )}

        {/* Properties card */}
        <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-2">
            <Activity size={13} className="text-[#0055CC]" />
            서버 속성
          </div>
          <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-[13px]">
            <div className="text-[#666666]">버전</div>
            <div className="col-span-2 font-medium">{serverStatus?.version ?? '—'}</div>
            <div className="text-[#666666]">런타임</div>
            <div className="col-span-2 font-medium">{serverStatus?.goVersion ?? '—'}</div>
            <div className="text-[#666666]">가동 시간</div>
            <div className="col-span-2 font-medium">{stats ? formatUptime(stats.uptime) : '—'}</div>
            <div className="text-[#666666]">DB 연결 수</div>
            <div className="col-span-2 font-medium">{stats?.dbConnections ?? '—'}</div>
          </div>
        </div>

        {/* Metric cards row */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label="CPU 사용률"
            value={stats ? stats.cpuUsage.toFixed(1) : '—'}
            unit="%"
            icon={<Cpu size={13} />}
            color={
              stats && stats.cpuUsage > 80 ? '#CC0000' :
              stats && stats.cpuUsage > 60 ? '#E08800' :
              '#0055CC'
            }
          />
          <MetricCard
            label="메모리"
            value={stats ? stats.memoryUsage : '—'}
            unit="MB"
            icon={<MemoryStick size={13} />}
            color={
              stats && stats.memoryUsage > 400 ? '#CC0000' :
              stats && stats.memoryUsage > 250 ? '#E08800' :
              '#008000'
            }
          />
          <MetricCard
            label="고루틴"
            value={stats?.goroutineCount ?? '—'}
            icon={<GitBranch size={13} />}
            color="#6600CC"
          />
          <MetricCard
            label="요청률"
            value={stats ? stats.requestRate.toFixed(1) : '—'}
            unit="req/s"
            icon={<Zap size={13} />}
            color="#E08800"
          />
          <MetricCard
            label="에러율"
            value={stats ? stats.errorRate.toFixed(2) : '—'}
            unit="%"
            icon={<AlertTriangle size={13} />}
            color={stats && stats.errorRate > 1 ? '#CC0000' : '#666666'}
          />
          <MetricCard
            label="시스템 메모리"
            value={stats?.systemMemoryUsage ?? '—'}
            unit="MB"
            icon={<Database size={13} />}
            color="#0055CC"
          />
        </div>

        {/* Chart */}
        <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[#666666] font-medium uppercase tracking-wide mb-3">
            <Activity size={13} className="text-[#0055CC]" />
            성능 히스토리 (최근 {chartData.length}개 샘플)
          </div>
          {chartData.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-xs text-[#999999]">
              데이터 수집 중 — 차트가 곧 표시됩니다...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimestamp}
                  tick={{ fontSize: 10, fill: '#666666' }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10, fill: '#666666' }} />
                <Tooltip
                  formatter={(value: number, name: string) => [value.toFixed(2), name]}
                  labelFormatter={formatTimestamp}
                  contentStyle={{ fontSize: 11, border: '1px solid #D4D4D4', background: '#FFFFFF' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="cpuUsage"
                  name="CPU %"
                  stroke="#0055CC"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="memoryUsage"
                  name="Memory MB"
                  stroke="#008000"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="requestRate"
                  name="Req/s"
                  stroke="#E08800"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
