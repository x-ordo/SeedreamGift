import React, { HTMLAttributes } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    interactive?: boolean;
    compact?: boolean;
    padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    shadow?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
    radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const PADDING_MAP: Record<string, string> = {
    none: 'p-0',
    xs: 'p-2',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
};

const SHADOW_MAP: Record<string, string> = {
    none: 'shadow-none',
    xs: 'shadow-xs',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
};

const RADIUS_MAP: Record<string, string> = {
    none: 'rounded-none',
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
    full: 'rounded-full',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className = '', children, interactive = false, compact = false, padding, shadow, radius, ...props }, ref) => {
        const paddingClass = padding ? PADDING_MAP[padding] || '' : (compact ? 'p-4' : 'p-6');
        const shadowClass = shadow ? SHADOW_MAP[shadow] || '' : '';
        const radiusClass = radius ? RADIUS_MAP[radius] || '' : '';

        return (
            <div
                ref={ref}
                className={`card bg-base-100 border border-base-300 shadow-sm ${paddingClass} ${shadowClass} ${radiusClass} ${interactive ? styles.interactive : ''} ${className}`}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = 'Card';
