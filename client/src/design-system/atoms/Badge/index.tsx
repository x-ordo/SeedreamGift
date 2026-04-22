/**
 * @file Badge/index.tsx
 * @description 뱃지 컴포넌트 — daisyUI badge
 * @module design-system/atoms
 */
import React, { memo, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export type BadgeColor = 'blue' | 'teal' | 'green' | 'red' | 'yellow' | 'elephant';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';
export type BadgeVariant = 'fill' | 'weak';

export interface BadgeProps {
  /** 변형 (채우기/연하게) */
  variant: BadgeVariant;
  /** 크기 */
  size: BadgeSize;
  /** 색상 */
  color: BadgeColor;
  /** 점 형태 표시 */
  dot?: boolean;
  /** 아이콘 */
  icon?: ReactNode;
  /** 콘텐츠 */
  children?: ReactNode;
  /** 접근성 레이블 */
  'aria-label'?: string;
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Mappings
// ============================================================================

const COLOR_MAP: Record<BadgeColor, { fill: string; weak: string }> = {
  blue: { fill: 'badge-primary', weak: 'badge-primary badge-soft' },
  green: { fill: 'badge-success', weak: 'badge-success badge-soft' },
  red: { fill: 'badge-error', weak: 'badge-error badge-soft' },
  yellow: { fill: 'badge-warning', weak: 'badge-warning badge-soft' },
  elephant: { fill: 'badge-neutral', weak: 'badge-neutral badge-soft' },
  teal: { fill: 'badge-accent', weak: 'badge-accent badge-soft' },
};

const SIZE_MAP: Record<BadgeSize, string> = {
  xs: 'badge-xs',
  sm: 'badge-sm',
  md: 'badge-md',
  lg: 'badge-lg',
};

// ============================================================================
// Component
// ============================================================================

export const Badge = memo<BadgeProps>(({
  color,
  size,
  variant,
  dot = false,
  icon,
  children,
  'aria-label': ariaLabel,
  className = '',
}) => {
  const colorClass = COLOR_MAP[color]?.[variant] || 'badge-neutral';
  const sizeClass = SIZE_MAP[size] || 'badge-md';

  if (dot) {
    const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2';
    return (
      <span
        className={`badge ${colorClass} rounded-full p-0 ${dotSize} ${className}`}
        role="status"
        aria-label={ariaLabel || '상태 표시'}
      />
    );
  }

  return (
    <span
      className={`badge ${colorClass} ${sizeClass} ${className}`}
      role="status"
      aria-label={ariaLabel}
    >
      {icon && <span className="mr-1 inline-flex items-center" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
});

Badge.displayName = 'Badge';

export default Badge;
