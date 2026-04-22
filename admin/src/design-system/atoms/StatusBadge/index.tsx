/**
 * @file StatusBadge
 * @description 상태 배지 컴포넌트 — daisyUI badge-soft
 * @module design-system/atoms
 */
import React, { memo } from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** 주문 상태 매핑 */
const ORDER_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  'PENDING': { label: '결제 대기', variant: 'warning' },
  'PAID': { label: '결제 완료', variant: 'info' },
  'DELIVERED': { label: '발급 완료', variant: 'success' },
  'CANCELLED': { label: '취소됨', variant: 'neutral' },
};

/** 매입 상태 매핑 */
const TRADEIN_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  'REQUESTED': { label: '신청완료', variant: 'warning' },
  'VERIFIED': { label: '검증완료', variant: 'info' },
  'PAID': { label: '입금완료', variant: 'success' },
  'REJECTED': { label: '거절됨', variant: 'error' },
};

/** KYC 상태 매핑 */
const KYC_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  'VERIFIED': { label: '인증완료', variant: 'success' },
  'PENDING': { label: '인증필요', variant: 'warning' },
  'REJECTED': { label: '거절됨', variant: 'error' },
};

/** 역할 매핑 */
const ROLE_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  'ADMIN': { label: 'ADMIN', variant: 'error' },
  'PARTNER': { label: 'PARTNER', variant: 'info' },
  'USER': { label: 'USER', variant: 'neutral' },
};

const VARIANT_CLASS_MAP: Record<BadgeVariant, string> = {
  success: 'badge-success badge-soft',
  warning: 'badge-warning badge-soft',
  error: 'badge-error badge-soft',
  info: 'badge-info badge-soft',
  neutral: 'badge-neutral badge-soft',
};

export interface StatusBadgeProps {
  /** 상태값 */
  status: string;
  /** 상태 타입 */
  type: 'order' | 'tradein' | 'kyc' | 'role';
  /** 커스텀 라벨 (선택) */
  customLabel?: string;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 상태 배지 컴포넌트
 * - 상태 타입에 따른 자동 스타일링
 * - 시맨틱 색상 사용
 */
export const StatusBadge = memo(({ status, type, customLabel, className = '' }: StatusBadgeProps) => {
  const statusMaps = {
    order: ORDER_STATUS_MAP,
    tradein: TRADEIN_STATUS_MAP,
    kyc: KYC_STATUS_MAP,
    role: ROLE_MAP,
  };

  const map = statusMaps[type];
  const config = map[status] || { label: status, variant: 'neutral' as BadgeVariant };
  const label = customLabel || config.label;
  const variantClass = VARIANT_CLASS_MAP[config.variant] || 'badge-neutral badge-soft';

  return (
    <span
      className={`badge badge-sm ${variantClass} font-semibold ${className}`}
      role="status"
      aria-label={`상태: ${label}`}
    >
      {label}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

export default StatusBadge;
