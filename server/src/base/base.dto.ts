/**
 * @file base.dto.ts
 * @description 하위 호환성을 위한 PaginationDto re-export 파일
 * @module base
 *
 * 사용처:
 * - 기존 모듈: import { PaginationDto } from './base.dto' 형태로 사용 중
 * - 신규 코드에서는 pagination.dto.ts에서 직접 import 권장
 *
 * PaginationQueryDto → PaginationDto 별칭으로 내보내서
 * 기존 코드 수정 없이 새 DTO 구조로 전환할 수 있도록 함
 */
export { PaginationQueryDto as PaginationDto } from './pagination.dto';
