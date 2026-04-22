/**
 * @file user-throttle.guard.ts
 * @description JWT 인증 사용자의 경우 IP 대신 userId를 키로 사용하는 Rate Limiter.
 * 미인증 요청은 기존 IP 기반 제한을 유지합니다.
 *
 * 효과: 공유 IP(기업 프록시)에서 다수 사용자가 각각 독립적으로 rate limit 적용
 */
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // JWT 인증된 사용자는 userId 기반, 그 외 IP 기반
    const user = req.user;
    if (user?.id) {
      return `user-${user.id}`;
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }
}
