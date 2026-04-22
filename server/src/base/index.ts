/**
 * @file index.ts
 * @description base 모듈 배럴 파일 - 공통 CRUD 기반 클래스 일괄 export
 * @module base
 *
 * 사용처:
 * - 모든 비즈니스 모듈에서 import { BaseCrudService, BaseCrudController, ... } from '../../base' 형태로 사용
 */
export * from './base.entity';
export * from './base-crud.service';
export * from './base-crud.controller';
export * from './pagination.dto';
export * from './base.dto';
