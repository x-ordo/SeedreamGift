/**
 * @file TextField/index.tsx
 * @description Toss Design System - TextField 컴포넌트 — daisyUI input hybrid
 *
 * Animated floating label stays in CSS Module (daisyUI has no equivalent).
 * Input wrapper uses daisyUI `input input-bordered` base with variant overrides.
 */
import React, {
  forwardRef,
  useState,
  useCallback,
  useRef,
  useImperativeHandle,
  memo,
  useMemo
} from 'react';
import { X, Eye, EyeOff, ChevronDown } from 'lucide-react';
import styles from './TextField.module.css';

// ============================================================================
// Types
// ============================================================================

export type TextFieldVariant = 'box' | 'line' | 'big' | 'hero';
export type TextFieldLabelOption = 'appear' | 'sustain';

export interface TextFieldFormat {
  transform: (value: string) => string;
  reset?: (formattedValue: string) => string;
}

export interface TextFieldPublicProps {
  disabled?: boolean;
  prefix?: string;
  suffix?: string;
  right?: React.ReactNode;
  placeholder?: string;
  format?: TextFieldFormat;
}

export interface TextFieldProps extends TextFieldPublicProps,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'size'> {
  variant: TextFieldVariant;
  label?: string;
  labelOption?: TextFieldLabelOption;
  help?: React.ReactNode;
  hasError?: boolean;
  paddingTop?: string | number;
  paddingBottom?: string | number;
  value?: string | number;
  defaultValue?: string;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export interface TextFieldClearableProps extends Omit<TextFieldProps, 'right'> {
  onClear?: () => void;
}

export interface TextFieldPasswordProps extends Omit<TextFieldProps, 'right' | 'type'> {
  onVisibilityChange?: (visible: boolean) => void;
}

export interface TextFieldButtonProps extends TextFieldPublicProps {
  variant: TextFieldVariant;
  label?: string;
  labelOption?: TextFieldLabelOption;
  help?: React.ReactNode;
  hasError?: boolean;
  value?: string;
  onClick?: () => void;
  className?: string;
}

// ============================================================================
// Helper functions
// ============================================================================

const getVariantClass = (variant: TextFieldVariant): string => {
  switch (variant) {
    case 'box': return 'input input-bordered w-full';
    case 'line': return styles.variantLine;
    case 'big': return 'input input-bordered input-lg w-full';
    case 'hero': return `input input-bordered w-full ${styles.variantHero}`;
    default: return 'input input-bordered w-full';
  }
};

// ============================================================================
// TextField Component
// ============================================================================

const TextFieldBase = forwardRef<HTMLInputElement, TextFieldProps>(({
  variant,
  label,
  labelOption = 'appear',
  help,
  hasError = false,
  disabled = false,
  prefix,
  suffix,
  right,
  placeholder,
  format,
  paddingTop,
  paddingBottom,
  value,
  defaultValue,
  onFocus,
  onBlur,
  onChange,
  className,
  id,
  ...restProps
}, ref) => {
  const generatedId = React.useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const [isFocused, setIsFocused] = useState(false);

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Determine actual value (controlled vs uncontrolled)
  const actualValue = value !== undefined ? String(value) : internalValue;
  const hasValue = actualValue.length > 0;

  // Label visibility
  const showLabel = labelOption === 'sustain' || hasValue || isFocused;

  // Generate unique ID for accessibility
  const inputId = id || `textfield-${generatedId}`;
  const helpId = help ? `${inputId}-help` : undefined;

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  }, [onFocus]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  }, [onBlur]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    // Apply format transform if provided
    if (format?.transform) {
      newValue = format.transform(newValue);
      e.target.value = newValue;
    }

    if (value === undefined) {
      setInternalValue(newValue);
    }

    onChange?.(e);
  }, [format, value, onChange]);

  const wrapperClasses = [
    styles.inputWrapper,
    getVariantClass(variant),
    hasError && (variant === 'box' || variant === 'big' ? 'input-error' : styles.hasError),
    disabled && styles.disabled,
  ].filter(Boolean).join(' ');

  const containerStyle = useMemo(() => ({
    paddingTop: paddingTop !== undefined ? (typeof paddingTop === 'number' ? `${paddingTop}px` : paddingTop) : undefined,
    paddingBottom: paddingBottom !== undefined ? (typeof paddingBottom === 'number' ? `${paddingBottom}px` : paddingBottom) : undefined,
  }), [paddingTop, paddingBottom]);

  return (
    <div className={`${styles.container} ${className || ''}`} style={containerStyle}>
      {label && (
        <label
          htmlFor={inputId}
          className={`${styles.label} ${showLabel ? styles.labelVisible : styles.labelHidden} ${hasError ? styles.labelError : ''}`}
        >
          {label}
        </label>
      )}

      <div className={wrapperClasses}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}

        <input
          ref={inputRef}
          id={inputId}
          className={styles.input}
          type="text"
          value={actualValue}
          defaultValue={value === undefined ? undefined : undefined}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={helpId}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          {...restProps}
        />

        {suffix && <span className={styles.suffix}>{suffix}</span>}
        {right && <div className={styles.right}>{right}</div>}
      </div>

      {help && (
        <div
          id={helpId}
          className={`${styles.help} ${hasError ? styles.helpError : ''}`}
          role={hasError ? 'alert' : undefined}
        >
          {help}
        </div>
      )}
    </div>
  );
});

