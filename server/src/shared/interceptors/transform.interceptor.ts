/**
 * @file transform.interceptor.ts
 * @description 전역 응답 변환 인터셉터 - 일관된 성공 응답 포맷 제공
 * @module shared/interceptors
 *
 * 기능:
 * - 모든 성공 응답을 표준화된 포맷으로 래핑
 * - 응답 시간 측정 및 헤더 추가
 *
 * 응답 포맷:
 * {
 *   success: true,
 *   data: <원본 응답>,
 *   timestamp: string
 * }
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 표준화된 API 응답 인터페이스
 */
export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  data: T;
  timestamp: string;
  traceId?: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const traceId = request['traceId'] as string;

    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // 응답 시간 헤더 추가
        response.setHeader('X-Response-Time', `${duration}ms`);

        return {
          success: true as const,
          statusCode,
          data,
          timestamp: new Date().toISOString(),
          traceId,
        };
      }),
    );
  }
}
