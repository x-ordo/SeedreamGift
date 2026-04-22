/**
 * @file ToastContext.tsx
 * @description 토스트 알림 Context - 전역 알림 메시지 관리 (큐 시스템)
 * @module contexts
 *
 * 주요 기능:
 * - 성공/에러/정보 타입별 토스트 표시
 * - 최대 3개 동시 표시 (스택 방식)
 * - 개별 dismiss 가능
 * - 자동 숨김 (기본 3초)
 * - 프로그레스 바 옵션
 * - 페이드 인/아웃 애니메이션
 * - 햅틱 피드백 (진동 + 사운드)
 *
 * 사용법:
 * const { showToast, dismissToast, clearAllToasts } = useToast();
 * showToast({ message: '저장 완료!', type: 'success' });
 * showToast({ message: '처리중...', type: 'info', showProgress: true, duration: 5000 });
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { CircleCheck, CircleAlert, TriangleAlert, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { VIBRATION_PATTERNS, vibrate, playSound } from '../utils/hapticUtils';
import './ToastContext.css';

/** 토스트 타입 */
type ToastType = 'success' | 'error' | 'info' | 'warning';

/** 토스트 ID */
type ToastId = string;

/** 토스트 옵션 */
interface ToastOptions {
  message: string;       // 표시할 메시지
  type?: ToastType;      // 타입 (기본: info)
  duration?: number;     // 표시 시간 ms (기본: 3000)
  haptic?: boolean;      // 햅틱 피드백 활성화 (기본: true)
  showProgress?: boolean; // 프로그레스 바 표시
  dismissible?: boolean; // 수동 닫기 가능 (기본: true)
  errorId?: string;      // 서버 에러 ID (클릭 시 클립보드 복사)
  action?: {             // 액션 버튼 (선택)
    label: string;
    onClick: () => void;
  };
}

/** 내부 토스트 상태 */
interface ToastState extends ToastOptions {
  id: ToastId;
  isExiting: boolean;
  createdAt: number;
}

interface ToastContextType {
  /** 토스트 표시 */
  showToast: (options: ToastOptions) => ToastId;
  /** 특정 토스트 닫기 */
  dismissToast: (id: ToastId) => void;
  /** 모든 토스트 닫기 */
  clearAllToasts: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastContextType | undefined>(undefined);

/** 최대 동시 표시 개수 */
const MAX_TOASTS = 3;

/** 고유 ID 생성 */
let toastIdCounter = 0;
const generateToastId = (): ToastId => `toast-${++toastIdCounter}-${Date.now()}`;

/**
 * 토스트 Provider
 * - 앱 최상위에서 감싸서 사용
 * - 토스트 UI를 children 아래에 렌더링
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const timersRef = useRef<Map<ToastId, NodeJS.Timeout>>(new Map());

  /**
   * 토스트 제거 (애니메이션 후)
   */
  const removeToast = useCallback((id: ToastId) => {
    // Clear timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    // Start exit animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
    );

    // Remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  /**
   * 토스트 표시
   */
  const showToast = useCallback(
    ({
      message,
      type = 'info',
      duration = 3000,
      haptic = true,
      showProgress = false,
      dismissible = true,
      errorId,
      action,
    }: ToastOptions): ToastId => {
      const id = generateToastId();

      setToasts((prev) => {
        // 최대 개수 초과 시 가장 오래된 것 제거
        let newToasts = [...prev];
        while (newToasts.length >= MAX_TOASTS) {
          const oldestId = newToasts[0].id;
          removeToast(oldestId);
          newToasts = newToasts.slice(1);
        }

        return [
          ...newToasts,
          {
            id,
            message,
            type,
            duration,
            haptic,
            showProgress,
            dismissible,
            errorId,
            action,
            isExiting: false,
            createdAt: Date.now(),
          },
        ];
      });

      // 햅틱 피드백
      if (haptic) {
        if (type === 'error') {
          vibrate(VIBRATION_PATTERNS.error);
          playSound('error', 0.3);
        } else if (type === 'success') {
          vibrate(VIBRATION_PATTERNS.success);
          playSound('success', 0.3);
        } else if (type === 'warning') {
          vibrate(VIBRATION_PATTERNS.warning);
          playSound('warning', 0.2);
        } else {
          vibrate(VIBRATION_PATTERNS.tap);
        }
      }

      // 자동 숨김 타이머
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);

      timersRef.current.set(id, timer);

      return id;
    },
    [removeToast]
  );

  /**
   * 특정 토스트 닫기
   */
  const dismissToast = useCallback(
    (id: ToastId) => {
      removeToast(id);
    },
    [removeToast]
  );

