/**
 * @file useMediaQuery.ts
 * @description 반응형 미디어 쿼리 훅 - 디바이스 유형 및 사용자 환경설정 감지
 * @module hooks
 *
 * 주요 기능:
 * - CSS 미디어 쿼리 매칭 상태 추적
 * - 프리셋 브레이크포인트 (sm: 576, md: 768, lg: 1024, xl: 1280)
 * - 디바이스 타입 감지 (모바일, 태블릿, 데스크탑)
 * - 사용자 환경설정 감지 (다크모드, 동작 감소 모드)
 *
 * 사용 예시:
 * ```tsx
 * // 기본 미디어 쿼리
 * const matches = useMediaQuery('(min-width: 768px)');
 *
 * // 프리셋 훅 사용
 * const isMobile = useIsMobile();
 * const isDesktop = useIsDesktop();
 * const prefersDark = usePrefersDarkMode();
 *
 * // 조건부 값
 * const columns = useResponsiveValue({ mobile: 1, tablet: 2, desktop: 4 });
 * ```
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * 미디어 쿼리 매칭 상태를 반환하는 훅
 *
 * @param query - CSS 미디어 쿼리 문자열 (예: '(min-width: 768px)')
 * @returns 쿼리 매칭 여부 (boolean)
 *
 * @example
 * const isWide = useMediaQuery('(min-width: 1024px)');
 */
export const useMediaQuery = (query: string): boolean => {
    const [matches, setMatches] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const media = window.matchMedia(query);
        const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [query]);

    return matches;
};

/**
 * 프리셋 브레이크포인트 (576/768/1024/1280 통일)
 * CSS 변수 및 designTokens와 동기화 유지
 */
const BREAKPOINTS = {
    sm: 576,
    md: 768,
    lg: 1024,
    xl: 1280,
} as const;

/**
 * 모바일 디바이스 여부 (< 768px)
 * @returns 모바일이면 true
 */
export const useIsMobile = (): boolean => {
    return useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);
};

/**
 * 태블릿 디바이스 여부 (768px - 1023px)
 * @returns 태블릿이면 true
 */
export const useIsTablet = (): boolean => {
    return useMediaQuery(
        `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`
    );
};

/**
 * 데스크탑 디바이스 여부 (>= 1024px)
 * @returns 데스크탑이면 true
 */
export const useIsDesktop = (): boolean => {
    return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
};

/**
 * 터치 디바이스 여부 (hover 불가능 + 터치 포인터)
 * @returns 터치 디바이스면 true
 */
export const useIsTouchDevice = (): boolean => {
    return useMediaQuery('(hover: none) and (pointer: coarse)');
};

/**
 * 정밀 포인터 디바이스 여부 (마우스 등)
 * @returns 마우스/트랙패드 사용 시 true
 */
export const useHasFinePointer = (): boolean => {
    return useMediaQuery('(hover: hover) and (pointer: fine)');
};

/**
 * 동작 감소 모드 선호 여부 (prefers-reduced-motion)
 * @returns 동작 감소 모드면 true
 */
export const usePrefersReducedMotion = (): boolean => {
    return useMediaQuery('(prefers-reduced-motion: reduce)');
};

/**
 * 다크 모드 선호 여부 (prefers-color-scheme: dark)
 * @returns 다크 모드 선호 시 true
 */
export const usePrefersDarkMode = (): boolean => {
    return useMediaQuery('(prefers-color-scheme: dark)');
};

/** 브레이크포인트 타입 */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * 현재 브레이크포인트 반환
 * @returns 현재 화면 크기에 해당하는 브레이크포인트 ('xs' | 'sm' | 'md' | 'lg' | 'xl')
 */
export const useBreakpoint = (): Breakpoint => {
    const isXl = useMediaQuery(`(min-width: ${BREAKPOINTS.xl}px)`);
    const isLg = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
    const isMd = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`);
    const isSm = useMediaQuery(`(min-width: ${BREAKPOINTS.sm}px)`);

    if (isXl) return 'xl';
    if (isLg) return 'lg';
    if (isMd) return 'md';
    if (isSm) return 'sm';
    return 'xs';
};

/**
 * 반응형 값 설정 인터페이스
 * @template T - 값 타입
 */
export interface ResponsiveValues<T> {
    /** 모바일 (< 768px) 값 */
    mobile: T;
    /** 태블릿 (768px - 1023px) 값 (선택) */
    tablet?: T;
    /** 데스크탑 (>= 1024px) 값 (선택) */
    desktop?: T;
}

/**
 * 디바이스 타입에 따라 조건부 값 반환
 *
 * @template T - 반환 값 타입
 * @param values - 디바이스별 값 객체
 * @returns 현재 디바이스에 해당하는 값
 *
 * @example
 * const columns = useResponsiveValue({ mobile: 1, tablet: 2, desktop: 4 });
 * const padding = useResponsiveValue({ mobile: '8px', desktop: '24px' });
 */
export const useResponsiveValue = <T>(values: ResponsiveValues<T>): T => {
    const isMobile = useIsMobile();
    const isTablet = useIsTablet();

    if (isMobile) return values.mobile;
    if (isTablet) return values.tablet ?? values.desktop ?? values.mobile;
    return values.desktop ?? values.tablet ?? values.mobile;
};
