/**
 * @file PasswordStrengthMeter.tsx
 * @description 비밀번호 강도 인디케이터 (auth 전용)
 *
 * 서버 요건과 동일한 4가지 기준 (create-user.dto.ts @Matches 규칙):
 * - 8자 이상
 * - 영문 포함
 * - 숫자 포함
 * - 특수문자 포함 (영문·숫자 외 모든 문자)
 *
 * 강도: 약함(1) → 보통(2) → 좋음(3) → 강함(4)
 */
import React from 'react';
import './PasswordStrengthMeter.css';

interface PasswordStrengthMeterProps {
  password: string;
}

const STRENGTH_LABELS = ['', '약함', '보통', '좋음', '강함'] as const;

const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  if (!password) return null;

  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const strength = [hasMinLength, hasLetter, hasNumber, hasSpecial].filter(Boolean).length;

  return (
    <div className="password-strength" role="status">
      {/* Screen reader summary */}
      <span className="sr-only">비밀번호 강도: {STRENGTH_LABELS[strength] || '입력 중'}</span>

      <div className="password-strength__bar-track" aria-hidden="true">
        <div
          className="password-strength__bar-fill"
          data-strength={strength}
        />
      </div>

      <div className="password-strength__label-row" aria-hidden="true">
        <span className="password-strength__label" data-strength={strength}>
          {STRENGTH_LABELS[strength]}
        </span>
      </div>

      <ul className="password-strength__checklist" aria-label="비밀번호 요건">
        <li className={`password-strength__check ${hasMinLength ? 'password-strength__check--pass' : ''}`}>
          {hasMinLength ? '\u2713' : '\u2717'} 8자 이상
        </li>
        <li className={`password-strength__check ${hasLetter ? 'password-strength__check--pass' : ''}`}>
          {hasLetter ? '\u2713' : '\u2717'} 영문 포함
        </li>
        <li className={`password-strength__check ${hasNumber ? 'password-strength__check--pass' : ''}`}>
          {hasNumber ? '\u2713' : '\u2717'} 숫자 포함
        </li>
        <li className={`password-strength__check ${hasSpecial ? 'password-strength__check--pass' : ''}`}>
          {hasSpecial ? '\u2713' : '\u2717'} 특수문자 포함
        </li>
      </ul>
    </div>
  );
};

export default PasswordStrengthMeter;
