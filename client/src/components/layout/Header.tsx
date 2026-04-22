/**
 * @file Header.tsx
 * @description 헤더 컴포넌트 - 상단 네비게이션 바 (daisyUI navbar)
 */
import React, { useCallback, memo, useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, User, ChevronDown, Gauge, Receipt, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCartStore } from '../../store/useCartStore';
import { useBrands } from '../../hooks/useBrands';
import { RateTicker } from '../home';
import Logo from '../common/Logo';
import siteConfig from '../../../../site.config.json';
import './Header.css';

// Intl formatters — created once, reused across renders
const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
  weekday: 'short',
});

// 현재 시간 표시 컴포넌트 (분 단위 갱신)
const CurrentTime: React.FC = memo(() => {
  const [time, setTime] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    // Align to the next minute boundary, then tick every 60s
    const msToNextMinute = (60 - new Date().getSeconds()) * 1000;
    const timeout = setTimeout(() => {
      setTime(new Date());
      intervalRef.current = setInterval(() => setTime(new Date()), 60_000);
    }, msToNextMinute);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="header-time">
      <span className="header-time-date">{dateFormatter.format(time)}</span>
      <span className="header-time-clock">{timeFormatter.format(time)}</span>
    </div>
  );
});

CurrentTime.displayName = 'CurrentTime';

const ROUTE_TITLES: Record<string, string> = {
  '/products': '구매',
  '/trade-in': '판매',
  '/rates': '시세조회',
  '/support': '고객센터',
  '/cart': '장바구니',
  '/checkout': '주문/결제',
  '/mypage': '마이페이지',
  '/login': '로그인',
  '/register': '회원가입',
};

function getPageTitle(pathname: string): string {
  if (pathname === '/') return '';
  for (const [route, title] of Object.entries(ROUTE_TITLES)) {
    if (pathname === route || pathname.startsWith(route + '/') || pathname.startsWith(route + '?')) {
      return title;
    }
  }
  if (pathname.startsWith('/voucher-types/')) return '구매';
  return '';
}

