import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

const NetworkStatus: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      // Attempt a lightweight fetch to verify connectivity
      await fetch('/manifest.json', { cache: 'no-store' });
      setIsOffline(false);
    } catch {
      // Still offline — state remains
    } finally {
      setIsRetrying(false);
    }
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[99999] flex items-center justify-center gap-2 py-2 bg-error text-white text-xs sm:text-sm font-medium"
      role="alert"
      aria-live="assertive"
    >
      <WifiOff size={16} aria-hidden="true" />
      <span>인터넷 연결이 끊어졌어요</span>
      <button
        type="button"
        onClick={handleRetry}
        disabled={isRetrying}
        className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-[background-color] duration-150 disabled:opacity-60"
        aria-label="네트워크 재연결 시도"
      >
        <RefreshCw
          size={12}
          aria-hidden="true"
          className={isRetrying ? 'animate-spin' : ''}
        />
        {isRetrying ? '확인 중...' : '재시도'}
      </button>
    </div>
  );
};

export default NetworkStatus;
