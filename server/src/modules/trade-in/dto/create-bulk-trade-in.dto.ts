import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';

export class PinEntryDto {
  @ApiProperty({ description: 'PIN 번호', example: '1234-5678-9012-3456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  pinCode: string;

  @ApiPropertyOptional({ description: '보안코드', example: '1234' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  securityCode?: string;

  @ApiPropertyOptional({ description: '권번호', example: '1234567890123' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  giftNumber?: string;
}

export class CreateBulkTradeInDto {
  @ApiProperty({ description: '상품 ID', example: 1 })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ description: 'PIN 목록 (최대 50건)', type: [PinEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PinEntryDto)
  pins: PinEntryDto[];

  @ApiPropertyOptional({
    description: '은행명 (서버가 등록 계좌 자동 사용)',
    example: '신한은행',
  })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  bankName?: string;

  @ApiPropertyOptional({
    description: '계좌번호 (서버가 등록 계좌 자동 사용)',
    example: '110123456789',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  accountNum?: string;

  @ApiPropertyOptional({
    description: '예금주명 (서버가 등록 계좌 자동 사용)',
    example: '홍길동',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  accountHolder?: string;

  @ApiPropertyOptional({ description: '신청자 이름' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  senderName?: string;

  @ApiPropertyOptional({ description: '신청자 핸드폰번호' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  senderPhone?: string;

  @ApiPropertyOptional({ description: '신청자 이메일' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  senderEmail?: string;
}
