/**
 * @file ProtectedRoute.tsx
 * @description 인증 보호 라우트 래퍼 - 로그인 여부를 확인하고 미인증 시 로그인 페이지로 리다이렉트
 * @module components/auth
 *
 * 사용처:
 * - App.tsx 라우팅: 마이페이지, 장바구니, 주문 등 인증이 필요한 모든 페이지를 감쌈
 *
 * 동작:
 * - isLoading 중: 스피너 표시 (초기 인증 상태 확인 대기)
 * - 미인증: /login으로 리다이렉트하며, 원래 경로를 state.from에 저장
 * - 인증됨: children 렌더링
 *
 * @example
 * <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  /** 보호할 하위 컴포넌트 */
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="page-container">
      <div className="flex justify-center items-center py-20">
        <span className="loading loading-spinner loading-lg text-primary" role="status" aria-label="로딩 중" />
      </div>
    </div>;
  }

  if (!isAuthenticated) {
    // 로그인 페이지로 리다이렉트하되, 원래 가려던 경로를 state로 전달
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
