import React, { ButtonHTMLAttributes, useCallback, useState, useEffect } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'point' | 'cta';
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    fullWidth?: boolean;
    isLoading?: boolean;
    loading?: boolean; // Alias for isLoading
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    icon?: React.ReactNode; // Alias for leftIcon
    disableRipple?: boolean;
}

interface Ripple {
    id: number;
    x: number;
    y: number;
}

const VARIANT_MAP: Record<string, string> = {
    primary: 'btn-primary',
    secondary: 'btn-soft',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-error',
    success: 'btn-success',
    point: '',
    cta: '',
};

const SIZE_MAP: Record<string, string> = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
    xl: styles.xl,
    '2xl': styles.xxl,
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className = '',
            variant = 'primary',
            size = 'md',
            fullWidth = false,
            isLoading = false,
            loading = false,
            leftIcon,
            rightIcon,
            icon,
            children,
            disabled,
            type = 'button',
            disableRipple = false,
            onClick,
            ...rest
        },
        ref
    ) => {
        const [ripples, setRipples] = useState<Ripple[]>([]);
        const showLoading = isLoading || loading;
        const effectiveLeftIcon = leftIcon || icon;

        const { ...buttonProps } = rest as any;
        delete buttonProps.iconPosition;

        // Clean up ripples after animation
        useEffect(() => {
            if (ripples.length > 0) {
                const timer = setTimeout(() => {
                    setRipples([]);
                }, 1000);
                return () => clearTimeout(timer);
            }
        }, [ripples]);

        const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
            if (!disableRipple && !disabled && !showLoading) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                setRipples(prev => [...prev, { id: Date.now(), x, y }]);
            }
            onClick?.(e);
        }, [disableRipple, disabled, showLoading, onClick]);

        const variantClass = VARIANT_MAP[variant] || 'btn-primary';
        const sizeClass = SIZE_MAP[size] || '';

        const classes = [
            'btn',
            variantClass,
            sizeClass,
            fullWidth ? 'w-full' : '',
            variant === 'point' ? styles.point : variant === 'cta' ? styles.cta : '',
            styles.btnBase,
            className,
        ]
            .filter(Boolean)
            .join(' ');

        return (
            <button
                ref={ref}
                type={type}
                className={classes}
                disabled={disabled || showLoading}
                aria-busy={showLoading || undefined}
                onClick={handleClick}
                {...buttonProps}
            >
                {/* Ripple Renderers */}
                {!disableRipple && ripples.map(ripple => (
                    <span
                        key={ripple.id}
                        className={styles.ripple}
                        style={{
                            left: ripple.x,
                            top: ripple.y
                        }}
                    />
                ))}

                {showLoading && (
                    <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <span className="loading loading-spinner loading-sm" role="status" aria-label="로딩 중" />
                    </span>
                )}
                {effectiveLeftIcon && (
                    <span className="inline-flex items-center text-[1.1em] leading-none" aria-hidden="true" style={showLoading ? { visibility: 'hidden' } : undefined}>
                        {effectiveLeftIcon}
                    </span>
                )}
                <span className="relative z-10" style={showLoading ? { visibility: 'hidden' } : undefined}>{children}</span>
                {rightIcon && (
                    <span className="inline-flex items-center text-[1.1em] leading-none" aria-hidden="true" style={showLoading ? { visibility: 'hidden' } : undefined}>
                        {rightIcon}
                    </span>
                )}
            </button>
        );
    }
);

Button.displayName = 'Button';
