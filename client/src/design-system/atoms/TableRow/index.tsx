/**
 * @file TableRow/index.tsx
 * @description 테이블 행 컴포넌트 - TDS 스타일 키-값 표시
 * @module design-system/atoms
 *
 * 사용 예시:
 * ```tsx
 * <TableRow left="상품명" right="신세계 상품권 5만원" />
 * <TableRow left="결제금액" right="47,500원" emphasized />
 * <TableRow left="할인율" right="-5%" align="space-between" />
 * ```
 */
import React, { memo, ReactNode } from 'react';
import './TableRow.css';

// ============================================================================
// Types
// ============================================================================

export type TableRowAlign = 'left' | 'space-between';
export type TableRowSize = 'small' | 'medium' | 'large';

export interface TableRowProps {
  /** 왼쪽 레이블 */
  left: ReactNode;
  /** 오른쪽 값 */
  right: ReactNode;
  /** 정렬 방식 */
  align?: TableRowAlign;
  /** 왼쪽 열 너비 비율 (%) - align="left" 일 때만 적용 */
  leftRatio?: number;
  /** 강조 스타일 (오른쪽 값 굵게) */
  emphasized?: boolean;
  /** 숫자 값 여부 (tabular-nums 적용) */
  numeric?: boolean;
  /** 하단 테두리 표시 */
  withBorder?: boolean;
  /** 크기 */
  size?: TableRowSize;
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const TableRow = memo<TableRowProps>(({
  left,
  right,
  align = 'space-between',
  leftRatio,
  emphasized = false,
  numeric = false,
  withBorder = false,
  size = 'medium',
  className = '',
}) => {
  const leftStyle = leftRatio && align === 'left'
    ? { width: `${leftRatio}%`, minWidth: `${leftRatio}%` }
    : undefined;

  const classNames = [
    'table-row',
    `table-row--align-${align}`,
    `table-row--size-${size}`,
    emphasized && 'table-row--emphasized',
    withBorder && 'table-row--with-border',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <span className="table-row__left" style={leftStyle}>
        {left}
      </span>
      <span className={`table-row__right ${numeric ? 'tabular-nums' : ''}`}>
        {right}
      </span>
    </div>
  );
});

TableRow.displayName = 'TableRow';

export default TableRow;
