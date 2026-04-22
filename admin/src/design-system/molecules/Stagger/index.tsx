/**
 * @file Stagger/index.tsx
 * @description Stagger 애니메이션 컨테이너 - 자식 요소 순차적 등장
 * @module design-system/molecules
 */
import { ReactNode, useRef, useEffect, useState, Children, memo } from 'react';
import { motion, useInView, Variants } from 'motion/react';

export interface StaggerProps {
  /** 자식 요소들 */
  children: ReactNode;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 각 아이템 사이 딜레이 (초) */
  staggerDelay?: number;
  /** 애니메이션 방향 */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** 이동 거리 (px) */
  distance?: number;
  /** 애니메이션 지속 시간 (초) */
  duration?: number;
  /** Intersection Observer threshold */
  threshold?: number;
  /** 한 번만 애니메이션 */
  once?: boolean;
}

const Stagger = memo(function Stagger({
  children,
  className = '',
  staggerDelay = 0.1,
  direction = 'up',
  distance = 20,
  duration = 0.5,
  threshold = 0.1,
  once = true,
}: StaggerProps) {
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
    }
  };

  const offset = getOffset();

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : staggerDelay,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: {
      opacity: 0,
      x: offset.x,
      y: offset.y,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0.01 : duration,
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
      variants={containerVariants}
      initial="hidden"
      animate={shouldAnimate ? 'visible' : 'hidden'}
    >
      {Children.map(children, (child) => (
        <motion.div variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
});

export { Stagger };
export default Stagger;
