/**
 * @file Logo.tsx
 * @description 공통 SEEDREAM GIFT 로고 컴포넌트
 *
 * SVG 로고(client/public/logo_d_leaf.svg)를 메인으로 사용합니다.
 * SVG 가 200x145 비율이라 size 는 너비 기준이 되고 높이는 자동(비율 유지).
 * white variant 는 같은 SVG 에 CSS filter 로 흰색 변환을 적용 (별도 파일 불필요).
 * 정사각형 raster 가 필요한 경우 (manifest.json, og:image 등) 는 /logo.jpg 사용.
 */
import React from 'react';
import siteConfig from '../../../../site.config.json';

const LOGO_SVG = '/logo_d_leaf.svg';
// SVG 의 원본 비율 — height = width * (145/200) = width * 0.725
const LOGO_RATIO = 145 / 200;

// "SEEDREAM GIFT" → prefix="SEEDREAM", suffix="GIFT"
const [brandPrefix, ...brandRest] = siteConfig.company.brand.split(' ');
const brandSuffix = brandRest.join(' ');

export interface LogoProps {
  /** 로고 크기 (px) — 너비 기준. 높이는 SVG 비율로 자동 계산. */
  size?: number;
  /** 텍스트 표시 여부 */
  showText?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 로고 변형 — Footer 등 dark 배경에서 'white' 사용 (SVG 단색 → CSS filter 로 반전) */
  variant?: 'default' | 'white';
}

const Logo: React.FC<LogoProps> = ({
  size = 40,
  showText = true,
  className = '',
  variant = 'default',
}) => {
  const height = Math.round(size * LOGO_RATIO);

  return (
    <span className={`inline-flex items-center gap-2 min-w-0 max-w-full ${className}`}>
      <img
        src={LOGO_SVG}
        alt=""
        aria-hidden="true"
        width={size}
        height={height}
        style={{
          width: size,
          height,
          flexShrink: 0,
          // SVG fill 이 단색 초록(rgb(26,72,38))으로 고정 → 흰색 영역에서는 그대로,
          // dark 배경(footer 등)에서는 brightness(0) invert(1) 로 흰색화.
          filter: variant === 'white' ? 'brightness(0) invert(1)' : undefined,
        }}
        decoding="auto"
      />
      {showText && (
        // 좁은 화면에서 텍스트가 가려지지 않도록:
        // 1) prefix 와 suffix 사이에 명시적 공백 → 단일 단어 취급 회피
        // 2) text-base sm:text-xl → 모바일 16px, ≥640px 20px (좁은 화면 압박 완화)
        // 3) min-w-0 + truncate → 부모 flex shrink 시 overflow ellipsis 처리
        <span className="font-bold text-base sm:text-xl select-none min-w-0 truncate">
          <span className="text-primary">{brandPrefix}</span>
          {brandSuffix && (
            <>
              {' '}
              <span className="text-base-content/60">{brandSuffix}</span>
            </>
          )}
        </span>
      )}
    </span>
  );
};

Logo.displayName = 'Logo';

export default Logo;
