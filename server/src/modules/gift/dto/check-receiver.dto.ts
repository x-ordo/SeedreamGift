import { ApiProperty } from '@nestjs/swagger';

import { IsEmail, IsNotEmpty } from 'class-validator';

export class CheckReceiverDto {
  @ApiProperty({ description: '수신자 이메일' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
