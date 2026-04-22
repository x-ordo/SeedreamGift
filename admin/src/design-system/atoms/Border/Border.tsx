/**
 * @file Border.tsx
 * @description Border/Divider 컴포넌트 - TDS 스타일
 *
 * 요소 간의 구분을 명확히 하고 계층 구조를 표현하는 데 사용
 *
 * Variants:
 * - full: 전체 너비에 맞춰서 선이 그려짐
 * - padding24: 양쪽에 24px의 여백을 두고 선이 그려짐
 * - height16: 16px 높이의 섹션 구분선 (배경색)
 *
 * Spacing:
 * - none: 여백 없음
 * - small: 상하 8px
 * - medium: 상하 16px (기본값)
 * - large: 상하 24px
 */

import './Border.css';

export interface BorderProps {
  /** Border 컴포넌트의 형태를 결정 */
  variant?: 'full' | 'padding24' | 'height16';
  /** 상하 여백 크기 */
  spacing?: 'none' | 'small' | 'medium' | 'large';
  /** variant가 height16일 때 높이를 커스텀할 수 있음 */
  height?: string;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 인라인 스타일 */
  style?: React.CSSProperties;
}

export function Border({
  variant = 'full',
  spacing = 'medium',
  height,
  className = '',
  style,
}: BorderProps) {
  const classes = [
    'border-divider',
    `border-divider--${variant}`,
    `border-divider--spacing-${spacing}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const customStyle: React.CSSProperties = {
    ...style,
    ...(height && variant === 'height16' ? { height } : {}),
  };

  return (
    <div
      className={classes}
      style={Object.keys(customStyle).length > 0 ? customStyle : undefined}
      role="separator"
      aria-orientation="horizontal"
    />
  );
}

export default Border;
