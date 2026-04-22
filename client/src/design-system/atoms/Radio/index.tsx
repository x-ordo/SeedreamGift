/**
 * @file Radio.tsx
 * @description 접근성을 준수하는 라디오 버튼 및 그룹 컴포넌트
 * @module design-system/atoms
 *
 * 기능:
 * - 커스텀 스타일 라디오 버튼
 * - RadioGroup 래퍼로 그룹 관리
 * - 비활성화 상태
 * - 키보드 내비게이션 (화살표 키)
 *
 * 접근성:
 * - role="radio", role="radiogroup"
 * - aria-checked
 * - tabIndex 관리
 * - 레이블 연결
 */
import React, { useId, createContext, useContext, useCallback, forwardRef } from 'react';
import styles from './Radio.module.css';

// ============================================
// RadioGroup Context
// ============================================

interface RadioGroupContextValue {
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

// ============================================
// RadioGroup Component
// ============================================

export interface RadioGroupProps {
  /** 그룹 name 속성 */
  name: string;
  /** 현재 선택된 값 */
  value: string;
  /** 값 변경 핸들러 */
  onChange: (value: string) => void;
  /** 전체 비활성화 */
  disabled?: boolean;
  /** 레이블 (그룹 제목) */
  label?: string;
  /** 레이아웃 방향 */
  orientation?: 'horizontal' | 'vertical';
  /** 자식 Radio 컴포넌트들 */
  children: React.ReactNode;
  /** 추가 클래스명 */
  className?: string;
  /** 에러 메시지 */
  error?: string;
  /** aria-describedby 연결 */
  'aria-describedby'?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  value,
  onChange,
  disabled = false,
  label,
  orientation = 'vertical',
  children,
  className = '',
  error,
  'aria-describedby': ariaDescribedBy,
}) => {
  const groupId = useId();
  const errorId = useId();

  // 키보드 내비게이션 핸들러
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      const radios = Array.from(
        e.currentTarget.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:disabled)')
      );
      const currentIndex = radios.findIndex((radio) => radio.value === value);

      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          nextIndex = currentIndex < radios.length - 1 ? currentIndex + 1 : 0;
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          nextIndex = currentIndex > 0 ? currentIndex - 1 : radios.length - 1;
          break;
        default:
          return;
      }

      const nextRadio = radios[nextIndex];
      if (nextRadio) {
        onChange(nextRadio.value);
        nextRadio.focus();
      }
    },
    [value, onChange, disabled]
  );

  return (
    <RadioGroupContext.Provider value={{ name, value, onChange, disabled }}>
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
      <div
        role="radiogroup"
        aria-labelledby={label ? `${groupId}-label` : undefined}
        aria-describedby={error ? errorId : ariaDescribedBy}
        aria-invalid={error ? true : undefined}
        onKeyDown={handleKeyDown}
        className={`${styles.group} ${styles[orientation]} ${className}`}
      >
        {label && (
          <span id={`${groupId}-label`} className={styles.groupLabel}>
            {label}
          </span>
        )}
        <div className={styles.radioList}>{children}</div>
        {error && (
          <span id={errorId} className={styles.errorText} role="alert">
            {error}
          </span>
        )}
      </div>
    </RadioGroupContext.Provider>
  );
};

// ============================================
// Radio Component
// ============================================

export interface RadioProps {
  /** 라디오 값 */
  value: string;
  /** 레이블 텍스트 */
  label?: string;
  /** 개별 비활성화 */
  disabled?: boolean;
  /** 커스텀 ID */
  id?: string;
  /** 추가 클래스명 */
  className?: string;
  /** 단독 사용 시 name */
  name?: string;
  /** 단독 사용 시 checked */
  checked?: boolean;
  /** 단독 사용 시 onChange */
  onChange?: (value: string) => void;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ value, label, disabled: radioDisabled = false, id, className = '', name, checked, onChange }, ref) => {
    const context = useContext(RadioGroupContext);
    const generatedId = useId();
    const radioId = id || generatedId;

    // Context 또는 props에서 값 가져오기
    const groupName = context?.name || name || '';
    const isChecked = context ? context.value === value : checked ?? false;
    const isDisabled = context?.disabled || radioDisabled;
    const handleChange = context?.onChange || onChange;

    const onInputChange = () => {
      handleChange?.(value);
    };

    // tabIndex: 선택된 항목 또는 그룹 내 첫 번째 항목만 0
    const tabIndex = isChecked ? 0 : -1;

    return (
      <label
        htmlFor={radioId}
        className={`${styles.container} ${isDisabled ? styles.disabled : ''} ${className}`}
      >
        <input
          ref={ref}
          type="radio"
          id={radioId}
          name={groupName}
          value={value}
          checked={isChecked}
          onChange={onInputChange}
          disabled={isDisabled}
          tabIndex={tabIndex}
          aria-checked={isChecked}
          className={styles.input}
        />
        <span className={styles.radio} aria-hidden="true">
          <span className={styles.radioInner} />
        </span>
        {label && <span className={styles.label}>{label}</span>}
      </label>
    );
  }
);

Radio.displayName = 'Radio';
RadioGroup.displayName = 'RadioGroup';

export default Radio;
