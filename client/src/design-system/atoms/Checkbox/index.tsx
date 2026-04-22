/**
 * @file Checkbox.tsx
 * @description 접근성을 준수하는 체크박스 컴포넌트 — daisyUI checkbox
 * @module design-system/atoms
 *
 * 기능:
 * - 제어/비제어 모드 지원
 * - 비활성화 상태
 * - 불확정(indeterminate) 상태 지원
 *
 * 접근성:
 * - aria-checked (true/false/mixed)
 * - aria-disabled
 * - :focus-visible 포커스 링
 * - 레이블 연결 (htmlFor/id)
 */
import React, { useId, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface CheckboxProps {
  /** 체크 여부 (제어 모드) */
  checked?: boolean;
  /** 기본 체크 여부 (비제어 모드) */
  defaultChecked?: boolean;
  /** 상태 변경 핸들러 */
  onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 불확정 상태 (부분 선택 표시) */
  indeterminate?: boolean;
  /** 레이블 텍스트 */
  label?: string;
  /** 커스텀 ID (자동 생성됨) */
  id?: string;
  /** input name 속성 */
  name?: string;
  /** 추가 클래스명 */
  className?: string;
  /** 필수 여부 */
  required?: boolean;
  /** aria-describedby 연결 */
  'aria-describedby'?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      checked,
      defaultChecked,
      onChange,
      disabled = false,
      indeterminate = false,
      label,
      id,
      name,
      className = '',
      required = false,
      'aria-describedby': ariaDescribedBy,
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const generatedId = useId();
    const checkboxId = id || generatedId;

    // forwardRef와 내부 ref 동시 사용
    useImperativeHandle(ref, () => inputRef.current!, []);

    // indeterminate 상태 설정 (DOM API로만 가능)
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.checked, e);
    };

    // aria-checked 값 결정
    const ariaChecked = indeterminate ? 'mixed' : checked ?? defaultChecked ?? false;

    return (
      <label
        htmlFor={checkboxId}
        className={`inline-flex items-start gap-2 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <input
          ref={inputRef}
          type="checkbox"
          id={checkboxId}
          name={name}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          aria-checked={ariaChecked}
          aria-disabled={disabled || undefined}
          aria-describedby={ariaDescribedBy}
          className="checkbox checkbox-primary"
        />
        {label && <span className="text-xs sm:text-sm text-base-content leading-5">{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
