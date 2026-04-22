/**
 * @file AuthContext.tsx
 * @description 인증 상태 관리 Context - 로그인/로그아웃 및 사용자 세션 관리
 * @module contexts
 *
 * 이 파일은 앱 전체의 인증 상태를 관리하는 브릿지 역할을 합니다.
 * 실제 비즈니스 로직과 상태 저장은 Zustand(useAuthStore)에서 처리하며,
 * Context API는 기존 React 컴포넌트 트리와의 호환성과 의존성 주입을 위해 사용됩니다.
 */
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import type { AuthUser } from '../api/manual';

/** 
 * @interface LoginData
 * @description 로그인 요청에 필요한 사용자 자격 증명 데이터
 */
interface LoginData {
  email: string;
  password: string;
}

/** 
 * @interface RegisterData
 * @description 회원가입 시 수집하는 사용자 정보 데이터
 */
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
 * @interface AuthContextType
 * @description 인증 컨텍스트를 통해 노출되는 상태와 메서드 정의
 */
interface AuthContextType {
  /** 현재 로그인된 사용자 정보 (null이면 비로그인 상태) */
  user: AuthUser | null;      
  /** 로그인 여부 확인 플래그 */
  isAuthenticated: boolean;   
  /** 초기 인증 상태(세션 확인 등)를 로드 중인지 여부 */
  isLoading: boolean;         
  /** 이메일/비밀번호 기반 로그인 처리 함수 */
  login: (data: LoginData) => Promise<void>;     
  /** 신규 사용자 등록 처리 함수 */
  register: (data: RegisterData) => Promise<void>; 
  /** 로그아웃 처리 및 로컬 세션 초기화 함수 */
  logout: () => void;         
  /** 
   * @function checkAuth
   * @description 현재 유효한 세션(토큰)이 있는지 서버에 확인하고 사용자 정보를 갱신합니다.
   * 주로 새로고침 시 인증 상태 복구를 위해 사용됩니다.
   */
  checkAuth: () => Promise<void>; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * @component AuthProvider
 * @description 인증 상태 관리 Provider (Zustand Store Wrapper)
 * 
 * @why
 * 1. Zustand 스토어의 상태를 Context를 통해 하위 컴포넌트에 전달하여 'Prop Drilling'을 방지합니다.
 * 2. 앱 최상위 레이어에서 공통 인증 로직(세션 확인)을 중앙 집중화합니다.
 * 
 * @lifecycle
 * - mount: 컴포넌트가 처음 렌더링될 때 `checkAuth()`를 호출하여 쿠키나 스토리지에 저장된 세션을 복구합니다.
 * - update: Zustand 스토어의 `user`나 `isAuthenticated` 상태가 변경되면 하위 구독자들에게 전파합니다.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading, login, register, logout, checkAuth } = useAuthStore();

  // 앱 시작 시 세션 복구 (Silent Refresh 패턴의 일환)
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
 * @function useAuth
 * @description 인증 상태 및 관련 액션에 접근하기 위한 커스텀 훅
 * 
 * @returns {AuthContextType} 인증 컨텍스트 데이터
 * @throws {Error} AuthProvider 범위 밖에서 호출되었을 경우 에러를 발생시켜 오용을 방지합니다.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};