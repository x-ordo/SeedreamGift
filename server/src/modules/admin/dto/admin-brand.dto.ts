import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  MaxLength,
  IsBoolean,
  IsObject,
} from 'class-validator';

/**
 * PIN 설정 객체 타입
 */
export interface PinConfigDto {
  pinLength: number;
  pinPattern: number[];
  hasSecurityCode: boolean;
  securityCodeLength?: number;
  hasGiftNumber: boolean;
  giftNumberLength?: number;
  allowedLengths?: number[];
  labels: {
    pin: string;
    securityCode?: string;
    giftNumber?: string;
  };
}

/**
 * 관리자용 브랜드 생성 DTO
 */
export class AdminCreateBrandDto {
  @ApiProperty({
    example: 'SHINSEGAE',
    description: '브랜드 코드 (Primary Key)',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: '신세계', description: '브랜드 이름' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  name: string;

  @ApiPropertyOptional({ example: '#003366', description: '브랜드 색상 (HEX)' })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @ApiPropertyOptional({ example: 1, description: '표시 순서' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  order?: number;

  @ApiPropertyOptional({
    example: '신세계 백화점 상품권',
    description: '브랜드 설명',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  description?: string;

  @ApiPropertyOptional({
    example: '/images/brands/shinsegae.png',
    description: '브랜드 이미지 URL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageUrl?: string;

  @ApiPropertyOptional({ example: true, description: '활성화 여부' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'PIN 코드 설정 (JSON)',
    example: {
      pinLength: 16,
      pinPattern: [4, 4, 4, 4],
      hasSecurityCode: true,
      securityCodeLength: 4,
      hasGiftNumber: false,
      labels: { pin: 'PIN 번호', securityCode: '보안코드' },
    },
  })
  @IsOptional()
  @IsObject()
  pinConfig?: PinConfigDto;
}

/**
 * 관리자용 브랜드 수정 DTO
 * - code 제외, 나머지 모든 필드 optional
 */
export class AdminUpdateBrandDto extends PartialType(
  OmitType(AdminCreateBrandDto, ['code']),
) {}
