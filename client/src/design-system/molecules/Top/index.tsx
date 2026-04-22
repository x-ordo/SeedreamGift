/**
 * @file Top/index.tsx
 * @description Toss Design System - Top 컴포넌트
 *
 * 페이지 상단 헤더/타이틀 영역을 구성하는 컴포넌트
 *
 * Sub-components:
 * - Top.TitleParagraph: 단순 타이틀 텍스트
 * - Top.TitleTextButton: 클릭 가능한 타이틀
 * - Top.TitleSelector: 드롭다운 화살표가 있는 타이틀
 * - Top.SubtitleParagraph: 단순 서브타이틀 텍스트
 * - Top.SubtitleTextButton: 클릭 가능한 서브타이틀
 * - Top.SubtitleSelector: 화살표가 있는 서브타이틀
 * - Top.SubtitleBadges: 뱃지 표시
 * - Top.UpperAssetContent: 상단 에셋 래퍼
 * - Top.RightAssetContent: 우측 에셋 래퍼
 * - Top.RightButton: 우측 버튼
 * - Top.LowerButton: 하단 작은 버튼
 * - Top.LowerCTA: 하단 CTA 버튼 영역
 * - Top.LowerCTAButton: 하단 CTA 버튼
 */
import React, { memo, forwardRef } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import styles from './Top.module.css';
import { Badge } from '../../atoms/Badge';
import { Button } from '../../atoms/Button';

// ============================================================================
// Types
// ============================================================================

export type TopTypography = 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7' |
  'st1' | 'st2' | 'st3' | 'st4' | 'st5' | 'st6' | 'st7' | 'st8' | 'st9' | 'st10' | 'st11' | 'st12' | 'st13';

export type TopFontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export interface TopProps {
  /** 콘텐츠 영역에 표시될 타이틀 (필수) */
  title: React.ReactNode;
  /** 상단 여백 (기본값: 24) */
  upperGap?: number;
  /** 하단 여백 (기본값: 24) */
  lowerGap?: number;
  /** 콘텐츠 영역 상단에 표시될 부가적인 내용 */
  upper?: React.ReactNode;
  /** 콘텐츠 영역 하단에 표시될 부가적인 내용 */
  lower?: React.ReactNode;
  /** 타이틀 상단에 표시될 서브타이틀 */
  subtitleTop?: React.ReactNode;
  /** 타이틀 하단에 표시될 서브타이틀 */
  subtitleBottom?: React.ReactNode;
  /** 콘텐츠 영역 우측에 표시될 부가적인 내용 */
  right?: React.ReactNode;
  /** 콘텐츠 영역 우측의 수직 정렬 */
  rightVerticalAlign?: 'center' | 'end';
  /** 추가 클래스명 */
  className?: string;
}

export interface TopTitleParagraphProps {
  children: React.ReactNode;
  /** 텍스트 크기 (기본값: 22) */
  size?: 22 | 28;
  /** 텍스트 색상 */
  color?: string;
  /** 타이포그래피 스타일 */
  typography?: TopTypography;
  /** 폰트 굵기 (기본값: bold) */
  fontWeight?: TopFontWeight;
  /** 접근성: heading role */
  role?: string;
  /** 접근성: aria-level */
  'aria-level'?: number;
  className?: string;
}

export interface TopTitleTextButtonProps {
  children: React.ReactNode;
  /** 버튼 크기 (기본값: xl) */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** 텍스트 색상 */
  color?: string;
  /** 버튼 형태 */
  variant?: 'arrow' | 'underline' | 'clear';
  onClick?: () => void;
  className?: string;
}

export interface TopTitleSelectorProps {
  children: React.ReactNode;
  /** 텍스트 색상 */
  color?: string;
  /** 타이포그래피 스타일 (기본값: t3) */
  typography?: TopTypography;
  /** 폰트 굵기 (기본값: bold) */
  fontWeight?: TopFontWeight;
  onClick?: () => void;
  'aria-haspopup'?: 'listbox' | 'menu' | 'dialog';
  className?: string;
}

