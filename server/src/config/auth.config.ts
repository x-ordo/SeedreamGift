/**
 * @file auth.config.ts
 * @description 인증 관련 설정 (JWT, bcrypt)
 * @module config
 *
 * 환경변수:
 * - JWT_ACCESS_EXPIRY: Access 토큰 만료 시간 (기본: '10m')
 * - SESSION_DURATION_MINUTES: 세션 절대 만료 시간 (기본: 60) — 로그인 후 이 시간이 지나면 재로그인 필요
 * - BCRYPT_SALT_ROUNDS: bcrypt 해싱 라운드 (기본: 10)
 * - JWT_ISSUER: JWT 토큰 issuer (기본: 'w-gift')
 * - JWT_AUDIENCE: JWT 토큰 audience (기본: 'w-gift-client')
 * - MAX_REFRESH_TOKENS_PER_USER: 사용자당 최대 리프레시 토큰 수 (기본: 5)
 * - PASSWORD_RESET_EXPIRY_HOURS: 비밀번호 재설정 토큰 유효 시간 (기본: 1)
 * - KYC_VERIFY_WINDOW_MINUTES: KYC 인증 유효 시간 (기본: 10)
 */
import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  jwt: {
    accessExpiry: string;
    sessionDurationMinutes: number;
    issuer: string;
    audience: string;
  };
  bcrypt: {
    saltRounds: number;
  };
  maxRefreshTokensPerUser: number;
  passwordResetExpiryHours: number;
  kycWindowMinutes: number;
}

export default registerAs(
  'auth',
  (): AuthConfig => ({
    jwt: {
      accessExpiry: process.env.JWT_ACCESS_EXPIRY || '10m',
      sessionDurationMinutes: parseInt(
        process.env.SESSION_DURATION_MINUTES || '60',
        10,
      ),
      issuer: process.env.JWT_ISSUER || 'w-gift',
      audience: process.env.JWT_AUDIENCE || 'w-gift-client',
    },
    bcrypt: {
      saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
    },
    maxRefreshTokensPerUser: parseInt(
      process.env.MAX_REFRESH_TOKENS_PER_USER || '5',
      10,
    ),
    passwordResetExpiryHours: parseInt(
      process.env.PASSWORD_RESET_EXPIRY_HOURS || '1',
      10,
    ),
    kycWindowMinutes: parseInt(
      process.env.KYC_VERIFY_WINDOW_MINUTES || '10',
      10,
    ),
  }),
);
