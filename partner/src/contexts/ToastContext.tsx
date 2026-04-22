/**
 * @file ToastContext.tsx
 * @description Toast notification context (queue system)
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

type ToastType = 'success' | 'error' | 'info' | 'warning';
type ToastId = string;

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  haptic?: boolean;
  showProgress?: boolean;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastState extends ToastOptions {
  id: ToastId;
  isExiting: boolean;
  createdAt: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => ToastId;
  dismissToast: (id: ToastId) => void;
  clearAllToasts: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastContextType | undefined>(undefined);

const MAX_TOASTS = 3;

let toastIdCounter = 0;
const generateToastId = (): ToastId => `toast-${++toastIdCounter}-${Date.now()}`;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const timersRef = useRef<Map<ToastId, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: ToastId) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const showToast = useCallback(
    ({
      message,
      type = 'info',
      duration = 3000,
      haptic = true,
      showProgress = false,
      dismissible = true,
      action,
    }: ToastOptions): ToastId => {
      const id = generateToastId();

      setToasts((prev) => {
        let newToasts = [...prev];
        while (newToasts.length >= MAX_TOASTS) {
          const oldestId = newToasts[0].id;
          removeToast(oldestId);
          newToasts = newToasts.slice(1);
        }
        return [
          ...newToasts,
          { id, message, type, duration, haptic, showProgress, dismissible, action, isExiting: false, createdAt: Date.now() },
        ];
      });

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

      const timer = setTimeout(() => { removeToast(id); }, duration);
      timersRef.current.set(id, timer);

      return id;
    },
    [removeToast]
  );

  const dismissToast = useCallback((id: ToastId) => { removeToast(id); }, [removeToast]);

  const clearAllToasts = useCallback(() => {
    setToasts((prev) => {
      prev.forEach((t) => {
        const timer = timersRef.current.get(t.id);
        if (timer) { clearTimeout(timer); timersRef.current.delete(t.id); }
      });
      return [];
    });
  }, []);

  // Session expired event listener
  useEffect(() => {
    const handleSessionExpired = () => {
      showToast({ message: '세션이 만료되었습니다. 다시 로그인해주세요', type: 'warning' });
    };
    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, [showToast]);

  // Session expiry warning
  useEffect(() => {
    const handleSessionWarning = () => {
      showToast({
        message: '세션이 곧 만료됩니다',
        type: 'warning',
        duration: 10000,
        action: {
          label: '연장하기',
          onClick: () => {
            import('../store/useAuthStore').then(({ useAuthStore }) => {
              useAuthStore.getState().refresh().catch(() => {});
            });
          },
        },
      });
    };
    window.addEventListener('session-expiry-warning', handleSessionWarning);
    return () => window.removeEventListener('session-expiry-warning', handleSessionWarning);
  }, [showToast]);

  // Global API error toast
  useEffect(() => {
    const handleApiError = (e: Event) => {
      const { message } = (e as CustomEvent).detail;
      showToast({ message: message || '요청 처리 중 오류가 발생했습니다', type: 'error' });
    };
    window.addEventListener('api-error', handleApiError);
    return () => window.removeEventListener('api-error', handleApiError);
  }, [showToast]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const TOAST_ICON_MAP: Record<ToastType, LucideIcon> = {
    success: CircleCheck,
    error: CircleAlert,
    warning: TriangleAlert,
    info: Info,
  };

  const contextValue = useMemo(() => ({
    showToast,
    dismissToast,
    clearAllToasts,
  }), [showToast, dismissToast, clearAllToasts]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="toast-stack" role="region" aria-label="알림 메시지">
        {toasts.map((toast, index) => {
          const IconComponent = TOAST_ICON_MAP[toast.type || 'info'];
          return (
            <div
              key={toast.id}
              className={`toast-container show ${toast.isExiting ? 'exiting' : ''} ${toast.type}`}
              style={{ '--toast-index': index, '--toast-total': toasts.length } as React.CSSProperties}
              role="alert"
              aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            >
              <div className="toast-content">
                <IconComponent size={20} aria-hidden />
                <span className="toast-message">{toast.message}</span>
                {toast.action && (
                  <button
                    type="button"
                    className="toast-action"
                    onClick={(e) => { e.stopPropagation(); toast.action!.onClick(); dismissToast(toast.id); }}
                  >
                    {toast.action.label}
                  </button>
                )}
                {toast.dismissible && (
                  <button type="button" className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="닫기">
                    <X size={16} aria-hidden />
                  </button>
                )}
              </div>
              {toast.showProgress && (
                <div className="toast-progress">
                  <div className="toast-progress-bar" style={{ animationDuration: `${toast.duration}ms` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
