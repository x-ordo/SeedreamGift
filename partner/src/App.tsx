/**
 * @file App.tsx
 * @description W기프트 파트너 앱
 *
 * Routes:
 * - /login  -> PartnerLoginPage
 * - /*      -> PartnerRoute guard -> PartnerPage (tab-based)
 */
import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import PartnerRoute from './components/auth/PartnerRoute';

const PartnerPage = lazy(() => import('./pages/Partner/PartnerPage'));
const PartnerLoginPage = lazy(() => import('./pages/PartnerLoginPage'));

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Suspense
          fallback={
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
              로딩 중...
            </div>
          }
        >
          <Routes>
            <Route path="/login" element={<PartnerLoginPage />} />
            <Route
              path="/*"
              element={
                <PartnerRoute>
                  <PartnerPage />
                </PartnerRoute>
              }
            />
          </Routes>
        </Suspense>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
