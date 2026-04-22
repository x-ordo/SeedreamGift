import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsIn,
  MaxLength,
  Min,
} from 'class-validator';

import { FAQ_CATEGORY } from '../../../shared/constants/statuses';

export class CreateFaqDto {
  @ApiProperty({ description: 'FAQ 질문' })
  @IsString()
  @MaxLength(200)
  question: string;

  @ApiProperty({ description: 'FAQ 답변 (HTML/Text)' })
  @IsString()
  @MaxLength(10000)
  answer: string;

  @ApiProperty({
    description: '카테고리 (GENERAL, PAYMENT, TRADE_IN, ACCOUNT, SHIPPING)',
  })
  @IsString()
  @IsIn(Object.values(FAQ_CATEGORY), {
    message: '유효하지 않은 카테고리입니다.',
  })
  category: string;

  @ApiPropertyOptional({ description: '정렬 순서', default: 99 })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ description: '활성화 여부', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateFaqDto {
  @ApiPropertyOptional({ description: 'FAQ 질문' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  question?: string;

  @ApiPropertyOptional({ description: 'FAQ 답변' })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  answer?: string;

  @ApiPropertyOptional({ description: '카테고리' })
  @IsString()
  @IsOptional()
  @IsIn(Object.values(FAQ_CATEGORY), {
    message: '유효하지 않은 카테고리입니다.',
  })
  category?: string;

  @ApiPropertyOptional({ description: '정렬 순서' })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ description: '활성화 여부' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
