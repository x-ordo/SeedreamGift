/**
 * @file BrandThemeContext.tsx
 * @description 브랜드 테마 상수 - 상품권 브랜드별 컬러 및 명칭 정의
 * @module contexts
 *
 * 주요 기능:
 * - 브랜드 코드 타입 정의 (SHINSEGAE, HYUNDAI, LOTTE 등)
 * - 브랜드별 한글명 매핑
 * - 브랜드별 컬러 테마 (primary, accent, light, gradient)
 *
 * 사용 예시:
 * ```tsx
 * import { BRAND_NAMES, BRAND_THEMES, BrandCode } from '@/contexts/BrandThemeContext';
 *
 * const brandCode: BrandCode = 'SHINSEGAE';
 * const name = BRAND_NAMES[brandCode]; // '신세계'
 * const colors = BRAND_THEMES[brandCode];
 * // { primary: '#E4002B', accent: '#FFD700', light: 'rgba(...)', gradient: '...' }
 * ```
 */

/** 브랜드 코드 */
export type BrandCode =
  | 'SHINSEGAE'
  | 'HYUNDAI'
  | 'LOTTE'
  | 'CULTURELAND'
  | 'DAISO'
  | 'OLIVEYOUNG';

/** 브랜드 한글명 매핑 */
export const BRAND_NAMES: Record<BrandCode, string> = {
  SHINSEGAE: '신세계',
  HYUNDAI: '현대',
  LOTTE: '롯데',
  CULTURELAND: '컬쳐랜드',
  DAISO: '다이소',
  OLIVEYOUNG: '올리브영',
};

/** 브랜드 컬러 정의 */
export interface BrandColors {
  primary: string;
  accent: string;
  light: string;
  gradient?: string;
}

/** 브랜드별 컬러 테마 */
export const BRAND_THEMES: Record<BrandCode, BrandColors> = {
  SHINSEGAE: {
    primary: '#E4002B',
    accent: '#FFD700',
    light: 'rgba(228, 0, 43, 0.08)',
    gradient: 'linear-gradient(135deg, #E4002B 0%, #8B0000 100%)',
  },
  HYUNDAI: {
    primary: '#003366',
    accent: '#00A651',
    light: 'rgba(0, 51, 102, 0.08)',
    gradient: 'linear-gradient(135deg, #003366 0%, #001933 100%)',
  },
  LOTTE: {
    primary: '#D40029',
    accent: '#FFCC00',
    light: 'rgba(212, 0, 41, 0.08)',
    gradient: 'linear-gradient(135deg, #D40029 0%, #8B0019 100%)',
  },
  CULTURELAND: {
    primary: '#4EC1D2',
    accent: '#FF6B35',
    light: 'rgba(78, 193, 210, 0.08)',
    gradient: 'linear-gradient(135deg, #4EC1D2 0%, #2A8A96 100%)',
  },
  DAISO: {
    primary: '#FF6B00',
    accent: '#FFE500',
    light: 'rgba(255, 107, 0, 0.08)',
    gradient: 'linear-gradient(135deg, #FF6B00 0%, #CC5500 100%)',
  },
  OLIVEYOUNG: {
    primary: '#00A651',
    accent: '#000000',
    light: 'rgba(0, 166, 81, 0.08)',
    gradient: 'linear-gradient(135deg, #00A651 0%, #006B34 100%)',
  },
};
