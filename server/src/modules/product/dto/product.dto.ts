/**
 * @file product.dto.ts
 * @description 상품 관리 DTO - 상품 생성/수정 API 요청 데이터 검증
 * @module product/dto
 *
 * 가격 체계:
 * - price: 액면가 (정가)
 * - discountRate: 판매 할인율 → buyPrice = price × (1 - discountRate/100)
 * - tradeInRate: 매입 수수료율 → payoutAmount = price × (1 - tradeInRate/100)
 */
import { ApiProperty } from '@nestjs/swagger';

import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

/**
 * 상품 생성 DTO
 * - POST /products 요청 본문
 */
export class CreateProductDto {
  /** 상품권 브랜드 코드 (SHINSEGAE, HYUNDAI, LOTTE 등) */
  @ApiProperty({ example: 'SHINSEGAE', description: '상품권 브랜드 코드' })
  @IsNotEmpty()
  @IsString()
  brandCode: string;

  /** 상품명 */
  @ApiProperty({ example: '신세계 상품권 10만원권' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  name: string;

  /** 상품 설명 (선택) */
  @ApiProperty({ example: '모바일 교환권', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  /** 액면가 (정가, 1원 이상) */
  @ApiProperty({ example: 100000, description: '액면가' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  price: number;

  /**
   * 판매 할인율 (%)
   * - 판매가(buyPrice) = 액면가 × (1 - 할인율/100)
   * - 예: 100,000원, 2.5% 할인 → 판매가 97,500원
   */
  @ApiProperty({ example: 2.5, description: '판매 할인율 (%)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountRate: number;

  /**
   * 매입 수수료율 (%)
   * - 매입가(payoutAmount) = 액면가 × (1 - 수수료율/100)
   * - 예: 100,000원, 5% 수수료 → 매입가 95,000원
   */
  @ApiProperty({ example: 5.0, description: '매입 할인율 (%)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  tradeInRate: number;

  /** 매입 허용 여부 (선택, 기본값: true) */
  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  allowTradeIn?: boolean;

  /** 상품 이미지 URL (선택) */
  @ApiProperty({ example: 'https://example.com/image.png', required: false })
  @IsOptional()
  @IsUrl({}, { message: '올바른 URL 형식이 아닙니다.' })
  @MaxLength(300)
  imageUrl?: string;

  /** 상품 유형 (PHYSICAL, DIGITAL, ENVELOPE) - 기본값 PHYSICAL */
  @ApiProperty({ example: 'PHYSICAL', required: false })
  @IsOptional()
  @IsIn(['PHYSICAL', 'DIGITAL', 'ENVELOPE'])
  type?: string;

  /** 배송 방법 (DELIVERY, PICKUP, BOTH, NONE) - 기본값 DELIVERY */
  @ApiProperty({ example: 'DELIVERY', required: false })
  @IsOptional()
  @IsIn(['NONE', 'DELIVERY', 'PICKUP', 'BOTH'])
  shippingMethod?: string;
}

/**
 * 상품 수정 DTO
 * - PATCH /products/:id 요청 본문
 * - 모든 필드 선택적
 */
export class UpdateProductDto {
  /** 상품명 */
  @IsOptional() @IsString() @MaxLength(30) name?: string;
  /** 상품 설명 */
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  /** 액면가 */
  @IsOptional() @IsNumber() @Min(1) price?: number;
  /** 판매 할인율 */
  @IsOptional() @IsNumber() @Min(0) @Max(100) discountRate?: number;
  /** 매입 수수료율 */
  @IsOptional() @IsNumber() @Min(0) @Max(100) tradeInRate?: number;
  /** 매입 허용 여부 */
  @IsOptional() @IsBoolean() allowTradeIn?: boolean;
  /** 활성화 여부 (비활성화 시 목록에서 숨김) */
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** 상품 이미지 URL */
  @IsOptional()
  @IsUrl({}, { message: '올바른 URL 형식이 아닙니다.' })
  @MaxLength(300)
  imageUrl?: string;
  /** 상품 유형 */
  @IsOptional() @IsIn(['PHYSICAL', 'DIGITAL', 'ENVELOPE']) type?: string;
  /** 배송 방법 */
  @IsOptional()
  @IsIn(['NONE', 'DELIVERY', 'PICKUP', 'BOTH'])
  shippingMethod?: string;
}
