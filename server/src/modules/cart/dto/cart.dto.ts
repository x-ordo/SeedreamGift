/**
 * @file cart.dto.ts
 * @description 장바구니 관련 DTO - 입력 데이터 검증
 * @module cart
 */
import { ApiProperty } from '@nestjs/swagger';

import {
  IsInt,
  IsOptional,
  IsArray,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';

/**
 * 장바구니 아이템 추가 DTO
 */
export class AddToCartDto {
  @ApiProperty({ description: '상품 ID', example: 1 })
  @IsInt()
  productId: number;

  @ApiProperty({ description: '수량', example: 1, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  quantity?: number = 1;
}

/**
 * 장바구니 수량 변경 DTO
 */
export class UpdateCartItemDto {
  @ApiProperty({
    description: '변경할 수량',
    example: 2,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}

/**
 * 장바구니 배치 삭제 DTO
 */
export class BatchRemoveCartDto {
  @ApiProperty({
    description: '삭제할 상품 ID 목록',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  productIds: number[];
}
