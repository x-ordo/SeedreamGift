/**
 * @file GridList/index.tsx
 * @description 그리드 목록 컴포넌트 - TDS 스타일
 * @module design-system/molecules
 *
 * 사용 예시:
 * ```tsx
 * import { Gift } from 'lucide-react';
 * <GridList column={3}>
 *   <GridList.Item icon={<Gift size={24} />} onClick={handleClick}>
 *     상품권 구매
 *   </GridList.Item>
 *   <GridList.Item image={<img src="/trade.png" />}>
 *     상품권 매입
 *   </GridList.Item>
 * </GridList>
 * ```
 */
import React, { memo, ReactNode, useCallback } from 'react';
import './GridList.css';

// ============================================================================
// Types
// ============================================================================

export interface GridListProps {
  /** 열 개수 (1, 2, 3) */
  column?: 1 | 2 | 3;
  /** 자식 요소 (GridList.Item) */
  children: ReactNode;
  /** 추가 클래스 */
  className?: string;
  /** 테두리 표시 (기존 유지) */
  bordered?: boolean;
  /** 좌우 패딩 없음 (기존 유지) */
  noPadding?: boolean;
  /** 크기 (기존 유지) */
  size?: 'compact' | 'default' | 'large';
}

export interface GridListItemProps {
  /** 이미지 (필수) */
  image: ReactNode;
  /** 아이콘 (기존 유지) */
  icon?: ReactNode;
  /** 아이콘 색상 적용 (기존 유지) */
  coloredIcon?: boolean;
  /** 선택됨 상태 (기존 유지) */
  selected?: boolean;
  /** 비활성화 (기존 유지) */
  disabled?: boolean;
  /** 클릭 핸들러 (기존 유지) */
  onClick?: () => void;
  /** 레이블 (텍스트) */
  children: ReactNode;
  /** 추가 클래스 */
  className?: string;
  /** 접근성 레이블 */
  'aria-label'?: string;
}

// ============================================================================
// GridList Component
// ============================================================================

export const GridList = memo<GridListProps>(({
  column = 3,
  size = 'default',
  bordered = false,
  noPadding = false,
  children,
  className = '',
}) => {
  const classNames = [
    'grid-list',
    `grid-list--column-${column}`,
    size !== 'default' && `grid-list--${size}`,
    bordered && 'grid-list--bordered',
    noPadding && 'grid-list--no-padding',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames} role="listbox">
      {children}
    </div>
  );
});

GridList.displayName = 'GridList';

// ============================================================================
// GridList.Item Component
// ============================================================================

const GridListItem = memo<GridListItemProps>(({
  image,
  icon,
  coloredIcon = false,
  selected = false,
  disabled = false,
  onClick,
  children,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const handleClick = useCallback(() => {
    if (!disabled && onClick) {
      onClick();
    }
  }, [disabled, onClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick, onClick]);

  const classNames = [
    'grid-list-item',
    selected && 'grid-list-item--selected',
    disabled && 'grid-list-item--disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      role="option"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      aria-selected={selected || undefined}
      aria-disabled={disabled || undefined}
    >
      {image && (
        <div className="grid-list-item__image" aria-hidden="true">
          {image}
        </div>
      )}
      {!image && icon && (
        <div
          className={`grid-list-item__icon ${coloredIcon ? 'grid-list-item__icon--colored' : ''}`}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <div className="grid-list-item__label">{children}</div>
    </div>
  );
});

GridListItem.displayName = 'GridList.Item';

// Attach Item to GridList
type GridListWithItem = typeof GridList & {
  Item: typeof GridListItem;
};

(GridList as GridListWithItem).Item = GridListItem;

export { GridListItem };
export default GridList as GridListWithItem;
