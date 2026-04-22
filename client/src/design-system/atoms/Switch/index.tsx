/**
 * @file Switch.tsx
 * @description 접근성을 준수하는 Switch(토글) 컴포넌트 — daisyUI toggle
 * @module design-system/atoms
 *
 * 접근성:
 * - role="switch" 사용
 * - aria-checked로 상태 전달
 * - Space 키로 토글 가능
 * - 레이블 연결 (htmlFor/id)
 */
import React, { useId } from 'react';

export interface SwitchProps {
  /** 현재 활성화 상태 */
  checked: boolean;
  /** 상태 변경 핸들러 */
  onChange: (checked: boolean) => void;
  /** 레이블 텍스트 */
  label: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 커스텀 ID (자동 생성됨) */
  id?: string;
  /** 추가 클래스명 */
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  className = '',
}) => {
  const generatedId = useId();
  const switchId = id || generatedId;

  return (
    <label
      htmlFor={switchId}
      className={`inline-flex items-center gap-3 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <input
        type="checkbox"
        role="switch"
        id={switchId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-checked={checked}
        className="toggle toggle-primary"
      />
      <span className="text-xs sm:text-sm text-base-content">{label}</span>
    </label>
  );
};

export default Switch;
