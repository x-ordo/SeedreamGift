import React, { useEffect, useRef } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import SEO from '../components/common/SEO';

interface RedirectState {
  targetUrl?: string;
  formData?: Record<string, string>;
  orderCode?: string;
}

/**
 * Seedream 발급 응답의 `targetUrl` + `formData` 를 HTML form 으로 렌더하여
 * 고객 브라우저를 키움페이 은행선택 창으로 auto-submit 합니다.
 *
 * 진입 경로: `CheckoutPage` 에서
 *   navigate('/checkout/redirect', { state: { targetUrl, formData, orderCode }, replace: true })
 *
 * ★ 보안(설계 D5):
 *  - `formData.TOKEN` 은 1회용 세션 토큰. localStorage / sessionStorage /
 *    URL query 에 저장 금지. hidden input → submit → 즉시 이탈.
 *  - 페이지 리로드 / 직접 진입 시 `location.state` 가 없으므로 홈으로 fallback.
 *  - `replace: true` 로 이동했으므로 뒤로가기 시 주문 페이지가 아닌 이전 장바구니 등으로 복귀.
 */
const CheckoutRedirect: React.FC = () => {
  const location = useLocation();
  const formRef = useRef<HTMLFormElement>(null);
  const state = location.state as RedirectState | null;

  useEffect(() => {
    if (formRef.current && state?.targetUrl) {
      const t = setTimeout(() => formRef.current?.submit(), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state]);

  if (!state?.targetUrl || !state?.formData) {
    return <Navigate to="/" replace />;
  }

  const { targetUrl, formData, orderCode } = state;

  return (
    <>
      <SEO title="결제 진행 중" />
      <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
        <div role="status" aria-live="polite">
          <h1 style={{ fontSize: 'var(--text-heading-3)', marginBottom: 'var(--space-2)' }}>
            결제창으로 이동 중입니다
          </h1>
          <p style={{ color: 'var(--color-neutral-600)', fontSize: 'var(--text-body)' }}>
            {orderCode ? <>주문번호 {orderCode}<br /></> : null}
            자동으로 전환되지 않으면 아래 버튼을 눌러주세요.
          </p>
        </div>
        <form ref={formRef} method="POST" action={targetUrl} style={{ marginTop: 'var(--space-6)' }}>
          {Object.entries(formData).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <button
            type="submit"
            style={{
              padding: 'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--text-body)',
            }}
          >
            결제창 열기
          </button>
        </form>
      </div>
    </>
  );
};

export default CheckoutRedirect;
