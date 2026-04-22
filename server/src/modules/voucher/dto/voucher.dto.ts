/**
 * @file voucher.dto.ts
 * @description 바우처(상품권 PIN) DTO - 재고 관리 API 요청 데이터 검증
 * @module voucher/dto
 *
 * 바우처 상태:
 * - AVAILABLE: 판매 가능
 * - SOLD: 판매 완료 (주문에 할당됨)
 * - EXPIRED: 만료됨
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * 바우처 단건 등록 DTO
 */
export class CreateVoucherDto {
  /** 바우처가 속할 상품 ID */
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  productId: number;

  /** PIN 번호 (암호화 저장 권장) */
  @ApiProperty({ example: 'ABC1-DEF2-GHI3' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  pinCode: string;
}

/**
 * 구조화된 바우처 단건 (EX 등 복합 필드 브랜드용)
 */
export class StructuredVoucherDto {
  /** PIN / 인증코드 (GIFT_PW → pinCode로 암호화) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  pin: string;

  /** 카드번호 / 권번호 (CODE1+CODE2+CODE3 조합 등) */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  giftNumber?: string;

  /** 보안코드 (현대, 신세계 등) */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  securityCode?: string;
}

/**
 * 바우처 대량 등록 DTO (관리자용)
 * - POST /vouchers/bulk 요청 본문
 * - 상품권 공급사로부터 받은 PIN 목록 일괄 등록
 *
 * 두 가지 방식 지원 (하위호환):
 * 1. pinCodes: string[] — 기존 방식 (단일 PIN 배열)
 * 2. vouchers: StructuredVoucherDto[] — 구조화 방식 (EX 등 복합 필드)
 */
export class BulkCreateVoucherDto {
  /** 바우처들이 속할 상품 ID */
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  productId: number;

  /** PIN 번호 배열 (기존 방식) */
  @ApiPropertyOptional({ example: ['PIN1', 'PIN2', 'PIN3'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  pinCodes?: string[];

  /** 구조화된 바우처 배열 (EX 등 복합 필드 브랜드용) */
  @ApiPropertyOptional({ type: [StructuredVoucherDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructuredVoucherDto)
  vouchers?: StructuredVoucherDto[];

  /** 만료까지 일수 (미입력 시 만료일 미설정) */
  @ApiPropertyOptional({ example: 365, description: '만료까지 일수' })
  @IsOptional()
  @IsInt()
  expiryDays?: number;
}
