import { PartialType } from '@nestjs/swagger';

import { IsString, MaxLength, IsIn } from 'class-validator';

const INQUIRY_CATEGORIES = [
  'order',
  'delivery',
  'refund',
  'tradein',
  'account',
  'etc',
] as const;

export class CreateInquiryDto {
  /** 문의 카테고리 */
  @IsString()
  @IsIn(INQUIRY_CATEGORIES, { message: '유효하지 않은 카테고리입니다.' })
  category: string;

  /** 문의 제목 */
  @IsString()
  @MaxLength(100, { message: '제목은 100자 이하로 입력해주세요.' })
  subject: string;

  /** 문의 내용 */
  @IsString()
  @MaxLength(2000, { message: '내용은 2,000자 이하로 입력해주세요.' })
  content: string;
}

export class UpdateInquiryDto extends PartialType(CreateInquiryDto) {}
