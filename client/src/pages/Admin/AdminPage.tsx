/**
 * @file AdminPage.tsx
 * @description 관리자 대시보드 - 탭 기반 플랫폼 전체 관리 허브
 * @module pages/Admin
 * @route /admin
 *
 * 사용처:
 * - AppRouter: /admin 경로에서 ADMIN 역할 사용자에게만 렌더링 (MainLayout 외부)
 *
 * 탭 구조 (15개):
 * - dashboard: 대시보드 홈 (통계 개요)
 * - users: 회원 관리 (KYC, 역할)
 * - sessions: 세션 관리 (로그인 기록)
 * - products: 상품 관리 (가격, 할인율)
 * - brands: 브랜드 관리 (코드, 이미지)
 * - vouchers: 재고(PIN) 관리 (발급, 상태)
 * - orders: 주문 관리 (결제, 배송)
 * - tradeins: 매입 신청 관리 (검증, 정산)
 * - gifts: 선물 관리 (발신/수신)
 * - notices: 공지사항 관리 (CRUD)
 * - events: 이벤트 관리 (기간, 배너)
 * - faqs: FAQ 관리 (카테고리별)
 * - inquiries: 1:1 문의 관리 (답변)
 * - configs: 시스템 설정 (key-value)
 * - audit-logs: 감사 로그 (액션 기록)
 *
 * 최적화:
 * - lazy() + keep-mounted 패턴으로 탭 컴포넌트 지연 로딩
 * - 한번 방문한 탭은 display:none으로 숨겨 상태 보존
 * - Suspense fallback으로 로딩 상태 표시
 *
 * 레이아웃:
 * - MainLayout 없이 독립 레이아웃 (관리자 전용 헤더)
 * - 데스크탑: 사이드바 + 콘텐츠 그리드
 * - 모바일: 하단 탭바 (주요 5개) + 더보기 시트
 */
