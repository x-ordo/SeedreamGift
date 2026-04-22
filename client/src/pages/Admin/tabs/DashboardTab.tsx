import { useState, useEffect, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Users, Package, Receipt, ShieldAlert, Banknote, Ticket, Gift,
  AlertTriangle, ArrowRight, TrendingUp, TrendingDown, DollarSign,
  Clock, PackageX,
} from 'lucide-react';
import { adminApi } from '@/api';
import { Skeleton, Badge } from '@/design-system';
import { useAdminContext } from '../AdminContext';
import { AdminTab } from '../constants';

// ── Types ──

interface DashboardStats {
  // 기본 카운트
  userCount: number;
  productCount: number;
  orderCount: number;
  pendingOrderCount: number;
  tradeInCount: number;
  pendingKycCount: number;
  pendingTradeInCount: number;
  availableVouchers: number;
  // 매출/수익 (기간별)
  salesAmount: number;
  tradeInPayouts: number;
  profit: number;
  period: string;
  // 재고 부족
  lowStockProducts: { productId: number; productName: string; brandCode: string; available: number; threshold: number }[];
  // 매입 에이징
  agingTradeIns: { over24h: number; over48h: number; over72h: number };
}

interface GiftStats {
  totalGifts: number;
  pendingGifts: number;
  claimedGifts: number;
  claimRate: number;
}

type PeriodKey = 'today' | 'week' | 'month' | 'year';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: '오늘' },
  { key: 'week', label: '7일' },
  { key: 'month', label: '30일' },
  { key: 'year', label: '1년' },
];

const formatKRW = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString();
};

// ── Components ──

const StatCard = ({ label, value, icon: Icon, color, bg, urgent, onClick }: {
  label: string; value: string; icon: LucideIcon; color: string; bg: string; urgent?: boolean; onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="admin-stat-card"
    style={{ cursor: onClick ? 'pointer' : 'default', textAlign: 'left', position: 'relative', border: urgent ? `2px solid ${color}` : undefined }}
    aria-label={`${label} ${value}`}
  >
    {urgent && <Badge color="red" variant="fill" size="xs" style={{ position: 'absolute', top: '8px', right: '8px' }}>처리 필요</Badge>}
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
      <div style={{ padding: '8px', backgroundColor: bg, borderRadius: '10px' }}>
        <Icon size={20} aria-hidden="true" style={{ color }} />
      </div>
      {onClick && <ArrowRight size={14} aria-hidden="true" style={{ color: 'var(--color-grey-300)' }} />}
    </div>
    <span className="admin-stat-label">{label}</span>
    <span className="admin-stat-value">{value}</span>
  </button>
);

const RevenueCard = ({ label, amount, icon: Icon, color, trend }: {
  label: string; amount: number; icon: LucideIcon; color: string; trend?: 'up' | 'down';
}) => (
  <div style={{
    padding: '20px',
    background: 'white',
    borderRadius: '16px',
    border: '1px solid var(--color-grey-100)',
    flex: '1 1 0',
    minWidth: '180px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <div style={{ padding: '6px', borderRadius: '8px', background: `color-mix(in oklch, ${color} 10%, white)` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-grey-500)' }}>{label}</span>
      {trend && (
        trend === 'up'
          ? <TrendingUp size={14} style={{ color: 'var(--color-success)', marginLeft: 'auto' }} />
          : <TrendingDown size={14} style={{ color: 'var(--color-error)', marginLeft: 'auto' }} />
      )}
    </div>
    <div style={{
      fontSize: '24px', fontWeight: 800, color: 'var(--color-grey-900)',
      letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
    }}>
      {formatKRW(amount)}<span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-grey-400)', marginLeft: '2px' }}>원</span>
    </div>
  </div>
);

