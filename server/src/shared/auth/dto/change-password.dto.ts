/**
 * @file change-password.dto.ts
 * @description 비밀번호 변경 DTO
 * @module auth/dto
 */
import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123!', description: '현재 비밀번호' })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ example: 'NewPassword123!', description: '새 비밀번호' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/, {
    message:
      '비밀번호는 8자 이상, 영문/숫자/특수문자(@$!%*#?&)를 각각 1개 이상 포함해야 합니다.',
  })
  newPassword: string;
}
