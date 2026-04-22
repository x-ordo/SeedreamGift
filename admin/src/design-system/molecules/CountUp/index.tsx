/**
 * @file CountUp/index.tsx
 * @description React Bits CountUp 컴포넌트 - 숫자 카운트업 애니메이션
 * @module design-system/molecules
 * @see https://reactbits.dev/text-animations/count-up
 *
 * Swift Trust Design System 적용:
 * - 스프링 물리 기반 부드러운 애니메이션
 * - 뷰포트 진입 시 자동 시작
 * - 접근성 고려 (prefers-reduced-motion)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring } from 'motion/react';

export interface CountUpProps {
  /** 목표 숫자 */
  to: number;
  /** 시작 숫자 (기본: 0) */
  from?: number;
  /** 카운트 방향 */
  direction?: 'up' | 'down';
  /** 시작 지연 시간 (초) */
  delay?: number;
  /** 애니메이션 지속 시간 (초) */
  duration?: number;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 조건부 시작 */
  startWhen?: boolean;
  /** 천단위 구분자 */
  separator?: string;
  /** 애니메이션 시작 콜백 */
  onStart?: () => void;
  /** 애니메이션 종료 콜백 */
  onEnd?: () => void;
  /** 접두사 (예: '₩') */
  prefix?: string;
  /** 접미사 (예: '명', '%') */
  suffix?: string;
}

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = ',',
  onStart,
  onEnd,
  prefix = '',
  suffix = '',
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const motionValue = useMotionValue(direction === 'down' ? to : from);

  // Spring physics based on duration
  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);

  const springValue = useSpring(motionValue, {
    damping,
    stiffness,
  });

  const isInView = useInView(ref, { once: true, margin: '0px' });

  // Listen for reduced motion preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Calculate decimal places
  const getDecimalPlaces = (num: number): number => {
    const str = num.toString();
    if (str.includes('.')) {
      const decimals = str.split('.')[1];
      if (parseInt(decimals) !== 0) {
        return decimals.length;
      }
    }
    return 0;
  };

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  // Format value with separator and prefix/suffix
  const formatValue = useCallback(
    (latest: number): string => {
      const hasDecimals = maxDecimals > 0;
      const options: Intl.NumberFormatOptions = {
        useGrouping: !!separator,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0,
      };

      const formattedNumber = new Intl.NumberFormat('ko-KR', options).format(latest);
      const result = separator
        ? formattedNumber.replace(/,/g, separator)
        : formattedNumber;

      return `${prefix}${result}${suffix}`;
    },
    [maxDecimals, separator, prefix, suffix]
  );

  // Set initial value
  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(direction === 'down' ? to : from);
    }
  }, [from, to, direction, formatValue]);

  // Start animation when in view
  useEffect(() => {
    if (isInView && startWhen) {
      // For reduced motion, show final value immediately
      if (prefersReducedMotion) {
        if (ref.current) {
          ref.current.textContent = formatValue(direction === 'down' ? from : to);
        }
        if (typeof onStart === 'function') onStart();
        if (typeof onEnd === 'function') onEnd();
        return;
      }

      if (typeof onStart === 'function') onStart();

      const timeoutId = setTimeout(() => {
        motionValue.set(direction === 'down' ? from : to);
      }, delay * 1000);

      const durationTimeoutId = setTimeout(
        () => {
          if (typeof onEnd === 'function') onEnd();
        },
        delay * 1000 + duration * 1000
      );

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(durationTimeoutId);
      };
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay, onStart, onEnd, duration, prefersReducedMotion, formatValue]);

  // Update text content on value change
  useEffect(() => {
    if (prefersReducedMotion) return;

    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest);
      }
    });
    return () => unsubscribe();
  }, [springValue, formatValue, prefersReducedMotion]);

  return <span className={className} ref={ref} />;
}

export { CountUp };
