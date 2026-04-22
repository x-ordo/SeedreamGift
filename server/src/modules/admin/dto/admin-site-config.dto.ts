import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsString } from 'class-validator';

/**
 * 관리자용 사이트 설정 변경 DTO
 */
export class AdminUpdateSiteConfigDto {
  @ApiProperty({ example: 'true', description: '설정 값' })
  @IsNotEmpty()
  @IsString()
  value: string;
}
