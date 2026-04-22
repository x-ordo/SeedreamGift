/**
 * @file GradientText/index.tsx
 * @description React Bits GradientText 컴포넌트 - 애니메이션 그라데이션 텍스트
 * @module design-system/molecules
 * @see https://reactbits.dev/text-animations/gradient-text
 *
 * Swift Trust Design System 적용:
 * - 디자인 토큰 사용 (--color-primary, --color-point)
 * - 부드러운 애니메이션 (--transition-slow)
 * - 접근성 고려 (prefers-reduced-motion)
 */
import { useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import {
  motion,
  useMotionValue,
  useAnimationFrame,
  useTransform,
} from 'motion/react';
import './GradientText.css';

export interface GradientTextProps {
  /** 표시할 텍스트 또는 컨텐츠 */
  children: ReactNode;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 그라데이션 색상 배열 (기본: primary → point → primary) */
  colors?: string[];
  /** 애니메이션 속도 (초) - 클수록 느림 */
  animationSpeed?: number;
  /** 테두리 표시 여부 */
  showBorder?: boolean;
  /** 그라데이션 방향 */
  direction?: 'horizontal' | 'vertical' | 'diagonal';
  /** 호버 시 일시정지 */
  pauseOnHover?: boolean;
  /** 왕복 애니메이션 여부 */
  yoyo?: boolean;
}

export default function GradientText({
  children,
  className = '',
  // Swift Trust 디자인 시스템 기본 색상
  colors = ['var(--color-primary)', 'var(--color-point)', 'var(--color-primary)'],
  animationSpeed = 8,
  showBorder = false,
  direction = 'horizontal',
  pauseOnHover = false,
  yoyo = true,
}: GradientTextProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  const animationDuration = animationSpeed * 1000;

  // Listen for reduced motion preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useAnimationFrame((time) => {
    if (isPaused || prefersReducedMotion) {
      lastTimeRef.current = null;
      return;
    }

    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += deltaTime;

    if (yoyo) {
      const fullCycle = animationDuration * 2;
      const cycleTime = elapsedRef.current % fullCycle;

      if (cycleTime < animationDuration) {
        progress.set((cycleTime / animationDuration) * 100);
      } else {
        progress.set(100 - ((cycleTime - animationDuration) / animationDuration) * 100);
      }
    } else {
      progress.set((elapsedRef.current / animationDuration) * 100);
    }
  });

  useEffect(() => {
    elapsedRef.current = 0;
    progress.set(0);
  }, [animationSpeed, progress, yoyo]);

  const backgroundPosition = useTransform(progress, (p) => {
    if (direction === 'horizontal') {
      return `${p}% 50%`;
    } else if (direction === 'vertical') {
      return `50% ${p}%`;
    } else {
      return `${p}% 50%`;
    }
  });

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  const gradientAngle =
    direction === 'horizontal'
      ? 'to right'
      : direction === 'vertical'
        ? 'to bottom'
        : 'to bottom right';
  const gradientColors = [...colors, colors[0]].join(', ');

  const gradientStyle = {
    backgroundImage: `linear-gradient(${gradientAngle}, ${gradientColors})`,
    backgroundSize:
      direction === 'horizontal'
        ? '300% 100%'
        : direction === 'vertical'
          ? '100% 300%'
          : '300% 300%',
    backgroundRepeat: 'repeat',
  };

  return (
    <motion.span
      className={`gradient-text-animated ${showBorder ? 'with-border' : ''} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showBorder && (
        <motion.span
          className="gradient-text-overlay"
          style={{ ...gradientStyle, backgroundPosition }}
        />
      )}
      <motion.span
        className="gradient-text-content"
        style={{ ...gradientStyle, backgroundPosition }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

export { GradientText };