TextFieldBase.displayName = 'TextField';

// ============================================================================
// TextField.Clearable Component
// ============================================================================

const TextFieldClearable = forwardRef<HTMLInputElement, TextFieldClearableProps>(({
  onClear,
  value,
  defaultValue,
  onChange,
  ...props
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(defaultValue || '');

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  const actualValue = value !== undefined ? String(value) : internalValue;
  const showClear = actualValue.length > 0 && !props.disabled;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (value === undefined) {
      setInternalValue(e.target.value);
    }
    onChange?.(e);
  }, [value, onChange]);

  const handleClear = useCallback(() => {
    if (value === undefined) {
      setInternalValue('');
    }

    // Trigger onChange with empty value
    if (inputRef.current) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(inputRef.current, '');
        const event = new Event('input', { bubbles: true });
        inputRef.current.dispatchEvent(event);
      }
    }

    onClear?.();
    inputRef.current?.focus();
  }, [value, onClear]);

  return (
    <TextFieldBase
      ref={inputRef}
      value={actualValue}
      onChange={handleChange}
      right={
        showClear ? (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClear}
            aria-label="입력 내용 지우기"
            tabIndex={-1}
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : undefined
      }
      {...props}
    />
  );
});

TextFieldClearable.displayName = 'TextField.Clearable';

// ============================================================================
// TextField.Password Component
// ============================================================================

const TextFieldPassword = forwardRef<HTMLInputElement, TextFieldPasswordProps>(({
  onVisibilityChange,
  ...props
}, ref) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleToggleVisibility = useCallback(() => {
    const newVisible = !isVisible;
    setIsVisible(newVisible);
    onVisibilityChange?.(newVisible);
  }, [isVisible, onVisibilityChange]);

  return (
    <TextFieldBase
      ref={ref}
      type={isVisible ? 'text' : 'password'}
      right={
        <button
          type="button"
          className={styles.visibilityButton}
          onClick={handleToggleVisibility}
          aria-label={isVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
          tabIndex={-1}
        >
          {isVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      }
      {...props}
    />
  );
});

TextFieldPassword.displayName = 'TextField.Password';

// ============================================================================
// TextField.Button Component
// ============================================================================

const TextFieldButton = memo<TextFieldButtonProps>(({
  variant,
  label,
  labelOption = 'appear',
  help,
  hasError = false,
  disabled = false,
  prefix,
  suffix,
  right,
  placeholder,
  value,
  onClick,
  className,
}) => {
  const generatedId = React.useId();
  const hasValue = Boolean(value);
  const showLabel = labelOption === 'sustain' || hasValue;

  const buttonId = `textfield-button-${generatedId}`;
  const helpId = help ? `${buttonId}-help` : undefined;

  const wrapperClasses = [
    styles.inputWrapper,
    styles.buttonWrapper,
    getVariantClass(variant),
    hasError && 'input-error',
    disabled && styles.disabled,
  ].filter(Boolean).join(' ');

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {label && (
        <span
          className={`${styles.label} ${showLabel ? styles.labelVisible : styles.labelHidden} ${hasError ? styles.labelError : ''}`}
        >
          {label}
        </span>
      )}

      <button
        type="button"
        id={buttonId}
        className={wrapperClasses}
        onClick={onClick}
        disabled={disabled}
        aria-describedby={helpId}
      >
        {prefix && <span className={styles.prefix}>{prefix}</span>}

        <span className={`${styles.buttonValue} ${!hasValue ? styles.buttonPlaceholder : ''}`}>
          {hasValue ? value : placeholder}
        </span>

        {suffix && <span className={styles.suffix}>{suffix}</span>}

        {right !== undefined ? (
          <div className={styles.right}>{right}</div>
        ) : (
          <ChevronDown size={18} className={styles.arrowIcon} aria-hidden="true" />
        )}
      </button>

      {help && (
        <div
          id={helpId}
          className={`${styles.help} ${hasError ? styles.helpError : ''}`}
          role={hasError ? 'alert' : undefined}
        >
          {help}
        </div>
      )}
    </div>
  );
});

TextFieldButton.displayName = 'TextField.Button';

// ============================================================================
// Export as compound component
// ============================================================================

type TextFieldComponent = typeof TextFieldBase & {
  Clearable: typeof TextFieldClearable;
  Password: typeof TextFieldPassword;
  Button: typeof TextFieldButton;
};

const TextField = TextFieldBase as TextFieldComponent;
TextField.Clearable = TextFieldClearable;
TextField.Password = TextFieldPassword;
TextField.Button = TextFieldButton;

export default TextField;
export { TextField, TextFieldClearable, TextFieldPassword, TextFieldButton };
