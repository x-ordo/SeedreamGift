import { IsInt, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateRefundDto {
  @IsInt()
  orderId: number;

  @IsString()
  @MaxLength(200)
  reason: string;
}

export class ProcessRefundDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  adminNote?: string;
}
