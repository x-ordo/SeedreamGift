/**
 * @file base.entity.ts
 * @description 기본 엔티티 추상 클래스 - 모든 DB 엔티티의 공통 필드 정의
 * @module base
 *
 * 포함 필드:
 * - id: 고유 식별자 (Primary Key)
 * - createdAt: 생성 일시
 * - updatedAt: 수정 일시
 *
 * 사용처:
 * - BaseCrudController: 타입 제약 조건 (T extends BaseEntity)
 * - 모든 엔티티 타입이 이 필드들을 가지고 있음을 보장
 */
import { ApiProperty } from '@nestjs/swagger';

/**
 * 기본 엔티티 추상 클래스
 *
 * 모든 엔티티가 공통으로 가지는 필드를 정의합니다.
 * Swagger 문서에 자동으로 포함됩니다.
 */
export abstract class BaseEntity {
  @ApiProperty({ description: '고유 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  @ApiProperty({ description: '수정 일시' })
  updatedAt: Date;
}
