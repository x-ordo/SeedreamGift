/**
 * @file main.tsx
 * @description 클라이언트 엔트리포인트 - React 앱 초기화 및 프로바이더 트리 구성
 * @module client
 *
 * 프로바이더 구조 (바깥 → 안쪽):
 * - React.StrictMode: 개발 모드에서 잠재적 문제 감지 (이중 렌더링)
 * - HelmetProvider: 페이지별 <head> 메타 태그 관리 (SEO)
 * - QueryClientProvider: React Query 전역 캐시 및 설정
 * - BrowserRouter: HTML5 History API 기반 클라이언트 사이드 라우팅
 *
 * 마운트 대상: #root (index.html)
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';

// 탭 전환 시 자동 리패치 비활성화, 5xx/네트워크 에러만 최대 2회 재시도 (지수 백오프)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx client errors (except 408 timeout)
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500 && status !== 408) return false;
        // Retry up to 2 times for 5xx and network errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      gcTime: 10 * 60 * 1000, // 10분 — 사용하지 않는 쿼리 캐시 자동 정리
    },
  },
});

/**
 * React 앱 루트 렌더링
 *
 * - StrictMode: 안전하지 않은 생명주기, 레거시 API 사용 경고
 * - BrowserRouter: 클라이언트 사이드 라우팅 활성화
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>,
);