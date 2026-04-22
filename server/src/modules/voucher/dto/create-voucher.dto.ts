import { ApiProperty } from '@nestjs/swagger';

import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  Min,
} from 'class-validator';

/**
 * @deprecated voucher.dto.ts의 CreateVoucherDto를 사용하세요.
 */
export class CreateVoucherDto {
  @ApiProperty({ description: '상품 ID' })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ description: 'PIN 코드 (평문, 서버에서 암호화)' })
  @IsString()
  @IsNotEmpty()
  pinCode: string;
}

/**
 * @deprecated voucher.dto.ts의 BulkCreateVoucherDto를 사용하세요.
 */
export class BulkCreateVoucherDto {
  @ApiProperty({ description: '상품 ID' })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({
    description: 'PIN 코드 배열 (평문, 서버에서 암호화)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  pinCodes: string[];
}

export class VoucherResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  productId: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  orderId?: number;

  @ApiProperty()
  createdAt: Date;
}

export class AssignedVoucherDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ description: '복호화된 PIN 코드' })
  pinCode: string;

  @ApiProperty()
  productId: number;
}
