/**
 * @file create-user.dto.ts
 * @description 사용자 생성 DTO - 회원가입 API 요청 데이터 검증
 * @module users/dto
 *
 * 보안 참고:
 * - role 필드는 의도적으로 제외됨 (권한 상승 방지)
 * - 모든 신규 사용자는 'USER' 역할로 생성됨
 * - 역할 변경은 관리자만 UpdateUserDto를 통해 가능
 */
import { ApiProperty } from '@nestjs/swagger';

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * 사용자 생성 DTO
 * - POST /auth/register 요청 본문
 *
 * 보안: role 필드 제거 - 사용자가 직접 역할을 지정할 수 없음
 */
export class CreateUserDto {
  /** 이메일 주소 (로그인 ID로 사용, 중복 불가) */
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(100)
  email: string;

  /** 비밀번호 (최소 8자, 영문+숫자+특수문자 포함, 서버에서 bcrypt 해싱) */
  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/, {
    message:
      '비밀번호는 8자 이상, 영문/숫자/특수문자(@$!%*#?&)를 각각 1개 이상 포함해야 합니다.',
  })
  password: string;

  /** 사용자 이름 (필수, 2~50자, 한글/영문) */
  @ApiProperty({ example: '홍길동' })
  @IsString()
  @IsNotEmpty({ message: '이름을 입력해주세요.' })
  @MinLength(2, { message: '이름은 2자 이상이어야 합니다.' })
  @MaxLength(50)
  @Matches(/^[가-힣a-zA-Z\s]+$/, {
    message: '이름은 한글 또는 영문만 입력 가능합니다.',
  })
  name: string;

  /** 연락처 (필수, 한국 휴대폰 형식) */
  @ApiProperty({ example: '010-1234-5678' })
  @IsString()
  @IsNotEmpty({ message: '전화번호를 입력해주세요.' })
  @Matches(/^01[016789]-?\d{3,4}-?\d{4}$/, {
    message: '올바른 휴대폰 번호 형식이 아닙니다. (예: 010-1234-5678)',
  })
  phone: string;

  /** 우편번호 (5자리) */
  @IsString()
  @Matches(/^\d{5}$/, { message: '우편번호는 5자리 숫자입니다.' })
  zipCode: string;

  /** 기본 주소 (도로명/지번) */
  @IsString()
  @IsNotEmpty({ message: '주소를 입력해주세요.' })
  @MaxLength(200)
  address: string;

  /** 상세 주소 (동/호수) */
  @IsString()
  @IsNotEmpty({ message: '상세주소를 입력해주세요.' })
  @MaxLength(200)
  addressDetail: string;

  /** 은행명 (1원 인증 후 전달) */
  @IsString()
  @IsOptional()
  @MaxLength(15)
  bankName?: string;

  /** 은행 코드 (금융결제원 표준) */
  @IsString()
  @IsOptional()
  @MaxLength(4)
  bankCode?: string;

  /** 계좌번호 (평문 — 서버에서 암호화 저장) */
  @IsString()
  @IsOptional()
  @MaxLength(30)
  accountNumber?: string;

  /** 예금주 */
  @IsString()
  @IsOptional()
  @MaxLength(15)
  accountHolder?: string;

  /** 1원 인증 세션 ID (회원가입 시 은행 정보가 있는 경우 필수) */
  @IsString()
  @IsOptional()
  verificationId?: string;

  // 보안: role 필드 의도적 제거
  // 모든 신규 사용자는 Prisma 스키마 기본값 'USER'로 생성됨
  // 역할 변경은 관리자만 PATCH /admin/users/:id를 통해 가능
}
