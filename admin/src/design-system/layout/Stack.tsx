/**
 * @file Stack.tsx
 * @description 수직 정렬 레이아웃 컴포넌트
 * @module design-system/layout
 *
 * 사용법:
 * <Stack gap={4}>
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 * </Stack>
 */
import React from 'react';
import styles from './layout.module.css';

type SpacingValue = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20;

interface StackProps {
  /** 자식 요소 간 간격 (8pt grid 기준) */
  gap?: SpacingValue;
  /** 수평 정렬 */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** 자식 요소 */
  children: React.ReactNode;
  /** 추가 className */
  className?: string;
  /** HTML 태그 */
  as?: 'div' | 'section' | 'article' | 'main' | 'aside' | 'nav' | 'ul' | 'ol';
  /** 테스트 ID */
  'data-testid'?: string;
}

/**
 * Stack - 수직 정렬 레이아웃
 * flexbox column 기반의 수직 배치 컴포넌트
 */
export const Stack: React.FC<StackProps> = ({
  gap = 4,
  align = 'stretch',
  children,
  className = '',
  as: Component = 'div',
  'data-testid': testId,
}) => {
  const alignClass = styles[`align-${align}`] || '';
  const gapClass = styles[`gap-${gap}`] || '';

  return (
    <Component
      className={`${styles.stack} ${alignClass} ${gapClass} ${className}`.trim()}
      data-testid={testId}
    >
      {children}
    </Component>
  );
};

export default Stack;
