/**
 * @file errorUtils.ts
 * @description 에러 처리 유틸리티 - API 에러 메시지 추출 및 포맷팅
 * @module utils
 *
 * 사용 예시:
 * ```tsx
 * try {
 *   await api.call();
 * } catch (error) {
 *   showToast({
 *     message: getErrorMessage(error, '요청에 실패했습니다.'),
 *     type: 'error'
 *   });
 * }
 * ```
 */
import axios, { AxiosError } from 'axios';

/**
 * API 에러 응답 타입
 */
export interface ApiErrorResponse {
  message?: string | string[];
  error?: string;
  errorId?: string;
  statusCode?: number;
  validationErrors?: Record<string, string>;
}

/**
 * 에러 객체에서 사용자 친화적인 메시지 추출
 *
 * 처리 우선순위:
 * 1. Axios 에러 → response.data.message
 * 2. Error 객체 → error.message
 * 3. 문자열 → 그대로 반환
 * 4. 기타 → 기본 메시지
 *
 * @param error - 에러 객체 (unknown 타입)
 * @param defaultMessage - 추출 실패 시 기본 메시지
 * @returns 사용자 친화적인 에러 메시지
 */
export function getErrorMessage(error: unknown, defaultMessage = '오류가 발생했습니다.'): string {
  // Axios 에러 처리
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const data = axiosError.response?.data;

    // Go 서버 에러 응답: { error: "메시지", errorId: "ERR-xxx" }
    if (data?.error && typeof data.error === 'string') {
      if (data.errorId) {
        return `${data.error} (${data.errorId})`;
      }
      return data.error;
    }

    // NestJS ValidationPipe 호환: { message: string | string[] }
    if (data?.message) {
      if (Array.isArray(data.message)) {
        return data.message[0] || defaultMessage;
      }
      return data.message;
    }

    // HTTP 상태 코드별 기본 메시지
    const status = axiosError.response?.status;
    if (status) {
      return getHttpErrorMessage(status, defaultMessage);
    }

    // 네트워크 에러
    if (axiosError.code === 'ERR_NETWORK') {
      return '네트워크 연결을 확인해주세요.';
    }

    // 타임아웃
    if (axiosError.code === 'ECONNABORTED') {
      return '요청 시간이 초과되었습니다.';
    }

    return defaultMessage;
  }

  // 일반 Error 객체
  if (error instanceof Error) {
    return error.message || defaultMessage;
  }

  // 문자열
  if (typeof error === 'string') {
    return error;
  }

  return defaultMessage;
}

/**
 * HTTP 상태 코드별 기본 에러 메시지
 *
 * @param status - HTTP 상태 코드
 * @param defaultMessage - 기본 메시지
 * @returns 에러 메시지
 */
export function getHttpErrorMessage(status: number, defaultMessage = '오류가 발생했습니다.'): string {
  const messages: Record<number, string> = {
    400: '잘못된 요청입니다.',
    401: '로그인이 필요합니다.',
    403: '권한이 없습니다.',
    404: '요청한 정보를 찾을 수 없습니다.',
    409: '이미 존재하는 정보입니다.',
    422: '입력 정보를 확인해주세요.',
    429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    500: '서버 오류가 발생했습니다.',
    502: '서버에 연결할 수 없습니다.',
    503: '서비스를 일시적으로 사용할 수 없습니다.',
    504: '서버 응답 시간이 초과되었습니다.',
  };

  return messages[status] || defaultMessage;
}

/**
 * 에러가 특정 HTTP 상태 코드인지 확인
 *
 * @param error - 에러 객체
 * @param status - 확인할 상태 코드
 * @returns 해당 상태 코드 여부
 */
export function isHttpError(error: unknown, status: number): boolean {
  if (axios.isAxiosError(error)) {
    return error.response?.status === status;
  }
  return false;
}

/**
 * 인증 에러인지 확인 (401)
 */
export function isAuthError(error: unknown): boolean {
  return isHttpError(error, 401);
}

/**
 * 권한 에러인지 확인 (403)
 */
export function isForbiddenError(error: unknown): boolean {
  return isHttpError(error, 403);
}

/**
 * 리소스 없음 에러인지 확인 (404)
 */
export function isNotFoundError(error: unknown): boolean {
  return isHttpError(error, 404);
}

/**
 * 서버 에러인지 확인 (5xx)
 */
export function isServerError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return status !== undefined && status >= 500 && status < 600;
  }
  return false;
}

/**
 * 네트워크 에러인지 확인
 */
export function isNetworkError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.code === 'ERR_NETWORK' || !error.response;
  }
  return false;
}

/**
 * 유효성 검사 에러 메시지 추출 (NestJS ValidationPipe)
 *
 * @param error - 에러 객체
 * @returns 필드별 에러 메시지 맵
 */
export function getValidationErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error)) {
    return {};
  }

  const data = error.response?.data as ApiErrorResponse;
  if (!data?.message || !Array.isArray(data.message)) {
    return {};
  }

  // NestJS ValidationPipe 에러 메시지 파싱
  // 형식: "필드명 should be ..."
  const errors: Record<string, string> = {};

  for (const msg of data.message) {
    const match = msg.match(/^(\w+)\s+(.+)$/);
    if (match) {
      const [, field, message] = match;
      errors[field] = message;
    } else {
      // 필드명 없는 에러는 _general로 저장
      errors['_general'] = msg;
    }
  }

  return errors;
}

/**
 * 에러에서 ErrorID를 추출합니다.
 */
export function getErrorId(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as ApiErrorResponse)?.errorId;
  }
  return undefined;
}

/**
 * 에러에서 Go 서버 필드별 검증 에러를 추출합니다.
 */
export function getFieldErrors(error: unknown): Record<string, string> | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse;
    if (data?.validationErrors && typeof data.validationErrors === 'object') {
      return data.validationErrors;
    }
  }
  return undefined;
}

/**
 * 프론트엔드 에러를 서버에 보고합니다.
 */
export function reportError(error: unknown, app: string = 'admin') {
  try {
    const errorId = getErrorId(error);
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    if (isNetworkError(error)) return;

    fetch('/api/v1/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: isServerError(error) ? 'error' : 'warn',
        message, url: window.location.pathname,
        errorId: errorId || '', stack: stack || '',
        userAgent: navigator.userAgent, app,
      }),
    }).catch(() => {});
  } catch { /* ignore */ }
}