export interface TopSubtitleParagraphProps {
  children: React.ReactNode;
  /** 텍스트 크기 (기본값: 17) */
  size?: 13 | 15 | 17;
  /** 텍스트 색상 */
  color?: string;
  /** 타이포그래피 스타일 */
  typography?: TopTypography;
  /** 폰트 굵기 */
  fontWeight?: TopFontWeight;
  /** 접근성: heading role */
  role?: string;
  /** 접근성: aria-level */
  'aria-level'?: number;
  className?: string;
}

export interface TopSubtitleTextButtonProps {
  children: React.ReactNode;
  /** 버튼 크기 (기본값: md) */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** 버튼 형태 (기본값: arrow) */
  variant?: 'arrow' | 'underline' | 'clear';
  /** 텍스트 색상 */
  color?: string;
  onClick?: () => void;
  className?: string;
}

export interface TopSubtitleSelectorProps {
  children: React.ReactNode;
  /** 셀렉터 크기 (기본값: 17) */
  size?: 13 | 15 | 17;
  /** 셀렉터 타입 */
  type?: 'arrow' | 'chevron';
  /** 텍스트 색상 */
  color?: string;
  /** 타이포그래피 스타일 */
  typography?: TopTypography;
  /** 폰트 굵기 */
  fontWeight?: TopFontWeight;
  onClick?: () => void;
  'aria-haspopup'?: 'listbox' | 'menu' | 'dialog';
  className?: string;
}

export interface TopSubtitleBadgesProps {
  badges: Array<{
    text: string;
    color: 'blue' | 'teal' | 'green' | 'red' | 'yellow' | 'elephant';
    variant: 'fill' | 'weak';
  }>;
  className?: string;
}

