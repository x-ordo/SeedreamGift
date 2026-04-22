import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

/**
 * 관리자용 상품 생성 DTO
 * - brandCode로 브랜드 연결
 */
export class AdminCreateProductDto {
  @ApiProperty({ example: 'SHINSEGAE', description: '브랜드 코드' })
  @IsNotEmpty()
  @IsString()
  brandCode: string;

  @ApiProperty({ example: '신세계 상품권 10만원권' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  name: string;

  @ApiPropertyOptional({ example: '모바일 교환권' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ example: 100000, description: '액면가' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  price: number;

  @ApiProperty({ example: 2.5, description: '판매 할인율 (%)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountRate: number;

  @ApiProperty({ example: 5.0, description: '매입 할인율 (%)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  tradeInRate: number;

  @ApiPropertyOptional({ example: true, description: '매입 허용 여부' })
  @IsOptional()
  @IsBoolean()
  allowTradeIn?: boolean;

  @ApiPropertyOptional({ example: '/images/shinsegae.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 'PHYSICAL',
    description: '상품 유형 (PHYSICAL, DIGITAL, ENVELOPE)',
  })
  @IsOptional()
  @IsIn(['PHYSICAL', 'DIGITAL', 'ENVELOPE'])
  type?: string;

  @ApiPropertyOptional({
    example: 'DELIVERY',
    description: '배송 방법 (NONE, DELIVERY, PICKUP, BOTH)',
  })
  @IsOptional()
  @IsIn(['NONE', 'DELIVERY', 'PICKUP', 'BOTH'])
  shippingMethod?: string;
}

/**
 * 관리자용 상품 수정 DTO
 * - AdminCreateProductDto의 모든 필드를 optional로 + isActive 추가
 */
export class AdminUpdateProductDto extends PartialType(AdminCreateProductDto) {
  @ApiPropertyOptional({ example: true, description: '활성화 여부' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
