/**
 * @file Loader/index.tsx
 * @description 로딩 인디케이터 컴포넌트 — daisyUI loading
 * @module design-system/atoms
 */
import React, { memo, CSSProperties } from 'react';
import './Loader.css';

// ============================================================================
// Types
// ============================================================================

export type LoaderSize = 'sm' | 'md' | 'lg';
export type LoaderType = 'primary' | 'dark' | 'light' | 'point' | 'brand';

export interface LoaderProps {
  /** 크기 */
  size?: LoaderSize;
  /** 색상 타입 */
  type?: LoaderType;
  /** 레이블 텍스트 */
  label?: string;
  /** 페이드인 효과 (지연 후 나타남) */
  fadeIn?: boolean;
  /** 인라인 모드 */
  inline?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 추가 스타일 */
  style?: CSSProperties;
}

export interface LoaderOverlayProps extends LoaderProps {
  /** 어두운 배경 */
  dark?: boolean;
}

// ============================================================================
// Mappings
// ============================================================================

const SIZE_MAP: Record<LoaderSize, string> = {
  sm: 'loading-sm',
  md: 'loading-md',
  lg: 'loading-lg',
};

const TYPE_COLOR_MAP: Record<LoaderType, string> = {
  primary: 'text-primary',
  dark: 'text-neutral',
  light: 'text-white/90',
  point: 'text-accent',
  brand: 'text-primary',
};

// ============================================================================
// Loader Component
// ============================================================================

export const Loader = memo<LoaderProps>(({
  size = 'md',
  type = 'primary',
  label,
  fadeIn = false,
  inline = false,
  className = '',
  style,
}) => {
  const sizeClass = SIZE_MAP[size] || 'loading-md';
  const colorClass = TYPE_COLOR_MAP[type] || 'text-primary';

  // Brand loader uses custom SVG
  if (type === 'brand') {
    const brandSizeMap: Record<LoaderSize, string> = { sm: 'w-6 h-6', md: 'w-10 h-10', lg: 'w-14 h-14' };
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 ${fadeIn ? 'loader--fade-in' : ''} ${className}`}
        style={style}
        role="status"
        aria-label={label || '로딩중'}
      >
        <svg className={`${brandSizeMap[size]} loader__brand-symbol`} viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <path d="M28 36L38 64L50 44L62 64L72 36" stroke="var(--color-point)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {label && <span className="text-xs sm:text-sm text-neutral-content text-center whitespace-pre-line leading-relaxed">{label}</span>}
      </div>
    );
  }

  return (
    <div
      className={`${inline ? 'inline-flex flex-row gap-2' : 'flex flex-col items-center justify-center gap-3'} ${fadeIn ? 'loader--fade-in' : ''} ${className}`}
      style={style}
      role="status"
      aria-label={label || '로딩중'}
    >
      <span
        className={`loading loading-spinner ${sizeClass} ${colorClass} ${inline ? '!w-4 !h-4' : ''}`}
        aria-hidden="true"
      />
      {label && (
        <span className={`text-xs sm:text-sm ${type === 'light' ? 'text-white/90' : 'text-neutral'} text-center whitespace-pre-line leading-relaxed`}>
          {label}
        </span>
      )}
    </div>
  );
});

Loader.displayName = 'Loader';

// ============================================================================
// Loader.Overlay
// ============================================================================

const LoaderOverlay = memo<LoaderOverlayProps>(({
  dark = false,
  ...props
}) => {
  return (
    <div className={`loader-overlay ${dark ? 'loader-overlay--dark' : ''}`}>
      <Loader
        {...props}
        type={dark ? 'light' : props.type}
        size={props.size || 'lg'}
      />
    </div>
  );
});

LoaderOverlay.displayName = 'Loader.Overlay';

// Attach Overlay to Loader
type LoaderWithOverlay = typeof Loader & {
  Overlay: typeof LoaderOverlay;
};

(Loader as LoaderWithOverlay).Overlay = LoaderOverlay;

export { LoaderOverlay };
export default Loader as LoaderWithOverlay;