export interface TopUpperAssetContentProps {
  content?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export interface TopRightAssetContentProps {
  content?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export interface TopRightButtonProps {
  children: React.ReactNode;
  /** 버튼 크기 (기본값: md) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 버튼 색상 */
  color?: 'primary' | 'dark' | 'point';
  /** 버튼 형태 */
  variant?: 'fill' | 'weak' | 'clear';
  onClick?: () => void;
  className?: string;
}

export interface TopLowerButtonProps {
  children: React.ReactNode;
  /** 버튼 크기 (기본값: sm) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  className?: string;
}

export interface TopLowerCTAProps {
  type: '2-button';
  leftButton: React.ReactNode;
  rightButton: React.ReactNode;
  className?: string;
}

export interface TopLowerCTAButtonProps {
  children: React.ReactNode;
  /** 버튼 크기 (기본값: lg) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 버튼 색상 */
  color?: 'primary' | 'dark' | 'point';
  /** 버튼 형태 */
  variant?: 'fill' | 'weak' | 'clear';
  /** 버튼 표시 방식 */
  display?: 'inline' | 'block';
  onClick?: () => void;
  className?: string;
}

// ============================================================================
// Helper functions
// ============================================================================

const getFontWeightValue = (weight: TopFontWeight): number => {
  switch (weight) {
    case 'regular': return 400;
    case 'medium': return 500;
    case 'semibold': return 600;
    case 'bold': return 700;
    default: return 500;
  }
};

const getDefaultTypographyForTitleSize = (size: 22 | 28): TopTypography => {
  return size === 28 ? 'st2' : 't3';
};

const getDefaultTypographyForSubtitleSize = (size: 13 | 15 | 17): TopTypography => {
  switch (size) {
    case 13: return 't7';
    case 15: return 't6';
    case 17: return 't5';
    default: return 't5';
  }
};

const getDefaultFontWeightForSubtitleSize = (size: 13 | 15 | 17): TopFontWeight => {
  return size === 17 ? 'medium' : 'regular';
};

// ============================================================================
// Sub-components
// ============================================================================

/** 타이틀 텍스트 */
const TitleParagraph = memo<TopTitleParagraphProps>(({
  children,
  size = 22,
  color = 'var(--color-grey-800)',
  fontWeight = 'bold',
  role = 'heading',
  'aria-level': ariaLevel = 1,
  className,
}) => {
  const sizeClass = size === 28 ? styles.titleSize28 : styles.titleSize22;

  return (
    <p
      className={`${styles.titleParagraph} ${sizeClass} ${className || ''}`}
      style={{
        color,
        fontWeight: getFontWeightValue(fontWeight),
      }}
      role={role}
      aria-level={ariaLevel}
    >
      {children}
    </p>
  );
});

TitleParagraph.displayName = 'Top.TitleParagraph';

/** 타이틀 텍스트 버튼 */
const TitleTextButton = memo<TopTitleTextButtonProps>(({
  children,
  size = 'xl',
  color = 'var(--color-grey-800)',
  variant,
  onClick,
  className,
}) => {
  const fontSize = size === '2xl' ? '28px' : size === 'xl' ? '22px' : '18px';

  return (
    <button
      type="button"
      className={`${styles.titleTextButton} ${className || ''}`}
      style={{
        color,
        fontSize,
        fontWeight: 700,
      }}
      onClick={onClick}
    >
      {children}
      {variant === 'arrow' && (
        <ChevronRight size={18} aria-hidden="true" />
      )}
    </button>
  );
});

TitleTextButton.displayName = 'Top.TitleTextButton';

/** 타이틀 셀렉터 버튼 */
const TitleSelector = memo<TopTitleSelectorProps>(({
  children,
  color = 'var(--color-grey-800)',
  fontWeight = 'bold',
  onClick,
  'aria-haspopup': ariaHasPopup = 'listbox',
  className,
}) => {
  return (
    <button
      type="button"
      className={`${styles.titleSelector} ${className || ''}`}
      style={{
        color,
        fontSize: '22px',
        fontWeight: getFontWeightValue(fontWeight),
      }}
      onClick={onClick}
      aria-haspopup={ariaHasPopup}
    >
      {children}
      <ChevronDown size={18} className={styles.selectorArrow} aria-hidden="true" />
    </button>
  );
});

TitleSelector.displayName = 'Top.TitleSelector';

/** 서브타이틀 텍스트 */
const SubtitleParagraph = memo<TopSubtitleParagraphProps>(({
  children,
  size = 17,
  color = 'var(--color-grey-700)',
  fontWeight,
  role = 'heading',
  'aria-level': ariaLevel = 2,
  className,
}) => {
  const sizeClass = size === 13 ? styles.subtitleSize13 : size === 15 ? styles.subtitleSize15 : styles.subtitleSize17;
  const actualFontWeight = fontWeight || getDefaultFontWeightForSubtitleSize(size);

  return (
    <p
      className={`${styles.subtitleParagraph} ${sizeClass} ${className || ''}`}
      style={{
        color,
        fontWeight: getFontWeightValue(actualFontWeight),
      }}
      role={role}
      aria-level={ariaLevel}
    >
      {children}
    </p>
  );
});

SubtitleParagraph.displayName = 'Top.SubtitleParagraph';

/** 서브타이틀 텍스트 버튼 */
const SubtitleTextButton = memo<TopSubtitleTextButtonProps>(({
  children,
  size = 'md',
  variant = 'arrow',
  color = 'var(--color-grey-700)',
  onClick,
  className,
}) => {
  const variantClass = variant === 'underline' ? styles.subtitleTextButtonUnderline : '';

  return (
    <button
      type="button"
      className={`${styles.subtitleTextButton} ${variantClass} ${className || ''}`}
      style={{ color }}
      onClick={onClick}
    >
      {children}
      {variant === 'arrow' && (
        <ChevronRight size={14} className={styles.subtitleTextButtonArrow} aria-hidden="true" />
      )}
    </button>
  );
});

SubtitleTextButton.displayName = 'Top.SubtitleTextButton';

/** 서브타이틀 셀렉터 버튼 */
const SubtitleSelector = memo<TopSubtitleSelectorProps>(({
  children,
  size = 17,
  type = 'arrow',
  color = 'var(--color-grey-700)',
  fontWeight,
  onClick,
  'aria-haspopup': ariaHasPopup = 'listbox',
  className,
}) => {
  const sizeClass = size === 13 ? styles.subtitleSize13 : size === 15 ? styles.subtitleSize15 : styles.subtitleSize17;
  const actualFontWeight = fontWeight || getDefaultFontWeightForSubtitleSize(size);

  return (
    <button
      type="button"
      className={`${styles.subtitleSelector} ${sizeClass} ${className || ''}`}
      style={{
        color,
        fontWeight: getFontWeightValue(actualFontWeight),
      }}
      onClick={onClick}
      aria-haspopup={ariaHasPopup}
    >
      {children}
      {type === 'arrow'
        ? <ChevronRight size={14} aria-hidden="true" />
        : <ChevronDown size={14} aria-hidden="true" />
      }
    </button>
  );
});

SubtitleSelector.displayName = 'Top.SubtitleSelector';

/** 서브타이틀 뱃지 */
const SubtitleBadges = memo<TopSubtitleBadgesProps>(({
  badges = [],
  className,
}) => {
  return (
    <div className={`${styles.subtitleBadges} ${className || ''}`}>
      {badges?.map((badge, index) => (
        <Badge
          key={index}
          color={badge.color}
          variant={badge.variant}
          size="sm"
        >
          {badge.text}
        </Badge>
      ))}
    </div>
  );
});

SubtitleBadges.displayName = 'Top.SubtitleBadges';

/** 상단 에셋 콘텐츠 래퍼 */
const UpperAssetContent = memo<TopUpperAssetContentProps>(({
  content,
  children,
  className,
}) => {
  return (
    <div className={`${styles.upperAssetContent} ${className || ''}`}>
      {children || content}
    </div>
  );
});

UpperAssetContent.displayName = 'Top.UpperAssetContent';

/** 우측 에셋 콘텐츠 래퍼 */
const RightAssetContent = memo<TopRightAssetContentProps>(({
  content,
  children,
  className,
}) => {
  return (
    <div className={`${styles.rightAssetContent} ${className || ''}`}>
      {children || content}
    </div>
  );
});

RightAssetContent.displayName = 'Top.RightAssetContent';

/** 우측 버튼 */
const RightButton = memo<TopRightButtonProps>(({
  children,
  size = 'md',
  color = 'primary',
  variant = 'fill',
  onClick,
  className,
}) => {
  // Map color prop to Button variant
  const buttonVariant = variant === 'weak' ? 'secondary' :
    color === 'dark' ? 'ghost' :
    color === 'point' ? 'point' : 'primary';

  return (
    <Button
      variant={buttonVariant}
      size={size === 'xl' ? 'lg' : size === 'lg' ? 'lg' : size === 'md' ? 'md' : 'sm'}
      onClick={onClick}
      className={`${styles.rightButton} ${className || ''}`}
    >
      {children}
    </Button>
  );
});

RightButton.displayName = 'Top.RightButton';

/** 하단 버튼 */
const LowerButton = memo<TopLowerButtonProps>(({
  children,
  size = 'sm',
  onClick,
  className,
}) => {
  return (
    <Button
      variant="ghost"
      size={size === 'xl' || size === 'lg' ? 'lg' : size === 'md' ? 'md' : 'sm'}
      onClick={onClick}
      className={`${styles.lowerButton} ${className || ''}`}
    >
      {children}
    </Button>
  );
});

LowerButton.displayName = 'Top.LowerButton';

/** 하단 CTA 영역 */
const LowerCTA = memo<TopLowerCTAProps>(({
  type,
  leftButton,
  rightButton,
  className,
}) => {
  return (
    <div className={`${styles.lowerCTA} ${className || ''}`}>
      {leftButton}
      {rightButton}
    </div>
  );
});

LowerCTA.displayName = 'Top.LowerCTA';

/** 하단 CTA 버튼 */
const LowerCTAButton = memo<TopLowerCTAButtonProps>(({
  children,
  size = 'lg',
  color = 'primary',
  variant = 'fill',
  display = 'inline',
  onClick,
  className,
}) => {
  const buttonVariant = variant === 'weak' ? 'secondary' :
    color === 'dark' ? 'ghost' :
    color === 'point' ? 'point' : 'primary';

  const displayClass = display === 'block' ? styles.lowerCTAButtonBlock : '';

  return (
    <Button
      variant={buttonVariant}
      size={size === 'xl' || size === 'lg' ? 'lg' : size === 'md' ? 'md' : 'sm'}
      onClick={onClick}
      fullWidth={display === 'block'}
      className={`${styles.lowerCTAButton} ${displayClass} ${className || ''}`}
    >
      {children}
    </Button>
  );
});

LowerCTAButton.displayName = 'Top.LowerCTAButton';

// ============================================================================
// Main Top Component
// ============================================================================

const TopBase = memo<TopProps>(({
  title,
  upperGap = 24,
  lowerGap = 24,
  upper,
  lower,
  subtitleTop,
  subtitleBottom,
  right,
  rightVerticalAlign = 'center',
  className,
}) => {
  const rightAlignClass = rightVerticalAlign === 'end' ? styles.contentRightEnd : styles.contentRightCenter;

  return (
    <div
      className={`${styles.container} ${className || ''}`}
      style={{
        paddingTop: `${upperGap}px`,
        paddingBottom: `${lowerGap}px`,
      }}
    >
      {/* Upper Area */}
      {upper && (
        <div className={styles.upper}>
          {upper}
        </div>
      )}

      {/* Main Content Area */}
      <div className={styles.contentArea}>
        {/* Left/Center Content */}
        <div className={styles.contentMain}>
          <div className={styles.titleArea}>
            {/* Subtitle Top */}
            {subtitleTop && (
              <div className={styles.subtitleTop}>
                {subtitleTop}
              </div>
            )}

            {/* Title */}
            {title}

            {/* Subtitle Bottom */}
            {subtitleBottom && (
              <div className={styles.subtitleBottom}>
                {subtitleBottom}
              </div>
            )}
          </div>
        </div>

        {/* Right Content */}
        {right && (
          <div className={`${styles.contentRight} ${rightAlignClass}`}>
            {right}
          </div>
        )}
      </div>

      {/* Lower Area */}
      {lower && (
        <div className={styles.lower}>
          {lower}
        </div>
      )}
    </div>
  );
});

TopBase.displayName = 'Top';

// ============================================================================
// Export as compound component
// ============================================================================

type TopComponent = typeof TopBase & {
  TitleParagraph: typeof TitleParagraph;
  TitleTextButton: typeof TitleTextButton;
  TitleSelector: typeof TitleSelector;
  SubtitleParagraph: typeof SubtitleParagraph;
  SubtitleTextButton: typeof SubtitleTextButton;
  SubtitleSelector: typeof SubtitleSelector;
  SubtitleBadges: typeof SubtitleBadges;
  UpperAssetContent: typeof UpperAssetContent;
  RightAssetContent: typeof RightAssetContent;
  RightButton: typeof RightButton;
  LowerButton: typeof LowerButton;
  LowerCTA: typeof LowerCTA;
  LowerCTAButton: typeof LowerCTAButton;
};

const Top = TopBase as TopComponent;
Top.TitleParagraph = TitleParagraph;
Top.TitleTextButton = TitleTextButton;
Top.TitleSelector = TitleSelector;
Top.SubtitleParagraph = SubtitleParagraph;
Top.SubtitleTextButton = SubtitleTextButton;
Top.SubtitleSelector = SubtitleSelector;
Top.SubtitleBadges = SubtitleBadges;
Top.UpperAssetContent = UpperAssetContent;
Top.RightAssetContent = RightAssetContent;
Top.RightButton = RightButton;
Top.LowerButton = LowerButton;
Top.LowerCTA = LowerCTA;
Top.LowerCTAButton = LowerCTAButton;

export default Top;
export {
  Top,
  TitleParagraph,
  TitleTextButton,
  TitleSelector,
  SubtitleParagraph,
  SubtitleTextButton,
  SubtitleSelector,
  SubtitleBadges,
  UpperAssetContent,
  RightAssetContent,
  RightButton,
  LowerButton,
  LowerCTA,
  LowerCTAButton,
};
