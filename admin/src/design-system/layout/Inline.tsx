/**
 * @file Inline.tsx
 * @description 수평 정렬 레이아웃 컴포넌트
 * @module design-system/layout
 *
 * 사용법:
 * <Inline gap={2} justify="between">
 *   <Button>Cancel</Button>
 *   <Button variant="primary">Submit</Button>
 * </Inline>
 */
import React from 'react';
import styles from './layout.module.css';

type SpacingValue = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20;

interface InlineProps {
  /** 자식 요소 간 간격 (8pt grid 기준) */
  gap?: SpacingValue;
  /** 수평 정렬 */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  /** 수직 정렬 */
  align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch';
  /** 줄바꿈 허용 */
  wrap?: boolean;
  /** 자식 요소 */
  children: React.ReactNode;
  /** 추가 className */
  className?: string;
  /** HTML 태그 */
  as?: 'div' | 'span' | 'section' | 'nav' | 'ul' | 'ol';
  /** 테스트 ID */
  'data-testid'?: string;
}

/**
 * Inline - 수평 정렬 레이아웃
 * flexbox row 기반의 수평 배치 컴포넌트
 */
export const Inline: React.FC<InlineProps> = ({
  gap = 2,
  justify = 'start',
  align = 'center',
  wrap = false,
  children,
  className = '',
  as: Component = 'div',
  'data-testid': testId,
}) => {
  const justifyClass = styles[`justify-${justify}`] || '';
  const alignClass = styles[`align-${align}`] || '';
  const gapClass = styles[`gap-${gap}`] || '';
  const wrapClass = wrap ? styles.wrap : '';

  return (
    <Component
      className={`${styles.inline} ${justifyClass} ${alignClass} ${gapClass} ${wrapClass} ${className}`.trim()}
      data-testid={testId}
    >
      {children}
    </Component>
  );
};

export default Inline;
