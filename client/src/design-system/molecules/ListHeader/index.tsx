/**
 * @file ListHeader/index.tsx
 * @description 리스트 헤더 컴포넌트 - Toss Design System 스타일
 * @module design-system/molecules
 *
 * 페이지나 섹션의 상단에 배치되어 제목, 설명, 상호작용 요소를 제공
 *
 * @example
 * ```tsx
 * <ListHeader
 *   title={
 *     <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
 *       타이틀 내용
 *     </ListHeader.TitleParagraph>
 *   }
 *   right={
 *     <ListHeader.RightText typography="t7">
 *       악세사리
 *     </ListHeader.RightText>
 *   }
 *   description={
 *     <ListHeader.DescriptionParagraph>보조설명 내용</ListHeader.DescriptionParagraph>
 *   }
 *   descriptionPosition="top"
 * />
 * ```
 */
import React, { memo, ReactNode } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import './ListHeader.css';

// ============================================================================
// Color Constants (adaptive)
// ============================================================================
const adaptive = {
  grey400: 'var(--color-grey-400, #B0B8C1)',
  grey600: 'var(--color-grey-600, #6B7684)',
  grey700: 'var(--color-grey-700, #4E5968)',
  grey800: 'var(--color-grey-800, #333D4B)',
};

// ============================================================================
// Typography Types
// ============================================================================
type Typography = 't4' | 't5' | 't6' | 't7';
type FontWeight = 'regular' | 'medium' | 'bold';
type TextButtonSize = 'xs' | 'md' | 'lg';
type TextButtonVariant = 'clear' | 'arrow' | 'underline';

// ============================================================================
// Sub-component: TitleParagraph
// ============================================================================
export interface ListHeaderTitleParagraphProps {
  /** 자식 요소 (텍스트) */
  children: ReactNode;
  /** 타이포그래피 스타일 */
  typography: 't4' | 't5' | 't7';
  /** 글꼴 두께 */
  fontWeight: FontWeight;
  /** 텍스트 색상 */
  color?: string;
}

const TitleParagraph = memo<ListHeaderTitleParagraphProps>(({
  children,
  typography,
  fontWeight,
  color = adaptive.grey800,
}) => {
  return (
    <span
      className={`list-header-title-paragraph list-header-typography-${typography} list-header-weight-${fontWeight}`}
      style={{ color }}
    >
      {children}
    </span>
  );
});

TitleParagraph.displayName = 'ListHeader.TitleParagraph';

// ============================================================================
// Sub-component: TitleTextButton
// ============================================================================
export interface ListHeaderTitleTextButtonProps {
  /** 자식 요소 (텍스트) */
  children: ReactNode;
  /** 버튼 크기 */
  size: TextButtonSize;
  /** 글꼴 두께 */
  fontWeight: FontWeight;
  /** 텍스트 색상 */
  color?: string;
  /** 버튼 형태 */
  variant?: TextButtonVariant;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** HTML type 속성 */
  htmlType?: 'button' | 'submit' | 'reset';
}

const TitleTextButton = memo<ListHeaderTitleTextButtonProps>(({
  children,
  size,
  fontWeight,
  color = adaptive.grey600,
  variant = 'underline',
  onClick,
  htmlType = 'button',
}) => {
  return (
    <button
      type={htmlType}
      className={`list-header-title-text-button list-header-size-${size} list-header-weight-${fontWeight} list-header-variant-${variant}`}
      style={{ color }}
      onClick={onClick}
    >
      <span className="list-header-title-text-button__text">{children}</span>
      {variant === 'arrow' && (
        <ChevronRight size={14} className="list-header-title-text-button__arrow" aria-hidden="true" />
      )}
    </button>
  );
});

TitleTextButton.displayName = 'ListHeader.TitleTextButton';

// ============================================================================
// Sub-component: TitleSelector
// ============================================================================
export interface ListHeaderTitleSelectorProps {
  /** 자식 요소 (텍스트) */
  children: ReactNode;
  /** 타이포그래피 스타일 */
  typography: 't4' | 't5' | 't7';
  /** 텍스트 색상 */
  color?: string;
  /** 글꼴 두께 */
  fontWeight?: FontWeight;
  /** 클릭 핸들러 */
  onClick?: () => void;
}

const TitleSelector = memo<ListHeaderTitleSelectorProps>(({
  children,
  typography,
  color = adaptive.grey800,
  fontWeight = 'bold',
  onClick,
}) => {
  return (
    <button
      type="button"
      className={`list-header-title-selector list-header-typography-${typography} list-header-weight-${fontWeight}`}
      style={{ color }}
      onClick={onClick}
    >
      <span className="list-header-title-selector__text">{children}</span>
      <ChevronDown size={16} className="list-header-title-selector__icon" aria-hidden="true" />
    </button>
  );
});

TitleSelector.displayName = 'ListHeader.TitleSelector';

// ============================================================================
// Sub-component: DescriptionParagraph
// ============================================================================
export interface ListHeaderDescriptionParagraphProps {
  /** 자식 요소 (텍스트) */
  children: ReactNode;
  /** 텍스트 색상 */
  color?: string;
}

const DescriptionParagraph = memo<ListHeaderDescriptionParagraphProps>(({
  children,
  color = adaptive.grey600,
}) => {
  return (
    <span className="list-header-description" style={{ color }}>
      {children}
    </span>
  );
});

