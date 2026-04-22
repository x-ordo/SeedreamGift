import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { StructuredVoucherDto } from '../../voucher/dto/voucher.dto';

const VOUCHER_STATUS = ['AVAILABLE', 'SOLD', 'USED', 'EXPIRED'] as const;
type VoucherStatus = (typeof VOUCHER_STATUS)[number];

/**
 * 관리자용 바우처 상태 변경 DTO
 */
export class AdminUpdateVoucherDto {
  @ApiPropertyOptional({ enum: VOUCHER_STATUS, description: '바우처 상태' })
  @IsOptional()
  @IsIn(VOUCHER_STATUS)
  status?: VoucherStatus;

  @ApiPropertyOptional({ example: 1, description: '주문 ID (판매 처리 시)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  orderId?: number;
}

/**
 * 관리자용 바우처 대량 등록 DTO
 *
 * 두 가지 방식 지원:
 * 1. pinCodes: string[] — 기존 방식 (단일 PIN 배열)
 * 2. vouchers: StructuredVoucherDto[] — 구조화 방식 (EX 등 복합 필드 브랜드용)
 */
export class AdminBulkCreateVoucherDto {
  @ApiProperty({ example: 1, description: '상품 ID' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  productId: number;

  @ApiPropertyOptional({
    example: ['1234-5678-9012-3456', '2345-6789-0123-4567'],
    description: 'PIN 코드 목록 (기존 방식)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pinCodes?: string[];

  @ApiPropertyOptional({
    type: [StructuredVoucherDto],
    description: '구조화된 바우처 배열 (EX 등 복합 필드 브랜드용)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructuredVoucherDto)
  vouchers?: StructuredVoucherDto[];
}
