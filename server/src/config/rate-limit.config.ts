/**
 * @file rate-limit.config.ts
 * @description Rate Limit 설정
 * @module config
 *
 * 환경변수:
 * - RATE_LIMIT_TTL: Rate limit 시간 윈도우 (ms, 기본: 60000)
 * - RATE_LIMIT_MAX: 시간 윈도우 내 최대 요청 수 (기본: 100)
 */
import { registerAs } from '@nestjs/config';

export interface RateLimitConfig {
  ttl: number;
  limit: number;
}

export default registerAs('rateLimit', (): RateLimitConfig => {
  let ttl = parseInt(process.env.RATE_LIMIT_TTL || '60000', 10);
  // 1000 미만이면 초 단위로 입력한 것으로 간주 → 밀리초로 변환
  if (ttl > 0 && ttl < 1000) ttl = ttl * 1000;
  return {
    ttl,
    limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  };
});
