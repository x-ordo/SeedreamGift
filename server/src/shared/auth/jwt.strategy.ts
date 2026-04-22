/**
 * @file jwt.strategy.ts
 * @description JWT 인증 전략 - Passport JWT 전략 구현
 * @module shared/auth
 *
 * 기능:
 * - Authorization 헤더에서 Bearer 토큰 추출
 * - JWT 서명 검증 및 페이로드 파싱
 * - 사용자 존재 여부 확인 후 request.user에 주입
 *
 * 사용:
 * - @UseGuards(AuthGuard('jwt')) 데코레이터로 보호
 * - 인증 성공 시 request.user에 사용자 정보 포함
 */
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import type { IUserAuthRepository } from './interfaces/user-auth.repository';
import { USER_AUTH_REPOSITORY } from './interfaces/user-auth.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userAuthRepository: IUserAuthRepository,
    @Inject(ConfigService) configService: ConfigService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    super({
      // Authorization: Bearer <token> 형식에서 토큰 추출
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 만료된 토큰 거부
      ignoreExpiration: false,
      // 서명 검증용 비밀 키 (환경 변수 필수)
      secretOrKey: jwtSecret,
      // 알고리즘 혼동 공격 방지 (HS256만 허용)
      algorithms: ['HS256'],
      // issuer/audience 검증
      issuer: configService.get<string>('auth.jwt.issuer', 'w-gift'),
      audience: configService.get<string>('auth.jwt.audience', 'w-gift-client'),
    });
  }

  /**
   * JWT 페이로드 검증 및 사용자 조회
   *
   * Passport가 JWT 검증 후 이 메서드 호출
   * 반환값이 request.user에 주입됨
   *
   * @param payload - 디코딩된 JWT 페이로드 { email, sub(userId), role }
   * @returns 비밀번호 제외한 사용자 정보
   * @throws UnauthorizedException - 사용자가 존재하지 않을 경우
   */
  async validate(payload: any) {
    // payload 구조: { email: '...', sub: 1, role: 'USER' }
    const user = await this.userAuthRepository.findById(payload.sub);

    // 토큰은 유효하지만 사용자가 삭제된 경우
    if (!user) {
      throw new UnauthorizedException();
    }

    // 계정 잠금 상태 확인 — 잠금 중인 계정의 기존 JWT도 차단
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('계정이 잠금 상태입니다.');
    }

    // 비밀번호 제외 후 반환 (보안)
    const { password, ...result } = user;
    return result;
  }
}
