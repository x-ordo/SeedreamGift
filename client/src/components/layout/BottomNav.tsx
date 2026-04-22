/**
 * @file BottomNav.tsx
 * @description 모바일 하단 네비게이션 - iOS/Android 스타일 탭 바
 *
 * 탭:
 * - 홈: 메인 페이지
 * - 구매: 상품 목록
 * - 판매: 매입 신청
 * - 장바구니: 장바구니 (배지)
 * - 마이: 마이페이지
 *
 * NOTE: 768px 이상에서는 CSS로 숨김
 */
import React, { memo, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ShoppingBag, Coins, TrendingUp, User } from 'lucide-react';
import { useCartStore } from '../../store/useCartStore';
import './BottomNav.css';

/**
 * CSS :has() 미지원 브라우저에서 FixedBottomCTA가 있을 때 BottomNav를 숨기는 fallback.
 * MutationObserver로 .bottom-cta--fixed 존재 여부를 감지하여 nav에 hidden 클래스 적용.
 */
function useHideWhenFixedCTA(navRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    // CSS :has() 지원 시 JS fallback 불필요
    try {
      if (CSS.supports('selector(:has(*))')) return;
    } catch {
      // CSS.supports('selector(...)') 미지원 브라우저 → fallback 실행
    }

    const nav = navRef.current;
    if (!nav) return;

    const update = () => {
      const hasFixedCTA = !!document.querySelector('.bottom-cta--fixed');
      nav.classList.toggle('bottom-nav--hidden-by-cta', hasFixedCTA);
      // 하단 패딩 JS 폴백 (reset.css의 body.has-fixed-cta 선택자용)
      document.body.classList.toggle('has-fixed-cta', hasFixedCTA);
    };

    update();

    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [navRef]);
}

export const BottomNav: React.FC = memo(() => {
  const cartItemCount = useCartStore((state) => state.getItemCount());
  const navRef = useRef<HTMLElement>(null);
  useHideWhenFixedCTA(navRef);

  return (
    <nav ref={navRef} className="bottom-nav" aria-label="모바일 메뉴" role="navigation">
      <NavLink to="/" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`} end>
        <Home size={22} aria-hidden="true" />
        <span>홈</span>
      </NavLink>

      <NavLink to="/products" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <span className="bottom-nav-icon-wrap">
          <ShoppingBag size={22} aria-hidden="true" />
          {cartItemCount > 0 && (
            <span className="bottom-nav-badge" aria-hidden="true">
              {cartItemCount > 99 ? '99' : cartItemCount}
            </span>
          )}
        </span>
        <span>구매</span>
      </NavLink>

      <NavLink to="/trade-in" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <Coins size={22} aria-hidden="true" />
        <span>판매</span>
      </NavLink>

      <NavLink to="/rates" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <TrendingUp size={22} aria-hidden="true" />
        <span>시세</span>
      </NavLink>

      <NavLink to="/mypage" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <User size={22} aria-hidden="true" />
        <span>마이</span>
      </NavLink>
    </nav>
  );
});

BottomNav.displayName = 'BottomNav';
export default BottomNav;
