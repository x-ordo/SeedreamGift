import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import './TextButton.css';

export type TextButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type TextButtonVariant = 'clear' | 'arrow' | 'underline';

export interface TextButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
    /** 텍스트 버튼의 사이즈를 결정해요. */
    size: TextButtonSize;
    /** TextButton 컴포넌트의 형태를 결정해요. */
    variant?: TextButtonVariant;
    /** TextButton 컴포넌트의 비활성화 여부를 나타내요. */
    disabled?: boolean;
    /** 텍스트 색상 (기본: primary) */
    color?: 'primary' | 'secondary' | 'tertiary' | 'point' | 'success' | 'error';
    /** 자식 요소 */
    children: React.ReactNode;
}

/**
 * TextButton 컴포넌트
 *
 * 사용자가 어떤 액션을 트리거하거나 이벤트를 실행할 때 사용해요.
 * Toss Design System 스타일을 따릅니다.
 *
 * @example
 * ```tsx
 * <TextButton size="md" variant="arrow" onClick={handleClick}>
 *   전체보기
 * </TextButton>
 * ```
 */
export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(
    (
        {
            size,
            variant = 'clear',
            disabled = false,
            color = 'primary',
            children,
            className = '',
            type = 'button',
            ...rest
        },
        ref
    ) => {
        const classNames = [
            'text-button',
            `text-button--${size}`,
            `text-button--${variant}`,
            `text-button--${color}`,
            disabled ? 'text-button--disabled' : '',
            className,
        ]
            .filter(Boolean)
            .join(' ');

        return (
            <button
                ref={ref}
                type={type}
                className={classNames}
                disabled={disabled}
                {...rest}
            >
                <span className="text-button__text">{children}</span>
                {variant === 'arrow' && (
                    <span className="text-button__arrow" aria-hidden="true">
                        <svg
                            width="1em"
                            height="1em"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M9 18L15 12L9 6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </span>
                )}
            </button>
        );
    }
);

TextButton.displayName = 'TextButton';

export default TextButton;