import { useState, lazy, Suspense, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { ShieldCheck, ExternalLink, UserCircle, LogOut, LayoutGrid, X } from 'lucide-react';
import ErrorBoundaryFallback from '@/components/common/ErrorBoundaryFallback';
import { useAuth } from '@/contexts/AuthContext';
import { Card, ListRow, ListHeader, Loader, Button } from '@/design-system';
import { COLORS, SPACING } from '@/constants/designTokens';
import { AdminTab, ADMIN_TABS, TAB_GROUPS, ROLES, ADMIN_LAYOUT } from './constants';
import { AdminContext } from './AdminContext';
import siteConfig from '../../../../site.config.json';
import './AdminPage.css';

/**
 * 관리자 탭 컴포넌트들을 lazy 로딩으로 정의합니다.
 * 초기 번들 크기를 줄이고, 관리자가 실제로 해당 메뉴를 클릭했을 때만 리소스를 로드합니다.
 */
const TAB_COMPONENTS: Record<AdminTab, React.LazyExoticComponent<React.FC>> = {
  'dashboard': lazy(() => import('./tabs/DashboardTab')),
  'users': lazy(() => import('./tabs/UsersTab')),
  'sessions': lazy(() => import('./tabs/SessionsTab')),
  'partners': lazy(() => import('./tabs/PartnersTab')),
  'products': lazy(() => import('./tabs/ProductsTab')),
  'brands': lazy(() => import('./tabs/BrandsTab')),
  'vouchers': lazy(() => import('./tabs/VouchersTab')),
  'orders': lazy(() => import('./tabs/OrdersTab')),
  'tradeins': lazy(() => import('./tabs/TradeInsTab')),
  'gifts': lazy(() => import('./tabs/GiftsTab')),
  'refunds': lazy(() => import('./tabs/RefundsTab')),
  'cash-receipts': lazy(() => import('./tabs/CashReceiptsTab')),
  'notices': lazy(() => import('./tabs/NoticesTab')),
  'events': lazy(() => import('./tabs/EventsTab')),
  'faqs': lazy(() => import('./tabs/FaqsTab')),
  'inquiries': lazy(() => import('./tabs/InquiriesTab')),
  'notification-channels': lazy(() => import('./tabs/NotificationChannelsTab')),
  'configs': lazy(() => import('./tabs/ConfigsTab')),
  'audit-logs': lazy(() => import('./tabs/AuditLogsTab')),
};

/**
 * 모바일 하단 탭바에 노출할 우선순위가 높은 탭 목록입니다.
 */
const MOBILE_QUICK_TABS = ['dashboard', 'users', 'products', 'orders', 'tradeins'] as const;

/**
 * 관리자 페이지 메인 컴포넌트입니다.
 * 
 * 주요 설계 원칙:
 * 1. 상태 보존 (Keep-mounted): `visitedTabs` 상태를 통해 한 번이라도 방문한 탭은 DOM에서 제거하지 않고
 *    `display: none`으로 처리합니다. 이를 통해 탭 전환 시 검색 필터나 입력 중인 폼 데이터가 유지됩니다.
 * 2. 독립적 레이아웃: 일반 사용자 사이트와 디자인 시스템 및 네비게이션 구조가 다르므로 독립된 헤더와 사이드바를 가집니다.
 * 3. 권한 기반 데이터 전달: `AdminContext`를 통해 현재 활성화된 탭 정보와 탭 전환 함수를 하위 컴포넌트에 공급합니다.
 * 4. 반응형 대응: 데스크탑의 그룹화된 사이드바와 모바일의 하단 탭바/풀다운 시트 메뉴를 모두 지원합니다.
 */
const AdminPage: React.FC = () => {
  const { user, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [visitedTabs, setVisitedTabs] = useState<Set<AdminTab>>(new Set(['dashboard']));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /**
   * 탭 전환 시 방문 기록에 추가하여 이후 keep-mounted 대상이 되게 합니다.
   * 또한 모바일 환경에서는 메뉴 선택 후 자동으로 메뉴 시트를 닫습니다.
   */
  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setVisitedTabs(prev => new Set([...prev, tab]));
    setMobileMenuOpen(false);
  };

  // Context value 최적화
  const adminContextValue = useMemo(() => ({
    activeTab,
    setActiveTab: handleTabChange,
  }), [activeTab]);

  /**
   * 관리자 로그아웃 처리 후 로그인 페이지로 이동합니다.
   */
  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const activeTabConfig = ADMIN_TABS.find(t => t.id === activeTab);

  /**
   * 활성화된 탭에 맞춰 문서 타이틀을 업데이트합니다.
   */
  useEffect(() => {
    document.title = `${activeTabConfig?.title || '관리'} | ${siteConfig.company.brand} Admin`;
    return () => { document.title = `${siteConfig.company.brand} Admin`; };
  }, [activeTabConfig]);

  if (authLoading) return null;

  return (
    <AdminContext.Provider value={adminContextValue}>
    <div className="admin-root">
      {/* 관리자 전용 상단 바: 플랫폼 로고, 사용자 정보, 사용자 사이트 바로가기 제공 */}
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-topbar-left">
            <div className="admin-topbar-logo">
              <ShieldCheck size={20} aria-hidden="true" />
              <span>{siteConfig.company.brand} Admin</span>
            </div>
          </div>
          <div className="admin-topbar-right">
            <Link to="/" className="admin-topbar-link">
              <ExternalLink size={16} aria-hidden="true" />
              <span>사용자 사이트</span>
            </Link>
            <div className="admin-topbar-divider" />
            <div className="admin-topbar-user">
              <UserCircle size={18} aria-hidden="true" />
              <span>{user?.name || user?.email}</span>
            </div>
            <button
              type="button"
              className="admin-topbar-logout"
              onClick={handleLogout}
              aria-label="로그아웃"
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="admin-page" style={{ backgroundColor: COLORS.bgSecondary, minHeight: 'calc(100vh - 56px)' }}>
        <div className="admin-container">
          {/* 페이지 헤더: 현재 탭의 목적과 설명을 표시 */}
          <header className="admin-header">
            <ListHeader
              title={<ListHeader.TitleParagraph typography="t4" fontWeight="bold">{activeTabConfig?.title || '관리 대시보드'}</ListHeader.TitleParagraph>}
              description={<ListHeader.DescriptionParagraph>{activeTabConfig?.description || '플랫폼의 모든 데이터와 시스템 설정을 관리합니다.'}</ListHeader.DescriptionParagraph>}
              descriptionPosition="bottom"
            />
          </header>

        <div className="admin-layout">
          {/* 데스크톱 사이드바: 탭 그룹별 분류를 통해 많은 관리 메뉴를 체계적으로 배치 */}
          <aside className="admin-sidebar">
            <Card padding="none" shadow="sm" style={{ position: 'sticky', top: ADMIN_LAYOUT.STICKY_TOP, border: `1px solid ${COLORS.grey200}` }}>
              <nav aria-label="관리자 메뉴" style={{ maxHeight: ADMIN_LAYOUT.NAV_MAX_HEIGHT, overflowY: 'auto' }}>
                {TAB_GROUPS.map(group => {
                  const groupTabs = ADMIN_TABS.filter(t => t.group === group.id);
                  if (groupTabs.length === 0) return null;
                  return (
                    <div key={group.id}>
                      <div style={{
                        padding: `${SPACING[3]} ${SPACING[4]}`,
                        fontSize: '11px',
                        fontWeight: 700,
                        color: COLORS.grey400,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.5px',
                      }}>
                        {group.label}
                      </div>
                      {groupTabs.map(item => {
                        const TabIcon = item.icon;
                        return (
                        <ListRow
                          key={item.id}
                          left={
                            <div
                              className="list-row-asset-icon list-row-asset-icon--squircle list-row-asset-icon--size-small"
                              style={{ backgroundColor: activeTab === item.id ? COLORS.primaryLight : COLORS.grey100 }}
                            >
                              <TabIcon size={18} aria-hidden="true" />
                            </div>
                          }
                          contents={
                            <ListRow.Texts
                              type="1RowTypeA"
                              top={
                                <span style={{ fontWeight: activeTab === item.id ? 700 : 500, color: activeTab === item.id ? COLORS.primary : COLORS.grey700 }}>
                                  {item.label}
                                </span>
                              }
                            />
                          }
                          onClick={() => handleTabChange(item.id as AdminTab)}
                          border="indented"
                          verticalPadding="md"
                          style={{ backgroundColor: activeTab === item.id ? COLORS.primaryLight : 'transparent', cursor: 'pointer' }}
                        />
                        );
                      })}
                    </div>
                  );
                })}
              </nav>
            </Card>
          </aside>

          {/* 메인 콘텐츠 영역: Suspense를 사용하여 lazy 로딩되는 탭 컴포넌트의 대기 상태를 관리 */}
          <section className="admin-content">
            <Card padding="lg" shadow="md" style={{ minHeight: '400px', border: `1px solid ${COLORS.grey200}` }}>
              <ErrorBoundary FallbackComponent={ErrorBoundaryFallback} resetKeys={[activeTab]}>
                <Suspense fallback={<Loader size="md" label="로딩 중..." />}>
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
              </ErrorBoundary>
            </Card>
          </section>
        </div>

        {/* 모바일 하단 탭바: 한 손 조작이 용이하도록 주요 관리 기능에 빠른 접근을 제공 */}
        <nav className="admin-mobile-tabbar" aria-label="빠른 메뉴">
          {MOBILE_QUICK_TABS.map(tabId => {
            const tab = ADMIN_TABS.find(t => t.id === tabId)!;
            const MobileTabIcon = tab.icon;
            return (
              <button
                key={tabId}
                className={`admin-mobile-tab ${activeTab === tabId ? 'active' : ''}`}
                onClick={() => handleTabChange(tabId)}
                aria-current={activeTab === tabId ? 'page' : undefined}
              >
                <MobileTabIcon size={20} aria-hidden="true" />
                <span>{tab.label.replace(' 관리', '').replace(' 신청', '')}</span>
              </button>
            );
          })}
          {/* 더보기 버튼 */}
          <button
            className={`admin-mobile-tab ${mobileMenuOpen ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="더 많은 메뉴"
          >
            <LayoutGrid size={20} aria-hidden="true" />
            <span>더보기</span>
          </button>
        </nav>

        {/* 모바일 전체 메뉴 시트: 하단 바에 포함되지 않은 모든 메뉴를 그리드 형태로 제공 */}
        {mobileMenuOpen && (
          <>
            <div className="admin-mobile-overlay" role="button" tabIndex={0} aria-label="메뉴 닫기" onClick={() => setMobileMenuOpen(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMobileMenuOpen(false); } }} />
            <div className="admin-mobile-sheet">
              <div className="admin-mobile-sheet-header">
                <h3>전체 메뉴</h3>
                <button onClick={() => setMobileMenuOpen(false)} aria-label="닫기">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="admin-mobile-sheet-grid">
                {ADMIN_TABS.map(item => {
                  const MenuIcon = item.icon;
                  return (
                  <button
                    key={item.id}
                    className={`admin-mobile-menu-item ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => handleTabChange(item.id as AdminTab)}
                  >
                    <MenuIcon size={20} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
    </AdminContext.Provider>
  );
};

export default AdminPage;

