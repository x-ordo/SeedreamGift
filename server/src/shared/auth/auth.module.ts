/**
 * @file auth.module.ts
 * @description 인증 모듈 - 회원가입, 로그인, JWT 토큰 관리
 * @module shared/auth
 *
 * 포함 기능:
 * - 회원가입 (비밀번호 bcrypt 해싱)
 * - 로그인 (JWT 토큰 발급)
 * - JWT 전략 (토큰 검증)
 *
 * 의존 모듈:
 * - UsersModule: 사용자 조회/생성 (IUserAuthRepository 인터페이스)
 * - PassportModule: 인증 전략 프레임워크
 * - JwtModule: JWT 토큰 생성/검증
 * - ConfigModule: 환경 변수 관리
 *
 * 환경변수:
 * - JWT_ACCESS_EXPIRY: Access 토큰 만료 시간 (기본: '10m')
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import type { StringValue } from 'ms';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { MfaService } from './mfa.service';
import { PasswordModule } from './password.module';
import { TokenCleanupService } from './token-cleanup.service';
import { UsersModule } from '../../modules/users/users.module';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    PasswordModule,
    CryptoModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        const accessExpiry = configService.get<string>(
          'auth.jwt.accessExpiry',
          '10m',
        );
        return {
          secret,
          signOptions: {
            expiresIn: accessExpiry as StringValue,
            issuer: configService.get<string>('auth.jwt.issuer', 'w-gift'),
            audience: configService.get<string>(
              'auth.jwt.audience',
              'w-gift-client',
            ),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, MfaService, JwtStrategy, TokenCleanupService],
  exports: [AuthService, MfaService],
})
export class AuthModule {}
