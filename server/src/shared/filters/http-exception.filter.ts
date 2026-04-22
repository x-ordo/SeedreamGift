/**
 * @file http-exception.filter.ts
 * @description 전역 HTTP 예외 필터 - 일관된 에러 응답 포맷 제공
 * @module shared/filters
 *
 * 기능:
 * - 모든 HTTP 예외를 캐치하여 표준화된 포맷으로 변환
 * - 한국어 에러 메시지 매핑
 * - 개발/프로덕션 환경별 상세 정보 노출 제어
 * - 에러 로깅
 *
 * 응답 포맷:
 * {
 *   success: false,
 *   error: {
 *     statusCode: number,
 *     message: string,
 *     code: string,
 *     timestamp: string,
 *     path: string,
 *     details?: any (개발 환경에서만)
 *   }
 * }
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';

import { Request, Response } from 'express';

import { GENERAL_ERRORS, AUTH_ERRORS } from '../constants/errors';
import { TelegramAlertService } from '../notifications/telegram-alert.service';
import { Prisma } from '../prisma/generated/client';

/**
 * 에러 응답 인터페이스
 */
interface ErrorResponse {
  success: false;
  error: {
    statusCode: number;
    message: string;
    code: string;
    timestamp: string;
    path: string;
    details?: any;
    traceId?: string;
  };
}

/**
 * HTTP 상태 코드별 기본 한국어 메시지 매핑
 */
const STATUS_MESSAGE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: GENERAL_ERRORS.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: AUTH_ERRORS.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: AUTH_ERRORS.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: GENERAL_ERRORS.NOT_FOUND,
  [HttpStatus.TOO_MANY_REQUESTS]:
    '요청 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: GENERAL_ERRORS.INTERNAL_ERROR,
  [HttpStatus.SERVICE_UNAVAILABLE]: '서비스를 일시적으로 사용할 수 없습니다.',
};

/**
 * HTTP 상태 코드별 에러 코드 매핑
 */
const STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(
    @Optional()
    @Inject(TelegramAlertService)
    private readonly telegramAlert?: TelegramAlertService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 상태 코드 및 메시지 추출
    const { statusCode, message, details } = this.extractErrorInfo(exception);

    // 에러 코드 결정
    const code = STATUS_CODE_MAP[statusCode] || 'UNKNOWN_ERROR';

    // 에러 응답 구성
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        statusCode,
        message,
        code,
        timestamp: new Date().toISOString(),
        path: request.url,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        traceId: (request as any).traceId,
      },
    };

    // 개발 환경에서만 상세 정보 포함
    if (!this.isProduction && details) {
      errorResponse.error.details = details;
    }

    // 에러 로깅
    this.logError(exception, request, statusCode, message);

    // 응답 전송
    response.status(statusCode).json(errorResponse);
  }

  /**
   * 예외에서 상태 코드, 메시지, 상세 정보 추출
   */
  private extractErrorInfo(exception: unknown): {
    statusCode: number;
    message: string;
    details?: any;
  } {
    // Prisma 예외 처리
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // TypeScript가 instanceof 체크 후에도 타입을 좁히지 못하는 경우를 위해 강제 형변환
      const prismaError = exception;

      if (prismaError.code === 'P2002') {
        const meta = prismaError.meta;
        const target = (meta?.target as string[])?.join(', ');
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `이미 존재하는 데이터입니다. (${target})`,
          details: meta,
        };
      }
      if (prismaError.code === 'P2025') {
        const meta = prismaError.meta;
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: '데이터를 찾을 수 없습니다.',
          details: meta,
        };
      }
    }

    // HttpException 처리
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let details: any;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as any;
        // class-validator 에러 메시지 처리
        if (Array.isArray(res.message)) {
          message = res.message[0]; // 첫 번째 에러 메시지
          details = res.message; // 전체 에러 목록
        } else {
          message = res.message || res.error || STATUS_MESSAGE_MAP[statusCode];
        }
      } else {
        message =
          STATUS_MESSAGE_MAP[statusCode] || GENERAL_ERRORS.INTERNAL_ERROR;
      }

      return { statusCode, message, details };
    }

    // 일반 Error 처리
    if (exception instanceof Error) {
      this.logger.error(
        `Unhandled Error: ${exception.message}`,
        exception.stack,
      );
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: this.isProduction
          ? GENERAL_ERRORS.INTERNAL_ERROR
          : exception.message,
        details: this.isProduction ? undefined : exception.stack,
      };
    }

    // 알 수 없는 예외
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: GENERAL_ERRORS.INTERNAL_ERROR,
    };
  }

  /**
   * 에러 로깅
   */
  private logError(
    exception: unknown,
    request: Request,
    statusCode: number,
    message: string,
  ): void {
    const logData = {
      statusCode,
      message,
      path: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: (request as any).user?.id,
    };

    // 5xx 에러는 error 레벨, 4xx는 warn 레벨
    if (statusCode >= 500) {
      this.logger.error(JSON.stringify(logData), (exception as Error)?.stack);

      // Telegram 알림 전송 (fire-and-forget)
      this.telegramAlert?.sendAlert({
        method: request.method,
        path: request.url,
        statusCode,
        message,
        traceId: (request as any).traceId,
      });
    } else if (statusCode >= 400) {
      this.logger.warn(JSON.stringify(logData));
    }
  }
}
