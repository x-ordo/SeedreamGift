/**
 * @file brandTheme.ts
 * @description 브랜드 테마 상수 - 상품권 브랜드별 컬러 및 명칭 정의
 * @module constants
 *
 * 주요 기능:
 * - 브랜드 코드 타입 정의 (SHINSEGAE, HYUNDAI, LOTTE 등)
 * - 브랜드별 한글명 매핑
 * - 브랜드별 컬러 테마 (primary, accent, light, gradient)
 *
 * 사용 예시:
 * ```tsx
 * import { BRAND_NAMES, BRAND_THEMES, BrandCode } from '@/constants';
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
  | 'DAISO'
  | 'CU'
  | 'OLIVEYOUNG'
  | 'WGIFT'
  | 'EX';

/** 브랜드 한글명 매핑 */
export const BRAND_NAMES: Record<BrandCode, string> = {
  SHINSEGAE: '신세계',
  HYUNDAI: '현대',
  LOTTE: '롯데',
  DAISO: '다이소',
  CU: 'CU',
  OLIVEYOUNG: '올리브영',
  WGIFT: '씨드림상품권',
  EX: '이엑스',
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
  DAISO: {
    primary: '#FF6B00',
    accent: '#FFE500',
    light: 'rgba(255, 107, 0, 0.08)',
    gradient: 'linear-gradient(135deg, #FF6B00 0%, #CC5500 100%)',
  },
  CU: {
    primary: '#00A651',
    accent: '#652D90',
    light: 'rgba(0, 166, 81, 0.08)',
    gradient: 'linear-gradient(135deg, #00A651 0%, #006B34 100%)',
  },
  OLIVEYOUNG: {
    primary: '#9BCA3C',
    accent: '#1A1A1A',
    light: 'rgba(155, 202, 60, 0.08)',
    gradient: 'linear-gradient(135deg, #9BCA3C 0%, #6B8E23 100%)',
  },
  WGIFT: {
    primary: '#6366F1',
    accent: '#FFBB00',
    light: 'rgba(99, 102, 241, 0.08)',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
  },
  EX: {
    primary: '#8B5CF6',
    accent: '#A78BFA',
    light: 'rgba(139, 92, 246, 0.08)',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
  },
};
