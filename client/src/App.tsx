/**
 * @file App.tsx
 * @description 앱 루트 컴포넌트 - 전역 프로바이더 및 라우트 정의
 * @module client
 *
 * 구조:
 * - AuthProvider → ModalProvider → ToastProvider 순서로 컨텍스트 래핑
 * - Suspense + ErrorBoundary로 lazy 로딩 및 에러 처리
 * - MainLayout 내부에 모든 페이지 라우트 배치
 *
 * 라우트 그룹:
 * - 상품 (/, /products, /products/:id)
 * - 장바구니/결제 (/cart, /checkout) - checkout은 인증 필수
 * - 사용자 (/mypage, /login, /register)
 * - 관리자 (/admin/*) - AdminRoute 가드 적용
 * - 고객지원 (/support, /rates)
 * - 레거시 리다이렉트 (/notice, /faq, /events → /support)
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import MainLayout from './layouts/MainLayout';
import { AuthProvider } from './contexts/AuthContext';
import { ModalProvider } from './contexts/ModalContext';
import { ToastProvider } from './contexts/ToastContext';
import { Loader, LoaderOverlay } from './design-system';
import ErrorBoundary from './components/common/ErrorBoundary';
import NotFoundPage from './pages/NotFoundPage';
import SEO from './components/common/SEO';
import NetworkStatus from './components/common/NetworkStatus';
import { SessionExpiryBanner } from './components/common/SessionExpiryBanner';

// 코드 스플리팅: 각 페이지를 별도 청크로 분리하여 초기 로딩 속도 개선
const HomePage = lazy(() => import('./pages/HomePage'));
const ProductListPage = lazy(() => import('./pages/Product/ProductListPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const MyPage = lazy(() => import('./pages/MyPage'));
const LoginPage = lazy(() => import('./pages/Auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage'));
// 매입 페이지는 /trade-in 경로로 분리 운영
const SupportHubPage = lazy(() => import('./pages/SupportHubPage'));
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'));
const VoucherTypeDetailPage = lazy(() => import('./pages/VoucherTypeDetail'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const ForgotPasswordPage = lazy(() => import('./pages/Auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/Auth/ResetPasswordPage'));
const LegalTermsPage = lazy(() => import('./pages/Legal/LegalTermsPage'));
const LegalPrivacyPage = lazy(() => import('./pages/Legal/LegalPrivacyPage'));
const RefundPolicyPage = lazy(() => import('./pages/Legal/RefundPolicyPage'));
const GiftPage = lazy(() => import('./pages/GiftPage'));
const PartnerInquiryPage = lazy(() => import('./pages/PartnerInquiryPage'));
// 어드민은 admin.wowgift.co.kr로 분리됨

function App() {
  return (
    <AuthProvider>
      <ModalProvider>
        <ToastProvider>
          <Suspense fallback={<LoaderOverlay />}>
            <ErrorBoundary>
              <NetworkStatus />
              <SessionExpiryBanner />
              <Routes>
                {/* 관리자/파트너 포털 리다이렉트 */}
                <Route path="/admin/*" element={<Navigate to={`${import.meta.env.VITE_ADMIN_URL || '/seedream_admin_portal'}`} replace />} />

                {/* 사용자 라우트 — MainLayout (헤더/푸터 포함) */}
                <Route element={<MainLayout />}>
                  <Route index element={<><SEO /><HomePage /></>} />

                  {/* 상품 라우트 — 목록/상세는 비인증 접근 허용 */}
                  <Route path="/products" element={<ProductListPage />} />
                  {/* Legacy: /products/:id → redirect to product list (brand can't be resolved from ID alone) */}
                  <Route path="/products/:id" element={<Navigate to="/products" replace />} />

                  {/* 장바구니 & 결제 — 결제는 ProtectedRoute로 인증 강제 */}
                  <Route path="/cart" element={<CartPage />} />
                  <Route
                    path="/checkout"
                    element={
                      <ProtectedRoute>
                        <CheckoutPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* 사용자 라우트 — 마이페이지는 인증 필수, 로그인/회원가입은 공개 */}
                  <Route
                    path="/mypage"
                    element={
                      <ProtectedRoute>
                        <MyPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/auth/login" element={<Navigate to="/login" replace />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/auth/register" element={<Navigate to="/register" replace />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />

                  {/* 법적 페이지 — 이용약관, 개인정보처리방침, 환불정책 */}
                  <Route path="/legal/terms" element={<LegalTermsPage />} />
                  <Route path="/legal/privacy" element={<LegalPrivacyPage />} />
                  <Route path="/legal/refund" element={<RefundPolicyPage />} />

                  {/* 파트너 제휴 문의 — 공개 페이지 */}
                  <Route path="/partner-inquiry" element={<PartnerInquiryPage />} />

                  {/* 선물하기 랜딩 페이지 */}
                  <Route path="/gift" element={<GiftPage />} />

                  {/* 매입 (판매) 라우트 - 별도 페이지로 분리 */}
                  <Route path="/trade-in" element={<ProductListPage mode="sell" />} />
                  <Route path="/voucher-types/:id" element={<VoucherTypeDetailPage />} />

                  {/* 시세 조회 */}
                  <Route path="/rates" element={<TransactionsPage />} />
                  {/* /live → /rates 리다이렉트 (기존 북마크/링크 호환) */}
                  <Route path="/live" element={<Navigate to="/rates" replace />} />

                  {/* 통합 고객지원 허브 (공지, FAQ, 이벤트 탭) */}
                  <Route path="/support" element={<SupportHubPage />} />

                  {/* 레거시 URL 리다이렉트 — 기존 개별 페이지를 /support 탭으로 통합 */}
                  <Route path="/notice" element={<Navigate to="/support?tab=notice" replace />} />
                  <Route path="/notices" element={<Navigate to="/support?tab=notice" replace />} />
                  <Route path="/faq" element={<Navigate to="/support?tab=faq" replace />} />
                  <Route path="/events" element={<Navigate to="/support?tab=event" replace />} />

                  {/* 디자인 시스템 쇼케이스 (개발용) */}
                  <Route
                    path="/design-system"
                    element={
                      <AdminRoute>
                        <DesignSystemPage />
                      </AdminRoute>
                    }
                  />

                  {/* 파트너 포털 리다이렉트 */}
                  <Route path="/partner/*" element={<Navigate to="/wow_partner_portal" replace />} />

                  {/* 404 — 매칭되지 않는 모든 경로를 처리 */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </ErrorBoundary>
          </Suspense>
        </ToastProvider>
      </ModalProvider>
    </AuthProvider>
  );
}

export default App;
