/**
 * @file base-response.dto.ts
 * @description 기본 API 응답 DTO - Swagger 문서용 응답 스키마
 * @module shared/common
 *
 * 포함 클래스:
 * - BaseResponseDto<T>: 성공 응답 스키마
 * - ErrorResponseDto: 에러 응답 스키마
 *
 * 사용처:
 * - Swagger 문서 생성 시 응답 타입 정의
 * - @ApiResponse() 데코레이터와 함께 사용
 */
import { ApiProperty } from '@nestjs/swagger';

/**
 * 성공 응답 DTO
 *
 * 모든 성공 API 응답의 표준 형식입니다.
 * TransformInterceptor에서 자동으로 래핑됩니다.
 *
 * @template T - 응답 데이터 타입
 */
export class BaseResponseDto<T> {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '응답 데이터' })
  data: T;

  @ApiProperty({
    description: '응답 시간',
    example: '2026-02-03T00:00:00.000Z',
  })
  timestamp: string;
}

/**
 * 에러 응답 DTO
 *
 * 모든 에러 API 응답의 표준 형식입니다.
 * HttpExceptionFilter에서 생성됩니다.
 */
export class ErrorResponseDto {
  @ApiProperty({ description: '성공 여부', example: false })
  success: boolean;

  @ApiProperty({
    description: '에러 상세 정보',
    example: {
      statusCode: 400,
      message: '잘못된 요청입니다.',
      code: 'BAD_REQUEST',
      timestamp: '2026-02-03T00:00:00.000Z',
      path: '/api/resource',
    },
  })
  error: {
    statusCode: number;
    message: string;
    code: string;
    timestamp: string;
    path: string;
    details?: any;
  };
}
