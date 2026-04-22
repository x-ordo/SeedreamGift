/**
 * @file roles.guard.ts
 * @description 역할 기반 접근 제어 (RBAC) 가드
 * @module shared/auth
 *
 * 역할 종류:
 * - USER: 일반 사용자 (KYC 인증 필요)
 * - PARTNER: 파트너 (대량 할인 적용)
 * - ADMIN: 관리자 (전체 접근)
 *
 * 사용법:
 * @UseGuards(AuthGuard('jwt'), RolesGuard)
 * @Roles('ADMIN')
 *
 * NOTE: JWT 인증 가드와 함께 사용 필수 (user 정보 필요)
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * 역할 메타데이터 설정 데코레이터
 *
 * @param roles - 허용할 역할 목록 (예: 'ADMIN', 'PARTNER')
 * @returns 메타데이터 설정 데코레이터
 *
 * @example
 * @Roles('ADMIN', 'PARTNER')
 * @Get('protected')
 * getProtected() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

/**
 * 역할 기반 접근 제어 가드
 *
 * 동작 흐름:
 * 1. 핸들러의 @Roles 메타데이터 조회
 * 2. 역할 지정 없으면 접근 허용
 * 3. request.user.role이 허용 역할에 포함되는지 확인
 * 4. 불일치 시 403 Forbidden 응답
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 핸들러 또는 컨트롤러 클래스에 지정된 역할 메타데이터 조회
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // @Roles 데코레이터 없으면 모든 인증된 사용자 허용
    if (!roles) {
      return true;
    }

    // HTTP 요청에서 user 정보 추출 (JWT 가드가 주입)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 사용자 없거나 역할 불일치 시 접근 거부
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
