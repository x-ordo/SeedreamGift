import axios from 'axios';

interface ApiErrorResponse {
  error?: string;
  errorId?: string;
  validationErrors?: Record<string, string>;
}

export function getErrorMessage(error: unknown, defaultMessage = '오류가 발생했습니다.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse;
    if (data?.error) return data.errorId ? `${data.error} (${data.errorId})` : data.error;
    const status = error.response?.status;
    if (status === 401) return '로그인이 필요합니다.';
    if (status === 403) return '권한이 없습니다.';
    if (status === 404) return '요청한 정보를 찾을 수 없습니다.';
    if (status && status >= 500) return '서버 오류가 발생했습니다.';
    if (error.code === 'ERR_NETWORK') return '네트워크 연결을 확인해주세요.';
  }
  if (error instanceof Error) return error.message || defaultMessage;
  if (typeof error === 'string') return error;
  return defaultMessage;
}

export function getErrorId(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) return (error.response?.data as ApiErrorResponse)?.errorId;
  return undefined;
}

export function getFieldErrors(error: unknown): Record<string, string> | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse;
    if (data?.validationErrors && typeof data.validationErrors === 'object') return data.validationErrors;
  }
  return undefined;
}

export function reportError(error: unknown, app = 'partner') {
  try {
    if (axios.isAxiosError(error) && (error.code === 'ERR_NETWORK' || !error.response)) return;
    const message = error instanceof Error ? error.message : String(error);
    fetch('/api/v1/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: axios.isAxiosError(error) && (error.response?.status ?? 0) >= 500 ? 'error' : 'warn',
        message, url: window.location.pathname,
        errorId: getErrorId(error) || '', stack: error instanceof Error ? error.stack || '' : '',
        userAgent: navigator.userAgent, app,
      }),
    }).catch(() => {});
  } catch { /* ignore */ }
}
