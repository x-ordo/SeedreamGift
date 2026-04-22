/**
 * @file paginated-query.ts
 * @description 범용 페이지네이션 쿼리 헬퍼
 * @module base
 *
 * Prisma delegate(findMany + count)를 받아 페이지네이션 응답을 생성합니다.
 * 10+ 서비스에서 반복되는 패턴을 단일 함수로 통합합니다.
 *
 * @example
 * ```typescript
 * return paginatedQuery(this.prisma.order, {
 *   pagination: paginationDto,
 *   where: status ? { status } : undefined,
 *   orderBy: { createdAt: 'desc' },
 *   include: { user: { select: { email: true } } },
 * });
 * ```
 */
import {
  PaginationQueryDto,
  PaginatedResponse,
  createPaginatedResponse,
} from './pagination.dto';

/**
 * Prisma delegate 인터페이스 (findMany + count)
 *
 * Prisma 모델의 findMany와 count 메서드만 필요합니다.
 * `this.prisma.order`, `this.prisma.user` 등을 직접 전달하면 됩니다.
 */
interface PrismaDelegate<T> {
  findMany(args: any): Promise<T[]>;
  count(args: any): Promise<number>;
}

/**
 * 페이지네이션 쿼리 옵션
 */
interface PaginatedQueryOptions {
  /** PaginationQueryDto (page, limit 포함) */
  pagination: PaginationQueryDto;
  /** Prisma where 조건 */
  where?: Record<string, any>;
  /** 정렬 기준 (기본: { createdAt: 'desc' }) */
  orderBy?: Record<string, any> | Record<string, any>[];
  /** Prisma include (관계 포함) — select와 동시 사용 불가 */
  include?: Record<string, any>;
  /** Prisma select (필드 선택) — include와 동시 사용 불가 */
  select?: Record<string, any>;
}

/**
 * 범용 페이지네이션 쿼리
 *
 * Prisma delegate의 findMany + count를 병렬 실행하고
 * 표준 PaginatedResponse로 변환합니다.
 *
 * @param delegate - Prisma 모델 delegate (e.g., this.prisma.order)
 * @param options - 페이지네이션, 필터, 정렬, 관계 포함 옵션
 * @returns PaginatedResponse<T>
 */
export async function paginatedQuery<T>(
  delegate: PrismaDelegate<T>,
  options: PaginatedQueryOptions,
): Promise<PaginatedResponse<T>> {
  const {
    pagination,
    where,
    orderBy = { createdAt: 'desc' },
    include,
    select,
  } = options;
  const page = pagination.page ?? 1;
  const limit = pagination.limit ?? 20;
  const skip = (page - 1) * limit;

  const findManyArgs: any = {
    where,
    skip,
    take: limit,
    orderBy,
  };

  if (include) findManyArgs.include = include;
  if (select) findManyArgs.select = select;

  const [items, total] = await Promise.all([
    delegate.findMany(findManyArgs),
    delegate.count({ where }),
  ]);

  return createPaginatedResponse(items, total, page, limit);
}
