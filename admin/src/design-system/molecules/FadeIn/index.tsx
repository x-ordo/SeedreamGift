/**
 * @file FadeIn/index.tsx
 * @description 스크롤 기반 Fade-in 애니메이션 컴포넌트
 * @module design-system/molecules
 *
 * 뷰포트 진입 시 부드럽게 나타나는 효과
 */
import { ReactNode, useRef, useEffect, useState, memo } from 'react';
import { motion, useInView, Variants } from 'motion/react';

export interface FadeInProps {
  /** 자식 요소 */
  children: ReactNode;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 애니메이션 방향 */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  /** 이동 거리 (px) */
  distance?: number;
  /** 애니메이션 지속 시간 (초) */
  duration?: number;
  /** 시작 지연 시간 (초) */
  delay?: number;
  /** Intersection Observer threshold */
  threshold?: number;
  /** 한 번만 애니메이션 */
  once?: boolean;
  /** 블러 효과 추가 */
  blur?: boolean;
  /** 스케일 효과 */
  scale?: number;
}

const FadeIn = memo(function FadeIn({
  children,
  className = '',
  direction = 'up',
  distance = 30,
  duration = 0.6,
  delay = 0,
  threshold = 0.1,
  once = true,
  blur = false,
  scale = 1,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, amount: threshold });
  const [mounted, setMounted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const shouldAnimate = mounted && isInView;

  const getOffset = () => {
    switch (direction) {
      case 'up': return { x: 0, y: distance };
      case 'down': return { x: 0, y: -distance };
      case 'left': return { x: distance, y: 0 };
      case 'right': return { x: -distance, y: 0 };
      case 'none': return { x: 0, y: 0 };
    }
  };

  const offset = getOffset();

  const variants: Variants = {
    hidden: {
      opacity: 0,
      x: offset.x,
      y: offset.y,
      scale: scale < 1 ? scale : 1,
      filter: blur ? 'blur(10px)' : 'blur(0px)',
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        duration: prefersReducedMotion ? 0.01 : duration,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  };

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={variants}
      initial="hidden"
      animate={shouldAnimate ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  );
});

export { FadeIn };
export default FadeIn;
