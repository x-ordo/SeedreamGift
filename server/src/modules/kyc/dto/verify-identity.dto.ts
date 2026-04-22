import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * 본인인증 검증 요청 DTO
 * Coocon KYC 팝업 완료 후, SMS_VERIFICATION 테이블 조회용
 */
export class VerifyIdentityDto {
  /** 휴대폰 번호 (하이픈 없이, 예: 01012345678) */
  @IsString()
  @IsNotEmpty({ message: '휴대폰 번호를 입력해주세요.' })
  @Matches(/^01[016789]\d{7,8}$/, {
    message: '올바른 휴대폰 번호를 입력해주세요.',
  })
  phone: string;
}
