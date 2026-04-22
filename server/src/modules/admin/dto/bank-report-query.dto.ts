import { IsDateString, IsOptional, IsString, IsIn } from 'class-validator';

export class BankReportQueryDto {
  /** 조회 시작일 (ISO 8601) */
  @IsDateString()
  startDate: string;

  /** 조회 종료일 (ISO 8601) */
  @IsDateString()
  endDate: string;

  /** 거래 유형 필터 */
  @IsOptional()
  @IsIn(['SALE', 'PURCHASE', 'ALL'])
  type?: 'SALE' | 'PURCHASE' | 'ALL';

  /** 거래 상태 필터 (쉼표 구분) */
  @IsOptional()
  @IsString()
  status?: string;

  /** PIN 표시 옵션: full(전체), masked(앞4자리), none(제외) */
  @IsOptional()
  @IsIn(['full', 'masked', 'none'])
  pinOption?: 'full' | 'masked' | 'none';
}
