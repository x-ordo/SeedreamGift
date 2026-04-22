/**
 * @file FadeIn/index.tsx
 * @description 스크롤 기반 Fade-in 애니메이션 컴포넌트
 * @module design-system/molecules
 *
 * 뷰포트 진입 시 부드럽게 나타나는 효과
 */
import { ReactNode, useRef, useState, useEffect, memo } from 'react';
import { motion, useInView } from 'motion/react';

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
}

const FadeIn = memo(function FadeIn({
  children,
  className = '',
  direction = 'up',
  distance = 16,
  duration = 0.4,
  delay = 0,
  threshold = 0.1,
  once = true,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, amount: threshold });

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const offset = (() => {
    switch (direction) {
      case 'up': return { x: 0, y: distance };
      case 'down': return { x: 0, y: -distance };
      case 'left': return { x: distance, y: 0 };
      case 'right': return { x: -distance, y: 0 };
      case 'none': return { x: 0, y: 0 };
    }
  })();

  const hidden = {
    opacity: 0,
    x: offset.x,
    y: offset.y,
  };

  const visible = {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
    },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={hidden}
      animate={isInView ? visible : hidden}
    >
      {children}
    </motion.div>
  );
});

export { FadeIn };
export default FadeIn;
