/**
 * @file BottomCTA/index.tsx
 * @description 하단 CTA 버튼 컴포넌트 - Toss Design System 패턴
 * @module design-system/molecules
 *
 * 사용 예시:
 * ```tsx
 * // 단일 버튼 (고정)
 * <FixedBottomCTA onClick={handleSubmit}>
 *   결제하기
 * </FixedBottomCTA>
 *
 * // 단일 버튼 (비고정 - 화면 따라 이동)
 * <BottomCTA.Single onClick={handleSubmit}>
 *   다음
 * </BottomCTA.Single>
 *
 * // 두 개 버튼 + topAccessory
 * <BottomCTA.Double
 *   fixed={false}
 *   topAccessory={<NumericSpinner ... />}
 *   leftButton={<CTAButton variant="secondary">취소</CTAButton>}
 *   rightButton={<CTAButton>확인</CTAButton>}
 * />
 * ```
 */
import React, { ReactNode, ButtonHTMLAttributes, CSSProperties, Ref, memo } from 'react';
import './BottomCTA.css';

// ============================================================================
// Types
// ============================================================================

export interface CTAButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 버튼 텍스트 또는 콘텐츠 */
  children: ReactNode;
  /** 버튼 스타일 변형 */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** 로딩 상태 */
  loading?: boolean;
  /** 버튼 크기 */
  size?: 'default' | 'small';
}

/** 레거시 호환 - leftButton/rightButton에 객체 형태로 전달할 때 사용 */
export type BottomCTAButtonProps = CTAButtonProps;

export interface BottomCTABaseProps {
  /** 화면 하단 완전 고정 (position: fixed) */
  fixed?: boolean;
  /** 스크롤 시 하단에 따라옴 (position: sticky) - 기본값 true */
  sticky?: boolean;
  /** 고정된 상태에서 레이아웃 공간을 차지할지 결정 (fixed=true일 때 기본값 true) */
  takeSpace?: boolean;
  /** 배경색 설정 ('default' | 'none') */
  background?: 'default' | 'none';
  /** 상단 그림자 표시 */
  showShadow?: boolean;
  /** 하단 safeArea 패딩 적용 여부 */
  hasSafeAreaPadding?: boolean;
  /** paddingBottom 적용 여부 */
  hasPaddingBottom?: boolean;
  /** 컨테이너 스타일 */
  containerStyle?: CSSProperties;
  /** 컨테이너 ref */
  containerRef?: Ref<HTMLDivElement>;
  /** CTA 위에 렌더링되는 악세서리 요소 */
  topAccessory?: ReactNode;
  /** CTA 아래에 렌더링되는 악세서리 요소 */
  bottomAccessory?: ReactNode;
}

export interface BottomCTASingleProps extends BottomCTABaseProps, Omit<CTAButtonProps, 'size'> {
  /** 추가 설명 텍스트 */
  subText?: string;
}

export interface BottomCTADoubleProps extends BottomCTABaseProps {
  /** 왼쪽 버튼 (ReactNode 또는 BottomCTAButtonProps 객체) */
  leftButton: ReactNode | BottomCTAButtonProps;
  /** 오른쪽 버튼 (ReactNode 또는 BottomCTAButtonProps 객체) */
  rightButton: ReactNode | BottomCTAButtonProps;
  /** 추가 설명 텍스트 */
  subText?: string;
}

// ============================================================================
// CTAButton Component (exported for use as leftButton/rightButton)
// ============================================================================

