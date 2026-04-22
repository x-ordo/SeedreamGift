import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTradeInDto {
  @ApiProperty({ description: '상품 ID', example: 1 })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiPropertyOptional({
    description: 'PIN 번호 (하이픈 포함 가능, 배송 모드에서는 생략)',
    example: '1234-5678-9012-3456',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  pinCode?: string;

  @ApiPropertyOptional({
    description: '보안코드 (브랜드별 선택)',
    example: '1234',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  securityCode?: string;

  @ApiPropertyOptional({
    description: '권번호 (브랜드별 선택)',
    example: '1234567890123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  giftNumber?: string;

  @ApiPropertyOptional({ description: '수량 (기본값 1, 최대 100)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

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

  @ApiPropertyOptional({ description: '신청자 이름', example: '홍길동' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  senderName?: string;

  @ApiPropertyOptional({
    description: '신청자 핸드폰번호',
    example: '01012345678',
  })
  @IsOptional()
  @IsString()
  @Matches(/^01[016789]\d{7,8}$/, {
    message: '올바른 휴대폰 번호를 입력해주세요.',
  })
  senderPhone?: string;

  @ApiPropertyOptional({
    description: '신청자 이메일',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  @MaxLength(50)
  senderEmail?: string;

  @ApiPropertyOptional({
    description: '발송방법',
    example: '익일특급(빠른등기)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  shippingMethod?: string;

  @ApiPropertyOptional({
    description: '발송예정일 (YYYY-MM-DD)',
    example: '2025-01-15',
  })
  @IsOptional()
  @IsString()
  shippingDate?: string;

  @ApiPropertyOptional({
    description: '도착예정일 (YYYY-MM-DD)',
    example: '2025-01-16',
  })
  @IsOptional()
  @IsString()
  arrivalDate?: string;

  @ApiPropertyOptional({
    description: '전달 메시지 (훼손정도/특이사항, 200자 이내)',
    example: '양호한 상태입니다',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
