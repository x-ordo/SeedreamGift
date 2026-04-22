/**
 * @file create-order.dto.ts
 * @description 주문 생성 DTO - 주문 API 요청 데이터 검증
 * @module orders/dto
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsEmail,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

/**
 * 주문 아이템 DTO
 * - 개별 상품의 주문 정보
 */
export class OrderItemDto {
  /** 주문할 상품 ID */
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  productId: number;

  /** 주문 수량 (1~10) */
  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsNotEmpty()
  quantity: number;
}

/**
 * 주문 생성 DTO
 * - POST /orders 요청 본문
 */
export class CreateOrderDto {
  /** 주문 아이템 목록 (상품 ID + 수량) */
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  /** 결제 수단 */
  @ApiPropertyOptional({ description: '결제 수단', example: 'CASH' })
  @IsOptional()
  @IsIn(['CASH', 'CARD', 'TRANSFER'])
  paymentMethod?: string;

  /** 선물 수신자 이메일 (Optional) */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  giftReceiverEmail?: string;

  /** 선물 메시지 (Optional, 200자 이내) */
  @ApiPropertyOptional({ description: '선물 메시지', example: '생일 축하해!' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  giftMessage?: string;

  @ApiPropertyOptional({
    description: '멱등성 키 (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  idempotencyKey?: string;

  // Shipping Info
  @ApiPropertyOptional({
    description: '배송 방법 (DELIVERY, PICKUP)',
    example: 'DELIVERY',
  })
  @IsOptional()
  @IsIn(['DELIVERY', 'PICKUP'])
  shippingMethod?: string;

  @ApiPropertyOptional({ description: '수령인 이름' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  recipientName?: string;

  @ApiPropertyOptional({ description: '수령인 연락처' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  recipientPhone?: string;

  @ApiPropertyOptional({ description: '수령인 주소' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  recipientAddr?: string;

  @ApiPropertyOptional({ description: '우편번호' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  recipientZip?: string;

  // Cash Receipt
  @ApiPropertyOptional({
    description: '현금영수증 유형 (PERSONAL, BUSINESS, NO_RECEIPT)',
    example: 'PERSONAL',
  })
  @IsOptional()
  @IsIn(['PERSONAL', 'BUSINESS', 'NO_RECEIPT'])
  cashReceiptType?: string;

  @ApiPropertyOptional({
    description: '현금영수증 번호 (휴대폰번호 또는 사업자번호)',
    example: '01012345678',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cashReceiptNumber?: string;
}
