import { IsNotEmpty, IsString } from 'class-validator';

export class WithdrawDto {
  /** 본인 확인용 비밀번호 */
  @IsString()
  @IsNotEmpty({ message: '비밀번호를 입력해주세요.' })
  password: string;
}
