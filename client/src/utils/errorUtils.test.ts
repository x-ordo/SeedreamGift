import { describe, it, expect } from 'vitest';
import {
  getErrorMessage,
  getHttpErrorMessage,
  isHttpError,
  isAuthError,
  isForbiddenError,
  isNotFoundError,
} from './errorUtils';

describe('getErrorMessage', () => {
  it('Error 인스턴스에서 메시지 추출', () => {
    expect(getErrorMessage(new Error('테스트 에러'))).toBe('테스트 에러');
  });

  it('Axios 에러에서 서버 메시지 추출', () => {
    const axiosError = {
      isAxiosError: true,
      response: { data: { error: '서버 에러 메시지' } },
      message: 'Request failed',
    };
    expect(getErrorMessage(axiosError)).toBe('서버 에러 메시지');
  });

  it('알 수 없는 에러 시 기본 메시지', () => {
    expect(getErrorMessage(null)).toBe('오류가 발생했습니다.');
    expect(getErrorMessage(undefined)).toBe('오류가 발생했습니다.');
  });

  it('커스텀 기본 메시지', () => {
    expect(getErrorMessage(null, '커스텀 메시지')).toBe('커스텀 메시지');
  });
});

describe('getHttpErrorMessage', () => {
  it('400 Bad Request', () => {
    expect(getHttpErrorMessage(400)).toMatch(/잘못된/);
  });

  it('401 Unauthorized', () => {
    expect(getHttpErrorMessage(401)).toMatch(/로그인/);
  });

  it('403 Forbidden', () => {
    expect(getHttpErrorMessage(403)).toMatch(/권한/);
  });

  it('404 Not Found', () => {
    expect(getHttpErrorMessage(404)).toMatch(/찾을 수 없/);
  });

  it('500 Server Error', () => {
    expect(getHttpErrorMessage(500)).toMatch(/서버/);
  });

  it('알 수 없는 코드', () => {
    expect(getHttpErrorMessage(999)).toBe('오류가 발생했습니다.');
  });
});

describe('isHttpError', () => {
  it('Axios 에러에서 상태 코드 매칭', () => {
    const err = { isAxiosError: true, response: { status: 404 } };
    expect(isHttpError(err, 404)).toBe(true);
    expect(isHttpError(err, 500)).toBe(false);
  });

  it('비-Axios 에러', () => {
    expect(isHttpError(new Error(), 404)).toBe(false);
  });
});

describe('isAuthError', () => {
  it('401 에러 감지', () => {
    expect(isAuthError({ isAxiosError: true, response: { status: 401 } })).toBe(true);
    expect(isAuthError({ isAxiosError: true, response: { status: 403 } })).toBe(false);
  });
});

describe('isForbiddenError', () => {
  it('403 에러 감지', () => {
    expect(isForbiddenError({ isAxiosError: true, response: { status: 403 } })).toBe(true);
  });
});

describe('isNotFoundError', () => {
  it('404 에러 감지', () => {
    expect(isNotFoundError({ isAxiosError: true, response: { status: 404 } })).toBe(true);
  });
});
