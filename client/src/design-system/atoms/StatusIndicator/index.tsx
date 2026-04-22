/**
 * @file StatusIndicator/index.tsx
 * @description 상태 표시 점 — DaisyUI status 기반
 * @module design-system/atoms
 *
 * StatusBadge(텍스트 뱃지)와 달리, 작은 원형 점으로 상태를 표시합니다.
 * 테이블 행이나 목록에서 공간이 제한적일 때 유용합니다.
 *
 * 사용 예시:
 * ```tsx
 * <StatusIndicator variant="success" label="활성" />
 * <StatusIndicator variant="error" />
 * <StatusIndicator variant="warning" label="검증 중" />
 * ```
 */
import React, { memo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type StatusVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

export interface StatusIndicatorProps {
  /** 상태 변형 */
  variant: StatusVariant;
  /** 레이블 텍스트 (점 옆에 표시) */
  label?: string;
  /** 크기 — DaisyUI status는 기본 12px */
  size?: 'sm' | 'md' | 'lg';
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const VARIANT_CLASS: Record<StatusVariant, string> = {
  success: 'status-success',
  error: 'status-error',
  warning: 'status-warning',
  info: 'status-info',
  neutral: 'status-neutral',
};

const SIZE_CLASS: Record<NonNullable<StatusIndicatorProps['size']>, string> = {
  sm: 'status-sm',
  md: '',
  lg: 'status-lg',
};

// ============================================================================
// Component
// ============================================================================

export const StatusIndicator = memo<StatusIndicatorProps>(({
  variant,
  label,
  size = 'md',
  className = '',
}) => {
  const dotClasses = [
    'status',
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
  ].filter(Boolean).join(' ');

  if (!label) {
    return (
      <span
        className={dotClasses}
        role="status"
        aria-label={variant}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5" role="status">
      <span className={dotClasses} aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </span>
  );
});

StatusIndicator.displayName = 'StatusIndicator';

export default StatusIndicator;
