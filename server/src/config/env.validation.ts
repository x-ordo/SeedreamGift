/**
 * @file env.validation.ts
 * @description 환경변수 유효성 검사 스키마 (Joi)
 * @module config
 *
 * 필수 환경변수:
 * - DATABASE_URL: MSSQL 연결 문자열
 * - JWT_SECRET: JWT 서명 키
 * - ENCRYPTION_KEY: AES-256 암호화 키
 *
 * 선택 환경변수:
 * - 인증, Rate Limit, 페이지네이션 관련 설정 (기본값 제공)
 */
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // 필수 환경변수
  DATABASE_URL: Joi.string().required().description('MSSQL connection string'),
  JWT_SECRET: Joi.string().required().description('JWT signing secret'),
  ENCRYPTION_KEY: Joi.string().required().description('AES-256 encryption key'),

  // 서버 설정
  PORT: Joi.number().default(5140).description('Server port'),

  // 인증 설정
  JWT_ACCESS_EXPIRY: Joi.string()
    .default('10m')
    .description('JWT access token expiry (e.g., 10m, 15m, 1h)'),
  SESSION_DURATION_MINUTES: Joi.number()
    .integer()
    .min(5)
    .max(1440)
    .default(60)
    .description(
      'Absolute session duration in minutes (no extension on refresh)',
    ),
  BCRYPT_SALT_ROUNDS: Joi.number()
    .integer()
    .min(8)
    .max(14)
    .default(12)
    .description('bcrypt salt rounds (higher = slower but more secure)'),

  // Rate Limit 설정
  RATE_LIMIT_TTL: Joi.number()
    .integer()
    .min(1)
    .default(60000)
    .description(
      'Rate limit time window in milliseconds (values < 1000 auto-converted from seconds)',
    ),
  RATE_LIMIT_MAX: Joi.number()
    .integer()
    .min(1)
    .default(100)
    .description('Maximum requests per time window'),

  // 페이지네이션 설정
  PAGINATION_DEFAULT: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .description('Default page size'),
  PAGINATION_MAX: Joi.number()
    .integer()
    .min(10)
    .max(500)
    .default(100)
    .description('Maximum page size'),

  // 프론트엔드/CORS 설정
  FRONTEND_URL: Joi.string()
    .uri()
    .optional()
    .description('Frontend URL for CORS'),
  COOKIE_SECURE: Joi.boolean().default(false).description('Secure cookie flag'),

  // 결제 설정
  PAYMENT_GATEWAY: Joi.string()
    .valid('mock', 'toss', 'inicis')
    .default('mock')
    .description('Payment gateway provider'),

  // Telegram 알림 설정 (선택)
  TELEGRAM_BOT_TOKEN: Joi.string()
    .optional()
    .description('Telegram Bot API token for error alerts'),
  TELEGRAM_CHAT_ID: Joi.string()
    .optional()
    .description('Telegram chat ID for error alerts'),

  // JWT 확장 설정
  JWT_ISSUER: Joi.string().default('w-gift').description('JWT token issuer'),
  JWT_AUDIENCE: Joi.string()
    .default('w-gift-client')
    .description('JWT token audience'),
  MAX_REFRESH_TOKENS_PER_USER: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(5)
    .description('Maximum refresh tokens per user'),
  PASSWORD_RESET_EXPIRY_HOURS: Joi.number()
    .integer()
    .min(1)
    .max(72)
    .default(1)
    .description('Password reset token expiry in hours'),
  KYC_VERIFY_WINDOW_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(60)
    .default(10)
    .description('KYC verification window in minutes'),

  // KYC (Coocon) API 설정
  COOCON_API_URL: Joi.string()
    .uri()
    .optional()
    .description('Coocon API base URL'),
  COOCON_API_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(60000)
    .default(10000)
    .description('Coocon API timeout in milliseconds'),
  COOCON_API_MAX_RETRIES: Joi.number()
    .integer()
    .min(0)
    .max(10)
    .default(3)
    .description('Coocon API max retries'),
  COOCON_API_RETRY_DELAY_MS: Joi.number()
    .integer()
    .min(100)
    .max(10000)
    .default(1000)
    .description('Coocon API retry delay in milliseconds'),

  // 캐시 설정
  CACHE_TTL_MS: Joi.number()
    .integer()
    .min(0)
    .default(300000)
    .description('Cache TTL in milliseconds'),
  CACHE_MAX_ENTRIES: Joi.number()
    .integer()
    .min(1)
    .default(100)
    .description('Maximum cache entries'),

  // 감사 로그 보관
  AUDIT_ARCHIVE_DAYS: Joi.number()
    .integer()
    .min(1)
    .default(90)
    .description('Days before audit logs are archived'),
  AUDIT_DELETE_DAYS: Joi.number()
    .integer()
    .min(1)
    .default(180)
    .description('Days before archived audit logs are deleted'),

  // CORS 추가 Origin
  ADDITIONAL_CORS_ORIGINS: Joi.string()
    .optional()
    .description('Additional CORS origins (comma-separated)'),
});