  /**
   * 모든 토스트 닫기
   * - setToasts를 통해 현재 toast 목록에 접근 → toasts dependency 불필요
   */
  const clearAllToasts = useCallback(() => {
    setToasts((prev) => {
      prev.forEach((t) => {
        const timer = timersRef.current.get(t.id);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(t.id);
        }
      });
      return [];
    });
  }, []);

  // 세션 만료 이벤트 (axios interceptor에서 발생) → 배너가 처리하므로 토스트 미표시
  // SessionExpiryBanner 컴포넌트가 session-expiry-warning 이벤트를 카운트다운으로 처리

  // 장바구니 만료 이벤트 리스너 (7일 이상 미사용 시)
  useEffect(() => {
    const handleCartExpired = () => {
      showToast({
        message: '오래된 장바구니가 비워졌어요',
        type: 'info',
        duration: 5000,
      });
    };

    window.addEventListener('cart-expired', handleCartExpired);
    return () => window.removeEventListener('cart-expired', handleCartExpired);
  }, [showToast]);

  // 글로벌 API 에러 토스트 (컴포넌트에서 처리하지 못한 에러의 안전장치)
  useEffect(() => {
    const handleApiError = (e: Event) => {
      const { message } = (e as CustomEvent).detail;
      showToast({ message: message || '요청 처리 중 오류가 발생했습니다', type: 'error' });
    };
    window.addEventListener('api-error', handleApiError);
    return () => window.removeEventListener('api-error', handleApiError);
  }, [showToast]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const contextValue = useMemo(() => ({
    showToast,
    dismissToast,
    clearAllToasts,
  }), [showToast, dismissToast, clearAllToasts]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="toast-stack" role="region" aria-label="알림 메시지">
        {toasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            index={index}
            total={toasts.length}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/**
 * 개별 토스트 아이템
 */
interface ToastItemProps {
  toast: ToastState;
  index: number;
  total: number;
  onDismiss: () => void;
}

const TOAST_ICON_MAP: Record<ToastType, LucideIcon> = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};

const ToastItem: React.FC<ToastItemProps> = ({ toast, index, total, onDismiss }) => {
  const progressRef = useRef<HTMLDivElement>(null);

  // 프로그레스 바 애니메이션
  useEffect(() => {
    if (toast.showProgress && progressRef.current) {
      progressRef.current.style.animationDuration = `${toast.duration}ms`;
    }
  }, [toast.showProgress, toast.duration]);

  return (
    <div
      className={`toast-container show ${toast.isExiting ? 'exiting' : ''} ${toast.type}`}
      style={{
        '--toast-index': index,
        '--toast-total': total,
      } as React.CSSProperties}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="toast-content">
        {React.createElement(TOAST_ICON_MAP[toast.type || 'info'], { size: 20, 'aria-hidden': true })}
        <span className="toast-message">
          {toast.message}
          {toast.errorId && (
            <button
              type="button"
              className="toast-error-id"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(toast.errorId!);
              }}
              title="클릭하여 복사"
              style={{
                display: 'inline-block', marginLeft: '6px', padding: '1px 6px',
                fontSize: '10px', fontFamily: 'var(--font-family-mono, monospace)',
                background: 'rgba(0,0,0,0.15)', borderRadius: '4px', border: 'none',
                color: 'inherit', opacity: 0.7, cursor: 'pointer', verticalAlign: 'middle',
              }}
            >
              {toast.errorId}
            </button>
          )}
        </span>
        {toast.action && (
          <button
            type="button"
            className="toast-action"
            onClick={(e) => {
              e.stopPropagation();
              toast.action!.onClick();
              onDismiss();
            }}
          >
            {toast.action.label}
          </button>
        )}
        {toast.dismissible && (
          <button
            type="button"
            className="toast-close"
            onClick={onDismiss}
            aria-label="닫기"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {toast.showProgress && (
        <div className="toast-progress">
          <div ref={progressRef} className="toast-progress-bar" />
        </div>
      )}
    </div>
  );
};

/**
 * 토스트 알림 접근 훅
 *
 * @returns ToastContextType - showToast, dismissToast, clearAllToasts 함수
 * @throws Error - ToastProvider 외부에서 호출 시
 *
 * @example
 * const { showToast, dismissToast } = useToast();
 *
 * // 성공 토스트
 * showToast({ message: '저장되었습니다!', type: 'success' });
 *
 * // 에러 토스트 (즉시 알림)
 * showToast({ message: '오류가 발생했습니다.', type: 'error' });
 *
 * // 프로그레스 바 포함
 * const toastId = showToast({
 *   message: '업로드 중...',
 *   type: 'info',
 *   showProgress: true,
 *   duration: 5000,
 * });
 *
 * // 특정 토스트 닫기
 * dismissToast(toastId);
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
