/**
 * @file TwoColumn.tsx
 * @description 2열 레이아웃 컴포넌트 (main + sidebar)
 * @module design-system/layout
 *
 * 사용법:
 * <TwoColumn
 *   main={<ProductList />}
 *   sidebar={<FilterPanel />}
 *   sidebarPosition="right"
 * />
 */
import React from 'react';
import styles from './layout.module.css';

type SpacingValue = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20;

interface TwoColumnProps {
  /** 메인 콘텐츠 */
  main: React.ReactNode;
  /** 사이드바 콘텐츠 */
  sidebar: React.ReactNode;
  /** 사이드바 위치 */
  sidebarPosition?: 'left' | 'right';
  /** 사이드바 너비 (px 또는 %) */
  sidebarWidth?: string;
  /** 열 간 간격 */
  gap?: SpacingValue;
  /** 모바일에서 사이드바 숨김 */
  hideSidebarOnMobile?: boolean;
  /** 모바일에서 순서 반전 (sidebar 먼저) */
  reverseMobile?: boolean;
  /** 추가 className */
  className?: string;
  /** 테스트 ID */
  'data-testid'?: string;
}

/**
 * TwoColumn - 2열 레이아웃
 * 반응형 2열 구조를 제공하며, 모바일에서는 단일 열로 전환
 */
export const TwoColumn: React.FC<TwoColumnProps> = ({
  main,
  sidebar,
  sidebarPosition = 'right',
  sidebarWidth = '320px',
  gap = 6,
  hideSidebarOnMobile = false,
  reverseMobile = false,
  className = '',
  'data-testid': testId,
}) => {
  const positionClass = styles[`sidebar-${sidebarPosition}`] || '';
  const gapClass = styles[`gap-${gap}`] || '';
  const hideMobileClass = hideSidebarOnMobile ? styles['hide-sidebar-mobile'] : '';
  const reverseMobileClass = reverseMobile ? styles['reverse-mobile'] : '';

  return (
    <div
      className={`${styles.twoColumn} ${positionClass} ${gapClass} ${hideMobileClass} ${reverseMobileClass} ${className}`.trim()}
      style={{ '--sidebar-width': sidebarWidth } as React.CSSProperties}
      data-testid={testId}
    >
      <main className={styles.mainColumn}>{main}</main>
      <aside className={styles.sidebarColumn}>{sidebar}</aside>
    </div>
  );
};

export default TwoColumn;
