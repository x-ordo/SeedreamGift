import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class TradeInPayoutQueryDto {
  /** 조회 시작일 (ISO 8601) */
  @IsDateString()
  startDate: string;

  /** 조회 종료일 (ISO 8601) */
  @IsDateString()
  endDate: string;

  /** 매입 상태 필터 */
  @IsOptional()
  @IsString()
  status?: string;

  /** 사용자 ID 필터 */
  @IsOptional()
  @IsString()
  userId?: string;

  /** 브랜드 코드 필터 */
  @IsOptional()
  @IsString()
  brandCode?: string;

  /** PIN 표시 옵션: full(전체), masked(앞4자리), none(제외) */
  @IsOptional()
  @IsIn(['full', 'masked', 'none'])
  pinOption?: 'full' | 'masked' | 'none';
}
