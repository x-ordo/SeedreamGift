/**
 * @file BlurText/index.tsx
 * @description React Bits BlurText 컴포넌트 - 텍스트 블러 reveal 애니메이션
 * @module design-system/molecules
 * @see https://reactbits.dev/text-animations/blur-text
 */
import { useRef, useEffect, useState, memo } from 'react';
import { motion, useInView, Variant } from 'motion/react';

export interface BlurTextProps {
  /** 표시할 텍스트 */
  text: string;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 각 단어/글자 사이 딜레이 (ms) */
  delay?: number;
  /** 애니메이션 단위: 'words' | 'characters' */
  animateBy?: 'words' | 'characters';
  /** 애니메이션 방향 */
  direction?: 'top' | 'bottom' | 'left' | 'right';
  /** Intersection Observer threshold */
  threshold?: number;
  /** 애니메이션 시작 상태 */
  animationFrom?: {
    filter?: string;
    opacity?: number;
    y?: number;
    x?: number;
  };
  /** 애니메이션 완료 콜백 */
  onAnimationComplete?: () => void;
}

const BlurText = memo(function BlurText({
  text,
  className = '',
  delay = 50,
  animateBy = 'words',
  direction = 'bottom',
  threshold = 0.1,
  animationFrom = { filter: 'blur(10px)', opacity: 0, y: 20 },
  onAnimationComplete,
}: BlurTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: threshold });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const elements = animateBy === 'words' ? text.split(' ') : text.split('');

  const getDirectionOffset = () => {
    switch (direction) {
      case 'top': return { y: -20, x: 0 };
      case 'bottom': return { y: 20, x: 0 };
      case 'left': return { y: 0, x: -20 };
      case 'right': return { y: 0, x: 20 };
      default: return { y: 20, x: 0 };
    }
  };

  const offset = getDirectionOffset();

  const variants = {
    hidden: {
      filter: animationFrom.filter || 'blur(10px)',
      opacity: animationFrom.opacity ?? 0,
      y: animationFrom.y ?? offset.y,
      x: animationFrom.x ?? offset.x,
    } as Variant,
    visible: (i: number) => ({
      filter: 'blur(0px)',
      opacity: 1,
      y: 0,
      x: 0,
      transition: {
        delay: prefersReducedMotion ? 0 : i * (delay / 1000),
        duration: prefersReducedMotion ? 0.01 : 0.4,
        ease: [0.2, 0.65, 0.3, 0.9],
      },
    } as Variant),
  };

  if (prefersReducedMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span ref={containerRef} className={`blur-text-container ${className}`}>
      {elements.map((element, i) => (
        <motion.span
          key={`${element}-${i}`}
          custom={i}
          variants={variants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          onAnimationComplete={i === elements.length - 1 ? onAnimationComplete : undefined}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {element}
          {animateBy === 'words' && i < elements.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </span>
  );
});

export { BlurText };
export default BlurText;
