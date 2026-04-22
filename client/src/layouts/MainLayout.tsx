/**
 * @file MainLayout.tsx
 * @description 메인 레이아웃 - 헤더/푸터/네비게이션 포함 공통 레이아웃
 * @module layouts
 *
 * 구조:
 * - Header: 상단 네비게이션 + 로고
 * - AnimatePresence + motion.main: 페이지 전환 애니메이션
 * - Footer: 하단 정보
 * - BottomNav: 모바일 하단 네비게이션
 * - ScrollTop: 맨 위로 스크롤 버튼
 */
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { BottomNav } from '../components/layout/BottomNav';

const pageVariants = {
  initial: {
    opacity: 0,
  },
  enter: {
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    // exit 애니메이션과 동시 scrollTo 시 jank 방지 — 다음 paint 이후 실행
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="layout-root">
      <a
        href="#main-content"
        className="skip-link"
        style={{
          position: 'absolute',
          top: '-40px',
          left: 0,
          background: 'var(--color-primary, #3182F6)',
          color: 'white',
          padding: '8px 16px',
          zIndex: 'var(--z-modal-backdrop)' as unknown as number,
          transition: 'top 0.2s ease',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: 500,
        }}
        onFocus={(e) => { e.currentTarget.style.top = '0'; }}
        onBlur={(e) => { e.currentTarget.style.top = '-40px'; }}
      >
        본문으로 건너뛰기
      </a>
      <Header />

      <AnimatePresence mode="popLayout">
        {prefersReducedMotion ? (
          <main id="main-content" className="main-content-wrapper" key={location.pathname}>
            <Suspense fallback={<div className="min-h-[60vh]" />}>
              <Outlet />
            </Suspense>
          </main>
        ) : (
          <motion.main
            id="main-content"
            className="main-content-wrapper"
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            style={{ willChange: 'opacity' }}
          >
            <Suspense fallback={<div className="min-h-[60vh]" />}>
              <Outlet />
            </Suspense>
          </motion.main>
        )}
      </AnimatePresence>

      <Footer />
      <BottomNav />

      <button
        type="button"
        id="scroll-top"
        className={`scroll-top flex items-center justify-center ${showScrollTop ? 'show' : ''}`}
        onClick={handleScrollTop}
        aria-label="맨 위로 스크롤"
      >
        <ArrowUp size={20} aria-hidden="true" />
      </button>
    </div>
  );
};

export default MainLayout;
