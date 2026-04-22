import axios from 'axios';
import { Configuration } from '../api/generated/configuration';

// Base URL configuration (Go API Server)
// API prefix: /api/v1/*
const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

import { useAuthStore } from '../store/useAuthStore';

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 쿠키 전송 활성화
  timeout: 30000, // 30초 타임아웃
});

export const api = axiosInstance;

// Request Interceptor: Inject Access Token from Memory (Zustand)
axiosInstance.interceptors.request.use(
  (config) => {
    // Zustand 스토어에서 최신 토큰 가져오기
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
interface QueueEntry {
  resolve: (token: string | null) => void;
  reject: (reason: unknown) => void;
}
let failedQueue: QueueEntry[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Global Error Handling & Data Unwrapping
axiosInstance.interceptors.response.use(
  async (response) => {
    // 백엔드 표준 응답 처리
    if (response.data && response.data.success === true && response.data.data !== undefined) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 인증/갱신 엔드포인트에서 발생한 401은 무한 루프 방지를 위해 즉시 거절
    if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
      return Promise.reject(error);
    }

    // 401 에러이고, 재시도하지 않은 요청인 경우
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 이미 갱신 중이라면 큐에 추가
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Zustand 스토어의 refresh() 실행 (이미 내부적으로 concurrency lock 처리됨)
        await useAuthStore.getState().refresh();
        
        const newToken = useAuthStore.getState().token;
        processQueue(null, newToken);
        
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        // 세션 만료 → 로그아웃 후 로그인 페이지로 이동
        localStorage.removeItem('wgift_client_logged_in');
        useAuthStore.setState({ token: null, user: null, isAuthenticated: false });
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // 429 Rate Limit: Retry-After 헤더 기반 자동 재시도 (1회)
    if (error.response?.status === 429 && !originalRequest._rateLimitRetry) {
      originalRequest._rateLimitRetry = true;
      const retryAfter = Number(error.response.headers['retry-after']) || 5;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return axiosInstance(originalRequest);
    }

    // 5xx 서버 에러: 1회 자동 재시도 (1초 딜레이)
    if (error.response?.status >= 500 && !originalRequest._serverRetry) {
      originalRequest._serverRetry = true;
      await new Promise(resolve => setTimeout(resolve, 1000));
      return axiosInstance(originalRequest);
    }

    // Go 서버 에러 포맷: { success: false, error: "메시지 문자열" }
    if (typeof error.response?.data?.error === 'string') {
      error.message = error.response.data.error;
    }

    // 글로벌 에러 토스트 (4xx/5xx에서 컴포넌트가 놓칠 경우 대비)
    // 401은 토큰 갱신 로직에서 처리하므로 제외
    if (error.response?.status && error.response.status >= 400 && error.response.status !== 401) {
      window.dispatchEvent(new CustomEvent('api-error', {
        detail: {
          status: error.response?.status || 0,
          message: error.response?.data?.error || error.message,
        }
      }));
    }

    return Promise.reject(error);
  }
);

// Configuration Asset for Generated API Clients
export const apiConfig = new Configuration({
  basePath: BASE_URL,
  accessToken: () => useAuthStore.getState().token || '',
});

export default axiosInstance;