/**
 * @file PartnerRoute.tsx
 * @description Partner-only route guard — only PARTNER role can access
 */
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authManualApi } from '../../api/manual';
import { useAuth } from '../../contexts/AuthContext';

interface PartnerRouteProps {
  children: React.ReactNode;
}

const PartnerRoute: React.FC<PartnerRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const location = useLocation();

  // Server-side role re-verification on mount
  useEffect(() => {
    if (user?.role === 'PARTNER') {
      authManualApi.getMe().then(res => {
        if (res.data?.role !== 'PARTNER') {
          logout();
        }
      }).catch(() => {
        // Token expiry — handled by JwtAuthGuard
      });
    }
  }, [user?.role, logout]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: 'var(--color-grey-500)',
        fontSize: '15px',
      }}>
        로딩 중...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'PARTNER') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: '16px',
        padding: '24px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          backgroundColor: '#fef2f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
        }}>
          !
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#191f28', margin: 0 }}>
          파트너 권한이 없습니다
        </h2>
        <p style={{ fontSize: '14px', color: '#8b95a1', margin: 0, maxWidth: '320px' }}>
          이 페이지는 파트너 계정만 접근할 수 있습니다.
          파트너 등록이 필요하시면 관리자에게 문의해주세요.
        </p>
        <button
          type="button"
          onClick={() => { logout(); }}
          style={{
            marginTop: '8px',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            color: '#fff',
            backgroundColor: '#059669',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          로그아웃
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export default PartnerRoute;
