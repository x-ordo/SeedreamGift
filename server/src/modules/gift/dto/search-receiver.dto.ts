import { ApiProperty } from '@nestjs/swagger';

import { IsString, MinLength, MaxLength } from 'class-validator';

export class SearchReceiverDto {
  @ApiProperty({
    description: '이메일 검색어 (최소 3자)',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  query: string;
}
