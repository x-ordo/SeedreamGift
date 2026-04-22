/**
 * @file PartnerPage.tsx
 * @description Partner dashboard — Emerald sidebar + light content layout
 */
import { useState, lazy, Suspense, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Handshake, ExternalLink, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { PartnerTab } from './constants';
import { PARTNER_TABS } from './constants';
import { PartnerContext } from './PartnerContext';
import './PartnerPage.css';

const TAB_COMPONENTS: Record<PartnerTab, React.LazyExoticComponent<React.FC>> = {
  'dashboard': lazy(() => import('./tabs/DashboardTab')),
  'products': lazy(() => import('./tabs/ProductsTab')),
  'buy': lazy(() => import('./tabs/BuyTab')),
  'tradein': lazy(() => import('./tabs/TradeInTab')),
  'orders': lazy(() => import('./tabs/OrdersTab')),
  'vouchers': lazy(() => import('./tabs/VouchersTab')),
  'payouts': lazy(() => import('./tabs/PayoutsTab')),
  'profile': lazy(() => import('./tabs/ProfileTab')),
};

const PartnerPage: React.FC = () => {
  const { user, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const VALID_PARTNER_TABS = PARTNER_TABS.map(t => t.id);
  const rawTab = searchParams.get('tab') as PartnerTab | null;
  const activeTab: PartnerTab = (rawTab && VALID_PARTNER_TABS.includes(rawTab)) ? rawTab : 'dashboard';

  const [visitedTabs, setVisitedTabs] = useState<Set<PartnerTab>>(() => {
    const urlTab = (new URLSearchParams(window.location.search).get('tab') as PartnerTab) || 'dashboard';
    const validUrlTab: PartnerTab = PARTNER_TABS.map(t => t.id).includes(urlTab) ? urlTab : 'dashboard';
    return new Set([validUrlTab]);
  });

  const handleTabChange = useCallback((tab: PartnerTab) => {
    setSearchParams({ tab }, { replace: false });
    setVisitedTabs(prev => new Set([...prev, tab]));
    requestAnimationFrame(() => {
      document.querySelector('.ptn-content')?.scrollTo(0, 0);
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

  const partnerContextValue = useMemo(() => ({
    activeTab,
    setActiveTab: handleTabChange,
  }), [activeTab, handleTabChange]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const activeTabConfig = PARTNER_TABS.find(t => t.id === activeTab);

  useEffect(() => {
    document.title = `${activeTabConfig?.title || '파트너'} | W기프트 파트너`;
    return () => { document.title = 'W기프트 파트너'; };
  }, [activeTabConfig]);

  if (authLoading) return null;

  return (
    <PartnerContext.Provider value={partnerContextValue}>
    <div className="ptn">
      <a
        href="#ptn-main-content"
        className="sr-only"
        style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
        onFocus={e => {
          e.currentTarget.style.position = 'fixed';
          e.currentTarget.style.left = '16px';
          e.currentTarget.style.top = '16px';
          e.currentTarget.style.width = 'auto';
          e.currentTarget.style.height = 'auto';
          e.currentTarget.style.overflow = 'visible';
          e.currentTarget.style.zIndex = '10000';
          e.currentTarget.style.padding = '12px 24px';
          e.currentTarget.style.background = '#059669';
          e.currentTarget.style.color = 'white';
          e.currentTarget.style.borderRadius = '8px';
          e.currentTarget.style.fontSize = '14px';
          e.currentTarget.style.fontWeight = '600';
          e.currentTarget.style.textDecoration = 'none';
        }}
        onBlur={e => {
          e.currentTarget.style.position = 'absolute';
          e.currentTarget.style.left = '-9999px';
          e.currentTarget.style.width = '1px';
          e.currentTarget.style.height = '1px';
          e.currentTarget.style.overflow = 'hidden';
        }}
      >
        메인 콘텐츠로 건너뛰기
      </a>
      {/* Emerald Sidebar (desktop) */}
      <aside className="ptn-sidebar">
        <div className="ptn-sidebar-inner">
          {/* Logo */}
          <div className="ptn-sidebar-logo">
            <div className="ptn-sidebar-logo-icon">
              <Handshake size={22} />
            </div>
            <div>
              <span>W GIFT</span>
              <small style={{ display: 'block', marginLeft: 0 }}>Partner Portal</small>
            </div>
          </div>

          {/* Navigation */}
          <nav className="ptn-nav" aria-label="파트너 메뉴">
            {PARTNER_TABS.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`ptn-nav-item ${isActive ? 'ptn-nav-item--active' : ''}`}
                  onClick={() => handleTabChange(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {isActive && <ChevronRight size={14} className="ptn-nav-item-arrow" />}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="ptn-sidebar-footer">
            <Link to="/" className="ptn-sidebar-link">
              <ExternalLink size={14} />
              <span>사용자 사이트</span>
            </Link>
            <div className="ptn-sidebar-user">
              <div className="ptn-sidebar-avatar">
                {(user?.name || user?.email || 'P').charAt(0).toUpperCase()}
              </div>
              <div className="ptn-sidebar-user-info">
                <span className="ptn-sidebar-user-name">{user?.name || '파트너'}</span>
                <span className="ptn-sidebar-user-email">{user?.email}</span>
              </div>
              <button
                type="button"
                className="ptn-sidebar-logout"
                onClick={handleLogout}
                aria-label="로그아웃"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main id="ptn-main-content" className="ptn-main">
        {/* Content Header */}
        <header className="ptn-content-header">
          <div>
            <h1 className="ptn-content-title">{activeTabConfig?.title || '대시보드'}</h1>
            {activeTabConfig?.description && (
              <p className="ptn-content-desc">{activeTabConfig.description}</p>
            )}
          </div>
        </header>

        {/* Tab Content */}
        <div className="ptn-content">
          <Suspense fallback={
            <div role="status" aria-busy="true" style={{ display: 'flex', justifyContent: 'center', padding: '48px 0', color: 'var(--color-grey-500)' }}>
              로딩 중...
            </div>
          }>
            {PARTNER_TABS.map(({ id }) => {
              if (!visitedTabs.has(id)) return null;
              const TabComponent = TAB_COMPONENTS[id];
              return (
                <div key={id} style={{ display: activeTab === id ? 'block' : 'none' }}>
                  <TabComponent />
                </div>
              );
            })}
          </Suspense>
        </div>
      </main>

      {/* Mobile Bottom Tabbar */}
      <nav className="ptn-mobile-tabbar" aria-label="파트너 메뉴">
        {PARTNER_TABS.map(tab => {
          const MobileIcon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`ptn-mobile-tab ${activeTab === tab.id ? 'ptn-mobile-tab--active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <MobileIcon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
    </PartnerContext.Provider>
  );
};

export default PartnerPage;
