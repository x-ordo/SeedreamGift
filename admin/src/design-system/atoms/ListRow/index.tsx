/**
 * @file ListRow/index.tsx
 * @description 리스트 행 컴포넌트 - Toss Design System 스타일
 * @module design-system/atoms
 *
 * @example
 * ```tsx
 * <ListRow
 *   left={<ListRow.AssetIcon name="https://assets.toss.im/assets/con-money-icon/toss-card-icon.png" shape="squircle" />}
 *   contents={<ListRow.Texts type="2RowTypeA" top="제목" bottom="설명" />}
 *   right={<ListRow.IconButton variant="fill" icon={ChevronRight} />}
 *   withArrow
 * />
 * ```
 */
import React, { memo, ReactNode, forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect } from 'react';
import { ChevronRight, PlayCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '@/components/common/Icon';
import './ListRow.css';

// ============================================================================
// Adaptive Colors
// ============================================================================
const adaptive = {
  grey100: 'var(--color-grey-100, #F2F4F6)',
  grey400: 'var(--color-grey-400, #B0B8C1)',
  grey500: 'var(--color-grey-500, #8B95A1)',
  grey600: 'var(--color-grey-600, #6B7684)',
  grey700: 'var(--color-grey-700, #4E5968)',
  grey800: 'var(--color-grey-800, #333D4B)',
  grey900: 'var(--color-grey-900, #191F28)',
  greyOpacity100: 'var(--color-grey-100, rgba(0, 27, 55, 0.05))',
  blue500: 'var(--color-primary, #3182F6)',
};

// ============================================================================
// Types
// ============================================================================

export type ListRowBorder = 'none' | 'indented' | 'full';
export type ListRowVerticalPadding = 'small' | 'medium' | 'large' | 'xlarge';
export type ListRowHorizontalPadding = 'small' | 'medium';
export type ListRowDisabledStyle = 'type1' | 'type2';
export type ListRowAlignment = 'top' | 'center';

export interface ListRowRef {
  shine: () => void;
  blink: () => void;
}

export interface ListRowProps {
  /** 왼쪽 영역 (아이콘, 이미지 등) */
  left?: ReactNode;
  /** 왼쪽 영역 수직 정렬 */
  leftAlignment?: ListRowAlignment;
  /** 제목 */
  title?: ReactNode;
  /** 부제목 */
  subtitle?: ReactNode;
  /** 설명 */
  description?: ReactNode;
  /** 커스텀 콘텐츠 영역 */
  contents?: ReactNode;
  /** 오른쪽 영역 (버튼, 배지 등) */
  right?: ReactNode;
  /** 오른쪽 영역 수직 정렬 */
  rightAlignment?: ListRowAlignment;
  /** 화살표 아이콘 표시 */
  withArrow?: boolean;
  /** 터치 효과 */
  withTouchEffect?: boolean;
  /** 구분선 스타일 */
  border?: ListRowBorder;
  /** 비활성화 */
  disabled?: boolean;
  /** 비활성화 스타일 */
  disabledStyle?: ListRowDisabledStyle;
  /** 수직 패딩 */
  verticalPadding?: ListRowVerticalPadding;
  /** 수평 패딩 */
  horizontalPadding?: ListRowHorizontalPadding;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 추가 클래스 */
  className?: string;
  /** 추가 스타일 */
  style?: React.CSSProperties;
  /** 접근성 레이블 */
  'aria-label'?: string;
}

// ============================================================================
// Main Component
// ============================================================================

const ListRowComp = memo(forwardRef<ListRowRef, ListRowProps>(({
  left,
  leftAlignment = 'center',
  title,
  subtitle,
  description,
  contents,
  right,
  rightAlignment = 'center',
  withArrow = false,
  withTouchEffect,
  border = 'indented',
  disabled = false,
  disabledStyle = 'type1',
  verticalPadding = 'medium',
  horizontalPadding = 'medium',
  onClick,
  className = '',
  style,
  'aria-label': ariaLabel,
}, ref) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [animationClass, setAnimationClass] = useState('');
  const animTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useImperativeHandle(ref, () => ({
    shine: () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      setAnimationClass('list-row--shine');
      animTimerRef.current = setTimeout(() => setAnimationClass(''), 1000);
    },
    blink: () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      setAnimationClass('list-row--blink');
      animTimerRef.current = setTimeout(() => setAnimationClass(''), 1000);
    },
  }), []);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled && onClick) {
      onClick();
    }
  }, [disabled, onClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const isInteractive = !!onClick || withTouchEffect;

  const classNames = [
    'list-row',
    `list-row--padding-${verticalPadding}`,
    `list-row--hpadding-${horizontalPadding}`,
    border !== 'none' && `list-row--border-${border}`,
    isInteractive && 'list-row--touch-effect',
    disabled && 'list-row--disabled',
    disabled && `list-row--disabled-${disabledStyle}`,
    leftAlignment === 'top' && 'list-row--left-align-top',
    rightAlignment === 'top' && 'list-row--right-align-top',
    animationClass,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={elementRef}
      className={classNames}
      style={style}
      onClick={handleClick}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      tabIndex={isInteractive && !disabled ? 0 : undefined}
      role={isInteractive ? 'button' : undefined}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
    >
      {left && (
        <div className="list-row__left">{left}</div>
      )}

      <div className="list-row__contents">
        {contents || (
          <>
            {title && <div className="list-row__title">{title}</div>}
            {subtitle && <div className="list-row__subtitle">{subtitle}</div>}
            {description && <div className="list-row__description">{description}</div>}
          </>
        )}
      </div>

      {(right || withArrow) && (
        <div className="list-row__right">
          {right}
          {withArrow && (
            <span className="list-row__arrow" aria-hidden="true">
              <ChevronRight size={16} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}));

ListRowComp.displayName = 'ListRow';

// ============================================================================
// Sub-component: AssetIcon
// ============================================================================

type AssetIconShape = 'original' | 'squircle' | 'card' | 'circle-background' | 'circle-masking';
type AssetIconSize = 'xsmall' | 'small' | 'medium';
type AssetIconVariant = 'none' | 'fill';
type AccPosition = 'top-right' | 'bottom-right';
type AccMasking = 'none' | 'circle';

export interface ListRowAssetIconProps {
  /** URL for icon image (if not using Lucide component) */
  name?: string;
  /** Lucide Icon component */
  icon?: LucideIcon;
  /** URL for external icon image */
  url?: string;
  /** Icon shape */
  shape?: AssetIconShape;
  /** Icon size */
  size?: AssetIconSize;
  /** Icon variant */
  variant?: AssetIconVariant;
  /** Background color */
  backgroundColor?: string;
  /** Accessory badge */
  acc?: ReactNode;
  /** Accessory position */
  accPosition?: AccPosition;
  /** Accessory masking */
  accMasking?: AccMasking;
  /** Alt text */
  alt?: string;
  /** Horizontal padding for card shape */
  paddingX?: boolean;
}

const AssetIcon = memo<ListRowAssetIconProps>(({
  name,
  icon,
  url,
  shape = 'original',
  size = 'medium',
  variant = 'none',
  backgroundColor = adaptive.greyOpacity100,
  acc,
  accPosition = 'bottom-right',
  accMasking = 'none',
  alt,
  paddingX = false,
}) => {
  const isCircle = shape === 'circle-background' || shape === 'circle-masking';
  const effectiveSize = isCircle ? 'large' : size;

  const classNames = [
    'list-row-asset-icon',
    `list-row-asset-icon--${shape}`,
    `list-row-asset-icon--size-${effectiveSize}`,
    variant === 'fill' && 'list-row-asset-icon--fill',
    paddingX && 'list-row-asset-icon--padding-x',
  ].filter(Boolean).join(' ');

  const showBackground = shape !== 'original';
  const bgStyle = showBackground ? { backgroundColor } : undefined;

  return (
    <div className={classNames} style={bgStyle}>
      {url ? (
        <img src={url} alt={alt || ''} className="list-row-asset-icon__img" decoding="async" />
      ) : name && (name.startsWith('http') || name.startsWith('/')) ? (
        <img src={name} alt={alt || ''} className="list-row-asset-icon__img" decoding="async" />
      ) : icon ? (
        <Icon icon={icon} size={24} className="list-row-asset-icon__icon" aria-hidden={!alt} aria-label={alt} />
      ) : null}

      {acc && (
        <div className={`list-row-asset-icon__acc list-row-asset-icon__acc--${accPosition} ${accMasking === 'circle' ? 'list-row-asset-icon__acc--circle' : ''}`}>
          {acc}
        </div>
      )}
    </div>
  );
});

AssetIcon.displayName = 'ListRow.AssetIcon';

// ============================================================================
// Sub-component: AssetImage
// ============================================================================

type AssetImageShape = 'original' | 'squircle' | 'card' | 'circle' | 'square';

export interface ListRowAssetImageProps {
  src: string;
  shape?: AssetImageShape;
  size?: AssetIconSize;
  backgroundColor?: string;
  scale?: number;
  scaleType?: 'fill' | 'fit';
  acc?: ReactNode;
  accPosition?: AccPosition;
  accMasking?: AccMasking;
  paddingX?: boolean;
  alt?: string;
}

const AssetImage = memo<ListRowAssetImageProps>(({
  src,
  shape = 'squircle',
  size = 'small',
  backgroundColor,
  scale = 1,
  scaleType = 'fill',
  acc,
  accPosition = 'bottom-right',
  accMasking = 'none',
  paddingX = false,
  alt = '',
}) => {
  const isFixedSize = shape === 'original' || shape === 'circle' || shape === 'square';

  const classNames = [
    'list-row-asset-image',
    `list-row-asset-image--${shape}`,
    !isFixedSize && `list-row-asset-image--size-${size}`,
    paddingX && 'list-row-asset-image--padding-x',
  ].filter(Boolean).join(' ');

  const imgStyle: React.CSSProperties = {
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    objectFit: scaleType === 'fit' ? 'contain' : 'cover',
  };

  return (
    <div className={classNames} style={backgroundColor ? { backgroundColor } : undefined}>
      <img src={src} alt={alt} className="list-row-asset-image__img" style={imgStyle} decoding="async" />

      {acc && (
        <div className={`list-row-asset-image__acc list-row-asset-image__acc--${accPosition} ${accMasking === 'circle' ? 'list-row-asset-image__acc--circle' : ''}`}>
          {acc}
        </div>
      )}
    </div>
  );
});

AssetImage.displayName = 'ListRow.AssetImage';

// ============================================================================
// Sub-component: AssetLottie
// ============================================================================

export interface ListRowAssetLottieProps {
  src: string;
  shape?: AssetImageShape;
  size?: AssetIconSize;
  backgroundColor?: string;
  acc?: ReactNode;
  accPosition?: AccPosition;
  accMasking?: AccMasking;
  paddingX?: boolean;
}

const AssetLottie = memo<ListRowAssetLottieProps>(({
  src,
  shape = 'squircle',
  size = 'small',
  backgroundColor = adaptive.greyOpacity100,
  acc,
  accPosition = 'bottom-right',
  accMasking = 'none',
  paddingX = false,
}) => {
  const isFixedSize = shape === 'original' || shape === 'circle' || shape === 'square';

  const classNames = [
    'list-row-asset-lottie',
    `list-row-asset-lottie--${shape}`,
    !isFixedSize && `list-row-asset-lottie--size-${size}`,
    paddingX && 'list-row-asset-lottie--padding-x',
  ].filter(Boolean).join(' ');

  // Note: Actual Lottie rendering would require lottie-web or similar library
  // This is a placeholder that shows the source URL
  return (
    <div className={classNames} style={{ backgroundColor }}>
      <div className="list-row-asset-lottie__player" data-src={src}>
        {/* Lottie player would be initialized here */}
        <PlayCircle size={24} className="list-row-asset-lottie__placeholder" aria-hidden="true" />
      </div>

      {acc && (
        <div className={`list-row-asset-lottie__acc list-row-asset-lottie__acc--${accPosition} ${accMasking === 'circle' ? 'list-row-asset-lottie__acc--circle' : ''}`}>
          {acc}
        </div>
      )}
    </div>
  );
});

AssetLottie.displayName = 'ListRow.AssetLottie';

// ============================================================================
// Sub-component: AssetText
// ============================================================================

type AssetTextShape = 'squircle' | 'card';

export interface ListRowAssetTextProps {
  children: ReactNode;
  shape: AssetTextShape;
  size?: AssetIconSize;
  backgroundColor?: string;
  color?: string;
  acc?: ReactNode;
  accPosition?: AccPosition;
  accMasking?: AccMasking;
  paddingX?: boolean;
}

const AssetText = memo<ListRowAssetTextProps>(({
  children,
  shape,
  size = 'small',
  backgroundColor = adaptive.greyOpacity100,
  color = adaptive.blue500,
  acc,
  accPosition = 'bottom-right',
  accMasking = 'none',
  paddingX = false,
}) => {
  const classNames = [
    'list-row-asset-text',
    `list-row-asset-text--${shape}`,
    `list-row-asset-text--size-${size}`,
    paddingX && 'list-row-asset-text--padding-x',
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames} style={{ backgroundColor }}>
      <span className="list-row-asset-text__content" style={{ color }}>
        {children}
      </span>

      {acc && (
        <div className={`list-row-asset-text__acc list-row-asset-text__acc--${accPosition} ${accMasking === 'circle' ? 'list-row-asset-text__acc--circle' : ''}`}>
          {acc}
        </div>
      )}
    </div>
  );
});

AssetText.displayName = 'ListRow.AssetText';

// ============================================================================
// Sub-component: Texts (Multi-line text)
// ============================================================================

type TextsType =
  // 1 Row types
  | '1RowTypeA' | '1RowTypeB' | '1RowTypeC'
  | 'Right1RowTypeA' | 'Right1RowTypeB' | 'Right1RowTypeC' | 'Right1RowTypeD' | 'Right1RowTypeE'
  // 2 Row types
  | '2RowTypeA' | '2RowTypeB' | '2RowTypeC' | '2RowTypeD' | '2RowTypeE' | '2RowTypeF'
  | 'Right2RowTypeA' | 'Right2RowTypeB' | 'Right2RowTypeC' | 'Right2RowTypeD' | 'Right2RowTypeE'
  // 3 Row types
  | '3RowTypeA' | '3RowTypeB' | '3RowTypeC' | '3RowTypeD' | '3RowTypeE' | '3RowTypeF';

export interface ListRowTextsProps {
  type?: TextsType;
  top?: ReactNode;
  middle?: ReactNode;
  bottom?: ReactNode;
  marginTop?: number;
}

const Texts = memo<ListRowTextsProps>(({
  type = '1RowTypeA',
  top,
  middle,
  bottom,
  marginTop,
}) => {
  const isRight = type.startsWith('Right');
  const rowCount = type.includes('3Row') ? 3 : type.includes('2Row') ? 2 : 1;

  const classNames = [
    'list-row-texts',
    `list-row-texts--${type}`,
    isRight && 'list-row-texts--right',
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames} style={marginTop ? { marginTop } : undefined}>
      {top && <span className="list-row-texts__top">{top}</span>}
      {rowCount >= 3 && middle && <span className="list-row-texts__middle">{middle}</span>}
      {rowCount >= 2 && bottom && <span className="list-row-texts__bottom">{bottom}</span>}
    </div>
  );
});

Texts.displayName = 'ListRow.Texts';

// ============================================================================
// Sub-component: IconButton
// ============================================================================

type IconButtonVariant = 'fill' | 'clear' | 'border';

export interface ListRowIconButtonProps {
  /** Icon name (Bootstrap Icons) */
  iconName?: string;
  /** Lucide Icon component */
  icon?: LucideIcon;
  /** Icon source URL */
  src?: string;
  /** Button variant */
  variant?: IconButtonVariant;
  /** Icon size in pixels */
  iconSize?: number;
  /** Icon color (only for mono icons) */
  color?: string;
  /** Background color */
  bgColor?: string;
  /** Aria label for accessibility */
  'aria-label'?: string;
  /** Click handler */
  onClick?: () => void;
}

const IconButton = memo<ListRowIconButtonProps>(({
  iconName,
  icon,
  src,
  variant = 'clear',
  iconSize = 24,
  color,
  bgColor = adaptive.greyOpacity100,
  'aria-label': ariaLabel,
  onClick,
}) => {
  const classNames = [
    'list-row-icon-button',
    `list-row-icon-button--${variant}`,
  ].filter(Boolean).join(' ');

  const buttonStyle: React.CSSProperties = {
    ...(variant === 'fill' && { backgroundColor: bgColor }),
  };

  const iconStyle: React.CSSProperties = {
    ...(color && { color }),
  };

  return (
    <button
      type="button"
      className={classNames}
      style={buttonStyle}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {src ? (
        <img src={src} alt="" style={{ width: iconSize, height: iconSize }} decoding="async" />
      ) : (icon || iconName) ? (
        <Icon icon={icon} name={iconName} size={iconSize} style={iconStyle} aria-hidden="true" />
      ) : null}
    </button>
  );
});

IconButton.displayName = 'ListRow.IconButton';

// ============================================================================
// Sub-component: Loader (Skeleton)
// ============================================================================

export interface ListRowLoaderProps {
  leftShape?: 'circle' | 'square' | 'bar';
  rows?: number;
  className?: string;
}

const ListRowLoader = memo<ListRowLoaderProps>(({
  leftShape,
  rows = 1,
  className = '',
}) => {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`list-row list-row--padding-medium ${className}`}>
          {leftShape && (
            <div className="list-row__left">
              <div
                className="skeleton"
                style={{
                  width: leftShape === 'bar' ? '60px' : '40px',
                  height: leftShape === 'bar' ? '16px' : '40px',
                  borderRadius: leftShape === 'circle' ? '50%' : 'var(--radius-sm)',
                }}
                aria-hidden="true"
              />
            </div>
          )}
          <div className="list-row__contents">
            <div className="skeleton" style={{ width: '70%', height: '18px', marginBottom: '8px' }} aria-hidden="true" />
            <div className="skeleton" style={{ width: '50%', height: '14px' }} aria-hidden="true" />
          </div>
        </div>
      ))}
    </>
  );
});

