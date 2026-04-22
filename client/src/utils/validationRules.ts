/**
 * @file validationRules.ts
 * @description 폼 유효성 검사 규칙 - 중앙화된 검증 로직
 * @module utils
 *
 * 주요 기능:
 * - 개별 필드 검증 함수
 * - 복합 검증 규칙 조합
 * - 에러 메시지 표준화
 *
 * 사용 예시:
 * ```tsx
 * // 개별 검증
 * const emailError = validators.email('test@example.com');
 *
 * // useForm과 함께 사용
 * const form = useForm(initialData, {
 *   validate: createFormValidator({
 *     email: [required('이메일'), email()],
 *     password: [required('비밀번호'), minLength(8)],
 *     phone: [required('전화번호'), phone()],
 *   }),
 * });
 *
 * // 직접 검증
 * const errors = validateFields(data, {
 *   pinCode: [required('PIN 번호'), minLength(8, 'PIN은 8자 이상')],
 * });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 검증 함수 타입
 * @returns undefined (유효) 또는 에러 메시지 (무효)
 */
export type Validator<T = string> = (value: T) => string | undefined;

/**
 * 필드별 검증 규칙 맵
 */
export type ValidationRules<T> = {
  [K in keyof T]?: Validator<T[K]>[];
};

/**
 * 검증 결과 (필드별 에러 메시지)
 */
export type ValidationErrors<T> = Partial<Record<keyof T, string>>;

// ============================================================================
// Basic Validators
// ============================================================================

/**
 * 필수 입력 검증
 */
export function required(fieldName = '이 필드'): Validator<unknown> {
  return (value) => {
    if (value === undefined || value === null || value === '') {
      return `${fieldName}을(를) 입력해주세요.`;
    }
    return undefined;
  };
}

/**
 * 최소 길이 검증
 */
export function minLength(min: number, message?: string): Validator<string> {
  return (value) => {
    if (value && value.length < min) {
      return message || `최소 ${min}자 이상 입력해주세요.`;
    }
    return undefined;
  };
}

/**
 * 최대 길이 검증
 */
export function maxLength(max: number, message?: string): Validator<string> {
  return (value) => {
    if (value && value.length > max) {
      return message || `최대 ${max}자까지 입력 가능합니다.`;
    }
    return undefined;
  };
}

/**
 * 정확한 길이 검증
 */
export function exactLength(length: number, message?: string): Validator<string> {
  return (value) => {
    if (value && value.length !== length) {
      return message || `정확히 ${length}자를 입력해주세요.`;
    }
    return undefined;
  };
}

/**
 * 최소값 검증 (숫자)
 */
export function minValue(min: number, message?: string): Validator<number> {
  return (value) => {
    if (value !== undefined && value < min) {
      return message || `${min} 이상의 값을 입력해주세요.`;
    }
    return undefined;
  };
}

/**
 * 최대값 검증 (숫자)
 */
export function maxValue(max: number, message?: string): Validator<number> {
  return (value) => {
    if (value !== undefined && value > max) {
      return message || `${max} 이하의 값을 입력해주세요.`;
    }
    return undefined;
  };
}

// ============================================================================
// Pattern Validators
// ============================================================================

/**
 * 이메일 형식 검증
 */
export function email(message?: string): Validator<string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return (value) => {
    if (value && !emailRegex.test(value)) {
      return message || '올바른 이메일 형식이 아닙니다.';
    }
    return undefined;
  };
}

/**
 * 전화번호 형식 검증 (한국)
 */
export function phone(message?: string): Validator<string> {
  // 010-1234-5678 또는 01012345678 형식
  const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
  return (value) => {
    if (value && !phoneRegex.test(value.replace(/-/g, ''))) {
      return message || '올바른 전화번호 형식이 아닙니다.';
    }
    return undefined;
  };
}

/**
 * 숫자만 허용
 */
export function numericOnly(message?: string): Validator<string> {
  return (value) => {
    if (value && !/^\d+$/.test(value)) {
      return message || '숫자만 입력 가능합니다.';
    }
    return undefined;
  };
}

/**
 * 영문자만 허용
 */
export function alphabeticOnly(message?: string): Validator<string> {
  return (value) => {
    if (value && !/^[a-zA-Z]+$/.test(value)) {
      return message || '영문자만 입력 가능합니다.';
    }
    return undefined;
  };
}

/**
 * 영문자 + 숫자만 허용
 */
export function alphanumeric(message?: string): Validator<string> {
  return (value) => {
    if (value && !/^[a-zA-Z0-9]+$/.test(value)) {
      return message || '영문자와 숫자만 입력 가능합니다.';
    }
    return undefined;
  };
}

/**
 * 정규식 패턴 검증
 */
export function pattern(regex: RegExp, message: string): Validator<string> {
  return (value) => {
    if (value && !regex.test(value)) {
      return message;
    }
    return undefined;
  };
}

// ============================================================================
// Business-Specific Validators
// ============================================================================

