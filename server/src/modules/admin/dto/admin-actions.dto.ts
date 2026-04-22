import { ApiProperty } from '@nestjs/swagger';

import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  KYC_STATUS,
  TRADEIN_STATUS,
  USER_ROLE,
  ORDER_STATUS,
} from '../../../shared/constants/statuses';
import type {
  KycStatus,
  TradeInStatus,
  UserRole,
  OrderStatus,
} from '../../../shared/constants/statuses';

export class UpdateKycStatusDto {
  @ApiProperty({
    enum: Object.values(KYC_STATUS),
    description: '변경할 KYC 상태',
  })
  @IsIn(Object.values(KYC_STATUS))
  status: KycStatus;
}

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: Object.values(USER_ROLE),
    description: '변경할 사용자 역할',
  })
  @IsIn(Object.values(USER_ROLE))
  role: UserRole;
}

export class UpdateTradeInStatusDto {
  @ApiProperty({
    enum: Object.values(TRADEIN_STATUS),
    description: '변경할 매입 상태',
  })
  @IsIn(Object.values(TRADEIN_STATUS))
  status: TradeInStatus;

  @ApiProperty({
    required: false,
    description: '거절 사유 (REJECTED 시 필수 권장)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: '새 비밀번호 (8자 이상, 영문/숫자/특수문자 포함)',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/, {
    message:
      '비밀번호는 8자 이상, 영문/숫자/특수문자를 각각 1개 이상 포함해야 합니다.',
  })
  password: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: Object.values(ORDER_STATUS),
    description: '변경할 주문 상태',
  })
  @IsIn(Object.values(ORDER_STATUS))
  status: OrderStatus;
}
