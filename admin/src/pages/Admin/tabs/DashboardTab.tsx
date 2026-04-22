import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Users, Package, Receipt, ShieldAlert, Banknote, Ticket, Gift,
  AlertTriangle, ArrowRight, Activity, TrendingUp, ChevronRight,
  CheckCircle2, Plus, FileUp, Settings, DollarSign, Clock, Server,
} from 'lucide-react';
import { adminApi } from '@/api';
import { Result, Skeleton, Badge } from '@/design-system';
import { formatPrice } from '@/utils';
import { useAdminContext } from '../AdminContext';
import { AdminTab } from '../constants';

type PeriodFilter = 'today' | 'week' | 'month' | 'all';

interface Stats {
  userCount: number;
  productCount: number;
  orderCount: number;
  pendingKycCount: number;
  pendingTradeInCount: number;
  voucherCount: number;
  giftCount?: number;
  // Revenue fields (period-filtered)
  salesAmount?: number;
  tradeInPayouts?: number;
  profit?: number;
  // Low stock alert
  lowStockProducts?: Array<{ productName: string; available: number; threshold: number }>;
  // Aging trade-ins (count by bucket)
  agingTradeIns?: { over24h: number; over48h: number; over72h: number };
}

interface GiftStats {
  totalGifts: number;
  pendingGifts: number;
  claimedGifts: number;
  claimRate: number;
  todayGifts: number;
  thisMonthGifts: number;
}

// ── StatCard (blacklist-frontend 패턴) ──
function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  variant = 'default',
  urgent,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix: string;
  variant?: 'default' | 'warning' | 'danger' | 'success' | 'info' | 'purple' | 'pink';
  urgent?: boolean;
  onClick?: () => void;
}) {
  const styles: Record<string, { icon: string; gradient: string; value: string }> = {
    default:  { icon: 'bg-slate-100 text-slate-600',    gradient: 'from-slate-50 to-white',  value: 'text-slate-900' },
    warning:  { icon: 'bg-amber-100 text-amber-600',    gradient: 'from-amber-50 to-white',  value: 'text-amber-600' },
    danger:   { icon: 'bg-red-100 text-red-600',        gradient: 'from-red-50 to-white',    value: 'text-red-600' },
    success:  { icon: 'bg-emerald-100 text-emerald-600', gradient: 'from-emerald-50 to-white', value: 'text-emerald-600' },
    info:     { icon: 'bg-blue-100 text-blue-600',      gradient: 'from-blue-50 to-white',   value: 'text-blue-600' },
    purple:   { icon: 'bg-purple-100 text-purple-600',  gradient: 'from-purple-50 to-white', value: 'text-purple-600' },
    pink:     { icon: 'bg-pink-100 text-pink-600',      gradient: 'from-pink-50 to-white',   value: 'text-pink-600' },
  };
  const s = styles[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border bg-gradient-to-br p-4 text-left transition-shadow hover:shadow-md ${s.gradient} ${urgent ? 'border-amber-300' : 'border-slate-200'} ${onClick ? 'cursor-pointer hover:border-slate-300' : ''}`}
      aria-label={`${label} ${value}${suffix}`}
    >
      {urgent && (
        <span className="absolute top-2 right-2 rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          처리 필요
        </span>
      )}
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.icon}`}>
          <Icon size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="mb-0.5 text-xs font-medium text-slate-500">{label}</p>
          <p className={`text-xl font-bold tabular-nums leading-none ${s.value}`}>
            {value.toLocaleString('ko-KR')}
            <span className="ml-0.5 text-sm font-medium text-slate-400">{suffix}</span>
          </p>
        </div>
      </div>
    </button>
  );
}

// ── QuickLink (blacklist-frontend 패턴) ──
function QuickLink({
  icon: Icon,
  label,
  color = 'slate',
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  color?: 'blue' | 'emerald' | 'amber' | 'slate' | 'purple';
  onClick: () => void;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-3 text-center transition-colors hover:border-slate-300 hover:bg-slate-50/50"
    >
      <div className={`rounded-xl p-2.5 ${colorMap[color]} transition-transform group-hover:scale-105`}>
        <Icon size={16} aria-hidden="true" />
      </div>
      <span className="text-xs font-medium text-slate-700">{label}</span>
    </button>
  );
}

