import { IsString, IsNotEmpty, Matches } from 'class-validator';

/** 1원 인증 확인 DTO */
export class BankVerifyConfirmDto {
  /** Coocon issue 응답의 verify_tr_dt */
  @IsString()
  @IsNotEmpty()
  verifyTrDt: string;

  /** Coocon issue 응답의 verify_tr_no */
  @IsString()
  @IsNotEmpty()
  verifyTrNo: string;

  /** 사용자가 입력한 3자리 인증 코드 */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{3}$/, { message: '인증 코드는 3자리 숫자입니다.' })
  verifyVal: string;
}
