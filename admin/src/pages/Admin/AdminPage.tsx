/**
 * @file AdminPage.tsx
 * @description 관리자 대시보드 - 다크 사이드바 + 밝은 콘텐츠 레이아웃
 */
import { useState, lazy, Suspense, useMemo, useEffect, useCallback } from 'react';
import siteConfig from '../../../../site.config.json';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, ExternalLink, LogOut, LayoutGrid, X, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader } from '@/design-system';
import { AdminTab, ADMIN_TABS, TAB_GROUPS } from './constants';
import { AdminContext } from './AdminContext';
import './AdminPage.css';

const TAB_COMPONENTS: Record<AdminTab, React.LazyExoticComponent<React.FC>> = {
  'dashboard': lazy(() => import('./tabs/DashboardTab')),
  'users': lazy(() => import('./tabs/UsersTab')),
  'partners': lazy(() => import('./tabs/PartnersTab')),
  'sessions': lazy(() => import('./tabs/SessionsTab')),
  'products': lazy(() => import('./tabs/ProductsTab')),
  'brands': lazy(() => import('./tabs/BrandsTab')),
  'vouchers': lazy(() => import('./tabs/VouchersTab')),
  'orders': lazy(() => import('./tabs/OrdersTab')),
  'tradeins': lazy(() => import('./tabs/TradeInsTab')),
  'gifts': lazy(() => import('./tabs/GiftsTab')),
  'refunds': lazy(() => import('./tabs/RefundsTab')),
  'settlements': lazy(() => import('./tabs/SettlementsTab')),
  'fraud': lazy(() => import('./tabs/FraudTab')),
  'cash-receipts': lazy(() => import('./tabs/CashReceiptsTab')),
  'partner-prices': lazy(() => import('./tabs/PartnerPricesTab')),
  'notices': lazy(() => import('./tabs/NoticesTab')),
  'events': lazy(() => import('./tabs/EventsTab')),
  'faqs': lazy(() => import('./tabs/FaqsTab')),
  'inquiries': lazy(() => import('./tabs/InquiriesTab')),
  'business-inquiries': lazy(() => import('./tabs/BusinessInquiriesTab')),
  'policies': lazy(() => import('./tabs/PoliciesTab')),
  'security': lazy(() => import('./tabs/SecurityTab')),
  'configs': lazy(() => import('./tabs/ConfigsTab')),
  'audit-logs': lazy(() => import('./tabs/AuditLogsTab')),
};

const MOBILE_QUICK_TABS = ['dashboard', 'users', 'products', 'orders', 'tradeins'] as const;

