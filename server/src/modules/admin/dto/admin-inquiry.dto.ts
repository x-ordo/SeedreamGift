import { IsString, MaxLength } from 'class-validator';

export class AdminAnswerInquiryDto {
  /** 답변 내용 */
  @IsString()
  @MaxLength(5000, { message: '답변은 5,000자 이하로 입력해주세요.' })
  answer: string;
}
