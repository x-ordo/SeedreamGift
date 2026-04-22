/**
 * @file Border/index.tsx
 * @description 구분선 컴포넌트 - TDS 스타일 디바이더
 * @module design-system/atoms
 *
 * 사용 예시:
 * ```tsx
 * // 전체 너비 구분선
 * <Border />
 *
 * // 패딩 있는 구분선
 * <Border variant="padding24" />
 *
 * // 섹션 구분 (두꺼운 구분선)
 * <Border variant="height16" />
 * ```
 */
import React, { memo, CSSProperties } from 'react';
import './Border.css';

// ============================================================================
// Types
// ============================================================================

export type BorderVariant =
  | 'full'
  | 'padding24'
  | 'padding20'
  | 'padding16'
  | 'height8'
  | 'height12'
  | 'height16';

export type BorderColor = 'grey' | 'light';

export interface BorderProps {
  /** 변형 스타일 */
  variant?: BorderVariant;
  /** 색상 */
  color?: BorderColor;
  /** 인셋 (왼쪽 여백) */
  inset?: boolean;
  /** 커스텀 높이 */
  height?: string | number;
  /** 추가 클래스 */
  className?: string;
  /** 추가 스타일 */
  style?: CSSProperties;
}

// ============================================================================
// Component
// ============================================================================

export const Border = memo<BorderProps>(({
  variant = 'full',
  color = 'grey',
  inset = false,
  height,
  className = '',
  style,
}) => {
  const classNames = [
    'border',
    `border--${variant}`,
    `border--color-${color}`,
    inset && 'border--inset',
    className,
  ].filter(Boolean).join(' ');

  const computedStyle: CSSProperties = {
    ...style,
    ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
  };

  return (
    <hr
      className={classNames}
      style={computedStyle}
      aria-hidden="true"
    />
  );
});

Border.displayName = 'Border';

export default Border;
