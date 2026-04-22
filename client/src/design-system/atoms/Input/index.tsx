import React, { InputHTMLAttributes, forwardRef, useId } from 'react';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', label, error, helperText, fullWidth = true, id: propId, ...props }, ref) => {
        const autoId = useId();
        const inputId = propId || autoId;
        const errorId = `${inputId}-error`;
        const helperId = `${inputId}-helper`;

        const describedByParts: string[] = [];
        if (error) describedByParts.push(errorId);
        else if (helperText) describedByParts.push(helperId);
        const ariaDescribedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

        return (
            <div className={`${styles.container} ${fullWidth ? 'w-full' : ''} ${className}`}>
                {label && <label className={styles.label} htmlFor={inputId}>{label}</label>}

                <div className={styles.inputWrapper}>
                    <input
                        ref={ref}
                        id={inputId}
                        className={`${styles.input} ${error ? styles.error : ''}`}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={ariaDescribedBy}
                        {...props}
                    />
                </div>

                {error && <span id={errorId} className={`${styles.helperText} ${styles.errorText}`} role="alert">{error}</span>}
                {!error && helperText && <span id={helperId} className={styles.helperText}>{helperText}</span>}
            </div>
        );
    }
);

Input.displayName = 'Input';
