/**
 * @file decimal-serializer.interceptor.ts
 * @description Prisma Decimal → JavaScript number 변환 인터셉터
 * @module shared/interceptors
 *
 * 문제:
 * - MSSQL + Prisma는 Decimal 필드를 Prisma.Decimal 객체로 반환
 * - JSON.stringify 시 문자열(e.g., "100000")로 직렬화되어 FE에서 혼란 발생
 *
 * 해결:
 * - 모든 응답에서 Decimal 객체를 JavaScript number로 변환
 * - Duck typing 사용 (toNumber 메서드 존재 여부로 판별)
 * - Prisma 내부 모듈 직접 import 회피 (버전 호환성)
 *
 * 순서:
 * - DecimalSerializerInterceptor → TransformInterceptor
 * - Decimal 변환 후 success envelope 래핑
 *
 * 사용처:
 * - main.ts: APP_INTERCEPTOR로 글로벌 등록 (모든 API 응답에 자동 적용)
 * - Product, Order, TradeIn 등 Decimal 컬럼(price, discountRate 등)을 가진 모든 모듈
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
 * Prisma Decimal 객체인지 duck typing으로 판별
 *
 * Prisma Decimal은 다음 특성을 가짐:
 * - toNumber() 메서드 존재
 * - toString() 결과가 숫자 문자열
 * - Date가 아님 (Date도 toNumber는 없지만 안전하게 제외)
 *
 * Prisma 7.x with MSSQL adapter의 Decimal 객체는 decimal.js 형식:
 * - {s: sign, e: exponent, d: digits[]} 형태로 직렬화됨
 */
function isPrismaDecimal(value: unknown): boolean {
  if (
    value === null ||
    value === undefined ||
    typeof value !== 'object' ||
    value instanceof Date ||
    Array.isArray(value)
  ) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // 방법 1: toNumber 메서드 존재 (Prisma Decimal 클래스 인스턴스)
  if (
    typeof obj.toNumber === 'function' &&
    typeof obj.toString === 'function' &&
    (obj.constructor?.name === 'Decimal' ||
      obj.constructor?.name === 'PrismaDecimal')
  ) {
    return true;
  }

  // 방법 2: decimal.js 내부 형식 {s, e, d} (Prisma 7.x MSSQL adapter)
  if (
    's' in obj &&
    'e' in obj &&
    'd' in obj &&
    typeof obj.s === 'number' &&
    typeof obj.e === 'number' &&
    Array.isArray(obj.d)
  ) {
    return true;
  }

  return false;
}

/**
 * 객체를 재귀적으로 순회하며 Prisma Decimal을 number로 변환
 *
 * 처리 대상:
 * - null / undefined → 그대로 반환
 * - Prisma Decimal → toNumber()
 * - Array → 각 요소 재귀 처리
 * - Date → 그대로 반환 (변환하지 않음)
 * - plain Object → 각 key-value 재귀 처리
 * - 기타 primitive → 그대로 반환
 */
/**
 * decimal.js 내부 형식 {s, e, d}를 number로 변환
 * s: sign (1 또는 -1)
 * e: exponent
 * d: digits 배열
 */
function decimalJsToNumber(obj: { s: number; e: number; d: number[] }): number {
  const sign = obj.s;
  const exponent = obj.e;
  const digits = obj.d;

  // digits 배열을 숫자로 결합
  let numStr = digits.join('');

  // 소수점 위치 계산
  const decimalPlace = exponent + 1;
  if (decimalPlace <= 0) {
    numStr = '0.' + '0'.repeat(-decimalPlace) + numStr;
  } else if (decimalPlace < numStr.length) {
    numStr = numStr.slice(0, decimalPlace) + '.' + numStr.slice(decimalPlace);
  } else {
    numStr = numStr + '0'.repeat(decimalPlace - numStr.length);
  }

  return sign * parseFloat(numStr);
}

function serializeDecimals(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Prisma Decimal 감지 → number 변환
  if (isPrismaDecimal(obj)) {
    const decimal = obj as Record<string, unknown>;

    // 방법 1: toNumber 메서드 사용
    if (typeof decimal.toNumber === 'function') {
      return (decimal as any).toNumber();
    }

    // 방법 2: decimal.js 내부 형식 변환
    if ('s' in decimal && 'e' in decimal && 'd' in decimal) {
      return decimalJsToNumber(
        decimal as unknown as { s: number; e: number; d: number[] },
      );
    }

    return obj;
  }

  // Date 객체는 변환하지 않음
  if (obj instanceof Date) {
    return obj;
  }

  // 배열 재귀 처리
  if (Array.isArray(obj)) {
    return obj.map(serializeDecimals);
  }

  // plain object 재귀 처리
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDecimals(value);
    }
    return result;
  }

  // primitive (string, number, boolean) → 그대로
  return obj;
}

@Injectable()
export class DecimalSerializerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => serializeDecimals(data)));
  }
}
