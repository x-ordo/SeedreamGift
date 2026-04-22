/**
 * @file Select.tsx
 * @description 접근성을 준수하는 네이티브 Select 래퍼 — daisyUI select
 * @module design-system/atoms
 */
import React, { useId, forwardRef, SelectHTMLAttributes } from 'react';

export interface SelectOption {
  /** 옵션 값 */
  value: string;
  /** 표시 텍스트 */
  label: string;
  /** 비활성화 여부 */
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  /** 선택된 값 */
  value?: string;
  /** 기본 선택 값 (비제어 모드) */
  defaultValue?: string;
  /** 값 변경 핸들러 */
  onChange?: (value: string, event: React.ChangeEvent<HTMLSelectElement>) => void;
  /** 옵션 목록 */
  options: SelectOption[];
  /** placeholder 텍스트 */
  placeholder?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 에러 상태 */
  error?: boolean;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 레이블 텍스트 */
  label?: string;
  /** 도움말 텍스트 */
  helperText?: string;
  /** 커스텀 ID */
  id?: string;
  /** input name 속성 */
  name?: string;
  /** 추가 클래스명 */
  className?: string;
  /** 필수 여부 */
  required?: boolean;
  /** 전체 너비 사용 */
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      options,
      placeholder,
      disabled = false,
      error = false,
      errorMessage,
      label,
      helperText,
      id,
      name,
      className = '',
      required = false,
      fullWidth = true,
      'aria-describedby': ariaDescribedBy,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = useId();
    const helperId = useId();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e.target.value, e);
    };

    // aria-describedby 조합
    const describedByIds = [
      error && errorMessage ? errorId : null,
      helperText ? helperId : null,
      ariaDescribedBy,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={`flex flex-col gap-1 ${fullWidth ? 'w-full' : ''} ${className}`}>
        {label && (
          <label htmlFor={selectId} className="text-xs sm:text-sm font-medium text-base-content">
            {label}
            {required && <span className="text-error" aria-hidden="true"> *</span>}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          name={name}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          aria-invalid={error || undefined}
          aria-describedby={describedByIds || undefined}
          className={`select select-bordered w-full ${error ? 'select-error' : ''}`}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        {error && errorMessage && (
          <span id={errorId} className="text-xs text-error" role="alert">
            {errorMessage}
          </span>
        )}
        {!error && helperText && (
          <span id={helperId} className="text-xs text-base-content/60">
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
