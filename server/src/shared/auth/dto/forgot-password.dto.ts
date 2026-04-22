import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  /** 가입 시 사용한 이메일 */
  @IsEmail({}, { message: '유효한 이메일 주소를 입력해주세요.' })
  email: string;
}