// ── StatusRow ──
function StatusRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        {status}
      </span>
    </div>
  );
}

// ── AgeBadge for trade-in aging ──
function AgeBadge({ hoursAgo }: { hoursAgo: number }) {
  if (hoursAgo < 24) {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        {Math.round(hoursAgo)}h
      </span>
    );
  }
  if (hoursAgo < 48) {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        {Math.round(hoursAgo)}h
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      {Math.round(hoursAgo)}h
    </span>
  );
}

// ── Period Pill Button ──
function PeriodPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

// ── Main Dashboard ──
const DashboardTab = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [giftStats, setGiftStats] = useState<GiftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [sysLoading, setSysLoading] = useState(false);
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const { setActiveTab } = useAdminContext();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminApi.getStatsWithPeriod(period).catch(() => adminApi.getStats().catch(() => null)),
      adminApi.getGiftStats().catch(() => null),
    ]).then(([statsRes, giftRes]) => {
      setStats(statsRes as Stats | null);
      if (giftRes) setGiftStats(giftRes as GiftStats);
    }).finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    const loadSystemInfo = async () => {
      setSysLoading(true);
      try {
        const info = await adminApi.getSystemInfo();
        setSystemInfo(info);
      } catch { /* 조용히 실패 */ }
      finally { setSysLoading(false); }
    };
    const loadStockAlerts = async () => {
      try {
        const alerts = await adminApi.getStockAlerts();
        setStockAlerts(Array.isArray(alerts) ? alerts : []);
      } catch { /* 조용히 실패 */ }
    };
    loadSystemInfo();
    loadStockAlerts();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true" aria-label="대시보드 로딩 중">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <Skeleton width={40} height={40} style={{ borderRadius: 12 }} />
                <div className="flex-1">
                  <Skeleton width={60} height={12} style={{ marginBottom: 8, borderRadius: 6 }} />
                  <Skeleton width={80} height={24} style={{ borderRadius: 6 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const urgentKyc = (stats?.pendingKycCount || 0) > 0;
  const urgentTradeIn = (stats?.pendingTradeInCount || 0) > 0;
  const lowStockProducts = stats?.lowStockProducts || [];
  const aging = stats?.agingTradeIns || { over24h: 0, over48h: 0, over72h: 0 };
  const hasAging = aging.over24h > 0 || aging.over48h > 0 || aging.over72h > 0;

  return (
    <div className="space-y-6">
      {/* Period Toggle */}
      <div className="flex items-center gap-2" role="group" aria-label="기간 필터">
        {([
          { key: 'today' as PeriodFilter, label: '오늘' },
          { key: 'week' as PeriodFilter, label: '7일' },
          { key: 'month' as PeriodFilter, label: '30일' },
          { key: 'all' as PeriodFilter, label: '전체' },
        ]).map(item => (
          <PeriodPill
            key={item.key}
            label={item.label}
            active={period === item.key}
            onClick={() => setPeriod(item.key)}
          />
        ))}
      </div>

      {/* 긴급 알림 배너 */}
      {(urgentKyc || urgentTradeIn) && (
        <div className="overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center">
            <div className="hidden h-full w-14 items-center justify-center border-r border-amber-200 bg-amber-100/50 py-4 sm:flex">
              <AlertTriangle size={22} className="text-amber-600" aria-hidden="true" />
            </div>
            <div className="flex flex-1 items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="text-amber-600 sm:hidden" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-amber-900">
                    처리 대기 항목 <span className="text-amber-600">
                      {(stats?.pendingKycCount || 0) + (stats?.pendingTradeInCount || 0)}건
                    </span>
                  </p>
                  <p className="text-sm text-amber-700">
                    {urgentKyc && `KYC 인증 ${stats?.pendingKycCount}건`}
                    {urgentKyc && urgentTradeIn && ' · '}
                    {urgentTradeIn && `매입 신청 ${stats?.pendingTradeInCount}건`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab(urgentKyc ? 'users' : 'tradeins')}
                className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                처리하기
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Low Stock Alert Banner */}
      {lowStockProducts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50">
          <div className="flex items-center">
            <div className="hidden h-full w-14 items-center justify-center border-r border-red-200 bg-red-100/50 py-4 sm:flex">
              <AlertTriangle size={22} className="text-red-600" aria-hidden="true" />
            </div>
            <div className="flex flex-1 items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="text-red-600 sm:hidden" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-red-900">
                    재고 부족 알림
                  </p>
                  <p className="text-sm text-red-700">
                    {lowStockProducts.map((p, i) => (
                      <span key={i}>
                        {i > 0 && ' / '}
                        {p.productName} ({p.available}개 / 기준 {p.threshold}개)
                      </span>
                    ))}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('vouchers')}
                className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                바우처 관리
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <DollarSign size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-xs font-medium text-slate-500">매출액</p>
              <p className="text-xl font-bold tabular-nums leading-none text-blue-600">
                {formatPrice(Number(stats?.salesAmount || 0))}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <Banknote size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-xs font-medium text-slate-500">매입 정산</p>
              <p className="text-xl font-bold tabular-nums leading-none text-emerald-600">
                {formatPrice(Number(stats?.tradeInPayouts || 0))}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <TrendingUp size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-xs font-medium text-slate-500">순이익</p>
              <p className="text-xl font-bold tabular-nums leading-none text-indigo-600">
                {formatPrice(Number(stats?.profit || ((stats?.salesAmount || 0) - (stats?.tradeInPayouts || 0))))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 통계 카드 그리드 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users}       label="전체 회원"   value={stats?.userCount || 0}          suffix="명"  variant="info"    onClick={() => setActiveTab('users')} />
        <StatCard icon={Package}     label="전체 상품"   value={stats?.productCount || 0}       suffix="종"  variant="default" onClick={() => setActiveTab('products')} />
        <StatCard icon={Receipt}     label="전체 주문"   value={stats?.orderCount || 0}         suffix="건"  variant="success" onClick={() => setActiveTab('orders')} />
        <StatCard icon={ShieldAlert} label="KYC 대기"    value={stats?.pendingKycCount || 0}    suffix="건"  variant="warning" urgent={urgentKyc} onClick={() => setActiveTab('users')} />
        <StatCard icon={Banknote}    label="매입 대기"   value={stats?.pendingTradeInCount || 0} suffix="건" variant="danger"  urgent={urgentTradeIn} onClick={() => setActiveTab('tradeins')} />
        <StatCard icon={Ticket}      label="전체 바우처" value={stats?.voucherCount || 0}       suffix="개"  variant="purple"  onClick={() => setActiveTab('vouchers')} />
        <StatCard icon={Gift}        label="전체 선물"   value={giftStats?.totalGifts || stats?.giftCount || 0} suffix="건" variant="pink" onClick={() => setActiveTab('gifts')} />
      </div>

      {/* 재고 부족 알림 (API) */}
      {stockAlerts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-red-200 bg-white">
          <div className="flex items-center gap-2 border-b bg-red-50/80 px-5 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle size={14} className="text-red-600" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-red-900">재고 부족 알림</h3>
            <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              {stockAlerts.length}건
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {stockAlerts.map((alert: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-medium text-slate-800">
                  {alert.productName || alert.name || `상품 #${alert.productId ?? idx}`}
                </span>
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                    사용가능 {alert.available ?? alert.availableCount ?? 0}개
                  </span>
                  <span className="text-xs text-slate-400">
                    기준 {alert.threshold ?? alert.minStockAlert ?? 0}개
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 메인 2단 그리드 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 좌측 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Aging Trade-Ins */}
          {hasAging && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b bg-slate-50/80 px-5 py-3">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                    <Clock size={14} className="text-amber-600" aria-hidden="true" />
                  </div>
                  미처리 매입 현황
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('tradeins')}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
                >
                  전체 보기
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-3 divide-x">
                <div className="flex flex-col items-center gap-1 py-5">
                  <span className="text-2xl font-bold text-emerald-600">{aging.over24h}</span>
                  <span className="text-xs text-slate-500">24h 이내</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-5">
                  <span className="text-2xl font-bold text-amber-600">{aging.over48h}</span>
                  <span className="text-xs text-slate-500">24~48h</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-5">
                  <span className="text-2xl font-bold text-red-600">{aging.over72h}</span>
                  <span className="text-xs text-slate-500">48h 초과</span>
                </div>
              </div>
            </div>
          )}

          {/* 선물 현황 */}
          {giftStats && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b bg-slate-50/80 px-5 py-3">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-50">
                    <Gift size={14} className="text-pink-600" aria-hidden="true" />
                  </div>
                  선물 현황
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('gifts')}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
                >
                  전체 보기
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
                {[
                  { label: '전체', value: giftStats.totalGifts, color: 'text-slate-900' },
                  { label: '대기중', value: giftStats.pendingGifts, color: 'text-amber-600' },
                  { label: '수령완료', value: giftStats.claimedGifts, color: 'text-emerald-600' },
                  { label: '수령률', value: giftStats.claimRate, color: 'text-blue-600', suffix: '%' },
                ].map(item => (
                  <div key={item.label} className="bg-white p-4 text-center">
                    <p className="text-xs font-medium text-slate-500">{item.label}</p>
                    <p className={`mt-1 text-2xl font-bold tabular-nums ${item.color}`}>
                      {item.value.toLocaleString('ko-KR')}
                      {item.suffix && <span className="ml-0.5 text-sm font-medium text-slate-400">{item.suffix}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 시스템 상태 */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b bg-slate-50/80 px-5 py-3">
              <Activity size={14} className="text-slate-500" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900">시스템 상태</h3>
            </div>
            <div className="p-4">
              <StatusRow label="서버 상태" status="정상" />
              <StatusRow label="DB 연결" status="정상" />
              <StatusRow label="API 서비스" status="정상" />
            </div>
          </div>
        </div>

        {/* 우측 1/3: 빠른 메뉴 */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b bg-slate-50/80 px-5 py-3">
            <TrendingUp size={14} className="text-slate-500" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">빠른 메뉴</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <QuickLink icon={Plus}     label="상품 등록"   color="blue"    onClick={() => setActiveTab('products')} />
            <QuickLink icon={FileUp}   label="PIN 등록"    color="purple"  onClick={() => setActiveTab('vouchers')} />
            <QuickLink icon={Users}    label="회원 관리"   color="slate"   onClick={() => setActiveTab('users')} />
            <QuickLink icon={Receipt}  label="주문 관리"   color="emerald" onClick={() => setActiveTab('orders')} />
            <QuickLink icon={Banknote} label="매입 관리"   color="amber"   onClick={() => setActiveTab('tradeins')} />
            <QuickLink icon={Settings} label="시스템 설정" color="slate"   onClick={() => setActiveTab('configs')} />
          </div>
        </div>
      </div>

      {/* 시스템 정보 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b bg-slate-50/80 px-5 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
            <Server size={14} className="text-slate-600" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900">시스템 정보</h3>
        </div>
        <div className="p-4">
          {sysLoading ? (
            <div
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
              role="status"
              aria-busy="true"
              aria-label="시스템 정보 로딩 중"
            >
              {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <Skeleton width={60} height={10} style={{ marginBottom: 8, borderRadius: 4 }} />
                  <Skeleton width={80} height={16} style={{ borderRadius: 4 }} />
                </div>
              ))}
            </div>
          ) : systemInfo ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {([
                { label: '버전', value: systemInfo.version },
                { label: 'Go 버전', value: systemInfo.goVersion },
                { label: '업타임', value: systemInfo.uptime },
                { label: '메모리 사용', value: systemInfo.memoryUsage },
                { label: 'DB 활성 연결', value: systemInfo.dbOpenConns != null ? String(systemInfo.dbOpenConns) : undefined },
                { label: 'DB 유휴 연결', value: systemInfo.dbIdleConns != null ? String(systemInfo.dbIdleConns) : undefined },
                { label: '빌드 시각', value: systemInfo.buildTime },
              ] as { label: string; value?: string }[]).filter(item => item.value != null).map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="mb-1 text-xs text-slate-500">{item.label}</p>
                  <p className="truncate text-sm font-bold text-slate-900" title={item.value}>{item.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">시스템 정보를 불러올 수 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
