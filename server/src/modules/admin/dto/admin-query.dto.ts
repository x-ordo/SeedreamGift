import { IsOptional, IsString, IsNumberString } from 'class-validator';

import { PaginationQueryDto } from '../../../base/pagination.dto';

export class AdminUsersQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() kycStatus?: string;
  @IsOptional() @IsString() role?: string;
}

export class AdminVouchersQueryDto extends PaginationQueryDto {
  @IsOptional() @IsNumberString() productId?: string;
  @IsOptional() @IsString() status?: string;
}

export class AdminStatusFilterQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() status?: string;
}

export class AdminOrdersQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
}

export class AdminTradeInsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() brandCode?: string;
}

export class AdminGiftsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
}

export class AdminInquiriesQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() category?: string;
}

export class AdminAuditLogsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() resource?: string;
  @IsOptional() @IsNumberString() userId?: string;
}