/**
 * PIN 번호 검증
 * - 8자 이상
 * - 숫자와 하이픈만 허용
 */
export function pinCode(message?: string): Validator<string> {
  return (value) => {
    if (!value) return undefined;

    // 하이픈 제거 후 검증
    const cleaned = value.replace(/-/g, '');

    if (cleaned.length < 8) {
      return message || 'PIN 번호는 8자 이상이어야 합니다.';
    }

    if (!/^[\d-]+$/.test(value)) {
      return 'PIN 번호는 숫자와 하이픈(-)만 입력 가능합니다.';
    }

    return undefined;
  };
}

/**
 * 계좌번호 검증
 * - 10~14자리 숫자
 */
export function accountNumber(message?: string): Validator<string> {
  return (value) => {
    if (!value) return undefined;

    const cleaned = value.replace(/-/g, '');

    if (!/^\d{10,14}$/.test(cleaned)) {
      return message || '올바른 계좌번호를 입력해주세요. (10~14자리)';
    }

    return undefined;
  };
}

/**
 * 비밀번호 강도 검증
 * - 최소 8자
 * - 영문, 숫자 포함
 */
export function password(customMessage?: string): Validator<string> {
  return (value) => {
    if (!value) return undefined;

    if (value.length < 8) {
      return customMessage || '비밀번호는 8자 이상이어야 합니다.';
    }

    if (!/[a-zA-Z]/.test(value)) {
      return '비밀번호에 영문자를 포함해주세요.';
    }

    if (!/\d/.test(value)) {
      return '비밀번호에 숫자를 포함해주세요.';
    }

    return undefined;
  };
}

/**
 * 비밀번호 확인 검증
 */
export function confirmPassword(
  getPassword: () => string,
  message?: string
): Validator<string> {
  return (value) => {
    if (value && value !== getPassword()) {
      return message || '비밀번호가 일치하지 않습니다.';
    }
    return undefined;
  };
}

/**
 * 한글 이름 검증
 * - 2~10자 한글
 */
export function koreanName(message?: string): Validator<string> {
  return (value) => {
    if (!value) return undefined;

    if (!/^[가-힣]{2,10}$/.test(value)) {
      return message || '올바른 이름을 입력해주세요. (2~10자 한글)';
    }

    return undefined;
  };
}

// ============================================================================
// Composite Validators
// ============================================================================

/**
 * 여러 검증 규칙 조합
 * 첫 번째 실패한 규칙의 에러 메시지 반환
 */
export function compose<T>(...validators: Validator<T>[]): Validator<T> {
  return (value) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return undefined;
  };
}

/**
 * 조건부 검증
 * condition이 true일 때만 검증 실행
 */
export function when<T>(
  condition: (value: T) => boolean,
  validator: Validator<T>
): Validator<T> {
  return (value) => {
    if (condition(value)) {
      return validator(value);
    }
    return undefined;
  };
}

/**
 * 값이 있을 때만 검증 (선택 필드용)
 */
export function optional<T>(validator: Validator<T>): Validator<T | undefined | null> {
  return (value) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return validator(value as T);
  };
}

// ============================================================================
// Form Validation Utilities
// ============================================================================

/**
 * 필드별 검증 실행
 */
export function validateFields<T extends Record<string, unknown>>(
  data: T,
  rules: ValidationRules<T>
): ValidationErrors<T> {
  const errors: ValidationErrors<T> = {};

  for (const [field, validators] of Object.entries(rules) as [keyof T, Validator<unknown>[]][]) {
    if (!validators) continue;

    const value = data[field];
    for (const validator of validators) {
      const error = validator(value);
      if (error) {
        errors[field] = error;
        break; // 첫 번째 에러만 저장
      }
    }
  }

  return errors;
}

/**
 * useForm용 validate 함수 생성
 */
export function createFormValidator<T extends Record<string, unknown>>(
  rules: ValidationRules<T>
): (values: T) => ValidationErrors<T> {
  return (values) => validateFields(values, rules);
}

/**
 * 모든 필드가 유효한지 확인
 */
export function isValid<T>(errors: ValidationErrors<T>): boolean {
  return Object.keys(errors).length === 0;
}

/**
 * 첫 번째 에러 메시지 반환
 */
export function getFirstError<T>(errors: ValidationErrors<T>): string | undefined {
  const firstKey = Object.keys(errors)[0] as keyof T | undefined;
  return firstKey ? errors[firstKey] : undefined;
}

// ============================================================================
// Pre-configured Validators Object
// ============================================================================

/**
 * 자주 사용되는 검증 규칙 프리셋
 */
export const validators = {
  required,
  minLength,
  maxLength,
  exactLength,
  minValue,
  maxValue,
  email,
  phone,
  numericOnly,
  alphabeticOnly,
  alphanumeric,
  pattern,
  pinCode,
  accountNumber,
  password,
  confirmPassword,
  koreanName,
  compose,
  when,
  optional,
} as const;
