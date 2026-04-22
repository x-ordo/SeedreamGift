/**
 * @file logger.middleware.ts
 * @description HTTP 요청 로깅 미들웨어 - 모든 요청/응답 기록
 * @module shared/middleware
 *
 * 기록 정보:
 * - 타임스탬프, HTTP 메서드, URL
 * - 상태 코드, 응답 시간
 * - Refresh Token 존재 여부
 * - Origin, User-Agent, IP
 *
 * 출력:
 * - 콘솔: 간략 로그 (NestJS Logger)
 * - 파일: 상세 로그 (logs/app.log)
 *
 * 사용처:
 * - app.module.ts: 전역 미들웨어로 등록
 */
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';

import { Request, Response, NextFunction } from 'express';

/**
 * HTTP 요청 로깅 미들웨어
 *
 * 모든 HTTP 요청을 콘솔과 파일에 기록합니다.
 * 응답 완료 시점(res.on('finish'))에 로그를 남깁니다.
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  /**
   * [의도] 전역 요청/응답 로깅 (Audit Log)
   * - 콘솔 출력 및 파일 기록을 병행하여 사후 분석 지원
   */
  use(req: Request, res: Response, next: NextFunction) {
    const { ip, method, originalUrl } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();
    const traceId = req.traceId;

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const hasRt = req.cookies?.['refresh_token'] ? 'YES' : 'NO';

      // Winston이 콘솔 + 파일 로깅을 모두 처리 (DailyRotateFile)
      this.logger.log(
        `[${traceId}] ${method} ${originalUrl} ${statusCode} ${duration}ms - RT:${hasRt}`,
      );
    });

    next();
  }
}
