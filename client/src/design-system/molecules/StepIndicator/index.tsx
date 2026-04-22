/**
 * @file StepIndicator/index.tsx
 * @description 스텝 인디케이터 컴포넌트 - 멀티스텝 폼 진행 상태 표시
 * @module design-system/molecules
 *
 * WCAG 2.1 AA 접근성 준수:
 * - role="list" / role="listitem" 구조
 * - aria-current="step" 현재 단계 표시
 * - aria-label로 상태 설명 (완료/진행 중)
 *
 * 사용 예시:
 * ```tsx
 * const steps = [
 *   { id: '1', label: '상품 선택' },
 *   { id: '2', label: 'PIN 입력' },
 *   { id: '3', label: '계좌 입력' },
 * ];
 *
 * <StepIndicator
 *   steps={steps}
 *   currentStep="2"
 *   ariaLabel="매입 진행 단계"
 * />
 * ```
 */
import React, { memo } from 'react';
import { Check } from 'lucide-react';
import './StepIndicator.css';

// ============================================================================
// Types
// ============================================================================

export interface Step {
  /** 고유 ID (비교용) */
  id: string | number;
  /** 표시 라벨 */
  label: string;
  /** 아이콘 (선택) */
  icon?: React.ReactNode;
}

export interface StepIndicatorProps {
  /** 스텝 목록 */
  steps: Step[];
  /** 현재 활성 스텝 ID */
  currentStep: string | number;
  /** 접근성 레이블 */
  ariaLabel?: string;
  /** 방향 (기본: horizontal) */
  direction?: 'horizontal' | 'vertical';
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 완료 아이콘 커스텀 */
  completedIcon?: React.ReactNode;
  /** 라벨 항상 표시 (기본: 반응형) */
  alwaysShowLabel?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 스텝 클릭 핸들러 (클릭 가능한 스텝에만) */
  onStepClick?: (stepId: string | number) => void;
  /** 클릭 가능한 스텝 ID 목록 */
  clickableSteps?: (string | number)[];
}

// ============================================================================
// Component
// ============================================================================

/**
 * 스텝 인디케이터 컴포넌트
 */
export const StepIndicator = memo<StepIndicatorProps>(({
  steps = [],
  currentStep,
  ariaLabel = '진행 단계',
  direction = 'horizontal',
  size = 'md',
  completedIcon = <Check size={16} aria-hidden="true" />,
  alwaysShowLabel = false,
  className = '',
  onStepClick,
  clickableSteps = [],
}) => {
  // 현재 스텝 인덱스 찾기
  const currentIndex = steps?.findIndex((s) => s.id === currentStep) ?? -1;

  // 스텝 상태 결정
  const getStepState = (index: number): 'completed' | 'active' | 'pending' => {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'active';
    return 'pending';
  };

  // 클릭 가능 여부
  const isClickable = (stepId: string | number): boolean => {
    return !!onStepClick && clickableSteps.includes(stepId);
  };

  // 스텝 aria-label 생성
  const getStepAriaLabel = (step: Step, state: 'completed' | 'active' | 'pending'): string => {
    const stateText = state === 'completed' ? '(완료)' :
                      state === 'active' ? '(진행 중)' : '';
    return `${step.label} ${stateText}`.trim();
  };

  return (
    <nav
      className={`step-indicator step-indicator--${direction} step-indicator--${size} ${className}`}
      role="list"
      aria-label={ariaLabel}
    >
      {steps?.map((step, index) => {
        const state = getStepState(index);
        const clickable = isClickable(step.id);
        const stepNumber = index + 1;

        const content = (
          <>
            <div className="step-indicator__number" aria-hidden="true">
              {state === 'completed' ? completedIcon : step.icon || stepNumber}
            </div>
            <span
              className={`step-indicator__label ${alwaysShowLabel ? 'step-indicator__label--always' : ''}`}
            >
              {step.label}
            </span>
          </>
        );

        // 클릭 가능한 스텝은 listitem 안에 button, 아니면 단순 div
        if (clickable) {
          return (
            <div
              key={step.id}
              role="listitem"
              className={`step-indicator__item step-indicator__item--${state} step-indicator__item--clickable`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <button
                type="button"
                className="step-indicator__button"
                aria-label={getStepAriaLabel(step, state)}
                onClick={() => onStepClick?.(step.id)}
              >
                {content}
              </button>
            </div>
          );
        }

        return (
          <div
            key={step.id}
            role="listitem"
            className={`step-indicator__item step-indicator__item--${state}`}
            aria-current={state === 'active' ? 'step' : undefined}
            aria-label={getStepAriaLabel(step, state)}
          >
            {content}
          </div>
        );
      })}
    </nav>
  );
});

StepIndicator.displayName = 'StepIndicator';

// ============================================================================
// Simple Step Indicator (Numbered only)
// ============================================================================

export interface SimpleStepIndicatorProps {
  /** 총 스텝 수 */
  totalSteps: number;
  /** 현재 스텝 (1부터 시작) */
  currentStep: number;
  /** 스텝 라벨 배열 (선택) */
  labels?: string[];
  /** 접근성 레이블 */
  ariaLabel?: string;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 간단한 스텝 인디케이터 (숫자만)
 */
export const SimpleStepIndicator = memo<SimpleStepIndicatorProps>(({
  totalSteps,
  currentStep,
  labels = [],
  ariaLabel = '진행 단계',
  className = '',
}) => {
  const steps: Step[] = Array.from({ length: totalSteps }, (_, i) => ({
    id: String(i + 1),
    label: labels[i] || `Step ${i + 1}`,
  }));

  return (
    <StepIndicator
      steps={steps}
      currentStep={String(currentStep)}
      ariaLabel={ariaLabel}
      className={className}
    />
  );
});

SimpleStepIndicator.displayName = 'SimpleStepIndicator';

// ============================================================================
// Progress Step Indicator (With progress bar)
// ============================================================================

export interface ProgressStepIndicatorProps extends Omit<StepIndicatorProps, 'direction'> {
  /** 진행률 바 표시 */
  showProgress?: boolean;
}

/**
 * 진행률 바가 포함된 스텝 인디케이터
 */
export const ProgressStepIndicator = memo<ProgressStepIndicatorProps>(({
  steps,
  currentStep,
  showProgress = true,
  ...props
}) => {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  const progress = steps.length > 1
    ? (currentIndex / (steps.length - 1)) * 100
    : currentIndex === 0 ? 0 : 100;

  return (
    <div className="progress-step-indicator">
      {showProgress && (
        <div
          className="progress-step-indicator__bar"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`진행률 ${Math.round(progress)}%`}
        >
          <div
            className="progress-step-indicator__fill"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
      )}
      <StepIndicator
        steps={steps}
        currentStep={currentStep}
        direction="horizontal"
        {...props}
      />
    </div>
  );
});

ProgressStepIndicator.displayName = 'ProgressStepIndicator';
