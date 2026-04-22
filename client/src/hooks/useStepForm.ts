/**
 * @file useStepForm.ts
 * @description 멀티스텝 폼 상태 관리 훅
 * @module hooks
 *
 * 주요 기능:
 * - 스텝 간 네비게이션 (next/prev/goTo)
 * - 스텝별 유효성 검사
 * - 폼 데이터 통합 관리
 * - 제출 상태 관리
 *
 * 사용 예시:
 * ```tsx
 * const stepForm = useStepForm({
 *   totalSteps: 3,
 *   initialData: { brand: '', productId: '', pin: '' },
 *   stepValidation: {
 *     1: (data) => !!data.brand,
 *     2: (data) => !!data.productId && data.pin.length >= 8,
 *     3: (data) => !!data.bankName && !!data.accountNum,
 *   },
 *   onComplete: async (data) => {
 *     await submitTradeIn(data);
 *   },
 * });
 *
 * // 사용
 * stepForm.currentStep // 1
 * stepForm.next() // 유효성 검사 후 다음 스텝
 * stepForm.prev() // 이전 스텝
 * stepForm.updateData({ brand: '신세계' })
 * stepForm.submit() // 최종 제출
 * ```
 */
import { useState, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type StepValidation<T> = {
  [step: number]: (data: T) => boolean | string;
};

export interface UseStepFormOptions<T extends Record<string, unknown>> {
  /** 총 스텝 수 */
  totalSteps: number;
  /** 초기 폼 데이터 */
  initialData: T;
  /** 스텝별 유효성 검사 함수 (true/false 또는 에러 메시지 반환) */
  stepValidation?: StepValidation<T>;
  /** 스텝 변경 콜백 */
  onStepChange?: (step: number, data: T) => void;
  /** 최종 제출 핸들러 */
  onComplete?: (data: T) => void | Promise<void>;
  /** 유효성 검사 실패 콜백 */
  onValidationError?: (step: number, error: string) => void;
}

export interface UseStepFormReturn<T extends Record<string, unknown>> {
  /** 현재 스텝 (1부터 시작) */
  currentStep: number;
  /** 총 스텝 수 */
  totalSteps: number;
  /** 현재 폼 데이터 */
  data: T;
  /** 제출 중 상태 */
  isSubmitting: boolean;
  /** 완료 상태 */
  isComplete: boolean;
  /** 첫 스텝 여부 */
  isFirstStep: boolean;
  /** 마지막 스텝 여부 */
  isLastStep: boolean;
  /** 현재 스텝 진행률 (0-100) */
  progress: number;
  /** 현재 스텝 유효성 여부 */
  isCurrentStepValid: boolean;
  /** 다음 스텝으로 이동 */
  next: () => boolean;
  /** 이전 스텝으로 이동 */
  prev: () => void;
  /** 특정 스텝으로 이동 (완료된 스텝만) */
  goTo: (step: number) => boolean;
  /** 폼 데이터 업데이트 */
  updateData: (updates: Partial<T>) => void;
  /** 특정 필드 업데이트 */
  setField: <K extends keyof T>(field: K, value: T[K]) => void;
  /** 폼 제출 (마지막 스텝에서) */
  submit: () => Promise<boolean>;
  /** 폼 초기화 */
  reset: (newData?: T) => void;
  /** 현재 스텝 유효성 검사 실행 */
  validateCurrentStep: () => boolean | string;
  /** 완료된 스텝 목록 */
  completedSteps: number[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * 멀티스텝 폼 관리 훅
 */
export function useStepForm<T extends Record<string, unknown>>(
  options: UseStepFormOptions<T>
): UseStepFormReturn<T> {
  const {
    totalSteps,
    initialData,
    stepValidation = {},
    onStepChange,
    onComplete,
    onValidationError,
  } = options;

  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<T>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Computed values
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;
  const progress = totalSteps > 1 ? ((currentStep - 1) / (totalSteps - 1)) * 100 : 0;

  // 현재 스텝 유효성 검사
  const validateCurrentStep = useCallback((): boolean | string => {
    const validator = stepValidation[currentStep];
    if (!validator) return true;

    const result = validator(data);
    return result;
  }, [currentStep, data, stepValidation]);

  // 현재 스텝 유효성 여부
  const isCurrentStepValid = useMemo(() => {
    const result = validateCurrentStep();
    return result === true;
  }, [validateCurrentStep]);

  // 다음 스텝
  const next = useCallback((): boolean => {
    const validationResult = validateCurrentStep();

    if (validationResult !== true) {
      const errorMessage = typeof validationResult === 'string'
        ? validationResult
        : '입력 정보를 확인해주세요.';
      onValidationError?.(currentStep, errorMessage);
      return false;
    }

    if (currentStep < totalSteps) {
      const nextStep = currentStep + 1;

      // 현재 스텝을 완료 목록에 추가
      setCompletedSteps((prev) =>
        prev.includes(currentStep) ? prev : [...prev, currentStep]
      );

      setCurrentStep(nextStep);
      onStepChange?.(nextStep, data);
      return true;
    }

    return false;
  }, [currentStep, totalSteps, data, validateCurrentStep, onStepChange, onValidationError]);

  // 이전 스텝
  const prev = useCallback((): void => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep, data);
    }
  }, [currentStep, data, onStepChange]);

  // 특정 스텝으로 이동 (완료된 스텝 또는 현재 스텝 이전만 허용)
  const goTo = useCallback((step: number): boolean => {
    if (step < 1 || step > totalSteps) return false;

    // 이전 스텝으로는 자유롭게 이동 가능
    if (step < currentStep) {
      setCurrentStep(step);
      onStepChange?.(step, data);
      return true;
    }

    // 다음 스텝으로는 중간 스텝들이 모두 완료되어야 함
    if (step > currentStep) {
      for (let s = currentStep; s < step; s++) {
        if (!completedSteps.includes(s)) {
          return false;
        }
      }
      setCurrentStep(step);
      onStepChange?.(step, data);
      return true;
    }

    return true;
  }, [currentStep, totalSteps, completedSteps, data, onStepChange]);

  // 데이터 업데이트
  const updateData = useCallback((updates: Partial<T>): void => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  // 단일 필드 업데이트
  const setField = useCallback(<K extends keyof T>(field: K, value: T[K]): void => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // 제출
  const submit = useCallback(async (): Promise<boolean> => {
    // 마지막 스텝 유효성 검사
    const validationResult = validateCurrentStep();
    if (validationResult !== true) {
      const errorMessage = typeof validationResult === 'string'
        ? validationResult
        : '입력 정보를 확인해주세요.';
      onValidationError?.(currentStep, errorMessage);
      return false;
    }

    if (!onComplete) {
      setIsComplete(true);
      return true;
    }

    setIsSubmitting(true);
    try {
      await onComplete(data);
      setIsComplete(true);
      setCompletedSteps((prev) =>
        prev.includes(currentStep) ? prev : [...prev, currentStep]
      );
      return true;
    } catch {
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [currentStep, data, validateCurrentStep, onComplete, onValidationError]);

  // 초기화
  const reset = useCallback((newData?: T): void => {
    setCurrentStep(1);
    setData(newData || initialData);
    setIsSubmitting(false);
    setIsComplete(false);
    setCompletedSteps([]);
  }, [initialData]);

  return {
    currentStep,
    totalSteps,
    data,
    isSubmitting,
    isComplete,
    isFirstStep,
    isLastStep,
    progress,
    isCurrentStepValid,
    next,
    prev,
    goTo,
    updateData,
    setField,
    submit,
    reset,
    validateCurrentStep,
    completedSteps,
  };
}

// ============================================================================
// Helper Types for Step Configuration
// ============================================================================

export interface StepConfig {
  /** 스텝 ID (1부터 시작) */
  id: number;
  /** 스텝 라벨 */
  label: string;
  /** 스텝 설명 (선택) */
  description?: string;
  /** 아이콘 클래스 (선택) */
  icon?: string;
}

/**
 * 스텝 설정 생성 헬퍼
 */
export function createStepConfig(steps: Omit<StepConfig, 'id'>[]): StepConfig[] {
  return steps.map((step, index) => ({
    ...step,
    id: index + 1,
  }));
}
