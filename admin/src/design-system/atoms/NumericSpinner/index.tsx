/**
 * @file NumericSpinner/index.tsx
 * @description 숫자 증감 컴포넌트 - TDS 스타일
 * @module design-system/atoms
 *
 * 사용 예시:
 * ```tsx
 * // 기본 사용 (제어 모드)
 * <NumericSpinner
 *   number={quantity}
 *   onNumberChange={setQuantity}
 *   minNumber={1}
 *   maxNumber={99}
 * />
 *
 * // 비제어 모드
 * <NumericSpinner
 *   defaultNumber={1}
 *   size="large"
 * />
 * ```
 */
import React, { memo, useState, useCallback } from 'react';
import './NumericSpinner.css';

// ============================================================================
// Types
// ============================================================================

export type NumericSpinnerSize = 'tiny' | 'small' | 'medium' | 'large';

export interface NumericSpinnerProps {
  /** 현재 값 (제어 모드) */
  number?: number;
  /** 초기값 (비제어 모드) */
  defaultNumber?: number;
  /** 최소값 */
  minNumber?: number;
  /** 최대값 */
  maxNumber?: number;
  /** 증가 단위 */
  step?: number;
  /** 비활성화 */
  disabled?: boolean;
  /** 크기 */
  size?: NumericSpinnerSize;
  /** 값 변경 콜백 */
  onNumberChange?: (value: number) => void;
  /** 감소 버튼 접근성 레이블 */
  decreaseAriaLabel?: string;
  /** 증가 버튼 접근성 레이블 */
  increaseAriaLabel?: string;
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const NumericSpinner = memo<NumericSpinnerProps>(({
  number,
  defaultNumber = 0,
  minNumber = 0,
  maxNumber = 999,
  step = 1,
  disabled = false,
  size = 'medium',
  onNumberChange,
  decreaseAriaLabel = '수량 줄이기',
  increaseAriaLabel = '수량 늘리기',
  className = '',
}) => {
  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = useState(defaultNumber);

  // Use external value if controlled, otherwise internal
  const isControlled = number !== undefined;
  const currentValue = isControlled ? number : internalValue;

  const updateValue = useCallback((newValue: number) => {
    const clampedValue = Math.max(minNumber, Math.min(maxNumber, newValue));

    if (!isControlled) {
      setInternalValue(clampedValue);
    }

    onNumberChange?.(clampedValue);
  }, [isControlled, minNumber, maxNumber, onNumberChange]);

  const handleDecrease = useCallback(() => {
    updateValue(currentValue - step);
  }, [currentValue, step, updateValue]);

  const handleIncrease = useCallback(() => {
    updateValue(currentValue + step);
  }, [currentValue, step, updateValue]);

  const isAtMin = currentValue <= minNumber;
  const isAtMax = currentValue >= maxNumber;

  return (
    <div
      className={`numeric-spinner numeric-spinner--${size} ${disabled ? 'numeric-spinner--disabled' : ''} ${className}`}
      role="group"
      aria-label="수량 조절"
    >
      <button
        type="button"
        className="numeric-spinner__button"
        onClick={handleDecrease}
        disabled={disabled || isAtMin}
        aria-label={decreaseAriaLabel}
      >
        <span className="numeric-spinner__icon" aria-hidden="true">−</span>
      </button>

      <span
        className="numeric-spinner__value"
        aria-live="polite"
        aria-atomic="true"
      >
        {currentValue}
      </span>

      <button
        type="button"
        className="numeric-spinner__button"
        onClick={handleIncrease}
        disabled={disabled || isAtMax}
        aria-label={increaseAriaLabel}
      >
        <span className="numeric-spinner__icon" aria-hidden="true">+</span>
      </button>
    </div>
  );
});

NumericSpinner.displayName = 'NumericSpinner';

export default NumericSpinner;
