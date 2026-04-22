import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * KCB PASS 인증 완료 확인 요청 DTO
 * 클라이언트가 폴링으로 success 감지 후, 결과 데이터와 함께 백엔드에 전달
 */
export class KcbCompleteDto {
  /** KCB 인증 고유 ID (startKcbAuth에서 생성된 UUID) */
  @IsString()
  @IsNotEmpty({ message: 'kcbAuthId를 입력해주세요.' })
  kcbAuthId: string;

  /** 인증된 이름 (RSLT_NAME) */
  @IsOptional()
  @IsString()
  name?: string;

  /** 전화번호 (TEL_NO) */
  @IsOptional()
  @IsString()
  phone?: string;

  /** CI 값 */
  @IsOptional()
  @IsString()
  ci?: string;

  /** 생년월일 (RSLT_BIRTHDAY) */
  @IsOptional()
  @IsString()
  birth?: string;

  /** 성별 코드 (RSLT_SEX_CD) */
  @IsOptional()
  @IsString()
  gender?: string;

  /** 내/외국인 코드 (RSLT_NTV_FRNR_CD) */
  @IsOptional()
  @IsString()
  nationality?: string;

  /** 통신사 (TELECOM) */
  @IsOptional()
  @IsString()
  telco?: string;
}