ListRowLoader.displayName = 'ListRow.Loader';

// ============================================================================
// Compound Component Type
// ============================================================================

type ListRowCompound = typeof ListRowComp & {
  AssetIcon: typeof AssetIcon;
  AssetImage: typeof AssetImage;
  AssetLottie: typeof AssetLottie;
  AssetText: typeof AssetText;
  Texts: typeof Texts;
  IconButton: typeof IconButton;
  Loader: typeof ListRowLoader;
};

// Attach sub-components
(ListRowComp as ListRowCompound).AssetIcon = AssetIcon;
(ListRowComp as ListRowCompound).AssetImage = AssetImage;
(ListRowComp as ListRowCompound).AssetLottie = AssetLottie;
(ListRowComp as ListRowCompound).AssetText = AssetText;
(ListRowComp as ListRowCompound).Texts = Texts;
(ListRowComp as ListRowCompound).IconButton = IconButton;
(ListRowComp as ListRowCompound).Loader = ListRowLoader;

export const ListRow = ListRowComp as ListRowCompound;

// Named exports
export {
  AssetIcon as ListRowAssetIcon,
  AssetImage as ListRowAssetImage,
  AssetLottie as ListRowAssetLottie,
  AssetText as ListRowAssetText,
  Texts as ListRowTexts,
  IconButton as ListRowIconButton,
  ListRowLoader,
};

export default ListRow;
