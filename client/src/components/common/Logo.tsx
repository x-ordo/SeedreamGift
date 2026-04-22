/**
 * @file Logo.tsx
 * @description 공통 SEEDREAM GIFT 로고 컴포넌트
 *
 * PNG 로고 이미지와 텍스트를 단일 컴포넌트로 통합.
 * LoginPage, RegisterPage, Header, Footer, Loader에서 공통 사용.
 */
import React from 'react';
import siteConfig from '../../../../site.config.json';

import logoDefault from '/assets/img/logo.png';
import logoWhite from '/assets/img/logo-white.png';

// "SEEDREAM GIFT" → prefix="SEEDREAM", suffix="GIFT"
const [brandPrefix, ...brandRest] = siteConfig.company.brand.split(' ');
const brandSuffix = brandRest.join(' ');

export interface LogoProps {
  /** 로고 크기 (px) */
  size?: number;
  /** 텍스트 표시 여부 */
  showText?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 로고 변형 — Footer 등 흰색 W 사용 시 'white' */
  variant?: 'default' | 'white';
}

const Logo: React.FC<LogoProps> = ({
  size = 40,
  showText = true,
  className = '',
  variant = 'default',
}) => {
  const src = variant === 'white' ? logoWhite : logoDefault;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        decoding="auto"
      />
      {showText && (
        <span className="font-bold text-lg sm:text-xl select-none">
          <span className="text-primary">{brandPrefix}</span>
          {brandSuffix && <span className="text-base-content/60">{brandSuffix}</span>}
        </span>
      )}
    </span>
  );
};

Logo.displayName = 'Logo';

export default Logo;
