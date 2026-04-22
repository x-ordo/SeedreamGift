import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /** 비밀번호 재설정 토큰 */
  @IsString()
  @IsNotEmpty({ message: '토큰이 필요합니다.' })
  token: string;

  /** 새 비밀번호 */
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/, {
    message:
      '비밀번호는 8자 이상, 영문/숫자/특수문자(@$!%*#?&)를 각각 1개 이상 포함해야 합니다.',
  })
  newPassword: string;
}
