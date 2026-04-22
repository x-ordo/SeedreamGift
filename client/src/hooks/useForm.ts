/**
 * @file useForm.ts
 * @description 폼 상태 관리 훅 - 필드별 상태, 유효성 검사, 제출 핸들링
 * @module hooks
 *
 * 사용 예시:
 * ```tsx
 * const form = useForm({
 *   email: '',
 *   password: '',
 * }, {
 *   validate: (values) => ({
 *     email: !values.email ? '이메일을 입력해주세요.' : undefined,
 *     password: values.password.length < 8 ? '8자 이상 입력해주세요.' : undefined,
 *   }),
 * });
 *
 * <input
 *   value={form.values.email}
 *   onChange={(e) => form.handleChange('email', e.target.value)}
 *   onBlur={() => form.handleBlur('email')}
 * />
 * {form.touched.email && form.errors.email && (
 *   <span className="error">{form.errors.email}</span>
 * )}
 * ```
 */
import { useState, useCallback, useMemo } from 'react';

export type FormErrors<T> = Partial<Record<keyof T, string>>;
export type FormTouched<T> = Partial<Record<keyof T, boolean>>;

export interface UseFormOptions<T extends Record<string, unknown>> {
  /** 유효성 검사 함수 */
  validate?: (values: T) => FormErrors<T>;
  /** blur 시 자동 검증 (기본: true) */
  validateOnBlur?: boolean;
  /** change 시 자동 검증 (기본: false) */
  validateOnChange?: boolean;
  /** 제출 핸들러 */
  onSubmit?: (values: T) => void | Promise<void>;
}

export interface UseFormReturn<T extends Record<string, unknown>> {
  /** 현재 폼 값 */
  values: T;
  /** 에러 메시지 */
  errors: FormErrors<T>;
  /** 터치된 필드 */
  touched: FormTouched<T>;
  /** 제출 중 상태 */
  isSubmitting: boolean;
  /** 폼 유효성 여부 */
  isValid: boolean;
  /** dirty 상태 (초기값과 다른지) */
  isDirty: boolean;
  /** 필드 값 변경 */
  handleChange: (field: keyof T, value: T[keyof T]) => void;
  /** 필드 blur 처리 */
  handleBlur: (field: keyof T) => void;
  /** 폼 제출 */
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  /** 필드 에러 설정 */
  setFieldError: (field: keyof T, message: string | undefined) => void;
  /** 필드 값 설정 */
  setFieldValue: (field: keyof T, value: T[keyof T]) => void;
  /** 여러 필드 값 설정 */
  setValues: (values: Partial<T>) => void;
  /** 폼 초기화 */
  reset: (newValues?: T) => void;
  /** 전체 유효성 검사 */
  validateForm: () => FormErrors<T>;
  /** 특정 필드 유효성 검사 */
  validateField: (field: keyof T) => string | undefined;
  /** input props 헬퍼 */
  getFieldProps: (field: keyof T) => {
    value: T[keyof T];
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    onBlur: () => void;
    name: string;
    id: string;
  };
}

/**
 * 폼 상태 관리 훅
 *
 * @param initialValues - 초기값
 * @param options - 옵션
 * @returns 폼 상태 및 핸들러
 */
export function useForm<T extends Record<string, unknown>>(
  initialValues: T,
  options: UseFormOptions<T> = {}
): UseFormReturn<T> {
  const {
    validate,
    validateOnBlur = true,
    validateOnChange = false,
    onSubmit,
  } = options;

  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [touched, setTouched] = useState<FormTouched<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 유효성 검사
  const validateForm = useCallback((): FormErrors<T> => {
    if (!validate) return {};
    const newErrors = validate(values);
    setErrors(newErrors);
    return newErrors;
  }, [validate, values]);

  // 특정 필드 검사
  const validateField = useCallback(
    (field: keyof T): string | undefined => {
      if (!validate) return undefined;
      const fieldErrors = validate(values);
      const error = fieldErrors[field];
      setErrors((prev) => ({ ...prev, [field]: error }));
      return error;
    },
    [validate, values]
  );

  // 필드 값 변경
  const handleChange = useCallback(
    (field: keyof T, value: T[keyof T]) => {
      setValuesState((prev) => ({ ...prev, [field]: value }));

      if (validateOnChange) {
        // 다음 틱에서 검증 (값 업데이트 후)
        setTimeout(() => {
          validateField(field);
        }, 0);
      }
    },
    [validateOnChange, validateField]
  );

  // 필드 blur
  const handleBlur = useCallback(
    (field: keyof T) => {
      setTouched((prev) => ({ ...prev, [field]: true }));

      if (validateOnBlur) {
        validateField(field);
      }
    },
    [validateOnBlur, validateField]
  );

  // 폼 제출
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      // 모든 필드를 터치됨으로 표시
      const allTouched = Object.keys(values).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {} as FormTouched<T>
      );
      setTouched(allTouched);

      // 유효성 검사
      const formErrors = validateForm();
      const hasErrors = Object.values(formErrors).some(Boolean);

      if (hasErrors) {
        return;
      }

      if (onSubmit) {
        setIsSubmitting(true);
        try {
          await onSubmit(values);
        } finally {
          setIsSubmitting(false);
        }
      }
    },
    [values, validateForm, onSubmit]
  );

  // 필드 에러 수동 설정
  const setFieldError = useCallback((field: keyof T, message: string | undefined) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  // 필드 값 수동 설정
  const setFieldValue = useCallback((field: keyof T, value: T[keyof T]) => {
    setValuesState((prev) => ({ ...prev, [field]: value }));
  }, []);

  // 여러 값 설정
  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }));
  }, []);

  // 초기화
  const reset = useCallback(
    (newValues?: T) => {
      setValuesState(newValues || initialValues);
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
    },
    [initialValues]
  );

  // input props 헬퍼
  const getFieldProps = useCallback(
    (field: keyof T) => ({
      value: values[field],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
      ) => {
        const value = e.target.type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : e.target.value;
        handleChange(field, value as T[keyof T]);
      },
      onBlur: () => handleBlur(field),
      name: String(field),
      id: String(field),
    }),
    [values, handleChange, handleBlur]
  );

  // 유효성 여부
  const isValid = useMemo(() => {
    if (!validate) return true;
    const currentErrors = validate(values);
    return !Object.values(currentErrors).some(Boolean);
  }, [validate, values]);

  // dirty 상태
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldError,
    setFieldValue,
    setValues,
    reset,
    validateForm,
    validateField,
    getFieldProps,
  };
}
