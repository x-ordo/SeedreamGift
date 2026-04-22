import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsString,
  IsBoolean,
  IsOptional,
  IsDateString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ description: '이벤트 제목' })
  @IsString()
  @MaxLength(100, { message: '제목은 100자 이하로 입력해주세요.' })
  title: string;

  @ApiProperty({ description: '이벤트 설명 (HTML/Text)' })
  @IsString()
  @MaxLength(5000, { message: '설명은 5,000자 이하로 입력해주세요.' })
  description: string;

  @ApiPropertyOptional({ description: '이벤트 이미지 URL' })
  @IsOptional()
  @IsUrl({}, { message: '올바른 URL 형식이 아닙니다.' })
  @MaxLength(300)
  imageUrl?: string;

  @ApiProperty({ description: '이벤트 시작일 (ISO 8601)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: '이벤트 종료일 (ISO 8601)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: '활성화 여부', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '메인 노출 여부', default: false })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}

export class UpdateEventDto {
  @ApiPropertyOptional({ description: '이벤트 제목' })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: '제목은 100자 이하로 입력해주세요.' })
  title?: string;

  @ApiPropertyOptional({ description: '이벤트 설명' })
  @IsString()
  @IsOptional()
  @MaxLength(5000, { message: '설명은 5,000자 이하로 입력해주세요.' })
  description?: string;

  @ApiPropertyOptional({ description: '이벤트 이미지 URL' })
  @IsOptional()
  @IsUrl({}, { message: '올바른 URL 형식이 아닙니다.' })
  @MaxLength(300)
  imageUrl?: string;

  @ApiPropertyOptional({ description: '이벤트 시작일 (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: '이벤트 종료일 (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: '활성화 여부' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '메인 노출 여부' })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}
