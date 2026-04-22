/**
 * @file TiltedCard/index.tsx
 * @description React Bits TiltedCard 컴포넌트 - 3D 틸트 효과 카드
 * @module design-system/molecules
 * @see https://reactbits.dev/components/tilted-card
 *
 * Swift Trust Design System 적용:
 * - 부드러운 스프링 애니메이션
 * - 디자인 토큰 사용
 * - 접근성 고려 (prefers-reduced-motion)
 */
import { useRef, useState, ReactNode, useEffect } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import './TiltedCard.css';

export interface TiltedCardProps {
  /** 카드 내부 콘텐츠 */
  children: ReactNode;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 컨테이너 너비 */
  containerWidth?: string | number;
  /** 컨테이너 높이 */
  containerHeight?: string | number;
  /** 호버 시 스케일 */
  scaleOnHover?: number;
  /** 회전 강도 (도) */
  rotateAmplitude?: number;
  /** 스프링 강성 */
  springStiffness?: number;
  /** 스프링 댐핑 */
  springDamping?: number;
  /** 클릭 이벤트 핸들러 */
  onClick?: () => void;
  /** 키보드 접근성 지원 */
  tabIndex?: number;
  /** 접근성 레이블 */
  ariaLabel?: string;
}

export default function TiltedCard({
  children,
  className = '',
  containerWidth = '100%',
  containerHeight = '100%',
  scaleOnHover = 1.02,
  rotateAmplitude = 8,
  springStiffness = 300,
  springDamping = 20,
  onClick,
  tabIndex = 0,
  ariaLabel,
}: TiltedCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Motion values for mouse position
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Listen for reduced motion preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Spring configuration
  const springConfig = {
    stiffness: springStiffness,
    damping: springDamping,
  };

  // Transform mouse position to rotation
  const rotateX = useSpring(
    useTransform(mouseY, [-0.5, 0.5], [rotateAmplitude, -rotateAmplitude]),
    springConfig
  );
  const rotateY = useSpring(
    useTransform(mouseX, [-0.5, 0.5], [-rotateAmplitude, rotateAmplitude]),
    springConfig
  );
  const scale = useSpring(isHovering ? scaleOnHover : 1, springConfig);

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    mouseX.set(x);
    mouseY.set(y);
  };

  // Handle mouse enter/leave
  const handleMouseEnter = () => {
    if (!prefersReducedMotion) {
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <motion.div
      ref={containerRef}
      className={`tilted-card ${className}`}
      style={{
        width: containerWidth,
        height: containerHeight,
        perspective: 1000,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={tabIndex}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel}
    >
      <motion.div
        className="tilted-card-inner"
        style={{
          rotateX: prefersReducedMotion ? 0 : rotateX,
          rotateY: prefersReducedMotion ? 0 : rotateY,
          scale: prefersReducedMotion ? (isHovering ? scaleOnHover : 1) : scale,
          transformStyle: 'preserve-3d',
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export { TiltedCard };
