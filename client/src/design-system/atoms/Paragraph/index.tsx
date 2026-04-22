import React, { ReactNode } from 'react';
import './Paragraph.css';

export interface ParagraphProps {
    /** 텍스트 내용 */
    children: ReactNode;
    /** 크기 */
    size?: 'small' | 'medium' | 'large';
    /** 색상 */
    color?: string;
    /** 무게 */
    weight?: 'regular' | 'medium' | 'semibold' | 'bold';
    /** 추가 클래스 */
    className?: string;
}

/**
 * Paragraph 컴포넌트 - TDS 스타일의 단락 텍스트
 */
export const Paragraph: React.FC<ParagraphProps> = ({
    children,
    size = 'medium',
    color,
    weight = 'regular',
    className = '',
}) => {
    const classNames = [
        'paragraph',
        `paragraph--${size}`,
        `paragraph--weight-${weight}`,
        className,
    ].filter(Boolean).join(' ');

    const style = color ? { color } : undefined;

    return (
        <p className={classNames} style={style}>
            {children}
        </p>
    );
};

Paragraph.displayName = 'Paragraph';

export default Paragraph;
