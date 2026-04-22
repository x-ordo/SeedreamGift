/**
 * @file Skeleton/index.tsx
 * @description 스켈레톤 로딩 컴포넌트 — daisyUI skeleton class
 * @module design-system/molecules
 */
import React, { memo, CSSProperties } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
  disableAnimation?: boolean;
}

export interface CardSkeletonProps {
  count?: number;
  showImage?: boolean;
  className?: string;
}

export interface ListSkeletonProps {
  rows?: number;
  showAvatar?: boolean;
  className?: string;
}

export interface TextSkeletonProps {
  lines?: number;
  lastLineWidth?: number;
  className?: string;
}

export interface ProductCardSkeletonProps {
  count?: number;
  className?: string;
}

export interface OrderItemSkeletonProps {
  count?: number;
  className?: string;
}

export interface PageSkeletonProps {
  showHeader?: boolean;
  contentRows?: number;
}

// ============================================================================
// Base Skeleton
// ============================================================================

export const Skeleton = memo<SkeletonProps>(({
  width,
  height,
  borderRadius,
  circle = false,
  className = '',
  style,
}) => {
  const computedStyle: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: circle ? '50%' : borderRadius,
    ...style,
  };

  return (
    <div
      className={`skeleton ${className}`}
      style={computedStyle}
      aria-hidden="true"
    />
  );
});

Skeleton.displayName = 'Skeleton';

// ============================================================================
// Card Skeleton
// ============================================================================

export const CardSkeleton = memo<CardSkeletonProps>(({
  count = 1,
  showImage = true,
  className = '',
}) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className={`card bg-base-100 shadow-sm p-4 ${className}`}>
        {showImage && <Skeleton width="100%" height="160px" borderRadius="var(--radius-md)" className="mb-4" />}
        <div className="flex flex-col gap-2">
          <Skeleton width="70%" height="20px" />
          <Skeleton width="40%" height="16px" />
          <Skeleton width="50%" height="24px" />
        </div>
      </div>
    ))}
  </>
));

CardSkeleton.displayName = 'CardSkeleton';

// ============================================================================
// List Skeleton
// ============================================================================

export const ListSkeleton = memo<ListSkeletonProps>(({
  rows = 3,
  showAvatar = false,
  className = '',
}) => (
  <div className={`flex flex-col gap-4 ${className}`}>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex items-center gap-4 py-2">
        {showAvatar && <Skeleton width={40} height={40} circle />}
        <div className="flex-1 flex flex-col gap-1">
          <Skeleton width="80%" height="16px" />
          <Skeleton width="60%" height="14px" />
        </div>
      </div>
    ))}
  </div>
));

ListSkeleton.displayName = 'ListSkeleton';

// ============================================================================
// Text Skeleton
// ============================================================================

export const TextSkeleton = memo<TextSkeletonProps>(({
  lines = 3,
  lastLineWidth = 60,
  className = '',
}) => (
  <div className={`flex flex-col gap-2 ${className}`}>
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton
        key={i}
        width={i === lines - 1 ? `${lastLineWidth}%` : '100%'}
        height="16px"
      />
    ))}
  </div>
));

TextSkeleton.displayName = 'TextSkeleton';

// ============================================================================
// Product Card Skeleton
// ============================================================================

export const ProductCardSkeleton = memo<ProductCardSkeletonProps>(({
  count = 1,
  className = '',
}) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className={`card bg-base-100 shadow-sm overflow-hidden ${className}`}>
        <Skeleton width="100%" height="120px" borderRadius="0" />
        <div className="p-4 flex flex-col gap-2">
          <Skeleton width="50%" height="14px" />
          <Skeleton width="80%" height="18px" />
          <div className="flex justify-between items-center mt-1">
            <Skeleton width="60%" height="22px" />
            <Skeleton width="30%" height="16px" />
          </div>
        </div>
      </div>
    ))}
  </>
));

ProductCardSkeleton.displayName = 'ProductCardSkeleton';

// ============================================================================
// Order Item Skeleton
// ============================================================================

export const OrderItemSkeleton = memo<OrderItemSkeletonProps>(({
  count = 1,
  className = '',
}) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className={`card bg-base-100 shadow-sm p-4 ${className}`}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col gap-2">
            <Skeleton width="80px" height="14px" />
            <Skeleton width="120px" height="24px" />
          </div>
          <Skeleton width="70px" height="24px" borderRadius="var(--radius-full)" />
        </div>
        <Skeleton width="100%" height="60px" borderRadius="var(--radius-md)" />
      </div>
    ))}
  </>
));

OrderItemSkeleton.displayName = 'OrderItemSkeleton';

// ============================================================================
// Page Skeleton
// ============================================================================

export const PageSkeleton = memo<PageSkeletonProps>(({
  showHeader = true,
  contentRows = 5,
}) => (
  <div className="max-w-3xl mx-auto p-6">
    {showHeader && (
      <div className="text-center mb-8">
        <Skeleton width="60%" height="32px" className="mx-auto" />
        <Skeleton width="80%" height="20px" className="mx-auto mt-2" />
      </div>
    )}
    <div className="card bg-base-100 shadow-sm p-6">
      <ListSkeleton rows={contentRows} />
    </div>
  </div>
));

PageSkeleton.displayName = 'PageSkeleton';
