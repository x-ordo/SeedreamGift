import { IsOptional, IsIn } from 'class-validator';

export class TransactionExportQueryDto {
  /** PIN 표시 옵션: full(전체), masked(앞4자리), none(제외) */
  @IsOptional()
  @IsIn(['full', 'masked', 'none'])
  pinOption?: 'full' | 'masked' | 'none';

  /** 거래 유형 필터: ALL(전체), SALE(판매), PURCHASE(매입) */
  @IsOptional()
  @IsIn(['ALL', 'SALE', 'PURCHASE'])
  type?: 'ALL' | 'SALE' | 'PURCHASE';
}
