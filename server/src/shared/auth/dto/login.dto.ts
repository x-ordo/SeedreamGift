/**
 * @file login.dto.ts
 * @description 로그인 DTO - 로그인 API 요청 데이터 검증
 * @module auth/dto
 */
import { ApiProperty } from '@nestjs/swagger';

import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * 로그인 DTO
 * - POST /auth/login 요청 본문
 * - 성공 시 JWT 액세스 토큰 반환
 */
export class LoginDto {
  /** 로그인 이메일 */
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  /** 비밀번호 (평문, 서버에서 bcrypt로 검증) */
  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
