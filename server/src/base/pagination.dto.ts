/**
 * @file pagination.dto.ts
 * @description 통합 페이지네이션 DTO 및 응답 인터페이스
 * @module base
 *
 * 프로젝트 전체에서 사용하는 단일 페이지네이션 표준:
 * - 요청: PaginationQueryDto (page, limit 쿼리 파라미터)
 * - 응답: PaginatedResponse<T> ({ items, meta })
 *
 * 사용처:
 * - BaseCrudController.findAll(): 모든 목록 조회 API의 쿼리 파라미터로 사용
 * - BaseCrudService.findAll(): PaginatedResponse 형태로 응답 생성
 * - AdminPage: 관리자 대시보드 테이블의 페이지네이션 UI와 연동
 *
 * 기존 PaginationDto (base.dto.ts)를 대체합니다.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

/**
 * 통합 페이지네이션 쿼리 DTO
 *
 * 모든 목록 조회 엔드포인트에서 사용하는 표준 페이지네이션 파라미터.
 *
 * @example GET /products?page=2&limit=10&sort=createdAt&order=desc
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: '페이지 번호' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
    description: '페이지당 항목 수',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '정렬 기준 필드', example: 'createdAt' })
  @IsOptional()
  @IsString()
  sort?: string = 'createdAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'desc',
    description: '정렬 방향',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}

/**
 * 통합 페이지네이션 응답 인터페이스
 *
 * 모든 목록 조회 엔드포인트의 표준 응답 형식.
 *
 * @example
 * {
 *   items: [{ id: 1, ... }, { id: 2, ... }],
 *   meta: { total: 50, page: 1, limit: 20, pages: 3 }
 * }
 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

/**
 * PaginatedResponse 헬퍼 함수
 *
 * 데이터 배열과 메타데이터로부터 표준 페이지네이션 응답을 생성합니다.
 *
 * @param items - 현재 페이지의 데이터 배열
 * @param total - 전체 레코드 수
 * @param page - 현재 페이지 번호
 * @param limit - 페이지당 항목 수
 * @returns PaginatedResponse<T>
 */
export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    items,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}
