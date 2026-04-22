/**
 * @file types.ts
 * @description 디자인 시스템 공통 타입 — 크기 표준화
 * @module design-system
 *
 * 표준 크기 체계: xs | sm | md | lg | xl
 * 레거시 값(xsmall, small, medium, large 등)은 normalizeSize()로 변환됩니다.
 */

/** 표준 크기 타입 */
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** 레거시 크기 → 표준 크기 매핑 */
export const LEGACY_SIZE_MAP: Record<string, Size> = {
  xsmall: 'xs',
  small: 'sm',
  medium: 'md',
  large: 'lg',
  xlarge: 'xl',
  tiny: 'xs',
  xxlarge: 'xl',
};

/**
 * 크기 값을 표준 Size로 정규화합니다.
 * 레거시 값(small, medium 등)을 표준 값(sm, md)으로 변환합니다.
 * 이미 표준 값이면 그대로 반환합니다.
 */
export function normalizeSize(size: string): Size {
  return LEGACY_SIZE_MAP[size] ?? (size as Size);
}
