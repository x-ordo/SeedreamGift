/**
 * @file DashboardTab.tsx
 * @description Partner dashboard — stats, quick links, recent orders
 */
import { useState, useEffect } from 'react';
import { Tag, Ticket, Receipt, Banknote, Package, Award, ShoppingCart, Coins } from 'lucide-react';
import { partnerApi } from '@/api/manual';
import { usePartnerContext } from '../PartnerContext';

interface DashboardData {
  productCount: number;
  availableProductCount: number;
  orderCount: number;
  monthlySales: number;
  pinStock: number;
  pendingPayout: number;
  partnerTier: string;
  recentOrders: any[];
  monthlyPurchaseCount?: number;
  monthlyPurchaseAmount?: number;
  monthlyTradeInCount?: number;
  monthlyTradeInAmount?: number;
}

const DashboardTab: React.FC = () => {
  const { setActiveTab } = usePartnerContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const res = await partnerApi.getDashboard();
        setData(res);
      } catch {
        // Use fallback data on error
        setData({
          productCount: 0,
          availableProductCount: 0,
          orderCount: 0,
          monthlySales: 0,
          pinStock: 0,
          pendingPayout: 0,
          partnerTier: '-',
          recentOrders: [],
        });
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="partner-tab">
        <div role="status" aria-busy="true" style={{ display: 'flex', justifyContent: 'center', padding: '48px 0', color: 'var(--color-grey-500)' }}>
          로딩 중...
        </div>
      </div>
    );
  }

  const stats = [
    { label: '등록 가능 상품', value: data?.availableProductCount ?? data?.productCount ?? 0, icon: Tag, colorClass: 'primary' },
    { label: '총 주문', value: data?.totalOrders ?? data?.orderCount ?? 0, icon: Receipt, colorClass: '' },
    { label: '이번달 매출', value: `${((data?.monthSalesAmount ?? data?.monthlySales ?? 0) / 10000).toLocaleString()}만원`, icon: Banknote, colorClass: 'success' },
    { label: 'PIN 재고', value: data?.availableVouchers ?? data?.pinStock ?? 0, icon: Package, colorClass: '' },
    { label: '정산 대기', value: `${((data?.pendingPayouts ?? data?.pendingPayout ?? 0) / 10000).toLocaleString()}만원`, icon: Banknote, colorClass: 'warning' },
    { label: '파트너 티어', value: data?.partnerTier ?? data?.tier ?? '-', icon: Award, colorClass: 'primary' },
    { label: '이번달 구매 건수', value: `${(data?.monthlyPurchaseCount ?? 0).toLocaleString()}건`, icon: ShoppingCart, colorClass: '' },
    { label: '이번달 구매금액', value: `${((data?.monthlyPurchaseAmount ?? 0) / 10000).toLocaleString()}만원`, icon: ShoppingCart, colorClass: 'primary' },
    { label: '이번달 매입 건수', value: `${(data?.monthlyTradeInCount ?? 0).toLocaleString()}건`, icon: Coins, colorClass: '' },
    { label: '이번달 매입금액', value: `${((data?.monthlyTradeInAmount ?? 0) / 10000).toLocaleString()}만원`, icon: Coins, colorClass: 'success' },
  ];

  const quickLinks = [
    { label: '등록 가능 상품', icon: Tag, tab: 'products' as const },
    { label: '상품 구매', icon: ShoppingCart, tab: 'buy' as const },
    { label: '매입 신청', icon: Coins, tab: 'tradein' as const },
    { label: 'PIN 등록', icon: Ticket, tab: 'vouchers' as const },
    { label: '주문 현황', icon: Receipt, tab: 'orders' as const },
    { label: '정산 내역', icon: Banknote, tab: 'payouts' as const },
  ];

  return (
    <div className="partner-tab">
      {/* Stats Grid */}
      <div className="partner-stats-row">
        {stats.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <div key={stat.label} className="partner-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatIcon size={16} style={{ color: 'var(--color-grey-400)' }} />
                <span className="partner-stat-label">{stat.label}</span>
              </div>
              <span className={`partner-stat-value ${stat.colorClass}`}>{stat.value}</span>
            </div>
          );
        })}
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="partner-section-title" style={{ marginBottom: '12px' }}>빠른 이동</h3>
        <div className="partner-quick-links">
          {quickLinks.map((link) => {
            const LinkIcon = link.icon;
            return (
              <button
                key={link.label}
                type="button"
                className="partner-quick-link"
                onClick={() => setActiveTab(link.tab)}
              >
                <LinkIcon size={18} />
                <span>{link.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Orders */}
      <div>
        <h3 className="partner-section-title" style={{ marginBottom: '12px' }}>최근 주문 (5건)</h3>
        <div className="partner-table-card">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <caption className="sr-only">최근 주문 목록</caption>
            <thead>
              <tr>
                <th scope="col">주문번호</th>
                <th scope="col">상품</th>
                <th scope="col">수량</th>
                <th scope="col">금액</th>
                <th scope="col">상태</th>
                <th scope="col">날짜</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentOrders ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-grey-400)' }}>
                    최근 주문 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                (data?.recentOrders ?? []).slice(0, 5).map((order: any) => (
                  <tr key={order.id}>
                    <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: 'var(--color-purple-500)' }}>
                      #{order.id}
                    </td>
                    <td>{order.productName || '-'}</td>
                    <td>{order.quantity ?? 0}</td>
                    <td className="tabular-nums">{Number(order.totalAmount ?? 0).toLocaleString()}원</td>
                    <td>
                      <span className={`partner-badge ${order.statusColor || 'gray'}`}>
                        {order.statusLabel || order.status || '-'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-grey-500)' }}>
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ko-KR') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
