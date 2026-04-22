/**
 * @file useCopyToClipboard.ts
 * @description 클립보드 복사 훅 - 복사 + 토스트 알림 통합
 * @module hooks
 *
 * 사용 예시:
 * ```tsx
 * const { copy, copied } = useCopyToClipboard();
 *
 * <Button onClick={() => copy(pinCode, 'PIN 번호가 복사되었어요.')}>
 *   {copied ? '복사됨!' : '복사하기'}
 * </Button>
 * ```
 */
import { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

/** 토스트 함수 타입 — Provider 없이 사용 시 외부에서 주입 */
export type ToastFn = (opts: { message: string; type: 'success' | 'error' }) => void;

export interface UseCopyToClipboardOptions {
  /** 복사 성공 시 기본 메시지 */
  defaultSuccessMessage?: string;
  /** 복사 실패 시 기본 메시지 */
  defaultErrorMessage?: string;
  /** 복사 상태 초기화 시간 (ms, 기본: 2000) */
  resetDelay?: number;
  /** 토스트 사용 여부 (기본: true) */
  showToast?: boolean;
  /** 외부 토스트 함수 — ToastProvider 없이 사용 시 전달 */
  toastFn?: ToastFn;
}

export interface UseCopyToClipboardReturn {
  /** 클립보드에 복사 */
  copy: (text: string, successMessage?: string) => Promise<boolean>;
  /** 복사 완료 상태 (resetDelay 후 false로 돌아감) */
  copied: boolean;
  /** 복사된 텍스트 */
  copiedText: string | null;
  /** 에러 객체 */
  error: Error | null;
  /** 상태 초기화 */
  reset: () => void;
}

/**
 * 클립보드 복사 훅
 *
 * @param options - 옵션
 * @returns 복사 함수 및 상태
 */
export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardReturn {
  const {
    defaultSuccessMessage = '복사되었습니다.',
    defaultErrorMessage = '복사에 실패했습니다.',
    resetDelay = 2000,
    showToast: enableToast = true,
    toastFn,
  } = options;

  const toastContext = useContext(ToastContext);
  // toastFn이 주입되면 Context 대신 사용, Provider 없으면 undefined
  const showToast = toastFn ?? toastContext?.showToast;

  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 타임아웃 클리어
  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // 상태 초기화
  const reset = useCallback(() => {
    clearTimeoutRef();
    setCopied(false);
    setCopiedText(null);
    setError(null);
  }, [clearTimeoutRef]);

  // 복사 함수
  const copy = useCallback(
    async (text: string, successMessage?: string): Promise<boolean> => {
      clearTimeoutRef();

      try {
        // Clipboard API 지원 확인
        if (!navigator.clipboard) {
          throw new Error('클립보드 API가 지원되지 않습니다.');
        }

        await navigator.clipboard.writeText(text);

        setCopied(true);
        setCopiedText(text);
        setError(null);

        // 토스트 표시
        if (enableToast && showToast) {
          showToast({
            message: successMessage || defaultSuccessMessage,
            type: 'success',
          });
        }

        // 일정 시간 후 상태 초기화
        timeoutRef.current = setTimeout(() => {
          setCopied(false);
        }, resetDelay);

        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setCopied(false);
        setCopiedText(null);

        // 에러 토스트 표시
        if (enableToast && showToast) {
          showToast({
            message: defaultErrorMessage,
            type: 'error',
          });
        }

        return false;
      }
    },
    [
      clearTimeoutRef,
      defaultSuccessMessage,
      defaultErrorMessage,
      resetDelay,
      enableToast,
      showToast,
    ]
  );

  // 컴포넌트 언마운트 시 타임아웃 클리어
  useEffect(() => {
    return () => {
      clearTimeoutRef();
    };
  }, [clearTimeoutRef]);

  return {
    copy,
    copied,
    copiedText,
    error,
    reset,
  };
}

/**
 * 여러 항목 복사용 훅 (PIN 목록 등)
 *
 * @param options - 옵션
 * @returns 복사 함수 및 상태 (마지막 복사된 항목 ID 추적)
 */
export function useCopyMultiple(
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardReturn & { lastCopiedId: string | null } {
  const base = useCopyToClipboard(options);
  const [lastCopiedId, setLastCopiedId] = useState<string | null>(null);

  const copyWithId = useCallback(
    async (text: string, successMessage?: string, id?: string): Promise<boolean> => {
      const result = await base.copy(text, successMessage);
      if (result && id) {
        setLastCopiedId(id);
      }
      return result;
    },
    [base]
  );

  return {
    ...base,
    copy: copyWithId,
    lastCopiedId,
  };
}