const DashboardTab = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [giftStats, setGiftStats] = useState<GiftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>('month');
  const { setActiveTab } = useAdminContext();

  const fetchStats = useCallback((p: PeriodKey) => {
    setLoading(true);
    Promise.allSettled([
      adminApi.getStats(p),
      adminApi.getGiftStats(),
    ]).then(([statsResult, giftResult]) => {
      if (statsResult.status === 'fulfilled') setStats(statsResult.value as DashboardStats);
      if (giftResult.status === 'fulfilled' && giftResult.value) setGiftStats(giftResult.value as GiftStats);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchStats(period); }, [period, fetchStats]);

  const handlePeriodChange = (p: PeriodKey) => { setPeriod(p); };
  const nav = (tab: AdminTab) => setActiveTab(tab);

  if (loading && !stats) {
    return (
      <div className="admin-tab" role="status" aria-busy="true" aria-label="대시보드 로딩 중">
        <Skeleton height={40} style={{ marginBottom: '16px' }} />
        <div className="admin-stats-row">{[1, 2, 3].map(i => <Skeleton key={i} height={120} style={{ borderRadius: '12px' }} />)}</div>
        <div className="admin-stats-row" style={{ marginTop: '16px' }}>{[1, 2, 3, 4].map(i => <Skeleton key={i} height={100} style={{ borderRadius: '12px' }} />)}</div>
      </div>
    );
  }

  const urgentItems = [
    stats?.pendingKycCount && { label: 'KYC 대기', value: `${stats.pendingKycCount}건` },
    stats?.pendingTradeInCount && { label: '매입 대기', value: `${stats.pendingTradeInCount}건` },
    stats?.pendingOrderCount && { label: '결제 대기', value: `${stats.pendingOrderCount}건` },
    stats?.lowStockProducts?.length && { label: '재고 부족', value: `${stats.lowStockProducts.length}종` },
  ].filter(Boolean) as { label: string; value: string }[];

  const agingTotal = (stats?.agingTradeIns?.over24h || 0) + (stats?.agingTradeIns?.over48h || 0) + (stats?.agingTradeIns?.over72h || 0);

  return (
    <div className="admin-tab">
      {/* 헤더 + 기간 필터 */}
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="admin-page-title">대시보드</h2>
          <p className="admin-page-desc">플랫폼 전체 현황을 한눈에 확인합니다</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--color-grey-50)', borderRadius: '10px', padding: '3px' }}>
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => handlePeriodChange(opt.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '13px',
                fontWeight: period === opt.key ? 700 : 500,
                background: period === opt.key ? 'white' : 'transparent',
                color: period === opt.key ? 'var(--color-grey-900)' : 'var(--color-grey-400)',
                cursor: 'pointer',
                boxShadow: period === opt.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 긴급 알림 */}
      {urgentItems.length > 0 && (
        <div className="admin-alert warning" role="alert">
          <AlertTriangle size={20} aria-hidden="true" style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-grey-900)', marginBottom: '2px' }}>처리 대기 중인 항목이 있습니다</div>
            <div style={{ fontSize: '13px', color: 'var(--color-grey-600)' }}>
              {urgentItems.map(item => `${item.label} ${item.value}`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 매출/수익 섹션 ═══ */}
      <div>
        <h3 className="admin-section-title" style={{ marginBottom: '12px' }}>
          매출 현황 <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--color-grey-400)', marginLeft: '6px' }}>
            {PERIOD_OPTIONS.find(o => o.key === period)?.label} 기준
          </span>
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <RevenueCard label="매출액" amount={stats?.salesAmount || 0} icon={DollarSign} color="var(--color-primary)" trend="up" />
          <RevenueCard label="매입 정산" amount={stats?.tradeInPayouts || 0} icon={Banknote} color="var(--color-orange-500)" />
          <RevenueCard label="수익" amount={stats?.profit || 0} icon={TrendingUp} color={(stats?.profit || 0) >= 0 ? 'var(--color-success)' : 'var(--color-error)'} trend={(stats?.profit || 0) >= 0 ? 'up' : 'down'} />
        </div>
      </div>

      {/* ═══ 핵심 지표 카드 ═══ */}
      <div style={{ marginTop: '24px' }}>
        <h3 className="admin-section-title" style={{ marginBottom: '12px' }}>핵심 지표</h3>
        <div className="admin-stats-row">
          <StatCard label="전체 회원" value={`${stats?.userCount || 0}명`} icon={Users} color="var(--color-blue-500)" bg="var(--color-blue-50)" onClick={() => nav('users')} />
          <StatCard label="전체 상품" value={`${stats?.productCount || 0}종`} icon={Package} color="var(--color-teal-500)" bg="var(--color-teal-50)" onClick={() => nav('products')} />
          <StatCard label="전체 주문" value={`${stats?.orderCount || 0}건`} icon={Receipt} color="var(--color-green-500)" bg="var(--color-green-50)" onClick={() => nav('orders')} />
          <StatCard label="KYC 대기" value={`${stats?.pendingKycCount || 0}건`} icon={ShieldAlert} color="var(--color-orange-500)" bg="var(--color-orange-50)" urgent={(stats?.pendingKycCount || 0) > 0} onClick={() => nav('users')} />
          <StatCard label="매입 대기" value={`${stats?.pendingTradeInCount || 0}건`} icon={Banknote} color="var(--color-red-500)" bg="var(--color-red-50)" urgent={(stats?.pendingTradeInCount || 0) > 0} onClick={() => nav('tradeins')} />
          <StatCard label="가용 바우처" value={`${stats?.availableVouchers || 0}개`} icon={Ticket} color="var(--color-purple-500)" bg="var(--color-purple-50)" onClick={() => nav('vouchers')} />
          <StatCard label="전체 선물" value={`${giftStats?.totalGifts || 0}건`} icon={Gift} color="var(--color-pink-500)" bg="var(--color-pink-50)" onClick={() => nav('gifts')} />
        </div>
      </div>

      {/* ═══ 재고 부족 알림 ═══ */}
      {stats?.lowStockProducts && stats.lowStockProducts.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3 className="admin-section-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PackageX size={16} style={{ color: 'var(--color-error)' }} />
            재고 부족 상품
            <Badge color="red" variant="fill" size="xs">{stats.lowStockProducts.length}</Badge>
          </h3>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid var(--color-red-100)',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-red-50)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-grey-600)', fontSize: '12px' }}>상품명</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-grey-600)', fontSize: '12px' }}>브랜드</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--color-grey-600)', fontSize: '12px' }}>현재 재고</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--color-grey-600)', fontSize: '12px' }}>기준</th>
                </tr>
              </thead>
              <tbody>
                {stats.lowStockProducts.map((p, i) => (
                  <tr key={p.productId} style={{ borderTop: i > 0 ? '1px solid var(--color-grey-100)' : undefined }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--color-grey-900)' }}>{p.productName}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-grey-500)' }}>{p.brandCode}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: p.available === 0 ? 'var(--color-error)' : 'var(--color-warning)', fontVariantNumeric: 'tabular-nums' }}>{p.available}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--color-grey-400)', fontVariantNumeric: 'tabular-nums' }}>{p.threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ 매입 에이징 ═══ */}
      {agingTotal > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3 className="admin-section-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} style={{ color: 'var(--color-warning)' }} />
            미처리 매입 에이징
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: '24시간 초과', count: stats?.agingTradeIns?.over24h || 0, color: 'var(--color-yellow-500)', bg: 'var(--color-yellow-50)' },
              { label: '48시간 초과', count: stats?.agingTradeIns?.over48h || 0, color: 'var(--color-orange-500)', bg: 'var(--color-orange-50)' },
              { label: '72시간 초과', count: stats?.agingTradeIns?.over72h || 0, color: 'var(--color-red-500)', bg: 'var(--color-red-50)' },
            ].map(item => (
              <div key={item.label} style={{
                flex: '1 1 0', minWidth: '120px', padding: '16px',
                background: item.bg, borderRadius: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.count}</div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-grey-500)', marginTop: '4px' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 선물 현황 ═══ */}
      {giftStats && (
        <div style={{ marginTop: '24px' }}>
          <h3 className="admin-section-title" style={{ marginBottom: '12px' }}>선물 현황</h3>
          <div className="admin-stats-row">
            <div className="admin-stat-card" style={{ textAlign: 'center' }}>
              <span className="admin-stat-label">대기중</span>
              <span className="admin-stat-value warning">{giftStats.pendingGifts}</span>
            </div>
            <div className="admin-stat-card" style={{ textAlign: 'center' }}>
              <span className="admin-stat-label">수령완료</span>
              <span className="admin-stat-value success">{giftStats.claimedGifts}</span>
            </div>
            <div className="admin-stat-card" style={{ textAlign: 'center' }}>
              <span className="admin-stat-label">수령률</span>
              <span className="admin-stat-value primary">{giftStats.claimRate}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardTab;
