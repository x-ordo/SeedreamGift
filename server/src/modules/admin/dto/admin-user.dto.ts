import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsNumber,
  IsString,
  MaxLength,
} from 'class-validator';

import { KYC_STATUS, USER_ROLE } from '../../../shared/constants/statuses';
import type { KycStatus, UserRole } from '../../../shared/constants/statuses';

/**
 * 관리자용 사용자 수정 DTO
 */
export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: '홍길동', description: '사용자 이름' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: '010-1234-5678', description: '전화번호' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  phone?: string;

  @ApiPropertyOptional({
    enum: Object.values(USER_ROLE),
    description: '사용자 역할',
  })
  @IsOptional()
  @IsIn(Object.values(USER_ROLE))
  role?: UserRole;

  @ApiPropertyOptional({
    enum: Object.values(KYC_STATUS),
    description: 'KYC 상태',
  })
  @IsOptional()
  @IsIn(Object.values(KYC_STATUS))
  kycStatus?: KycStatus;

  @ApiPropertyOptional({ example: 1000000, description: '건당 한도 (원)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  customLimitPerTx?: number;

  @ApiPropertyOptional({ example: 5000000, description: '일일 한도 (원)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  customLimitPerDay?: number;
}
