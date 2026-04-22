/**
 * @file jwt-auth.guard.ts
 * @description JWT 인증 가드 - Passport JWT 전략 래퍼
 * @module shared/auth
 *
 * 사용법:
 * @UseGuards(JwtAuthGuard) 또는 @UseGuards(AuthGuard('jwt'))
 *
 * 동작:
 * - Authorization 헤더의 Bearer 토큰 검증
 * - 검증 성공 시 request.user에 사용자 정보 주입
 * - 실패 시 401 Unauthorized 응답
 */
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT 인증 가드
 *
 * AuthGuard('jwt')의 Injectable 래퍼
 * JwtStrategy를 사용하여 토큰 검증 수행
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
