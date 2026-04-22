/**
 * @file EmptyState/index.tsx
 * @description 데이터 없음 상태 컴포넌트
 * @module design-system/molecules/EmptyState
 *
 * 사용법:
 * <EmptyState
 *   variant="cart"
 *   title="장바구니가 비어있습니다"
 *   description="원하는 상품을 담아보세요"
 *   action={<Button>쇼핑하러 가기</Button>}
 * />
 */
import React from 'react';
import { Search, ShoppingCart, Receipt, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './EmptyState.module.css';

type EmptyStateVariant = 'search' | 'cart' | 'order' | 'error' | 'custom';

interface EmptyStateProps {
  /** 아이콘 변형 */
  variant?: EmptyStateVariant;
  /** 커스텀 아이콘 (variant='custom'일 때) */
  icon?: React.ReactNode;
  /** 제목 */
  title: string;
  /** 설명 (선택) */
  description?: string;
  /** 액션 버튼 (선택) */
  action?: React.ReactNode;
  /** 추가 className */
  className?: string;
  /** 테스트 ID */
  'data-testid'?: string;
}

/**
 * 기본 아이콘 매핑
 */
const DEFAULT_ICONS: Record<Exclude<EmptyStateVariant, 'custom'>, LucideIcon> = {
  search: Search,
  cart: ShoppingCart,
  order: Receipt,
  error: TriangleAlert,
};

/**
 * EmptyState - 데이터 없음 상태 표시
 * 검색 결과, 장바구니, 주문 내역 등이 비어있을 때 사용
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'search',
  icon,
  title,
  description,
  action,
  className = '',
  'data-testid': testId,
}) => {
  const renderIcon = () => {
    if (variant === 'custom' && icon) {
      return <div className={styles.iconWrapper}>{icon}</div>;
    }

    const IconComp = DEFAULT_ICONS[variant as Exclude<EmptyStateVariant, 'custom'>];
    return (
      <div className={styles.iconWrapper}>
        <IconComp size={48} aria-hidden="true" />
      </div>
    );
  };

  return (
    <div
      className={`${styles.emptyState} ${styles[variant]} ${className}`.trim()}
      role="status"
      aria-label={title}
      data-testid={testId}
    >
      {renderIcon()}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
};

export default EmptyState;
