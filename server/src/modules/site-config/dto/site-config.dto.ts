/**
 * @file site-config.dto.ts
 * @description 사이트 설정 DTO - 동적 설정 관리 API 요청 데이터 검증
 * @module site-config/dto
 *
 * 주요 설정 키:
 * - PURCHASE_LIMIT_DAILY: 일일 최대 구매 한도 (원)
 * - TRADE_IN_MIN_AMOUNT: 최소 매입 금액 (원)
 * - MAINTENANCE_MODE: 점검 모드 여부
 */
import { ApiProperty } from '@nestjs/swagger';

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
} from 'class-validator';

/**
 * 사이트 설정 생성 DTO
 * - POST /site-config 요청 본문
 */
export class CreateSiteConfigDto {
  /** 설정 키 (고유, 대문자_스네이크_케이스 권장, 최대 30자) */
  @ApiProperty({ example: 'PURCHASE_LIMIT_DAILY' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  key: string;

  /** 설정 값 (문자열로 저장, 사용 시 타입에 따라 변환) */
  @ApiProperty({ example: '1000000' })
  @IsNotEmpty()
  @IsString()
  value: string;

  /**
   * 값 타입 (파싱 힌트)
   * - NUMBER: 숫자
   * - STRING: 문자열
   * - BOOLEAN: 불리언 ('true'/'false')
   * - JSON: JSON 객체
   */
  @ApiProperty({ example: 'NUMBER' })
  @IsNotEmpty()
  @IsIn(['STRING', 'NUMBER', 'BOOLEAN', 'JSON'])
  type: string;

  /** 설정 설명 (관리자 UI에서 표시) */
  @ApiProperty({ example: '일일 최대 구매 한도 (원)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  description?: string;
}

/**
 * 사이트 설정 수정 DTO
 * - PATCH /site-config/:id 요청 본문
 */
export class UpdateSiteConfigDto {
  /** 새 설정 값 */
  @IsOptional() @IsString() value?: string;
  /** 설정 설명 */
  @IsOptional() @IsString() description?: string;
}
