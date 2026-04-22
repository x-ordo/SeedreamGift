/**
 * @file Aurora/index.tsx
 * @description Aurora 배경 효과 컴포넌트 (CSS 기반)
 * @module design-system/molecules
 *
 * React Bits Aurora 컴포넌트의 CSS-only 버전
 *
 * Swift Trust Design System 적용:
 * - 디자인 토큰 색상 사용
 * - 부드러운 애니메이션
 * - 접근성 고려 (prefers-reduced-motion)
 */
import { memo, useEffect, useState } from 'react';
import './Aurora.css';

export interface AuroraProps {
  /** 추가 CSS 클래스 */
  className?: string;
  /** 그라데이션 색상 배열 */
  colors?: string[];
  /** 애니메이션 속도 (초) */
  speed?: number;
  /** 블러 강도 (px) */
  blur?: number;
  /** 불투명도 (0-1) */
  opacity?: number;
  /** 애니메이션 활성화 */
  animate?: boolean;
}

const Aurora = memo(function Aurora({
  className = '',
  colors = [
    'var(--color-primary)',
    'var(--color-point)',
    'var(--color-blue-300)',
  ],
  speed = 8,
  blur = 80,
  opacity = 0.6,
  animate = true,
}: AuroraProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Listen for reduced motion preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const shouldAnimate = animate && !prefersReducedMotion;

  return (
    <div
      className={`aurora-container ${className}`}
      aria-hidden="true"
      style={{
        '--aurora-speed': `${speed}s`,
        '--aurora-blur': `${blur}px`,
        '--aurora-opacity': opacity,
        '--aurora-color-1': colors[0] || 'var(--color-primary)',
        '--aurora-color-2': colors[1] || 'var(--color-point)',
        '--aurora-color-3': colors[2] || 'var(--color-blue-300)',
      } as React.CSSProperties}
    >
      <div
        className={`aurora-blob aurora-blob-1 ${shouldAnimate ? 'aurora-animate' : ''}`}
      />
      <div
        className={`aurora-blob aurora-blob-2 ${shouldAnimate ? 'aurora-animate' : ''}`}
      />
      <div
        className={`aurora-blob aurora-blob-3 ${shouldAnimate ? 'aurora-animate' : ''}`}
      />
    </div>
  );
});

export { Aurora };
export default Aurora;
