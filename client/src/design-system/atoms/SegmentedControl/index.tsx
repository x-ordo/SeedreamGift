/**
 * @file SegmentedControl/index.tsx
 * @description TDS SegmentedControl — 여러 선택지 중 하나를 선택하는 컴포넌트
 * @module design-system/atoms
 *
 * 접근성:
 * - role="radiogroup" / role="radio"
 * - aria-checked 자동 관리
 * - 키보드 좌/우 화살표 네비게이션
 *
 * @example
 * ```tsx
 * <SegmentedControl value={tab} onChange={setTab}>
 *   <SegmentedControl.Item value="buy">구매</SegmentedControl.Item>
 *   <SegmentedControl.Item value="sell">판매</SegmentedControl.Item>
 * </SegmentedControl>
 * ```
 */
import React, { createContext, useContext, useState, useRef, useCallback, memo, KeyboardEvent } from 'react';
import './SegmentedControl.css';

// ============================================================================
// Context
// ============================================================================

interface SegmentedContextValue {
  value: string;
  onChange: (value: string) => void;
  size: 'sm' | 'lg';
  registerItem: (value: string, el: HTMLButtonElement) => void;
  unregisterItem: (value: string) => void;
}

const SegmentedContext = createContext<SegmentedContextValue | null>(null);

// ============================================================================
// SegmentedControl
// ============================================================================

export interface SegmentedControlProps {
  /** 자식 SegmentedControl.Item들 */
  children: React.ReactNode;
  /** 현재 선택값 (제어 모드) */
  value?: string;
  /** 초기 선택값 (비제어 모드) */
  defaultValue?: string;
  /** 선택 변경 핸들러 */
  onChange?: (value: string) => void;
  /** 크기 */
  size?: 'sm' | 'lg';
  /** 접근성 레이블 */
  'aria-label'?: string;
  /** 추가 클래스 */
  className?: string;
}

const SegmentedControlRoot = memo<SegmentedControlProps>(({
  children,
  value: controlledValue,
  defaultValue = '',
  onChange,
  size = 'sm',
  'aria-label': ariaLabel,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const registerItem = useCallback((value: string, el: HTMLButtonElement) => {
    itemRefs.current.set(value, el);
  }, []);

  const unregisterItem = useCallback((value: string) => {
    itemRefs.current.delete(value);
  }, []);

  const handleChange = useCallback((newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  }, [isControlled, onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(itemRefs.current.entries());
    const currentIndex = items.findIndex(([val]) => val === currentValue);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    if (nextIndex !== null) {
      const [nextValue, nextEl] = items[nextIndex];
      handleChange(nextValue);
      nextEl?.focus();
    }
  }, [currentValue, handleChange]);

  return (
    <SegmentedContext.Provider value={{ value: currentValue, onChange: handleChange, size, registerItem, unregisterItem }}>
      <div
        className={`segmented-control segmented-control--${size} ${className}`}
        role="radiogroup"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {children}
      </div>
    </SegmentedContext.Provider>
  );
});

SegmentedControlRoot.displayName = 'SegmentedControl';

// ============================================================================
// SegmentedControl.Item
// ============================================================================

export interface SegmentedItemProps {
  /** 이 아이템의 값 */
  value: string;
  /** 라벨 */
  children: React.ReactNode;
  /** 비활성화 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
}

const SegmentedItem = React.forwardRef<HTMLButtonElement, SegmentedItemProps>(({
  value,
  children,
  disabled = false,
  className = '',
}, ref) => {
  const ctx = useContext(SegmentedContext);
  if (!ctx) throw new Error('SegmentedControl.Item은 SegmentedControl 내부에서 사용해야 합니다');

  const isSelected = ctx.value === value;

  const setRef = useCallback((el: HTMLButtonElement | null) => {
    if (el) {
      ctx.registerItem(value, el);
    } else {
      ctx.unregisterItem(value);
    }
    if (typeof ref === 'function') {
      ref(el);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
    }
  }, [ctx, value, ref]);

  return (
    <button
      ref={setRef}
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-disabled={disabled || undefined}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      className={`segmented-control__item ${isSelected ? 'segmented-control__item--selected' : ''} ${disabled ? 'segmented-control__item--disabled' : ''} ${className}`}
      onClick={() => !disabled && ctx.onChange(value)}
    >
      <span className="segmented-control__label">{children}</span>
    </button>
  );
});

SegmentedItem.displayName = 'SegmentedControl.Item';

// ============================================================================
// Compound Export
// ============================================================================

type SegmentedControlComponent = typeof SegmentedControlRoot & {
  Item: typeof SegmentedItem;
};

export const SegmentedControl = SegmentedControlRoot as SegmentedControlComponent;
SegmentedControl.Item = SegmentedItem;
