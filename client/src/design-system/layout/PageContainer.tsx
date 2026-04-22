/**
 * @file PageContainer.tsx
 * @description 페이지 래퍼 컴포넌트 (max-width, padding 표준화)
 * @module design-system/layout
 *
 * 사용법:
 * <PageContainer size="lg">
 *   <h1>Page Title</h1>
 *   <p>Content...</p>
 * </PageContainer>
 */
import React from 'react';
import styles from './layout.module.css';

type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface PageContainerProps {
  /** 컨테이너 최대 너비 */
  size?: ContainerSize;
  /** 세로 패딩 적용 */
  withVerticalPadding?: boolean;
  /** 중앙 정렬 */
  centered?: boolean;
  /** 자식 요소 */
  children: React.ReactNode;
  /** 추가 className */
  className?: string;
  /** HTML 태그 */
  as?: 'div' | 'main' | 'section' | 'article';
  /** 테스트 ID */
  'data-testid'?: string;
}

/**
 * PageContainer - 페이지 래퍼
 * 반응형 max-width와 패딩을 제공하는 컨테이너
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  size = 'lg',
  withVerticalPadding = true,
  centered = true,
  children,
  className = '',
  as: Component = 'div',
  'data-testid': testId,
}) => {
  const sizeClass = styles[`container-${size}`] || '';
  const paddingClass = withVerticalPadding ? styles['with-vertical-padding'] : '';
  const centeredClass = centered ? styles.centered : '';

  return (
    <Component
      className={`${styles.pageContainer} ${sizeClass} ${paddingClass} ${centeredClass} ${className}`.trim()}
      data-testid={testId}
    >
      {children}
    </Component>
  );
};

export default PageContainer;
