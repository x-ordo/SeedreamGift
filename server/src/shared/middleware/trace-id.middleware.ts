import { randomUUID } from 'crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';

import { Request, Response, NextFunction } from 'express';

declare module 'express' {
  interface Request {
    traceId?: string;
  }
}

/**
 * Trace ID 미들웨어
 * 모든 요청에 고유한 ID를 부여하여 로그 추적을 용이하게 합니다.
 */
@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 요청 헤더에 x-trace-id가 있으면 사용하고, 없으면 생성
    const traceId = (req.headers['x-trace-id'] as string) || randomUUID();

    // 요청 객체에 저장 (다른 미들웨어/인터셉터에서 접근 가능)
    req.traceId = traceId;

    // 응답 헤더에도 포함
    res.setHeader('x-trace-id', traceId);

    next();
  }
}
