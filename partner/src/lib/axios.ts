import axios from 'axios';
import { Configuration } from '../api/generated/configuration';

// Base URL configuration (Go API Server)
const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

import { useAuthStore } from '../store/useAuthStore';

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 30000, // 30초 타임아웃
});

export const api = axiosInstance;

// Request Interceptor: Inject Access Token from Memory (Zustand)
axiosInstance.interceptors.request.use(
  (config) => {
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
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
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
    if (response.data && response.data.success === true && response.data.data !== undefined) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
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
        await useAuthStore.getState().refresh();

        const newToken = useAuthStore.getState().token;
        processQueue(null, newToken);

        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        window.dispatchEvent(new CustomEvent('session-expired'));
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 429 Rate Limit: Retry-After 헤더 기반 자동 재시도 (1회)
    if (error.response?.status === 429 && !(originalRequest as any)._rateLimitRetry) {
      (originalRequest as any)._rateLimitRetry = true;
      const retryAfter = Number(error.response.headers['retry-after']) || 5;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return axiosInstance(originalRequest);
    }

    // 5xx 서버 에러: 1회 자동 재시도 (1초 딜레이)
    if (error.response?.status && error.response.status >= 500 && !(originalRequest as any)._serverRetry) {
      (originalRequest as any)._serverRetry = true;
      await new Promise(resolve => setTimeout(resolve, 1000));
      return axiosInstance(originalRequest);
    }

    // Go server error format
    if (typeof error.response?.data?.error === 'string') {
      error.message = error.response.data.error;
    }

    if (error.response?.status && error.response.status >= 400 && error.response.status !== 401) {
      window.dispatchEvent(new CustomEvent('api-error', {
        detail: { message: error.message, status: error.response.status }
      }));
    }

    return Promise.reject(error);
  }
);

// Configuration for Generated API Clients
export const apiConfig = new Configuration({
  basePath: BASE_URL,
  accessToken: () => useAuthStore.getState().token || '',
});

export default axiosInstance;
