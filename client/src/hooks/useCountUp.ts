/**
 * @file useCountUp.ts
 * @description 숫자 카운트업 애니메이션 훅 - 뷰포트 진입 시 0에서 목표값까지 애니메이션
 * @module hooks
 *
 * 주요 기능:
 * - Intersection Observer로 뷰포트 진입 감지
 * - easeOutExpo 이징으로 자연스러운 애니메이션
 * - prefers-reduced-motion 지원 (동작 감소 모드)
 * - 커스텀 포맷터 및 접두사/접미사 지원
 *
 * 사용 예시:
 * ```tsx
 * const { value, ref, isComplete } = useCountUp({
 *   end: 128500000,
 *   duration: 2000,
 *   suffix: '원',
 *   formatter: (val) => val.toLocaleString('ko-KR'),
 * });
 *
 * return <span ref={ref}>{value}</span>; // "128,500,000원"
 * ```
 */
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 카운트업 옵션 인터페이스
 */
interface UseCountUpOptions {
  /** 목표 숫자 (카운트업 종료값) */
  end: number;
  /** 시작 숫자 (기본값: 0) */
  start?: number;
  /** 애니메이션 지속 시간 (밀리초, 기본값: 2000) */
  duration?: number;
  /** 표시할 소수점 자릿수 (기본값: 0) */
  decimals?: number;
  /** 이징 함수 (기본값: easeOutExpo) */
  easing?: (t: number) => number;
  /** 뷰포트 진입 시 애니메이션 시작 여부 (기본값: true) */
  startOnView?: boolean;
  /** Intersection Observer 임계값 (기본값: 0.3) */
  threshold?: number;
  /** 숫자 포맷팅 함수 (기본값: toLocaleString) */
  formatter?: (value: number) => string;
  /** 접미사 (예: '%', '명', '원') */
  suffix?: string;
  /** 접두사 (예: '₩', '$') */
  prefix?: string;
}

/**
 * 카운트업 반환값 인터페이스
 */
interface UseCountUpReturn {
  /** 포맷팅된 현재 값 (문자열) */
  value: string;
  /** 현재 값 (숫자) */
  rawValue: number;
  /** 뷰포트 감지용 ref (요소에 연결) */
  ref: React.RefObject<HTMLElement | null>;
  /** 애니메이션 완료 여부 */
  isComplete: boolean;
  /** 수동 애니메이션 시작 */
  start: () => void;
  /** 애니메이션 초기화 */
  reset: () => void;
}

/**
 * easeOutExpo 이징 함수 - 빠른 시작, 느린 종료
 * @param t - 진행률 (0-1)
 * @returns 이징 적용된 진행률
 */
const easeOutExpo = (t: number): number => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

/**
 * 숫자 카운트업 애니메이션 훅
 *
 * @param options - 카운트업 옵션
 * @returns 포맷팅된 값, ref, 완료 상태, 제어 함수
 */
export function useCountUp(options: UseCountUpOptions): UseCountUpReturn {
  const {
    end,
    start = 0,
    duration = 2000,
    decimals = 0,
    easing = easeOutExpo,
    startOnView = true,
    threshold = 0.3,
    formatter = (val) => val.toLocaleString('ko-KR'),
    suffix = '',
    prefix = '',
  } = options;

  const [rawValue, setRawValue] = useState(start);
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const ref = useRef<HTMLElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Format the value with prefix/suffix
  const formatValue = useCallback((val: number): string => {
    const roundedVal = Number(val.toFixed(decimals));
    return `${prefix}${formatter(roundedVal)}${suffix}`;
  }, [decimals, formatter, prefix, suffix]);

  // Animation function
  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easing(progress);

    const currentValue = start + (end - start) * easedProgress;
    setRawValue(currentValue);

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setRawValue(end);
      setIsComplete(true);
    }
  }, [start, end, duration, easing]);

  // Start animation
  const startAnimation = useCallback(() => {
    if (hasStarted) return;

    setHasStarted(true);
    setIsComplete(false);
    startTimeRef.current = null;
    animationRef.current = requestAnimationFrame(animate);
  }, [hasStarted, animate]);

  // Reset animation
  const reset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setRawValue(start);
    setIsComplete(false);
    setHasStarted(false);
    startTimeRef.current = null;
  }, [start]);

  // Intersection Observer for viewport detection
  useEffect(() => {
    if (!startOnView || hasStarted) return;

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasStarted) {
            startAnimation();
          }
        });
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [startOnView, threshold, hasStarted, startAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Handle reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches && hasStarted) {
      // Skip animation and show final value immediately
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setRawValue(end);
      setIsComplete(true);
    }
  }, [hasStarted, end]);

  return {
    value: formatValue(rawValue),
    rawValue,
    ref,
    isComplete,
    start: startAnimation,
    reset,
  };
}

export default useCountUp;
