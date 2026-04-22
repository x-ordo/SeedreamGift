/**
 * @file Tooltip/index.tsx
 * @description 툴팁 컴포넌트 — DaisyUI tooltip 기반
 * @module design-system/atoms
 *
 * 사용 예시:
 * ```tsx
 * <Tooltip content="도움말 텍스트">
 *   <button>Hover me</button>
 * </Tooltip>
 *
 * <Tooltip content="에러 안내" color="error" position="bottom">
 *   <span>!</span>
 * </Tooltip>
 * ```
 */
import React, { memo, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
export type TooltipColor =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export interface TooltipProps {
  /** 툴팁에 표시할 텍스트 */
  content: string;
  /** 위치 (기본: top) */
  position?: TooltipPosition;
  /** 색상 변형 */
  color?: TooltipColor;
  /** 항상 표시 (기본: hover 시에만) */
  open?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 트리거 요소 */
  children: ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export const Tooltip = memo<TooltipProps>(({
  content,
  position = 'top',
  color,
  open = false,
  className = '',
  children,
}) => {
  const classNames = [
    'tooltip',
    `tooltip-${position}`,
    color && `tooltip-${color}`,
    open && 'tooltip-open',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames} data-tip={content}>
      {children}
    </div>
  );
});

Tooltip.displayName = 'Tooltip';

export default Tooltip;
