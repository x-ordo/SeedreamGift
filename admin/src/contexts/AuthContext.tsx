/**
 * @file AuthContext.tsx
 * @description 인증 상태 관리 Context - 로그인/로그아웃 및 사용자 세션 관리
 * @module contexts
 *
 * 주요 기능:
 * - Zustand Store(useAuthStore)를 기반으로 한 인증 상태 관리
 * - 기존 컴포넌트 호환성을 위한 Context API 브릿지 제공
 * - 앱 전역에서 useAuth() 훅으로 인증 상태 접근
 */
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import type { AuthUser } from '../api/manual';

/** 로그인 데이터 타입 */
interface LoginData {
  email: string;
  password: string;
}

/** 회원가입 데이터 타입 */
interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  zipCode: string;
  address: string;
  addressDetail: string;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;

  accountHolder?: string;
  verificationId?: string;
}

/**
 * 인증 Context 타입 정의
 */
interface AuthContextType {
  user: AuthUser | null;      // 현재 로그인된 사용자 정보 (null이면 비로그인)
  isAuthenticated: boolean;   // 로그인 여부
  isLoading: boolean;         // 초기 인증 상태 로딩 중 여부
  login: (data: LoginData) => Promise<void>;     // 로그인 함수
  register: (data: RegisterData) => Promise<void>; // 회원가입 함수
  logout: () => void;         // 로그아웃 함수
  checkAuth: () => Promise<void>; // 세션 확인/갱신 함수
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 인증 상태 관리 Provider (Zustand Store Wrapper)
 *
 * 사용법: 앱 최상위에서 감싸서 사용
 * Zustand 스토어의 상태를 Context를 통해 하위 컴포넌트에 전달합니다.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading, login, register, logout, checkAuth } = useAuthStore();

  // 앱 시작 시 세션 복구 (Silent Refresh)
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const contextValue = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    checkAuth,
  }), [user, isAuthenticated, isLoading, login, register, logout, checkAuth]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * 인증 상태 접근 훅
 * 
 * @returns AuthContextType - 인증 상태 및 함수
 * @throws Error - AuthProvider 외부에서 호출 시
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};