export const Header: React.FC = memo(() => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const cartItemCount = useCartStore((state) => state.getItemCount());
  const { data: brands = [] } = useBrands();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showBuyDropdown, setShowBuyDropdown] = useState(false);
  const buyDropdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevCartCount = useRef(cartItemCount);
  const [cartBounce, setCartBounce] = useState(false);
  const currentPageTitle = getPageTitle(location.pathname);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
    setIsDropdownOpen(false);
  }, [logout, navigate]);

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  // buyDropdownTimer 언마운트 클린업
  useEffect(() => {
    return () => {
      if (buyDropdownTimer.current) {
        clearTimeout(buyDropdownTimer.current);
      }
    };
  }, []);

  // 카트 아이템 추가 시 바운스 애니메이션
  useEffect(() => {
    if (cartItemCount > prevCartCount.current) {
      const startTimer = setTimeout(() => setCartBounce(true), 0);
      const endTimer = setTimeout(() => setCartBounce(false), 400);
      prevCartCount.current = cartItemCount;
      return () => { clearTimeout(startTimer); clearTimeout(endTimer); };
    }
    prevCartCount.current = cartItemCount;
  }, [cartItemCount]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // 드롭다운 키보드 내비게이션
  useEffect(() => {
    if (!isDropdownOpen) return;

    const menuEl = dropdownRef.current?.querySelector('[role="menu"]');
    if (!menuEl) return;

    const items = menuEl.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (items.length > 0) {
      requestAnimationFrame(() => items[0].focus());
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const menuItems = menuEl.querySelectorAll<HTMLElement>('[role="menuitem"]');
      if (menuItems.length === 0) return;

      const currentIndex = Array.from(menuItems).indexOf(document.activeElement as HTMLElement);

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
          menuItems[nextIndex].focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
          menuItems[prevIndex].focus();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setIsDropdownOpen(false);
          document.getElementById('user-menu-button')?.focus();
          break;
        }
        case 'Tab': {
          setIsDropdownOpen(false);
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen]);

  return (
    <>
    <a
      href="#main-content"
      className="sr-only"
      style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
      onFocus={e => { e.currentTarget.style.position = 'fixed'; e.currentTarget.style.left = '16px'; e.currentTarget.style.top = '16px'; e.currentTarget.style.width = 'auto'; e.currentTarget.style.height = 'auto'; e.currentTarget.style.overflow = 'visible'; e.currentTarget.style.zIndex = '10000'; e.currentTarget.style.padding = '12px 24px'; e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderRadius = '12px'; e.currentTarget.style.fontSize = '14px'; e.currentTarget.style.fontWeight = '600'; e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
      onBlur={e => { e.currentTarget.style.position = 'absolute'; e.currentTarget.style.left = '-9999px'; e.currentTarget.style.width = '1px'; e.currentTarget.style.height = '1px'; e.currentTarget.style.overflow = 'hidden'; }}
    >메인 콘텐츠로 건너뛰기</a>
    <header className="header-bar navbar" role="banner">
       <div className="header-inner">
        {/* Left: Logo + mobile page title */}
        <div className="header-left">
          <Link className="header-logo" to="/" aria-label={`${siteConfig.company.brand} 홈으로 이동`}>
            <Logo size={32} />
          </Link>
          {currentPageTitle && (
            <span className="header-mobile-title">{currentPageTitle}</span>
          )}
        </div>

        {/* Center: Main Navigation (Desktop) */}
        <div className="header-center">
          <nav className="flex items-center gap-2" aria-label="메인 메뉴">
            {/* 구매 - with brand dropdown */}
            <div
              className="header-nav-dropdown"
              onMouseEnter={() => {
                if (buyDropdownTimer.current) clearTimeout(buyDropdownTimer.current);
                setShowBuyDropdown(true);
              }}
              onMouseLeave={() => {
                buyDropdownTimer.current = setTimeout(() => setShowBuyDropdown(false), 150);
              }}
            >
              <NavLink to="/products" className={({ isActive }) => `header-nav-item ${isActive ? 'active' : ''}`}>
                구매
              </NavLink>
              {showBuyDropdown && (
                <div className="header-nav-dropdown-menu">
                  <Link to="/products" className="header-nav-dropdown-item" onClick={() => setShowBuyDropdown(false)}>
                    전체 상품
                  </Link>
                  <div className="header-nav-dropdown-divider" />
                  {brands.filter(b => b.isActive).map(brand => (
                    <Link key={brand.code} to={`/voucher-types/${brand.code}`} className="header-nav-dropdown-item" onClick={() => setShowBuyDropdown(false)}>
                      {brand.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <NavLink to="/trade-in" className={({ isActive }) => `header-nav-item ${isActive ? 'active' : ''}`}>
              판매
            </NavLink>
            <NavLink to="/rates" className={({ isActive }) => `header-nav-item ${isActive ? 'active' : ''}`}>
              시세조회
            </NavLink>
            <NavLink to="/support" className={({ isActive }) => `header-nav-item ${isActive ? 'active' : ''}`}>
              고객센터
            </NavLink>
          </nav>
        </div>

        {/* Right: Ticker, Time, Actions */}
        <div className="header-right">
          {/* Ticker & Time (Desktop only) */}
          <div className="header-info-group">
            <div className="header-ticker-wrapper">
              <RateTicker mode="both" interval={3500} compact />
            </div>
            <CurrentTime />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Cart with indicator badge (PARTNER 계정에는 노출하지 않음) */}
            {user?.role !== 'PARTNER' && (
              <Link to="/cart" className={`header-icon-btn${cartBounce ? ' cart-bounce' : ''}`} aria-label={`장바구니 ${cartItemCount > 0 ? `(${cartItemCount}개)` : ''}`}>
                <ShoppingBag size={20} aria-hidden="true" />
                {cartItemCount > 0 && (
                  <span className="header-cart-badge">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </Link>
            )}

            {isLoading ? (
              <div className="flex items-center gap-2" aria-hidden="true">
                <div className="skeleton w-11 h-11 rounded-full" />
              </div>
            ) : isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  id="user-menu-button"
                  className="header-user-btn"
                  onClick={toggleDropdown}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="menu"
                  aria-label={`${user?.name || '회원'}님 메뉴`}
                >
                  <div className="header-user-avatar">
                    {user?.name?.charAt(0) || user?.username?.charAt(0) || 'U'}
                  </div>
                  <span className="header-user-name">{user?.name || user?.username}</span>
                  <ChevronDown size={14} className="header-user-chevron" />
                </button>

                {isDropdownOpen && (
                  <ul className="header-dropdown-menu" role="menu">
                    {user?.role === 'ADMIN' && (
                      <>
                        <li>
                          <Link to="/admin" role="menuitem" onClick={closeDropdown}>
                            <Gauge size={18} aria-hidden="true" />
                            관리자
                          </Link>
                        </li>
                        <li className="header-dropdown-divider" />
                      </>
                    )}
                    <li>
                      <Link to="/mypage?tab=settings" role="menuitem" onClick={closeDropdown}>
                        <User size={18} aria-hidden="true" />
                        마이페이지
                      </Link>
                    </li>
                    <li>
                      <Link to="/mypage?tab=orders" role="menuitem" onClick={closeDropdown}>
                        <Receipt size={18} aria-hidden="true" />
                        주문내역
                      </Link>
                    </li>
                    <li className="header-dropdown-divider" />
                    <li>
                      <button type="button" role="menuitem" onClick={handleLogout}>
                        <LogOut size={18} aria-hidden="true" />
                        로그아웃
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="header-btn-login">로그인</Link>
                <Link to="/register" className="header-btn-cta">가입</Link>
              </div>
            )}
          </div>
        </div>
       </div>
    </header>
    </>
  );
});

Header.displayName = 'Header';
export default Header;
