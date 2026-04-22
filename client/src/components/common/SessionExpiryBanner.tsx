/**
 * @file SessionExpiryBanner.tsx
 * @description 세션 만료 카운트다운 배너 — 만료 60초 전 표시, 0초 시 자동 로그아웃 + 새로고침
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LogOut, RefreshCw } from 'lucide-react';

const COUNTDOWN_SECONDS = 60;

export const SessionExpiryBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  const [extending, setExtending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    clearCountdown();
    setVisible(false);
    try {
      const { useAuthStore } = await import('../../store/useAuthStore');
      await useAuthStore.getState().logout();
    } catch { /* ignore */ }
    window.location.href = '/login';
  }, [clearCountdown]);

  const handleExtend = useCallback(async () => {
    setExtending(true);
    try {
      const { useAuthStore } = await import('../../store/useAuthStore');
      await useAuthStore.getState().refresh();
      clearCountdown();
      setVisible(false);
      setSeconds(COUNTDOWN_SECONDS);
    } catch {
      await handleLogout();
    } finally {
      setExtending(false);
    }
  }, [clearCountdown, handleLogout]);

  useEffect(() => {
    const handleWarning = () => {
      setSeconds(COUNTDOWN_SECONDS);
      setVisible(true);

      clearCountdown();
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const handleSessionRestored = () => {
      clearCountdown();
      setVisible(false);
      setSeconds(COUNTDOWN_SECONDS);
    };

    window.addEventListener('session-expiry-warning', handleWarning);
    window.addEventListener('session-restored', handleSessionRestored);

    return () => {
      window.removeEventListener('session-expiry-warning', handleWarning);
      window.removeEventListener('session-restored', handleSessionRestored);
      clearCountdown();
    };
  }, [clearCountdown]);

  // 0초 도달 시 자동 로그아웃
  useEffect(() => {
    if (visible && seconds === 0) {
      handleLogout();
    }
  }, [visible, seconds, handleLogout]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[15000] flex items-center justify-center px-4 py-3"
      style={{ background: 'rgba(25, 31, 40, 0.95)', backdropFilter: 'blur(8px)' }}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-white max-w-[600px] w-full">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <LogOut size={18} className="shrink-0 text-white/70" aria-hidden="true" />
          <div className="text-sm">
            <span className="font-bold">{seconds}초</span>
            <span className="text-white/70 ml-1.5">후 자동 로그아웃됩니다</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExtend}
            disabled={extending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-[background-color] disabled:opacity-50"
          >
            <RefreshCw size={14} className={extending ? 'animate-spin' : ''} aria-hidden="true" />
            연장하기
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-white/10 text-white/80 text-sm font-medium hover:bg-white/20 transition-[background-color]"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
};
