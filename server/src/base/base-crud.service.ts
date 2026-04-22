/**
 * @file base-crud.service.ts
 * @description 공통 CRUD 서비스 - 모든 비즈니스 서비스의 기반 클래스
 * @module base
 *
 * 주요 기능:
 * - 표준 CRUD 작업 (Create, Read, Update, Delete)
 * - 페이지네이션, 필터링, 정렬 지원
 * - 페이지네이션 메타데이터 반환 (통합 { items, meta } 형식)
 * - Prisma Delegate 패턴으로 타입 안전성 보장
 *
 * 사용법:
 * class MyService extends BaseCrudService<Entity, CreateDto, UpdateDto> {
 *   constructor(prisma: PrismaService) {
 *     super(prisma.myModel);
 *   }
 * }
 */
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { PaginatedResponse, createPaginatedResponse } from './pagination.dto';

/**
 * 페이지네이션 설정
 * 환경변수로 설정 가능: PAGINATION_DEFAULT, PAGINATION_MAX
 */
export const PAGINATION = {
  get DEFAULT_PAGE_SIZE(): number {
    return parseInt(process.env.PAGINATION_DEFAULT || '20', 10);
  },
  get MAX_PAGE_SIZE(): number {
    return parseInt(process.env.PAGINATION_MAX || '100', 10);
  },
} as const;

// PaginatedResponse를 re-export하여 기존 import 경로 호환성 유지
export type { PaginatedResponse } from './pagination.dto';

/**
 * Prisma 델리게이트 인터페이스
 * - Prisma 클라이언트의 각 모델(prisma.user, prisma.product 등)이 구현
 * - 제네릭 타입 T로 엔티티 타입 지정
 */
export interface CrudDelegate<T> {
  findMany(args?: Record<string, unknown>): Promise<T[]>;
  findFirst(args?: Record<string, unknown>): Promise<T | null>;
  findUnique(args: Record<string, unknown>): Promise<T | null>;
  create(args: Record<string, unknown>): Promise<T>;
  update(args: Record<string, unknown>): Promise<T>;
  delete(args: Record<string, unknown>): Promise<T>;
  count(args?: Record<string, unknown>): Promise<number>;
}

/** Prisma 모델 where/orderBy 제네릭 (기본: Record<string, unknown>) */
export interface CrudQueryArgs {
  where?: Record<string, unknown>;
  orderBy?: Record<string, unknown>;
}

/**
 * 공통 CRUD 서비스 추상 클래스
 *
 * @template T - 엔티티 타입
 * @template CreateDto - 생성 DTO 타입
 * @template UpdateDto - 수정 DTO 타입
 * @template Q - 쿼리 인자 타입 (where, orderBy) - 서브클래스에서 Prisma 타입으로 좁힐 수 있음
 */
export abstract class BaseCrudService<
  T,
  CreateDto,
  UpdateDto,
  Q extends CrudQueryArgs = CrudQueryArgs,
