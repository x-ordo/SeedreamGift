/**
 * @file AdminRoute.tsx
 * @description 관리자 전용 라우트 래퍼 - ADMIN 역할만 접근 허용
 * @module components/auth
 *
 * 사용처:
 * - App.tsx 라우팅: /admin/* 경로의 모든 관리자 페이지를 감쌈
 *
 * 동작:
 * - isLoading 중: 스피너 표시 (초기 인증 상태 확인 대기)
 * - 미인증: /admin/login으로 리다이렉트하며, 원래 경로를 state.from에 저장
 * - 인증되었으나 ADMIN 아님: 홈(/)으로 리다이렉트 (관리자 영역 숨김)
 * - ADMIN 인증됨: children 렌더링
 *
 * @example
 * <Route path="/admin/*" element={<AdminRoute><AdminPage /></AdminRoute>} />
 */
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authManualApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';

interface AdminRouteProps {
    /** 관리자 전용 하위 컴포넌트 */
    children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
    const { user, isAuthenticated, isLoading, logout } = useAuth();
    const location = useLocation();

    // 마운트 시 서버에서 역할 재확인 (클라이언트 조작 방어)
    useEffect(() => {
        if (user?.role === 'ADMIN') {
            authManualApi.getMe().then(res => {
                if (res.data?.role !== 'ADMIN') {
                    logout();
                }
            }).catch(() => {
                // 토큰 만료 등 — 별도 처리 불필요 (JwtAuthGuard가 처리)
            });
        }
    }, [user?.role, logout]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="loading loading-spinner loading-lg text-primary" role="status" aria-label="인증 확인 중" />
                    <p style={{ marginTop: 12, fontSize: 14, color: 'var(--color-grey-500)' }}>인증 확인 중...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (user?.role !== 'ADMIN') {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default AdminRoute;
