/**
 * @file Center.tsx
 * @description 중앙 정렬 래퍼 컴포넌트
 * @module design-system/layout
 *
 * 사용법:
 * <Center>
 *   <Spinner />
 * </Center>
 */
import React from 'react';
import styles from './layout.module.css';

interface CenterProps {
  /** 자식 요소 */
  children: React.ReactNode;
  /** 추가 className */
  className?: string;
  /** 전체 높이 (min-height: 100vh) */
  fullHeight?: boolean;
  /** 인라인 중앙 정렬 (inline-flex) */
  inline?: boolean;
  /** 테스트 ID */
  'data-testid'?: string;
}

/**
 * Center - 중앙 정렬 래퍼
 * 자식 요소를 수평/수직 중앙에 배치
 */
export const Center: React.FC<CenterProps> = ({
  children,
  className = '',
  fullHeight = false,
  inline = false,
  'data-testid': testId,
}) => {
  const fullHeightClass = fullHeight ? styles.fullHeight : '';
  const inlineClass = inline ? styles.inlineCenter : styles.center;

  return (
    <div
      className={`${inlineClass} ${fullHeightClass} ${className}`.trim()}
      data-testid={testId}
    >
      {children}
    </div>
  );
};

export default Center;
