/**
 * @file etag.interceptor.ts
 * @description ETag Interceptor - GET 요청에 대해 ETag 헤더를 생성하고
 * If-None-Match 요청 시 304 Not Modified를 반환합니다.
 *
 * 변경되지 않은 데이터에 대해 bandwidth를 절약합니다.
 */
import { createHash } from 'crypto';

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';

import type { Request, Response } from 'express';
import { Observable, map } from 'rxjs';

@Injectable()
export class EtagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only apply to GET requests
    if (request.method !== 'GET') return next.handle();

    return next.handle().pipe(
      map((data) => {
        if (!data) return data;

        // Generate ETag from response body
        const body = JSON.stringify(data);
        const etag = `"${createHash('md5').update(body).digest('hex')}"`;

        response.setHeader('ETag', etag);

        // Check If-None-Match
        const ifNoneMatch = request.headers['if-none-match'];
        if (ifNoneMatch === etag) {
          response.status(304);
          return undefined;
        }

        return data;
      }),
    );
  }
}