export const CTAButton = memo<CTAButtonProps>(({
  children,
  variant = 'primary',
  loading = false,
  size = 'default',
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      type="button"
      className={`bottom-cta-button bottom-cta-button--${variant} ${size === 'small' ? 'bottom-cta-button--small' : ''} ${loading ? 'bottom-cta-button--loading' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="bottom-cta-spinner" aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  );
});

CTAButton.displayName = 'CTAButton';

// ============================================================================
// Helper: Check if value is ButtonProps object or ReactNode
// ============================================================================

function isButtonProps(value: ReactNode | BottomCTAButtonProps): value is BottomCTAButtonProps {
  return (
    value !== null &&
    typeof value === 'object' &&
    'children' in value &&
    !React.isValidElement(value)
  );
}

// ============================================================================
// BottomCTA.Single
// ============================================================================

const BottomCTASingle = memo<BottomCTASingleProps>(({
  fixed = false,
  sticky = true,
  takeSpace,
  background = 'default',
  showShadow = true,
  hasSafeAreaPadding = true,
  hasPaddingBottom = true,
  containerStyle,
  containerRef,
  topAccessory,
  bottomAccessory,
  subText,
  children,
  ...buttonProps
}) => {
  const shouldTakeSpace = takeSpace ?? fixed;

  const containerClasses = [
    'bottom-cta',
    fixed && 'bottom-cta--fixed',
    !fixed && sticky && 'bottom-cta--sticky',
    showShadow && 'bottom-cta--shadow',
    background === 'none' && 'bottom-cta--no-bg',
    !hasPaddingBottom && 'bottom-cta--no-padding-bottom',
    !hasSafeAreaPadding && 'bottom-cta--no-safe-area',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        ref={containerRef}
        className={containerClasses}
        style={containerStyle}
      >
        <div className="bottom-cta-container">
          {topAccessory && (
            <div className="bottom-cta-top-accessory">{topAccessory}</div>
          )}
          {subText && (
            <p className="bottom-cta-subtext">{subText}</p>
          )}
          <CTAButton {...buttonProps}>{children}</CTAButton>
          {bottomAccessory && (
            <div className="bottom-cta-bottom-accessory">{bottomAccessory}</div>
          )}
        </div>
      </div>
      {fixed && shouldTakeSpace && <div className="bottom-cta-spacer" />}
    </>
  );
});

BottomCTASingle.displayName = 'BottomCTA.Single';

// ============================================================================
// BottomCTA.Double
// ============================================================================

const BottomCTADouble = memo<BottomCTADoubleProps>(({
  fixed = false,
  sticky = true,
  takeSpace,
  background = 'default',
  showShadow = true,
  hasSafeAreaPadding = true,
  hasPaddingBottom = true,
  containerStyle,
  containerRef,
  topAccessory,
  bottomAccessory,
  leftButton,
  rightButton,
  subText,
}) => {
  const shouldTakeSpace = takeSpace ?? fixed;

  const containerClasses = [
    'bottom-cta',
    fixed && 'bottom-cta--fixed',
    !fixed && sticky && 'bottom-cta--sticky',
    showShadow && 'bottom-cta--shadow',
    background === 'none' && 'bottom-cta--no-bg',
    !hasPaddingBottom && 'bottom-cta--no-padding-bottom',
    !hasSafeAreaPadding && 'bottom-cta--no-safe-area',
  ].filter(Boolean).join(' ');

  // Render button - supports both ReactNode and BottomCTAButtonProps
  const renderButton = (button: ReactNode | BottomCTAButtonProps, defaultVariant: 'primary' | 'secondary') => {
    if (isButtonProps(button)) {
      return <CTAButton variant={defaultVariant} {...button} />;
    }
    return button;
  };

  return (
    <>
      <div
        ref={containerRef}
        className={containerClasses}
        style={containerStyle}
      >
        <div className="bottom-cta-container">
          {topAccessory && (
            <div className="bottom-cta-top-accessory">{topAccessory}</div>
          )}
          {subText && (
            <p className="bottom-cta-subtext">{subText}</p>
          )}
          <div className="bottom-cta-double">
            {renderButton(leftButton, 'secondary')}
            {renderButton(rightButton, 'primary')}
          </div>
          {bottomAccessory && (
            <div className="bottom-cta-bottom-accessory">{bottomAccessory}</div>
          )}
        </div>
      </div>
      {fixed && shouldTakeSpace && <div className="bottom-cta-spacer" />}
    </>
  );
});

BottomCTADouble.displayName = 'BottomCTA.Double';

// ============================================================================
// BottomCTA (Compound Component)
// ============================================================================

type BottomCTAComponent = typeof BottomCTASingle & {
  Single: typeof BottomCTASingle;
  Double: typeof BottomCTADouble;
};

export const BottomCTA = BottomCTASingle as BottomCTAComponent;
BottomCTA.Single = BottomCTASingle;
BottomCTA.Double = BottomCTADouble;

// ============================================================================
// FixedBottomCTA (Convenience wrapper with fixed=true)
// ============================================================================

const FixedBottomCTASingle = memo<Omit<BottomCTASingleProps, 'fixed'>>((props) => {
  return <BottomCTASingle fixed={true} {...props} />;
});

FixedBottomCTASingle.displayName = 'FixedBottomCTA';

const FixedBottomCTADouble = memo<Omit<BottomCTADoubleProps, 'fixed'>>((props) => {
  return <BottomCTADouble fixed={true} {...props} />;
});

FixedBottomCTADouble.displayName = 'FixedBottomCTA.Double';

type FixedBottomCTAComponent = typeof FixedBottomCTASingle & {
  Double: typeof FixedBottomCTADouble;
};

export const FixedBottomCTA = FixedBottomCTASingle as FixedBottomCTAComponent;
FixedBottomCTA.Double = FixedBottomCTADouble;
