import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isAfterStartDate', async: false })
class IsAfterStartDate implements ValidatorConstraintInterface {
  validate(endDate: string, args: ValidationArguments) {
    const obj = args.object as any;
    if (!obj.startDate || !endDate) return true;
    return new Date(endDate) > new Date(obj.startDate);
  }
  defaultMessage() {
    return '종료일은 시작일 이후여야 합니다.';
  }
}

/**
 * 관리자용 이벤트 생성 DTO
 */
export class AdminCreateEventDto {
  @ApiProperty({ example: '신년 이벤트', description: '이벤트 제목' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({
    example: '새해를 맞아 특별 할인 이벤트를 진행합니다.',
    description: '이벤트 설명',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiPropertyOptional({
    example: '/images/events/newyear.jpg',
    description: '이벤트 이미지 URL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageUrl?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
    description: '이벤트 시작일',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    example: '2024-01-31T23:59:59Z',
    description: '이벤트 종료일',
  })
  @IsDateString()
  @Validate(IsAfterStartDate)
  endDate: string;

  @ApiPropertyOptional({ example: true, description: '활성화 여부' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, description: '메인 노출 여부' })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

/**
 * 관리자용 이벤트 수정 DTO
 */
export class AdminUpdateEventDto extends PartialType(AdminCreateEventDto) {}
