/**
 * @file Result/index.tsx
 * @description 결과 페이지 컴포넌트 - TDS 스타일
 * @module design-system/molecules
 *
 * 사용 예시:
 * ```tsx
 * <Result
 *   icon="success"
 *   title="결제가 완료되었습니다"
 *   description="주문 내역은 마이페이지에서 확인하실 수 있습니다."
 *   button={<Button onClick={goHome}>홈으로 이동</Button>}
 * />
 *
 * <Result
 *   figure={<img src="/error.svg" />}
 *   title="오류가 발생했습니다"
 *   description="잠시 후 다시 시도해주세요."
 *   button={<Button onClick={retry}>다시 시도</Button>}
 * />
 * ```
 */
import React, { memo, ReactNode } from 'react';
import { Check, X, TriangleAlert, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './Result.css';

// ============================================================================
// Types
// ============================================================================

export type ResultIconType = 'success' | 'error' | 'warning' | 'info';

export interface ResultProps {
  /** 아이콘 타입 (preset) */
  icon?: ResultIconType;
  /** 커스텀 그래픽 (icon과 함께 사용 불가) */
  figure?: ReactNode;
  /** 제목 */
  title: ReactNode;
  /** 설명 */
  description?: ReactNode;
  /** 버튼 영역 */
  button?: ReactNode;
  /** 추가 콘텐츠 */
  extra?: ReactNode;
  /** 전체 높이 사용 */
  fullHeight?: boolean;
  /** 애니메이션 효과 */
  animated?: boolean;
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Icon Component
// ============================================================================

const RESULT_ICONS: Record<ResultIconType, LucideIcon> = {
  success: Check,
  error: X,
  warning: TriangleAlert,
  info: Info,
};

const ResultIcon = memo<{ type: ResultIconType }>(({ type }) => {
  const IconComp = RESULT_ICONS[type];

  return (
    <div className={`result__icon result__icon--${type}`} aria-hidden="true">
      <IconComp size={32} />
    </div>
  );
});

ResultIcon.displayName = 'Result.Icon';

// ============================================================================
// Result Component
// ============================================================================

export const Result = memo<ResultProps>(({
  icon,
  figure,
  title,
  description,
  button,
  extra,
  fullHeight = false,
  animated = true,
  className = '',
}) => {
  const classNames = [
    'result',
    fullHeight && 'result--full-height',
    animated && 'result--animated',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames} role="status" aria-live="polite">
      {(icon || figure) && (
        <div className="result__figure">
          {icon ? <ResultIcon type={icon} /> : figure}
        </div>
      )}

      <h5 className="result__title">{title}</h5>

      {description && (
        <p className="result__description">{description}</p>
      )}

      {button && (
        <div className="result__button">{button}</div>
      )}

      {extra && (
        <div className="result__extra">{extra}</div>
      )}
    </div>
  );
});

Result.displayName = 'Result';

export default Result;
