import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';

/** 1원 인증 발송 요청 DTO */
export class BankVerifyRequestDto {
  /** 은행 코드 (금융결제원 표준 코드, 예: '004') */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{3}$/, { message: '은행 코드는 3자리 숫자입니다.' })
  bankCode: string;

  /** 은행명 (예: '국민은행') */
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  bankName: string;

  /** 계좌번호 (숫자만, 하이픈 제외) */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10,20}$/, { message: '계좌번호는 10~20자리 숫자입니다.' })
  accountNumber: string;

  /** 예금주명 */
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  accountHolder: string;
}
