/**
 * @file update-profile.dto.ts
 * @description 사용자 프로필 수정 DTO
 * @module auth/dto
 */
import { ApiProperty } from '@nestjs/swagger';

import {
  IsEmail,
  IsOptional,
  IsString,
  IsBoolean,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Hong Gil Dong', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'user@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '010-1234-5678', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^01[016789]-?\d{3,4}-?\d{4}$/, {
    message: '올바른 휴대폰 번호 형식이 아닙니다. (예: 010-1234-5678)',
  })
  phone?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{5}$/, { message: '우편번호는 5자리 숫자입니다.' })
  zipCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  addressDetail?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  emailNotification?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  pushNotification?: boolean;
}