> {
  /** true이면 findAll/findOne/count에서 deletedAt: null 자동 필터 */
  protected readonly softDeleteFilter: boolean = false;

  constructor(protected readonly delegate: CrudDelegate<T>) {}

  /** where 조건에 soft-delete 필터 병합 */
  protected applySoftDeleteFilter(
    where?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!this.softDeleteFilter) return where;
    return { ...where, deletedAt: null };
  }

  /**
   * 새 레코드 생성
   *
   * @param data - 생성할 데이터 (CreateDto)
   * @returns 생성된 엔티티
   */
  async create(data: CreateDto): Promise<T> {
    return this.delegate.create({
      data,
    });
  }

  /**
   * 다중 레코드 조회 (페이지네이션, 필터링, 정렬 지원)
   *
   * @param params.skip - 건너뛸 레코드 수 (페이지네이션)
   * @param params.take - 가져올 레코드 수 (페이지 크기)
   * @param params.cursor - 커서 기반 페이지네이션용
   * @param params.where - 필터 조건
   * @param params.orderBy - 정렬 조건
   * @returns 엔티티 배열
   */
  async findAll(params?: {
    skip?: number;
    take?: number;
    cursor?: Record<string, unknown>;
    where?: Q['where'];
    orderBy?: Q['orderBy'];
  }): Promise<T[]> {
    const { skip, take, cursor, where, orderBy } = params || {};
    return this.delegate.findMany({
      skip,
      take,
      cursor,
      where: this.applySoftDeleteFilter(where as Record<string, unknown>),
      orderBy,
    });
  }

  /**
   * 다중 레코드 조회 + 페이지네이션 메타데이터 (통합 형식)
   *
   * @param params.page - 페이지 번호 (1부터 시작)
   * @param params.limit - 페이지 크기 (최대 100)
   * @param params.where - 필터 조건
   * @param params.orderBy - 정렬 조건 (기본: id desc)
   * @returns { items, meta } 통합 페이지네이션 응답
   */
  async findAllPaginated(params?: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    where?: Q['where'];
    orderBy?: Q['orderBy'];
  }): Promise<PaginatedResponse<T>> {
    const page = Math.max(1, params?.page || 1);
    const requestedLimit = params?.limit || PAGINATION.DEFAULT_PAGE_SIZE;

    // 최대 페이지 크기 제한
    if (requestedLimit > PAGINATION.MAX_PAGE_SIZE) {
      throw new BadRequestException(
        `페이지 크기는 최대 ${PAGINATION.MAX_PAGE_SIZE}까지 가능합니다.`,
      );
    }

    const limit = Math.min(requestedLimit, PAGINATION.MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;
    const where = this.applySoftDeleteFilter(
      params?.where as Record<string, unknown>,
    );

    // orderBy 우선순위: 명시적 orderBy > sort/order 파라미터 > 기본값 (id desc)
    const orderBy =
      params?.orderBy ||
      (params?.sort
        ? { [params.sort]: params.order || 'desc' }
        : { id: 'desc' });

    // 데이터와 총 개수를 병렬로 조회
    const [items, total] = await Promise.all([
      this.delegate.findMany({
        skip,
        take: limit,
        where,
        orderBy,
      }),
      this.delegate.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, limit);
  }

  /**
   * 단일 레코드 조회 (ID 기준)
   *
   * @param id - 조회할 레코드 ID
   * @returns 엔티티
   * @throws NotFoundException - 레코드가 존재하지 않을 때
   */
  async findOne(id: number): Promise<T> {
    const where = this.applySoftDeleteFilter({ id }) || { id };
    // soft-delete 활성 시 findFirst 사용 (findUnique는 unique 필드만 허용)
    const item = this.softDeleteFilter
      ? await this.delegate.findFirst({ where })
      : await this.delegate.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Entity with ID ${id} not found`);
    }
    return item;
  }

  /**
   * 레코드 수정
   *
   * @param id - 수정할 레코드 ID
   * @param data - 수정할 데이터 (UpdateDto)
   * @returns 수정된 엔티티
   * @throws NotFoundException - 레코드가 존재하지 않을 때
   */
  async update(id: number, data: UpdateDto): Promise<T> {
    try {
      return await this.delegate.update({
        where: { id },
        data,
      });
    } catch (error: any) {
      // P2025: Record to update not found
      if (error?.code === 'P2025') {
        throw new NotFoundException(`Entity with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * 레코드 삭제
   *
   * @param id - 삭제할 레코드 ID
   * @returns 삭제된(또는 논리 삭제된) 엔티티
   * @throws NotFoundException - 레코드가 존재하지 않을 때
   */
  async remove(id: number): Promise<T> {
    try {
      if (this.softDeleteFilter) {
        // 논리 삭제 처리
        return await this.delegate.update({
          where: { id },
          data: { deletedAt: new Date() } as any,
        });
      }

      // 물리 삭제 처리
      return await this.delegate.delete({
        where: { id },
      });
    } catch (error: any) {
      // P2025: Record to delete/update not found
      if (error?.code === 'P2025') {
        throw new NotFoundException(`Entity with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * 레코드 수 조회
   *
   * @param where - 필터 조건 (선택)
   * @returns 레코드 수
   */
  async count(where?: Q['where']): Promise<number> {
    return this.delegate.count({
      where: this.applySoftDeleteFilter(where as Record<string, unknown>),
    });
  }
}
