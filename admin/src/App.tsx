/**
 * @file App.tsx
 * @description W기프트 관리자 앱 (admin.wowgift.co.kr)
 *
 * 라우트:
 * - /login  → 관리자 로그인
 * - /*      → AdminRoute 가드 → AdminPage (탭 기반)
 */
import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import AdminRoute from './components/auth/AdminRoute';

const AdminPage = lazy(() => import('./pages/Admin/AdminPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));

function App() {
  return (
    <AuthProvider>
      <Suspense
        fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            로딩 중...
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<AdminLoginPage />} />
          <Route
            path="/*"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