DescriptionParagraph.displayName = 'ListHeader.DescriptionParagraph';

// ============================================================================
// Sub-component: RightText
// ============================================================================
export interface ListHeaderRightTextProps {
  /** 자식 요소 (텍스트) */
  children: ReactNode;
  /** 타이포그래피 스타일 */
  typography: 't6' | 't7';
  /** 텍스트 색상 */
  color?: string;
}

const RightText = memo<ListHeaderRightTextProps>(({
  children,
  typography,
  color = adaptive.grey700,
}) => {
  return (
    <span
      className={`list-header-right-text list-header-typography-${typography}`}
      style={{ color }}
    >
      {children}
    </span>
  );
});

RightText.displayName = 'ListHeader.RightText';

// ============================================================================
// Sub-component: RightArrow
// ============================================================================
export interface ListHeaderRightArrowProps {
  /** 자식 요소 (텍스트) */
  children?: ReactNode;
  /** 타이포그래피 스타일 */
  typography: 't6' | 't7';
  /** 화살표 아이콘 색상 */
  color?: string;
  /** 텍스트 색상 */
  textColor?: string;
  /** 클릭 핸들러 */
  onClick?: () => void;
}

const RightArrow = memo<ListHeaderRightArrowProps>(({
  children,
  typography,
  color = adaptive.grey400,
  textColor = adaptive.grey700,
  onClick,
}) => {
  const content = (
    <>
      {children && (
        <span
          className={`list-header-right-arrow__text list-header-typography-${typography}`}
          style={{ color: textColor }}
        >
          {children}
        </span>
      )}
      <ChevronRight size={16} className="list-header-right-arrow__icon" style={{ color }} aria-hidden="true" />
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="list-header-right-arrow list-header-right-arrow--clickable" onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <span className="list-header-right-arrow">
      {content}
    </span>
  );
});

RightArrow.displayName = 'ListHeader.RightArrow';

// ============================================================================
// Main Component: ListHeader
// ============================================================================
export interface ListHeaderProps {
  /** 제목 요소 (TitleParagraph, TitleTextButton, TitleSelector) */
  title: ReactNode;
  /** 제목 너비 비율 (기본값: 0.66) */
  titleWidthRatio?: number;
  /** 설명 요소 (DescriptionParagraph) */
  description?: ReactNode;
  /** 설명 위치 */
  descriptionPosition?: 'top' | 'bottom';
  /** 오른쪽 요소 (RightText, RightArrow) */
  right?: ReactNode;
  /** 오른쪽 요소 정렬 */
  rightAlignment?: 'center' | 'bottom';
  /** 추가 클래스 */
  className?: string;
}

const ListHeaderComp = memo<ListHeaderProps>(({
  title,
  titleWidthRatio = 0.66,
  description,
  descriptionPosition = 'top',
  right,
  rightAlignment = 'center',
  className = '',
}) => {
  const classNames = [
    'list-header',
    `list-header--right-align-${rightAlignment}`,
    description && `list-header--desc-${descriptionPosition}`,
    className,
  ].filter(Boolean).join(' ');

  // Calculate width ratio (capped at 0.5 if ratio > 2)
  const effectiveRatio = titleWidthRatio > 2 ? 0.5 : titleWidthRatio;

  return (
    <div className={classNames}>
      <div
        className="list-header__left"
        style={right ? { flex: effectiveRatio } : undefined}
      >
        {descriptionPosition === 'top' && description && (
          <div className="list-header__description-wrap">
            {description}
          </div>
        )}

        <div className="list-header__title">
          {title}
        </div>

        {descriptionPosition === 'bottom' && description && (
          <div className="list-header__description-wrap list-header__description-wrap--bottom">
            {description}
          </div>
        )}
      </div>

      {right && (
        <div className="list-header__right">
          {right}
        </div>
      )}
    </div>
  );
});

ListHeaderComp.displayName = 'ListHeader';

// ============================================================================
// Compound Component Type
// ============================================================================
type ListHeaderWithSubComponents = typeof ListHeaderComp & {
  TitleParagraph: typeof TitleParagraph;
  TitleTextButton: typeof TitleTextButton;
  TitleSelector: typeof TitleSelector;
  DescriptionParagraph: typeof DescriptionParagraph;
  RightText: typeof RightText;
  RightArrow: typeof RightArrow;
};

// Attach sub-components
(ListHeaderComp as ListHeaderWithSubComponents).TitleParagraph = TitleParagraph;
(ListHeaderComp as ListHeaderWithSubComponents).TitleTextButton = TitleTextButton;
(ListHeaderComp as ListHeaderWithSubComponents).TitleSelector = TitleSelector;
(ListHeaderComp as ListHeaderWithSubComponents).DescriptionParagraph = DescriptionParagraph;
(ListHeaderComp as ListHeaderWithSubComponents).RightText = RightText;
(ListHeaderComp as ListHeaderWithSubComponents).RightArrow = RightArrow;

export const ListHeader = ListHeaderComp as ListHeaderWithSubComponents;
export default ListHeader;

// Named exports for sub-components
export {
  TitleParagraph as ListHeaderTitleParagraph,
  TitleTextButton as ListHeaderTitleTextButton,
  TitleSelector as ListHeaderTitleSelector,
  DescriptionParagraph as ListHeaderDescriptionParagraph,
  RightText as ListHeaderRightText,
  RightArrow as ListHeaderRightArrow,
};
