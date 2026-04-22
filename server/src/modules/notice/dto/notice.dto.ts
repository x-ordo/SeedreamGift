import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class CreateNoticeDto {
  @ApiProperty({ description: '공지사항 제목' })
  @IsString()
  @MaxLength(100, { message: '제목은 100자 이하로 입력해주세요.' })
  title: string;

  @ApiProperty({ description: '공지사항 내용 (HTML/Text)' })
  @IsString()
  @MaxLength(10000, { message: '내용은 10,000자 이하로 입력해주세요.' })
  content: string;

  @ApiPropertyOptional({ description: '활성화 여부', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateNoticeDto extends PartialType(CreateNoticeDto) {}
