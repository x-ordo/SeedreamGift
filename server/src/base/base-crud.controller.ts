/**
 * @file base-crud.controller.ts
 * @description 공통 CRUD 컨트롤러 - 모든 REST 컨트롤러의 기반 클래스
 * @module base
 *
 * 주요 기능:
 * - 표준 REST 엔드포인트 (POST, GET, PATCH, DELETE)
 * - Swagger 문서 자동 생성
 * - 통합 페이지네이션 (page/limit 쿼리 파라미터, { items, meta } 응답)
 *
 * 엔드포인트:
 * - POST / - 새 레코드 생성
 * - GET / - 목록 조회 (페이지네이션)
 * - GET /:id - 단일 조회
 * - PATCH /:id - 수정
 * - DELETE /:id - 삭제
 */
import {
  Body,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { BaseCrudService, PaginatedResponse } from './base-crud.service';
import { BaseEntity } from './base.entity';
import { PaginationQueryDto } from './pagination.dto';

/**
 * 공통 CRUD 컨트롤러 클래스
 *
 * @template T - 엔티티 타입 (BaseEntity 상속)
 * @template CreateDto - 생성 DTO 타입
 * @template UpdateDto - 수정 DTO 타입
 */
export class BaseCrudController<T extends BaseEntity, CreateDto, UpdateDto> {
  constructor(
    private readonly service: BaseCrudService<T, CreateDto, UpdateDto>,
  ) {}

  /**
   * POST / - 새 레코드 생성
   */
  @Post()
  @ApiOperation({ summary: 'Create a new record' })
  @ApiResponse({ status: 201, description: 'Created successfully.' })
  async create(@Body() createDto: CreateDto): Promise<T> {
    return this.service.create(createDto);
  }

  /**
   * GET / - 목록 조회 (통합 페이지네이션)
   *
   * @param query.page - 페이지 번호 (기본값: 1)
   * @param query.limit - 페이지당 항목 수 (기본값: 20, 최대: 100)
   * @returns { items: T[], meta: { total, page, limit, pages } }
   */
  @Get()
  @ApiOperation({ summary: 'Retrieve multiple records (paginated)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '페이지 번호 (기본값: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '페이지당 항목 수 (기본값: 20, 최대: 100)',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: '정렬 기준 필드 (기본값: createdAt)',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    description: '정렬 방향 (기본값: desc)',
  })
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<T>> {
    return this.service.findAllPaginated({
      page: query.page,
      limit: query.limit,
      sort: query.sort,
      order: query.order,
    });
  }

  /**
   * GET /:id - 단일 레코드 조회
   *
   * @param id - 조회할 레코드 ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a single record by ID' })
  @ApiResponse({ status: 200, description: 'Found.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<T> {
    return this.service.findOne(id);
  }

  /**
   * PATCH /:id - 레코드 수정
   *
   * @param id - 수정할 레코드 ID
   * @param updateDto - 수정할 필드들
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a record' })
  @ApiResponse({ status: 200, description: 'Updated successfully.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateDto,
  ): Promise<T> {
    return this.service.update(id, updateDto);
  }

  /**
   * DELETE /:id - 레코드 삭제
   *
   * @param id - 삭제할 레코드 ID
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a record' })
  @ApiResponse({ status: 200, description: 'Deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<T> {
    return this.service.remove(id);
  }
}
