/**
 * @file StatusBadge
 * @description 상태 배지 컴포넌트 — daisyUI badge-soft
 * @module design-system/atoms
 *
 * 상태 매핑은 @/constants/statusMaps 단일 소스를 사용합니다.
 */
import { memo } from 'react';
import { getStatusConfig } from '@/constants/statusMaps';

/** statusMaps의 color 문자열 → daisyUI badge 클래스 변환 */
const COLOR_TO_CLASS: Record<string, string> = {
  green: 'badge-success badge-soft',
  yellow: 'badge-warning badge-soft',
  red: 'badge-error badge-soft',
  blue: 'badge-info badge-soft',
  elephant: 'badge-neutral badge-soft',
  teal: 'badge-accent badge-soft',
};

export interface StatusBadgeProps {
  /** 상태값 */
  status: string;
  /** 상태 타입 */
  type: 'order' | 'tradein' | 'kyc' | 'gift' | 'voucher' | 'role';
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
  const config = getStatusConfig(status, type);
  const label = customLabel || config.label;
  const colorClass = COLOR_TO_CLASS[config.color] || 'badge-neutral badge-soft';

  return (
    <span
      className={`badge badge-sm ${colorClass} font-semibold ${className}`}
      role="status"
      aria-label={`상태: ${label}`}
    >
      {label}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

export default StatusBadge;
