/**
 * @file Alert/index.tsx
 * @description 알림 배너 컴포넌트 — daisyUI alert 래퍼
 * @module design-system/atoms
 *
 * 사용 예시:
 * ```tsx
 * <Alert variant="error">{errorMessage}</Alert>
 * <Alert variant="info" icon={<Zap size={16} />}>결제 즉시 PIN 발급</Alert>
 * <Alert variant="warning" dismissible onDismiss={handleDismiss}>경고 메시지</Alert>
 * ```
 */
import React, { memo, ReactNode, useState } from 'react';
import { Info, CircleCheck, TriangleAlert, CircleX, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  /** 알림 유형 */
  variant: AlertVariant;
  /** 커스텀 아이콘 (기본 아이콘 대신 사용) */
  icon?: ReactNode;
  /** 닫기 버튼 표시 */
  dismissible?: boolean;
  /** 닫기 콜백 */
  onDismiss?: () => void;
  /** 콘텐츠 */
  children: ReactNode;
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Mappings
// ============================================================================

const VARIANT_CLASS: Record<AlertVariant, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
};

const DEFAULT_ICONS: Record<AlertVariant, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleX,
};

/** error/warning → assertive (role="alert"), info/success → polite (role="status") */
const VARIANT_ROLE: Record<AlertVariant, 'alert' | 'status'> = {
  info: 'status',
  success: 'status',
  warning: 'alert',
  error: 'alert',
};

// ============================================================================
// Component
// ============================================================================

export const Alert = memo<AlertProps>(({
  variant,
  icon,
  dismissible = false,
  onDismiss,
  children,
  className = '',
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const variantClass = VARIANT_CLASS[variant];
  const role = VARIANT_ROLE[variant];
  const DefaultIcon = DEFAULT_ICONS[variant];

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={`alert ${variantClass} ${className}`} role={role}>
      {icon ?? <DefaultIcon size={16} aria-hidden="true" />}
      <span className="flex-1">{children}</span>
      {dismissible && (
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={handleDismiss}
          aria-label="닫기"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

Alert.displayName = 'Alert';

export default Alert;
