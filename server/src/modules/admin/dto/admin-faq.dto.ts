import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { FAQ_CATEGORY } from '../../../shared/constants/statuses';

/**
 * 관리자용 FAQ 생성 DTO
 */
export class AdminCreateFaqDto {
  @ApiProperty({
    example: '상품권 구매 후 환불이 가능한가요?',
    description: 'FAQ 질문',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  question: string;

  @ApiProperty({
    example: '구매 후 7일 이내 미사용 상품권에 한해 환불이 가능합니다.',
    description: 'FAQ 답변',
  })
  @IsNotEmpty()
  @IsString()
  answer: string;

  @ApiProperty({ example: 'PURCHASE', description: 'FAQ 카테고리' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  @IsIn(Object.values(FAQ_CATEGORY), {
    message:
      'FAQ 카테고리는 GENERAL, PURCHASE, TRADEIN, PAYMENT, DELIVERY, ACCOUNT 중 하나여야 합니다.',
  })
  category: string;

  @ApiPropertyOptional({ example: 1, description: '표시 순서' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  order?: number;

  @ApiPropertyOptional({ example: true, description: '활성화 여부' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * 관리자용 FAQ 수정 DTO
 */
export class AdminUpdateFaqDto extends PartialType(AdminCreateFaqDto) {}
