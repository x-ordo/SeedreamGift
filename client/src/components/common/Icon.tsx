/**
 * @file Icon.tsx
 * @description Lucide 아이콘 래퍼 컴포넌트
 * @module components/common
 *
 * Lucide 컴포넌트 직접 전달 또는 Bootstrap Icon 이름(레거시)으로 사용 가능.
 *
 * @example
 * // Lucide 컴포넌트 직접
 * <Icon icon={Home} size={20} />
 *
 * // 레거시 Bootstrap Icon 이름
 * <Icon name="bi-house" size={20} />
 */
import { createElement } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';

interface IconProps extends LucideProps {
  /** Lucide 컴포넌트 직접 전달 */
  icon?: LucideIcon;
}

export function Icon({ icon: IconComponent, size = 20, ...props }: IconProps) {
  if (!IconComponent) return null;
  return createElement(IconComponent, { size, ...props });
}

