/**
 * @file audit.interceptor.ts
 * @description 감사 로그 인터셉터 - 중요 변경 요청 자동 기록
 * @module shared/interceptors
 *
 * 기능:
 * - POST, PATCH, DELETE, PUT 요청 자동 로깅
 * - 민감 정보 마스킹 처리 (비밀번호, PIN 등)
 * - 요청자 정보 (IP, User Agent, 사용자 ID) 기록
 * - 비동기 로깅으로 응답 속도에 영향 최소화
 *
 * 마스킹 대상:
 * - password, pinCode, accountNumber, cardNumber, cvv
 * - token, refreshToken, accessToken, secret, apiKey
 *
 * 사용처:
 * - main.ts: APP_INTERCEPTOR로 글로벌 등록
 * - 관리자 대시보드에서 감사 로그 조회 시 활용
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';

import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AuditService } from '../audit/audit.service';

/**
 * 민감 정보 마스킹 대상 필드
 *
 * 감사 로그에 평문으로 저장되면 안 되는 필드 목록.
 * 대소문자 구분 없이 필드명에 포함되면 마스킹 처리됨.
 */
/**
 * 민감 정보 조회 시에도 감사 기록이 필요한 GET 경로 패턴
 * 사용자 개인정보, PIN 복호화 등 민감 데이터 접근 추적
 */
const SENSITIVE_GET_PATTERNS = [
  /^\/api\/admin\/users\/\d+$/, // 사용자 상세 조회 (kycData 포함)
  /^\/api\/admin\/vouchers\/\d+$/, // 바우처 상세 조회 (PIN 복호화)
  /^\/api\/admin\/trade-ins\/\d+$/, // 매입 상세 조회 (PIN/계좌 복호화)
];

const SENSITIVE_FIELDS = [
  'password',
  'pinCode',
  'pin',
  'accountNumber',
  'accountNum',
  'bankAccount',
  'cardNumber',
  'cvv',
  'token',
  'refreshToken',
  'accessToken',
  'secret',
  'apiKey',
  'securityCode',
  'giftNumber',
  'encryptionKey',
];

/**
 * 감사 로그 인터셉터
 *
 * 중요 변경 요청(POST, PATCH, DELETE, PUT)을 자동으로 감사 로그에 기록합니다.
 * 민감 정보는 마스킹 처리되어 저장됩니다.
 *
 * @example
 * // 로그 예시
 * {
 *   userId: 1,
 *   action: 'POST /api/orders',
 *   resource: 'orders',
 *   newValue: { amount: 50000, pin: '[MASKED:16chars]' }
 * }
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  constructor(private readonly auditService: AuditService) {}

  /**
   * 민감 정보 마스킹 처리
   * @param obj 원본 객체
   * @returns 민감 정보가 마스킹된 객체 복사본
   */
  private sanitizeBody(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeBody(item));
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_FIELDS.some((field) =>
        lowerKey.includes(field.toLowerCase()),
      );

      if (isSensitive) {
        // 민감 정보는 길이만 표시하고 마스킹
        const valueStr =
          typeof value === 'string' ? value : JSON.stringify(value ?? '');
        sanitized[key] = `[MASKED:${valueStr.length}chars]`;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeBody(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * 요청 인터셉트 및 감사 로그 기록
   *
   * @param context - 실행 컨텍스트 (요청/응답 정보)
   * @param next - 다음 핸들러 호출
   * @returns Observable - 응답 스트림
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, body } = request;
    const user = request.user;
    const userAgent = request.get('user-agent');
    const traceId = request['traceId'];

    // 변경 요청 (POST, PATCH, DELETE, PUT) + 민감 GET 경로 감사 기록
    const isMutating = ['POST', 'PATCH', 'DELETE', 'PUT'].includes(method);
    const isSensitiveGet =
      method === 'GET' &&
      SENSITIVE_GET_PATTERNS.some((pattern) => pattern.test(url));

    if (isMutating || isSensitiveGet) {
      return next.handle().pipe(
        tap((data) => {
          // 비동기로 감사 로그 기록 (응답 속도에 영향 최소화)
          // 보안: 민감 정보 마스킹 처리
          // fire-and-forget 패턴: 에러를 조용히 무시
          void this.auditService
            .log({
              userId: user?.id,
              action: `${method} ${url}`,
              resource: this.extractResource(url),
              resourceId: this.extractResourceId(url, data),
              method,
              newValue: isMutating
                ? {
                    ...this.sanitizeBody(body),
                    _traceId: traceId,
                  }
                : { _traceId: traceId, _type: 'SENSITIVE_READ' },
              ip,
              userAgent,
            })
            .catch(() => {
              // 감사 로그 실패는 무시 (메인 응답에 영향 없음)
            });
        }),
      );
    }

    return next.handle();
  }

  /**
   * URL에서 리소스 이름 추출
   *
   * @param url - 요청 URL (예: /api/products/1)
   * @returns 리소스 이름 (예: products)
   */
  private extractResource(url: string): string {
    const parts = url.split('/');
    // /api/products/1 -> products
    return parts[2] || 'unknown';
  }

  /**
   * URL 또는 응답에서 리소스 ID 추출
   *
   * @param url - 요청 URL
   * @param responseData - 응답 데이터
   * @returns 리소스 ID (있는 경우)
   */
  private extractResourceId(
    url: string,
    responseData: any,
  ): string | undefined {
    // URL에서 ID 추출 시도
    const parts = url.split('/');
    if (parts[3] && !isNaN(Number(parts[3]))) {
      return parts[3];
    }
    // 생성 응답에서 ID 추출 시도
    return responseData?.id?.toString() || responseData?.data?.id?.toString();
  }
}
