/**
 * @file pagination.config.ts
 * @description 페이지네이션 설정
 * @module config
 *
 * 환경변수:
 * - PAGINATION_DEFAULT: 기본 페이지 크기 (기본: 20)
 * - PAGINATION_MAX: 최대 페이지 크기 (기본: 100)
 */
import { registerAs } from '@nestjs/config';

export interface PaginationConfig {
  defaultPageSize: number;
  maxPageSize: number;
}

export default registerAs(
  'pagination',
  (): PaginationConfig => ({
    defaultPageSize: parseInt(process.env.PAGINATION_DEFAULT || '20', 10),
    maxPageSize: parseInt(process.env.PAGINATION_MAX || '100', 10),
  }),
);
