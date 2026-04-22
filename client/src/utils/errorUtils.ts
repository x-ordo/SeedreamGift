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
 * Go 서버 에러 응답 타입
 * 형식: { success: false, error: "메시지", errorId?: "ERR-xxx" }
 */
export interface ApiErrorResponse {
  success?: boolean;
  error?: string;
  errorId?: string;
  validationErrors?: Record<string, string>;
}

/**
 * 영문 기술 에러 메시지 → 한국어 변환 맵
 * Axios/네트워크 레이어에서 발생하는 영문 메시지를 잡아 번역합니다.
 */
const ENGLISH_ERROR_MAP: Record<string, string> = {
  'Network Error': '네트워크 연결을 확인해주세요.',
  'timeout of': '서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
  'Request failed': '요청 처리에 실패했습니다. 잠시 후 다시 시도해주세요.',
  'ECONNABORTED': '서버 응답 시간이 초과되었습니다.',
  'ERR_NETWORK': '인터넷 연결이 불안정합니다. 연결 상태를 확인해주세요.',
  'ERR_BAD_REQUEST': '잘못된 요청입니다. 입력 내용을 확인해주세요.',
  'ERR_BAD_RESPONSE': '서버 응답 오류입니다. 잠시 후 다시 시도해주세요.',
  'Internal Server Error': '서버 내부 오류입니다. 잠시 후 다시 시도해주세요.',
  'Unauthorized': '로그인이 필요합니다.',
  'Forbidden': '접근 권한이 없습니다.',
  'Not Found': '요청하신 정보를 찾을 수 없습니다.',
};

/**
 * 영문 메시지를 한국어로 번역합니다.
 * 패턴 매칭 후 순수 ASCII 문자열이면 일반 오류 메시지를 반환합니다.
 */
function translateIfEnglish(msg: string): string {
  for (const [pattern, korean] of Object.entries(ENGLISH_ERROR_MAP)) {
    if (msg.includes(pattern)) return korean;
  }
  // 순수 ASCII 영문 메시지인 경우 한국어 기본 메시지로 대체
  if (/^[a-zA-Z0-9\s:.\-/]+$/.test(msg.trim())) {
    return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }
  return msg;
}

/**
 * 에러 객체에서 사용자 친화적인 메시지 추출
 *
 * 처리 우선순위:
 * 1. Axios 에러 → response.data.error (Go 서버 포맷)
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

    // Go 서버 에러 응답: { success: false, error: "메시지", errorId?: "ERR-xxx" }
    if (data?.error && typeof data.error === 'string') {
      const translated = translateIfEnglish(data.error);
      if (data.errorId) {
        return `${translated} (${data.errorId})`;
      }
      return translated;
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
    return translateIfEnglish(error.message || defaultMessage);
  }

  // 문자열
  if (typeof error === 'string') {
    return translateIfEnglish(error);
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
    400: '입력 내용을 다시 확인해주세요.',
    401: '로그인이 필요합니다. 다시 로그인해주세요.',
    403: '접근 권한이 없습니다.',
    404: '요청하신 정보를 찾을 수 없습니다.',
    408: '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.',
    409: '이미 처리된 요청입니다.',
    422: '입력 정보를 확인해주세요.',
    429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    500: '서버에 일시적 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
    502: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
    503: '서비스 점검 중입니다. 잠시 후 다시 시도해주세요.',
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
 * 에러에서 ErrorID를 추출합니다.
 */
export function getErrorId(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as ApiErrorResponse)?.errorId;
  }
  return undefined;
}

/**
 * 에러에서 필드별 검증 에러를 추출합니다.
 * Go 서버 응답: { validationErrors: { "fieldName": "에러 메시지" } }
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
 * 네트워크 에러나 로깅 자체의 실패는 무시합니다.
 */
export function reportError(error: unknown, app: string = 'client') {
  try {
    const errorId = getErrorId(error);
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    // 네트워크 에러는 보고하지 않음 (서버 연결 불가 상태)
    if (isNetworkError(error)) return;

    const payload = {
      level: isServerError(error) ? 'error' : 'warn',
      message,
      url: window.location.pathname,
      errorId: errorId || '',
      stack: stack || '',
      userAgent: navigator.userAgent,
      app,
    };

    // fire-and-forget (비동기, 실패 무시)
    fetch('/api/v1/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // 에러 리포팅 자체 실패는 무시
  }
}

