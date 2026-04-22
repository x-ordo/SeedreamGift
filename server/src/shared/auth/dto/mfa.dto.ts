import { IsNotEmpty, IsString, Length } from 'class-validator';

/** MFA 코드 검증 DTO */
export class MfaVerifyDto {
  /** TOTP 6자리 코드 */
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: '인증 코드는 6자리여야 합니다.' })
  token: string;
}

/** MFA 로그인 2단계 DTO */
export class MfaLoginDto {
  /** 1단계에서 받은 임시 토큰 */
  @IsNotEmpty()
  @IsString()
  mfaToken: string;

  /** TOTP 6자리 코드 */
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: '인증 코드는 6자리여야 합니다.' })
  token: string;
}