const AdminPage: React.FC = () => {
  const { user, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const VALID_ADMIN_TABS = ADMIN_TABS.map(t => t.id);
  const rawTab = searchParams.get('tab') as AdminTab | null;
  const activeTab: AdminTab = (rawTab && VALID_ADMIN_TABS.includes(rawTab)) ? rawTab : 'dashboard';

  const [visitedTabs, setVisitedTabs] = useState<Set<AdminTab>>(() => {
    const urlTab = (new URLSearchParams(window.location.search).get('tab') as AdminTab) || 'dashboard';
    const validUrlTab: AdminTab = ADMIN_TABS.map(t => t.id).includes(urlTab) ? urlTab : 'dashboard';
    return new Set([validUrlTab]);
  });

  const handleTabChange = useCallback((tab: AdminTab) => {
    setSearchParams({ tab }, { replace: false });
    setVisitedTabs(prev => new Set([...prev, tab]));
    setMobileMenuOpen(false);
    requestAnimationFrame(() => {
      document.querySelector('.adm-content')?.scrollTo(0, 0);
      window.scrollTo(0, 0);
    });
  }, [setSearchParams]);

  useEffect(() => {
    if (activeTab) {
      setVisitedTabs(prev => {
        if (prev.has(activeTab)) return prev;
        return new Set([...prev, activeTab]);
      });
    }
  }, [activeTab]);

  const adminContextValue = useMemo(() => ({
    activeTab,
    setActiveTab: handleTabChange,
  }), [activeTab, handleTabChange]);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const activeTabConfig = ADMIN_TABS.find(t => t.id === activeTab);

  useEffect(() => {
    document.title = `${activeTabConfig?.title || '관리'} | ${siteConfig.company.brand} Admin`;
    return () => { document.title = `${siteConfig.company.brand} Admin`; };
  }, [activeTabConfig]);

  if (authLoading) return null;

  return (
    <AdminContext.Provider value={adminContextValue}>
    <div className="adm">
      {/* ── 다크 사이드바 (데스크톱) ── */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar-inner">
          {/* 로고 */}
          <div className="adm-sidebar-logo">
            <div className="adm-sidebar-logo-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <span>{siteConfig.company.brand}</span>
              <small style={{ display: 'block', marginLeft: 0 }}>Admin Console</small>
            </div>
          </div>

          {/* 네비게이션 */}
          <nav className="adm-nav" aria-label="관리자 메뉴">
            {TAB_GROUPS.map(group => {
              const groupTabs = ADMIN_TABS.filter(t => t.group === group.id);
              if (groupTabs.length === 0) return null;
              return (
                <div key={group.id} className="adm-nav-group">
                  <div className="adm-nav-group-label">{group.label}</div>
                  {groupTabs.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`adm-nav-item ${isActive ? 'adm-nav-item--active' : ''}`}
                        onClick={() => handleTabChange(item.id as AdminTab)}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon size={18} />
                        <span>{item.label}</span>
                        {isActive && <ChevronRight size={14} className="adm-nav-item-arrow" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* 사이드바 하단: 유저 정보 */}
          <div className="adm-sidebar-footer">
            <Link to="/" className="adm-sidebar-link">
              <ExternalLink size={14} />
              <span>사용자 사이트</span>
            </Link>
            <div className="adm-sidebar-user">
              <div className="adm-sidebar-avatar">
                {(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="adm-sidebar-user-info">
                <span className="adm-sidebar-user-name">{user?.name || '관리자'}</span>
                <span className="adm-sidebar-user-email">{user?.email}</span>
              </div>
              <button
                type="button"
                className="adm-sidebar-logout"
                onClick={handleLogout}
                aria-label="로그아웃"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── 메인 콘텐츠 영역 ── */}
      <main className="adm-main">
        {/* 콘텐츠 헤더 */}
        <header className="adm-content-header">
          <div>
            <h1 className="adm-content-title">{activeTabConfig?.title || '대시보드'}</h1>
            {activeTabConfig?.description && (
              <p className="adm-content-desc">{activeTabConfig.description}</p>
            )}
          </div>
        </header>

        {/* 탭 콘텐츠 */}
        <div className="adm-content">
          <Suspense fallback={<Loader size="medium" label="로딩 중..." />}>
            {ADMIN_TABS.map(({ id }) => {
              if (!visitedTabs.has(id as AdminTab)) return null;
              const TabComponent = TAB_COMPONENTS[id as AdminTab];
              return (
                <div key={id} style={{ display: activeTab === id ? 'block' : 'none' }}>
                  <TabComponent />
                </div>
              );
            })}
          </Suspense>
        </div>
      </main>

      {/* ── 모바일 하단 탭바 ── */}
      <nav className="adm-mobile-tabbar" aria-label="빠른 메뉴">
        {MOBILE_QUICK_TABS.map(tabId => {
          const tab = ADMIN_TABS.find(t => t.id === tabId)!;
          const MobileIcon = tab.icon;
          return (
            <button
              key={tabId}
              className={`adm-mobile-tab ${activeTab === tabId ? 'adm-mobile-tab--active' : ''}`}
              onClick={() => handleTabChange(tabId)}
              aria-current={activeTab === tabId ? 'page' : undefined}
            >
              <MobileIcon size={20} />
              <span>{tab.label.replace(' 관리', '').replace(' 신청', '')}</span>
            </button>
          );
        })}
        <button
          className={`adm-mobile-tab ${mobileMenuOpen ? 'adm-mobile-tab--active' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label="더 많은 메뉴"
        >
          <LayoutGrid size={20} />
          <span>더보기</span>
        </button>
      </nav>

      {/* ── 모바일 메뉴 시트 ── */}
      {mobileMenuOpen && (
        <>
          <button type="button" className="adm-mobile-overlay" aria-label="메뉴 닫기" onClick={() => setMobileMenuOpen(false)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} />
          <div className="adm-mobile-sheet">
            <div className="adm-mobile-sheet-header">
              <h3>전체 메뉴</h3>
              <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="닫기"><X size={20} /></button>
            </div>
            <div className="adm-mobile-sheet-grid">
              {ADMIN_TABS.map(item => {
                const MenuIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={`adm-mobile-menu-item ${activeTab === item.id ? 'adm-mobile-menu-item--active' : ''}`}
                    onClick={() => handleTabChange(item.id as AdminTab)}
                  >
                    <MenuIcon size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
    </AdminContext.Provider>
  );
};

export default AdminPage;
