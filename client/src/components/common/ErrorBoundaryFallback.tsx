/**
 * @file ErrorBoundaryFallback.tsx
 * @description 에러 바운더리 폴백 UI — lazy 탭/페이지 크래시 시 복구 가능한 에러 화면
 */
import React from 'react';
import { FallbackProps } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/design-system';

const ErrorBoundaryFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-8) var(--space-4)',
        minHeight: '300px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-red-50, #FEF2F2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AlertTriangle size={28} color="var(--color-error)" aria-hidden="true" />
      </div>

      <div>
        <h3 style={{
          fontSize: 'var(--text-subhead)',
          fontWeight: 700,
          color: 'var(--color-grey-900)',
          margin: '0 0 var(--space-2)',
        }}>
          문제가 발생했습니다
        </h3>
        <p style={{
          fontSize: 'var(--text-body)',
          color: 'var(--color-grey-500)',
          margin: 0,
          lineHeight: 1.6,
          maxWidth: '360px',
        }}>
          페이지를 불러오는 중 오류가 발생했습니다.
          <br />
          아래 버튼을 눌러 다시 시도해주세요.
        </p>
      </div>

      {process.env.NODE_ENV === 'development' && error?.message && (
        <pre style={{
          fontSize: '11px',
          color: 'var(--color-grey-400)',
          background: 'var(--color-grey-50)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-3)',
          maxWidth: '480px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          margin: 0,
        }}>
          {error.message}
        </pre>
      )}

      <Button variant="secondary" size="md" onClick={resetErrorBoundary}>
        <RefreshCw size={16} />
        다시 시도
      </Button>
    </div>
  );
};

export default ErrorBoundaryFallback;
